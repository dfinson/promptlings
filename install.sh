#!/usr/bin/env bash
set -euo pipefail

# promptlings installer (Linux/macOS)
#
# Installs selected agents and skills into your assistant's agents and skills directories.
#
# This script does NOT modify any global instruction file by default. The memory-manager
# read-side block changes how your assistant behaves in every future session in every
# repository, so it is opt-in only, via --with-readside or an explicit interactive
# confirmation. See --help.
#
# Recommended usage (read the script before running it):
#   curl -fsSL https://raw.githubusercontent.com/dfinson/promptlings/main/install.sh -o install.sh
#   less install.sh
#   bash install.sh --review

REPO="dfinson/promptlings"
BRANCH="main"
BASE_URL="https://raw.githubusercontent.com/$REPO/$BRANCH"
READSIDE_PATH="agents/context/memory-manager-read-side.md"
BMAD_BOOTSTRAP_PATH="skills/promptlings-bmad-bootstrap"
BMAD_BOOTSTRAP_MARKER="promptlings-bmad-bootstrap-start"

ALL_AGENTS="the-nitcracker pr-walkthrough memory-manager technical-demo bmad-orchestrator speckit-flow"
ALL_SKILLS="reasoning-first-narration tts-setup cue-synced-demo promptlings-bmad-setup promptlings-bmad-bootstrap"
REVIEW_AGENTS="the-nitcracker pr-walkthrough"

agent_path() {
  case "$1" in
    pr-walkthrough)    echo "agents/code-review/pr-walkthrough.agent.md" ;;
    the-nitcracker)    echo "agents/code-review/the-nitcracker.agent.md" ;;
    memory-manager)    echo "agents/context/memory-manager.agent.md" ;;
    technical-demo)    echo "agents/media/technical-demo.agent.md" ;;
    bmad-orchestrator) echo "agents/orchestration/bmad-orchestrator.agent.md" ;;
    speckit-flow)      echo "agents/orchestration/speckit-flow.agent.md" ;;
    *) return 1 ;;
  esac
}

skill_path() {
  case "$1" in
    reasoning-first-narration) echo "skills/reasoning-first-narration/SKILL.md" ;;
    tts-setup) echo "skills/tts-setup/SKILL.md" ;;
    cue-synced-demo) echo "skills/cue-synced-demo/SKILL.md" ;;
    promptlings-bmad-setup) echo "skills/promptlings-bmad-setup/SKILL.md" ;;
    promptlings-bmad-bootstrap) echo "skills/promptlings-bmad-bootstrap/SKILL.md" ;;
    *) return 1 ;;
  esac
}

skill_files() {
  case "$1" in
    reasoning-first-narration|tts-setup|cue-synced-demo|promptlings-bmad-setup) echo "SKILL.md" ;;
    promptlings-bmad-bootstrap) printf '%s\n' "SKILL.md" "startup.md" ;;
    *) return 1 ;;
  esac
}

agent_skills() {
  case "$1" in
    technical-demo) echo "reasoning-first-narration tts-setup cue-synced-demo" ;;
    bmad-orchestrator) echo "promptlings-bmad-setup promptlings-bmad-bootstrap" ;;
  esac
}

usage() {
  cat <<'EOF'
promptlings installer

Usage: bash install.sh [options]

Selection (pick at most one):
  --review              Install the two code-review agents (the-nitcracker, pr-walkthrough)
  --all                 Install all agents and skills
  --agents a,b,c        Install agents by name (comma separated)
  --skills a,b          Install skills by name (comma separated, also --skills=a,b)
  --list                Print available agent and skill names and exit

Behavior:
  --dry-run             Print every path that would be written, write nothing
  --yes                 Skip the confirmation prompt
  --with-readside       Install or replace the managed memory read-side block in your GLOBAL
                        instruction file. Requires memory-manager. This changes
                        assistant behavior in every future session in every repository.
                        Migrate legacy handoff data before replacing its read-side block.
  --with-bmad-bootstrap Append the BMAD startup block to selected hosts' GLOBAL instruction
                        files, once. Requires bmad-orchestrator. No additional opt-in prompt.
  --help                Print this message and exit

With no selection flag, an interactive run asks which set you want. A non-interactive run
(a piped one-liner) installs the two code-review agents and prints how to ask for more.

Files written by default: one .agent.md per selected agent, under ~/.copilot/agents/ and/or
~/.claude/agents/, and one <name>/SKILL.md per selected skill, under ~/.copilot/skills/ and/or
~/.claude/skills/, including companion Markdown. technical-demo also selects its three companions.
bmad-orchestrator selects promptlings-bmad-setup and promptlings-bmad-bootstrap.
No global instruction file is changed unless
--with-bmad-bootstrap or --with-readside is given or you confirm the read-side prompt.
COPILOT_HOME overrides the Copilot root for agent, skill, and opted-in instruction paths.

session-handoff is a deprecated selection alias for memory-manager. Existing agent files
and legacy handoff data are never deleted. Basic Memory setup is performed by the agent.
EOF
}

