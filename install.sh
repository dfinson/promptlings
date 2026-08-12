#!/usr/bin/env bash
set -euo pipefail

# promptlings installer (Linux/macOS)
#
# Installs selected agent files into your assistant's agents directory.
#
# This script does NOT modify any global instruction file by default. The session-handoff
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
READSIDE_PATH="agents/context/session-handoff-read-side.md"
READSIDE_MARKER="session-handoff-read-side-start"

ALL_AGENTS="the-nitcracker pr-walkthrough session-handoff technical-demo bmad-orchestrator speckit-flow"
REVIEW_AGENTS="the-nitcracker pr-walkthrough"

agent_path() {
  case "$1" in
    pr-walkthrough)    echo "agents/code-review/pr-walkthrough.agent.md" ;;
    the-nitcracker)    echo "agents/code-review/the-nitcracker.agent.md" ;;
    session-handoff)   echo "agents/context/session-handoff.agent.md" ;;
    technical-demo)    echo "agents/media/technical-demo.agent.md" ;;
    bmad-orchestrator) echo "agents/orchestration/bmad-orchestrator.agent.md" ;;
    speckit-flow)      echo "agents/orchestration/speckit-flow.agent.md" ;;
    *) return 1 ;;
  esac
}

usage() {
  cat <<'EOF'
promptlings installer

Usage: bash install.sh [options]

Selection (pick at most one):
  --review              Install the two code-review agents (the-nitcracker, pr-walkthrough)
  --all                 Install all six agents
  --agents a,b,c        Install agents by name (comma separated)
  --list                Print available agent names and exit

Behavior:
  --dry-run             Print every path that would be written, write nothing
  --yes                 Skip the confirmation prompt
  --with-readside       Also append the session-handoff read-side block to your GLOBAL
                        instruction file. Requires the session-handoff agent. This changes
                        assistant behavior in every future session in every repository.
  --help                Print this message and exit

With no selection flag, an interactive run asks which set you want. A non-interactive run
(a piped one-liner) installs the two code-review agents and prints how to ask for more.

Files written by default: one .agent.md per selected agent, under ~/.copilot/agents/ and/or
~/.claude/agents/. Nothing outside those directories is touched unless --with-readside is
given or you confirm the read-side prompt.
EOF
}

# ----- argument parsing -----

selection=""
selection_source=""
dry_run=0
assume_yes=0
want_readside=0

set_selection() {
  if [ -n "$selection_source" ]; then
    echo "Error: $1 conflicts with $selection_source. Pick one selection flag." >&2
    exit 2
  fi
  selection_source="$1"
  selection="$2"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --review) set_selection "--review" "$REVIEW_AGENTS" ;;
    --all)    set_selection "--all" "$ALL_AGENTS" ;;
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
    --list)
      for a in $ALL_AGENTS; do echo "$a"; done
      exit 0
      ;;
    --dry-run) dry_run=1 ;;
    --yes|-y)  assume_yes=1 ;;
    --with-readside) want_readside=1 ;;
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

if [ -z "$selection" ]; then
  if [ "$interactive" -eq 1 ]; then
    echo "Which agents do you want?"
    echo "  1) The two code-review agents: the-nitcracker, pr-walkthrough (default)"
    echo "  2) All six agents"
    echo "  3) Cancel"
    printf 'Choice [1]: '
    read -r choice || choice=""
    case "${choice:-1}" in
      1|"") selection="$REVIEW_AGENTS" ;;
      2)    selection="$ALL_AGENTS" ;;
      *)    echo "Cancelled. Nothing was written."; exit 0 ;;
    esac
  else
    selection="$REVIEW_AGENTS"
    echo "No selection flag and no terminal to ask on, so defaulting to the two code-review agents."
    echo "For everything else, download the script and pass a flag:"
    echo "  curl -fsSL $BASE_URL/install.sh -o install.sh"
    echo "  bash install.sh --all          # all six agents"
    echo "  bash install.sh --list         # available agent names"
    echo ""
  fi
fi

# validate and de-duplicate
resolved=""
for a in $selection; do
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

if [ -z "$selection" ]; then
  echo "Error: no agents selected." >&2
  exit 2
fi

selection_has_session_handoff=0
case " $selection " in
  *" session-handoff "*) selection_has_session_handoff=1 ;;
esac

if [ "$want_readside" -eq 1 ] && [ "$selection_has_session_handoff" -eq 0 ]; then
  echo "Error: --with-readside only makes sense alongside the session-handoff agent." >&2
  echo "Try: bash install.sh --agents session-handoff --with-readside" >&2
  exit 2
fi

# ----- detect targets -----

targets=""
copilot_dir="$HOME/.copilot/agents"
claude_dir="$HOME/.claude/agents"
copilot_selected=0
claude_selected=0