# ----- argument parsing -----

selection=""
skill_selection=""
selection_source=""
dry_run=0
assume_yes=0
want_readside=0
want_bmad_bootstrap=0

set_selection() {
  if [ -n "$selection_source" ]; then
    echo "Error: $1 conflicts with $selection_source. Pick one selection flag." >&2
    exit 2
  fi
  selection_source="$1"
  if [ "$1" = "--skills" ]; then
    skill_selection="$2"
  else
    selection="$2"
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --review) set_selection "--review" "$REVIEW_AGENTS" ;;
    --all)    set_selection "--all" "$ALL_AGENTS"; skill_selection="$ALL_SKILLS" ;;
    --agents)
      if [ "$#" -lt 2 ]; then
        echo "Error: --agents requires a comma separated list of agent names." >&2
        exit 2
      fi
      set_selection "--agents" "$(echo "$2" | tr ',' ' ')"
      shift
      ;;
    --agents=*)
      set_selection "--agents" "$(echo "${1#--agents=}" | tr ',' ' ')"
      ;;
    --skills)
      if [ "$#" -lt 2 ]; then
        echo "Error: --skills requires a comma separated list of skill names." >&2
        exit 2
      fi
      set_selection "--skills" "$(echo "$2" | tr ',' ' ')"
      shift
      ;;
    --skills=*)
      set_selection "--skills" "$(echo "${1#--skills=}" | tr ',' ' ')"
      ;;
    --list)
      echo "Agents:"
      for a in $ALL_AGENTS; do echo "$a"; done
      echo ""
      echo "Skills:"
      for s in $ALL_SKILLS; do echo "$s"; done
      exit 0
      ;;
    --dry-run) dry_run=1 ;;
    --yes|-y)  assume_yes=1 ;;
    --with-readside) want_readside=1 ;;
    --with-bmad-bootstrap) want_bmad_bootstrap=1 ;;
    --help|-h) usage; exit 0 ;;
    *)
      echo "Error: unknown option '$1'. Run with --help." >&2
      exit 2
      ;;
  esac
  shift
done

# ----- interactivity -----
#
# Interactive means the script was invoked as a file on disk AND stdin is a terminal.
# `curl ... | bash` satisfies neither, so it can never prompt and never silently opts in
# to anything.

script_is_file=0
if [ -f "${BASH_SOURCE[0]:-}" ]; then
  script_is_file=1
fi

interactive=0
if [ "$script_is_file" -eq 1 ] && [ -t 0 ]; then
  interactive=1
fi

# ----- resolve the selection -----

if [ -z "$selection_source" ]; then
  if [ "$interactive" -eq 1 ]; then
    echo "Which agents and skills do you want?"
    echo "  1) The two code-review agents: the-nitcracker, pr-walkthrough (default)"
    echo "  2) All agents and skills"
    echo "  3) Cancel"
    printf 'Choice [1]: '
    read -r choice || choice=""
    case "${choice:-1}" in
      1|"") selection="$REVIEW_AGENTS" ;;
      2)    selection="$ALL_AGENTS"; skill_selection="$ALL_SKILLS" ;;
      *)    echo "Cancelled. Nothing was written."; exit 0 ;;
    esac
  else
    selection="$REVIEW_AGENTS"
    echo "No selection flag and no terminal to ask on, so defaulting to the two code-review agents."
    echo "For everything else, download the script and pass a flag:"
    echo "  curl -fsSL $BASE_URL/install.sh -o install.sh"
    echo "  bash install.sh --all          # all agents and skills"
    echo "  bash install.sh --list         # available agent and skill names"
    echo ""
  fi
fi

# validate and de-duplicate
resolved=""
for a in $selection; do
  if [ "$a" = "session-handoff" ]; then
    echo "session-handoff is now memory-manager. Installing the canonical agent only."
    a="memory-manager"
  fi
  if ! agent_path "$a" >/dev/null 2>&1; then
    echo "Error: unknown agent '$a'. Run with --list to see valid names." >&2
    exit 2
  fi
  case " $resolved " in
    *" $a "*) ;;
    *) resolved="$resolved $a" ;;
  esac
done
selection="$(echo "$resolved" | sed 's/^ *//;s/ *$//')"

for a in $selection; do
  skill_selection="$skill_selection $(agent_skills "$a")"
done

resolved=""
for s in $skill_selection; do
  if ! skill_path "$s" >/dev/null 2>&1; then
    echo "Error: unknown skill '$s'. Run with --list to see valid names." >&2
    exit 2
  fi
  case " $resolved " in
    *" $s "*) ;;
    *) resolved="$resolved $s" ;;
  esac
done
skill_selection="$(echo "$resolved" | sed 's/^ *//;s/ *$//')"

if [ -z "$selection" ] && [ -z "$skill_selection" ]; then
  echo "Error: Nothing selected." >&2
  exit 2
fi

selection_has_bmad=0
selection_has_memory_manager=0
case " $selection " in
  *" memory-manager "*) selection_has_memory_manager=1 ;;
esac
case " $selection " in
  *" bmad-orchestrator "*) selection_has_bmad=1 ;;
esac

if [ "$want_readside" -eq 1 ] && [ "$selection_has_memory_manager" -eq 0 ]; then
  echo "Error: --with-readside only makes sense alongside the memory-manager agent." >&2
  echo "Try: bash install.sh --agents memory-manager --with-readside" >&2
  exit 2
fi
if [ "$want_bmad_bootstrap" -eq 1 ] && [ "$selection_has_bmad" -eq 0 ]; then
  echo "Error: --with-bmad-bootstrap requires the bmad-orchestrator agent." >&2
  exit 2
fi

# ----- detect targets -----