if [ -d "$HOME/.copilot" ] || command -v copilot >/dev/null 2>&1 \
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
  if [ "$readside_copilot" -eq 1 ]; then printf '%s\n' "$HOME/.copilot/copilot-instructions.md"; fi
  if [ "$readside_claude" -eq 1 ]; then printf '%s\n' "$HOME/.claude/CLAUDE.md"; fi
}
if [ "$want_readside" -eq 1 ] || { [ "$selection_has_session_handoff" -eq 1 ] && [ "$interactive" -eq 1 ]; }; then
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

echo "Plan"
echo "===="
echo "Source: $BASE_URL"
echo ""
echo "Directories created if missing:"
if [ "$copilot_selected" -eq 1 ]; then echo "  $copilot_dir"; fi
if [ "$claude_selected" -eq 1 ]; then echo "  $claude_dir"; fi
echo ""
echo "Files written ($agent_count agent(s) per directory, overwritten if present):"
plan_files() {
  for a in $selection; do
    echo "  $1/$a.agent.md"
  done
}
if [ "$copilot_selected" -eq 1 ]; then plan_files "$copilot_dir"; fi
if [ "$claude_selected" -eq 1 ]; then plan_files "$claude_dir"; fi
echo ""

if [ "$want_readside" -eq 1 ]; then
  echo "Global instruction files appended to (opt-in via --with-readside):"
  readside_each | while IFS= read -r f; do
    echo "  $f"
  done
  echo ""
  echo "  The appended block instructs EVERY future session in EVERY repository to read your"
  echo "  session-handoff files before doing anything else, including before answering a"
  echo "  question or searching the codebase. It is added once, marked with"
  echo "  '$READSIDE_MARKER', and nothing existing is removed."
  echo ""
elif [ -n "$(readside_each)" ]; then
  echo "Global instruction files: you will be asked, after the agents are installed, whether to"
  echo "append the session-handoff read-side block to:"
  readside_each | while IFS= read -r f; do
    echo "  $f"
  done
  echo ""
  echo "  Answering no leaves them untouched. Nothing is written without that answer."
  echo ""
else
  echo "Global instruction files modified: none."
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
  echo "Installing to $1"
  mkdir -p "$1"
  for a in $selection; do
    echo "  $a.agent.md"
    download "$(agent_path "$a")" "$1/$a.agent.md"
  done
}
if [ "$copilot_selected" -eq 1 ]; then install_to "$copilot_dir"; fi
if [ "$claude_selected" -eq 1 ]; then install_to "$claude_dir"; fi

echo ""
echo "Installed $agent_count agent(s). Restart your assistant to pick them up."

# ----- read-side block, opt-in only -----

append_readside() {
  local instr_file="$1"
  local block="$2"
  if [ -f "$instr_file" ] && grep -qF "$READSIDE_MARKER" "$instr_file" 2>/dev/null; then
    echo "  Already present in $instr_file. Skipping."
    return 0
  fi
  mkdir -p "$(dirname "$instr_file")"
  printf '\n%s\n' "$block" >> "$instr_file"
  echo "  Appended to $instr_file"
}

readside_enable_hint() {
  echo "To enable it later, run:"
  echo "  curl -fsSL $BASE_URL/install.sh -o install.sh"
  echo "  bash install.sh --agents session-handoff --with-readside"
  echo "Or add it by hand: see the Read-Side Setup section of"
  echo "  $BASE_URL/agents/context/session-handoff.agent.md"
}

if [ "$selection_has_session_handoff" -eq 1 ]; then
  echo ""
  proceed_readside=0

  if [ "$want_readside" -eq 1 ]; then
    proceed_readside=1
  elif [ "$interactive" -eq 1 ]; then
    echo "session-handoff needs a companion read-side instruction so that future sessions load"
    echo "the context it persisted. Enabling it appends a block to:"
    readside_each | while IFS= read -r f; do
      echo "  $f"
    done
    echo ""
    echo "That block applies to EVERY future session in EVERY repository, not just this one. It"
    echo "instructs your assistant to read the session-handoff files before doing anything else,"
    echo "including before answering a question or searching the codebase."
    echo ""
    printf 'Append it now? [y/N]: '
    read -r reply || reply=""
    case "$reply" in
      y|Y|yes|Yes|YES) proceed_readside=1 ;;
      *) proceed_readside=0 ;;
    esac
  else
    echo "Skipping the session-handoff read-side block: it modifies a global instruction file"
    echo "that affects every future session in every repository, and there is no terminal here"
    echo "to confirm on."
    readside_enable_hint
    proceed_readside=0
  fi

  if [ "$proceed_readside" -eq 1 ]; then
    echo ""
    echo "Fetching $READSIDE_PATH ..."
    readside_block="$(curl -fsSL "$BASE_URL/$READSIDE_PATH" || true)"
    if [ -z "$readside_block" ]; then
      echo "Warning: failed to fetch $READSIDE_PATH. Nothing was appended." >&2
      readside_enable_hint
    else
      readside_each | while IFS= read -r f; do
        append_readside "$f" "$readside_block"
      done
    fi
  elif [ "$interactive" -eq 1 ] && [ "$want_readside" -eq 0 ]; then
    echo ""
    echo "Left your global instruction files untouched."
    readside_enable_hint
  fi
fi