targets=""
copilot_root="${COPILOT_HOME:-$HOME/.copilot}"
case "$copilot_root" in
  /*|[A-Za-z]:[\\/]* ) ;;
  *) copilot_root="$PWD/$copilot_root" ;;
esac
copilot_dir="$copilot_root/agents"
claude_dir="$HOME/.claude/agents"
copilot_skills_dir="$copilot_root/skills"
claude_skills_dir="$HOME/.claude/skills"
copilot_selected=0
claude_selected=0

if [ -n "${COPILOT_HOME:-}" ] || [ -d "$copilot_root" ] || command -v copilot >/dev/null 2>&1 \
  || { command -v gh >/dev/null 2>&1 && gh copilot --version >/dev/null 2>&1; }; then
  targets="set"
  copilot_selected=1
fi

if [ -d "$HOME/.claude" ] || command -v claude >/dev/null 2>&1; then
  targets="set"
  claude_selected=1
fi

if [ -z "$targets" ]; then
  echo "No supported assistant detected. Defaulting to the GitHub Copilot CLI location."
  echo ""
  targets="set"
  copilot_selected=1
fi

readside_copilot=0
readside_claude=0
readside_each() {
  if [ "$readside_copilot" -eq 1 ]; then printf '%s\n' "$copilot_root/copilot-instructions.md"; fi
  if [ "$readside_claude" -eq 1 ]; then printf '%s\n' "$HOME/.claude/CLAUDE.md"; fi
}
if [ "$want_readside" -eq 1 ] || { [ "$selection_has_memory_manager" -eq 1 ] && [ "$interactive" -eq 1 ]; }; then
  if [ "$copilot_selected" -eq 1 ]; then
    readside_copilot=1
  fi
  if [ "$claude_selected" -eq 1 ]; then
    readside_claude=1
  fi
fi

# ----- print the plan before writing anything -----

agent_count=0
for a in $selection; do agent_count=$((agent_count + 1)); done
skill_count=0
for s in $skill_selection; do skill_count=$((skill_count + 1)); done
skill_file_count=0
for s in $skill_selection; do
  for f in $(skill_files "$s"); do skill_file_count=$((skill_file_count + 1)); done
done

echo "Plan"
echo "===="
echo "Source: $BASE_URL"
echo ""
echo "Agent directories created if missing ($agent_count agent(s) per directory):"
if [ "$agent_count" -gt 0 ]; then
  if [ "$copilot_selected" -eq 1 ]; then echo "  $copilot_dir"; fi
  if [ "$claude_selected" -eq 1 ]; then echo "  $claude_dir"; fi
fi
echo ""
echo "Agent files written ($agent_count agent(s) per directory, overwritten if present):"
plan_files() {
  for a in $selection; do
    echo "  $1/$a.agent.md"
  done
}
if [ "$copilot_selected" -eq 1 ]; then plan_files "$copilot_dir"; fi
if [ "$claude_selected" -eq 1 ]; then plan_files "$claude_dir"; fi
echo ""
echo "Skill directories created if missing ($skill_count skill(s) per tool):"
plan_skill_dirs() {
  if [ "$skill_count" -gt 0 ]; then
    echo "  $1"
    for s in $skill_selection; do
      echo "  $1/$s"
    done
  fi
}
if [ "$copilot_selected" -eq 1 ]; then plan_skill_dirs "$copilot_skills_dir"; fi
if [ "$claude_selected" -eq 1 ]; then plan_skill_dirs "$claude_skills_dir"; fi
echo ""
echo "Skill files written ($skill_count skill(s), $skill_file_count file(s) per tool, overwritten if present):"
plan_skill_files() {
  for s in $skill_selection; do
    for f in $(skill_files "$s"); do echo "  $1/$s/$f"; done
  done
}
if [ "$copilot_selected" -eq 1 ]; then plan_skill_files "$copilot_skills_dir"; fi
if [ "$claude_selected" -eq 1 ]; then plan_skill_files "$claude_skills_dir"; fi
echo ""

if [ "$want_readside" -eq 1 ]; then
  echo "Global instruction files updated (opt-in via --with-readside):"
  readside_each | while IFS= read -r f; do
    echo "  $f"
  done
  echo ""
  echo "  The block enables scoped Basic Memory recall and session capture in future sessions."
  echo "  Existing memory-manager or legacy session-handoff marked blocks are replaced."
  echo "  Unrelated instructions and handoff data are preserved. Migrate legacy data first."
  echo ""
elif [ -n "$(readside_each)" ]; then
  echo "Global instruction files: you will be asked, after the agents are installed, whether to"
  echo "install or replace the managed memory read-side block in:"
  readside_each | while IFS= read -r f; do
    echo "  $f"
  done
  echo ""
  echo "  Answering no leaves them untouched. Nothing is written without that answer."
  echo ""
elif [ "$want_bmad_bootstrap" -eq 0 ]; then
  echo "Global instruction files modified: none."
  echo ""
fi
if [ "$want_bmad_bootstrap" -eq 1 ]; then
  echo "Global instruction files appended to (opt-in via --with-bmad-bootstrap):"
  if [ "$copilot_selected" -eq 1 ]; then echo "  $copilot_root/copilot-instructions.md"; fi
  if [ "$claude_selected" -eq 1 ]; then echo "  $HOME/.claude/CLAUDE.md"; fi
  echo "  Appends startup.md once, marked with '$BMAD_BOOTSTRAP_MARKER'; preserves existing contents."
  echo ""
fi

if [ "$dry_run" -eq 1 ]; then
  echo "Dry run. Nothing was written."
  exit 0
fi

if [ "$interactive" -eq 1 ] && [ "$assume_yes" -eq 0 ]; then
  printf 'Proceed? [y/N]: '
  read -r reply || reply=""
  case "$reply" in
    y|Y|yes|Yes|YES) ;;
    *) echo "Cancelled. Nothing was written."; exit 0 ;;
  esac
  echo ""
fi

# ----- install -----

download() {
  # download REMOTE_PATH DEST: write to a temp file first so a failed fetch cannot
  # truncate a file that is already installed.
  local remote="$1"
  local dest="$2"
  local tmp
  tmp="$(mktemp "${dest}.XXXXXX")"
  if curl -fsSL "$BASE_URL/$remote" -o "$tmp"; then
    mv "$tmp" "$dest"
  else
    rm -f "$tmp"
    echo "Error: failed to download $remote" >&2
    return 1
  fi
}

install_to() {
  if [ "$agent_count" -eq 0 ]; then return 0; fi
  echo "Installing to $1"
  mkdir -p "$1"
  for a in $selection; do
    echo "  $a.agent.md"
    download "$(agent_path "$a")" "$1/$a.agent.md"
  done
}
if [ "$copilot_selected" -eq 1 ]; then install_to "$copilot_dir"; fi
if [ "$claude_selected" -eq 1 ]; then install_to "$claude_dir"; fi
install_skills_to() {
  if [ "$skill_count" -eq 0 ]; then return 0; fi
  echo "Installing skills to $1"
  for s in $skill_selection; do
    for f in $(skill_files "$s"); do
      mkdir -p "$(dirname "$1/$s/$f")"
      echo "  $s/$f"
      download "skills/$s/$f" "$1/$s/$f"
    done
  done
}
if [ "$copilot_selected" -eq 1 ]; then install_skills_to "$copilot_skills_dir"; fi
if [ "$claude_selected" -eq 1 ]; then install_skills_to "$claude_skills_dir"; fi

append_bmad_bootstrap() {
  local instr_file="$1"
  local startup="$(dirname "$instr_file")/$BMAD_BOOTSTRAP_PATH/startup.md"
  if [ -f "$instr_file" ]; then
    local signature
    signature="$(od -An -tx1 -N4 "$instr_file" | tr -d '[:space:]')"
    case "$signature" in
      fffe*|feff*|0000feff*)
        echo "Error: UTF-16 or UTF-32 instruction file: $instr_file. Convert it to UTF-8 before enabling BMAD bootstrap. Nothing was appended." >&2
        return 1
        ;;
    esac
  fi
  if [ -f "$instr_file" ] && grep -qF "$BMAD_BOOTSTRAP_MARKER" "$instr_file"; then
    echo "  Already present in $instr_file. Skipping."
    return 0
  fi
  if [ ! -s "$startup" ] || ! grep -qF "$BMAD_BOOTSTRAP_MARKER" "$startup"; then
    echo "Error: invalid BMAD startup block: $startup. Nothing was appended to $instr_file." >&2
    return 1
  fi
  { printf '\n'; cat "$startup"; printf '\n'; } >> "$instr_file"
  echo "  Appended to $instr_file"
}
if [ "$want_bmad_bootstrap" -eq 1 ]; then
  if [ "$copilot_selected" -eq 1 ]; then append_bmad_bootstrap "$copilot_root/copilot-instructions.md"; fi
  if [ "$claude_selected" -eq 1 ]; then append_bmad_bootstrap "$HOME/.claude/CLAUDE.md"; fi
fi

echo ""
echo "Installed $agent_count agent(s) and $skill_count skill(s) per tool. Restart your assistant to pick them up."

# ----- read-side block, opt-in only -----

set_readside() {
  local instr_file="$1"
  local block="$2"
  local first last marker_count tmp
  first="$(printf '%s\n' "$block" | sed -n '1{s/\r$//;p;}')"
  last="$(printf '%s\n' "$block" | sed -n '${s/\r$//;p;}')"
  marker_count="$(printf '%s\n' "$block" | awk '/^<!-- (session-handoff|memory-manager)-read-side-(start|end) -->\r?$/ { n++ } END { print n+0 }')"
  if [ "$first" != "<!-- memory-manager-read-side-start -->" ] \
    || [ "$last" != "<!-- memory-manager-read-side-end -->" ] || [ "$marker_count" -ne 2 ]; then
    echo "Error: invalid downloaded memory read-side block. $instr_file was not changed." >&2
    return 1
  fi
  mkdir -p "$(dirname "$instr_file")"
  tmp="$(mktemp "${instr_file}.XXXXXX")"
  # Feed the block as data, not an awk -v value that interprets backslash escapes.
  if { printf '%s\n' "$block"; if [ -f "$instr_file" ]; then cat "$instr_file"; fi; } | awk -v BINMODE=3 '
    function fail() { bad=1; exit 1 }
    !block_done {
      line=$0; sub(/\r$/, "", line)
      block = block line ORS
      if (line == "<!-- memory-manager-read-side-end -->") block_done=1
      next
    }
    {
      line=$0; sub(/\r$/, "", line)
      if (line ~ /^<!-- (session-handoff|memory-manager)-read-side-start -->$/) {
        if (open != "") fail()
        open = (line ~ /session-handoff/) ? "session-handoff" : "memory-manager"
        if (!inserted) { printf "%s", block; inserted=1 }
        next
      }
      if (line ~ /^<!-- (session-handoff|memory-manager)-read-side-end -->$/) {
        family = (line ~ /session-handoff/) ? "session-handoff" : "memory-manager"
        if (open != family) fail()
        open=""
        next
      }
      if (open == "") print
    }
    END {
      if (bad || open != "") exit 1
      if (!inserted) printf "%s", block
    }
  ' > "$tmp"; then
    if [ -f "$instr_file" ] && cmp -s "$tmp" "$instr_file"; then
      rm -f "$tmp"
      echo "  Already current in $instr_file."
    else
      if [ -f "$instr_file" ]; then chmod "$(stat -c '%a' "$instr_file" 2>/dev/null || stat -f '%Lp' "$instr_file")" "$tmp"; fi
      mv "$tmp" "$instr_file"
      echo "  Updated managed memory instructions in $instr_file."
    fi
  else
    rm -f "$tmp"
    echo "Error: unmatched or nested memory markers in $instr_file. Original instructions were not changed." >&2
    return 1
  fi
}

readside_enable_hint() {
  echo "To enable it later, run:"
  echo "  curl -fsSL $BASE_URL/install.sh -o install.sh"
  echo "  bash install.sh --agents memory-manager --with-readside"
  echo "Or add it by hand: see Completion and setup instructions in"
  echo "  $BASE_URL/agents/context/memory-manager.agent.md"
}

if [ "$selection_has_memory_manager" -eq 1 ]; then
  echo "Legacy Session Handoff, Context Manager, or Memory Maintainer agent files are not removed."
  echo "After migration, review and retire obsolete agents manually. Run Memory Manager setup"
  echo "to configure Basic Memory projects and routing. The installer does not create them."
  echo ""
  proceed_readside=0

  if [ "$want_readside" -eq 1 ]; then
    proceed_readside=1
  elif [ "$interactive" -eq 1 ]; then
    echo "Memory Manager has a companion read-side instruction for future sessions."
    echo "Enabling it installs or replaces managed memory blocks in:"
    readside_each | while IFS= read -r f; do
      echo "  $f"
    done
    echo ""
    echo "That block applies to EVERY future session in EVERY repository, not just this one. It"
    echo "replaces legacy handoff instructions, not the data. Migrate that data first."
    echo ""
    printf 'Update it now? [y/N]: '
    read -r reply || reply=""
    case "$reply" in
      y|Y|yes|Yes|YES) proceed_readside=1 ;;
      *) proceed_readside=0 ;;
    esac
  else
    echo "Skipping the memory-manager read-side block: it modifies a global instruction file"
    echo "that affects every future session in every repository, and there is no terminal here"
    echo "to confirm on."
    readside_enable_hint
    proceed_readside=0
  fi

  if [ "$proceed_readside" -eq 1 ]; then
    echo ""
    echo "Fetching $READSIDE_PATH ..."
    if ! readside_block="$(curl -fsSL "$BASE_URL/$READSIDE_PATH")"; then
      echo "Error: failed to fetch $READSIDE_PATH. Global instructions were not changed." >&2
      exit 1
    fi
    if [ -z "$readside_block" ]; then
      echo "Error: empty download for $READSIDE_PATH. Global instructions were not changed." >&2
      exit 1
    else
      readside_each | while IFS= read -r f; do
        set_readside "$f" "$readside_block"
      done
    fi
  elif [ "$interactive" -eq 1 ] && [ "$want_readside" -eq 0 ]; then
    echo ""
    echo "Left your global instruction files untouched."
    readside_enable_hint
  fi
fi
