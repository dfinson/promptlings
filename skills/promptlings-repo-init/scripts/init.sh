#!/usr/bin/env bash
set -euo pipefail

# Keep these versions identical to the pins in install.sh and install.ps1.
BMAD_VERSION=6.12.4
SPECKIT_VERSION=1.2.5

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project="" methods="" shared_frameworks=0 integration=copilot check_only=0
fail() { echo "Initialization incomplete: $*" >&2; exit 1; }
value() { [ "$#" -ge 2 ] && [ -n "$2" ] && [[ "$2" != --* ]] || fail "$1 requires a value."; }
while [ "$#" -gt 0 ]; do
  case "$1" in
    --project) value "$@"; project="$2"; shift ;;
    --method) value "$@"; methods="$methods $2"; shift ;;
    --shared-frameworks) shared_frameworks=1 ;;
    --integration) value "$@"; integration="$2"; shift ;;
    --check-only) check_only=1 ;;
    --help|-h)
      echo "Initialize the bound method in this working copy: bash init.sh"
      echo "Options: --project PATH, --method bmad|speckit (repeatable), --shared-frameworks, --integration copilot|claude, --check-only"
      exit 0 ;;
    *) fail "Unknown option: $1. Use --help." ;;
  esac
  shift
done
[[ "$integration" == copilot || "$integration" == claude ]] || fail "Integration must be copilot or claude."
if [ -z "$project" ]; then
  project="$(git rev-parse --show-toplevel)" || fail "Run inside a Git working copy or pass --project."
fi
project="$(cd "$project" && pwd)"
if [ -z "$methods" ]; then
  methods="$(git -C "$project" config --get promptlings.method || true)"
  [ -n "$methods" ] || fail "Repository is not bound to a method. Set promptlings.method with the user's agreement, or pass --method."
  [[ "$methods" == bmad || "$methods" == speckit ]] || fail "Unknown promptlings.method: $methods."
fi
bmad=0 speckit=0
for method in $methods; do
  case "$method" in
    bmad) bmad=1 ;;
    speckit) speckit=1 ;;
    *) fail "Unknown method: $method." ;;
  esac
done
label="$(echo $methods)"

# Validates the repository root and promptlings-managed blocks before anything is written.
top="$(git -C "$project" rev-parse --show-toplevel)" || fail "--project must name a Git repository."
[ "$(cd "$top" && pwd -P)" = "$(cd "$project" && pwd -P)" ] ||
  fail "--project must name the Git repository or linked worktree root."
# Linked worktrees resolve to the common Git directory, so these rules cover every working copy.
exclude="$(git -C "$project" rev-parse --path-format=absolute --git-path info/exclude)"
if [ -f "$exclude" ]; then
  for name in personal bmad speckit; do
    start="$(grep -nFx -- "# promptlings $name start" "$exclude" | cut -d: -f1 || true)"
    end="$(grep -nFx -- "# promptlings $name end" "$exclude" | cut -d: -f1 || true)"
    if [ -n "$start$end" ] && { [[ "$start" == *$'\n'* || "$end" == *$'\n'* ]] ||
      [ -z "$start" ] || [ -z "$end" ] || [ "$start" -ge "$end" ]; }; then
      fail "Malformed promptlings $name exclusion block in $exclude. Existing rules were not changed."
    fi
  done
fi
# Installation is skipped for an existing directory, so a directory without its marker cannot self-repair.
for partial in "$bmad _bmad config.toml" "$speckit .specify integration.json"; do
  set -- $partial
  if [ "$1" -eq 1 ] && [ -e "$project/$2" ] && [ ! -f "$project/$2/$3" ]; then
    fail "Partial framework installation: $2 exists without $2/$3 in $project. Ask the user to remove $2, then rerun."
  fi
done
[ "$check_only" -eq 0 ] || exit 0

# Initialization uses installed tools only. The machine installer owns installing them.
if [ "$bmad" -eq 1 ]; then
  [[ "$(bmad-method --version)" == *"$BMAD_VERSION"* ]] ||
    fail "BMAD $BMAD_VERSION is required. Run the promptlings machine installer."
fi
if [ "$speckit" -eq 1 ]; then
  [[ "$(specify version)" == *"$SPECKIT_VERSION"* ]] ||
    fail "Spec Kit $SPECKIT_VERSION is required. Run the promptlings machine installer."
  workflow="$(dirname "$here")/workflows/promptlings-delivery.yml"
  [ -f "$workflow" ] || fail "Missing bundled workflow: $workflow."
fi

exclude_block() {
  local start="# promptlings $1 start" end="# promptlings $1 end"
  shift
  touch "$exclude"
  awk -v s="$start" -v e="$end" '{ sub(/\r$/, "") } $0 == s { skip = 1 } !skip { print } $0 == e { skip = 0 }' \
    "$exclude" > "$exclude.promptlings"
  printf '%s\n' "$start" "$@" "$end" >> "$exclude.promptlings"
  mv "$exclude.promptlings" "$exclude"
}

# Exclusions land before any framework file is written.
framework=()
mkdir -p "$(dirname "$exclude")"
exclude_block personal /.claude/settings.local.json /CLAUDE.local.md
if [ "$bmad" -eq 1 ]; then
  rules=(/_bmad/config.user.toml '/_bmad/custom/*.user.toml' /_bmad/render/ '/_bmad/**/__pycache__/' .memlog.md)
  machinery=(/_bmad/ /_bmad-output/ '/.agents/skills/bmad-*/' '/.claude/skills/bmad-*/'
    '/.github/skills/bmad-*/' '/.github/agents/bmad-*.agent.md')
  framework+=("${machinery[@]}")
  [ "$shared_frameworks" -eq 1 ] || rules+=("${machinery[@]}")
  exclude_block bmad "${rules[@]}"
fi
if [ "$speckit" -eq 1 ]; then
  rules=(/.specify/feature.json /.specify/extensions/.cache/ /.specify/extensions/.backup/
    '/.specify/extensions/*/local-config.yml' '/.specify/extensions/*/*-config.local.yml')
  machinery=(/.specify/ /specs/ '/.github/skills/speckit-*/' '/.claude/skills/speckit-*/'
    '/.agents/skills/speckit-*/' '/.github/agents/speckit.*.agent.md'
    '/.github/prompts/speckit.*.prompt.md' '/.claude/commands/speckit.*.md')
  framework+=("${machinery[@]}")
  if [ "$shared_frameworks" -eq 0 ]; then
    rules+=("${machinery[@]}")
    if [ "$integration" = copilot ]; then context=.github/copilot-instructions.md; else context=CLAUDE.md; fi
    # Only reserve a generic instruction file when the framework creates it.
    for candidate in .github/copilot-instructions.md CLAUDE.md; do
      if grep -qFx "/$candidate" "$exclude" || { [ "$candidate" = "$context" ] && [ ! -e "$project/$candidate" ]; }; then
        rules+=("/$candidate"); framework+=("/$candidate")
      fi
    done
  fi
  exclude_block speckit "${rules[@]}"
fi

# Existing framework directories are not upgraded or regenerated.
if [ "$bmad" -eq 1 ] && [ ! -d "$project/_bmad" ]; then
  bmad-method install --directory "$project" --modules bmm --tools github-copilot,claude-code --yes
fi
if [ "$speckit" -eq 1 ]; then
  (
    cd "$project"
    if [ ! -d .specify ]; then
      options=()
      [ "$integration" != copilot ] || options+=(--integration-options=--skills)
      specify init --here --force --non-interactive --integration "$integration" --ignore-agent-tools ${options[@]+"${options[@]}"} </dev/null
    fi
    specify integration list
    specify workflow add "$workflow"
    specify workflow info promptlings-delivery >/dev/null
  )
fi

required=()
if [ "$bmad" -eq 1 ]; then
  required+=(_bmad/scripts/render_skill.py _bmad/_config/manifest.yaml _bmad/config.toml
    .agents/skills/bmad-build/SKILL.md .claude/skills/bmad-build/SKILL.md)
fi
if [ "$speckit" -eq 1 ]; then
  if [ "$integration" = copilot ]; then directory=.github/skills; else directory=.claude/skills; fi
  required+=(.specify/integration.json "$directory/speckit-specify/SKILL.md" "$directory/speckit-converge/SKILL.md"
    .specify/workflows/promptlings-delivery/workflow.yml)
fi
for relative in ${required[@]+"${required[@]}"}; do
  [ -f "$project/$relative" ] || fail "Framework installation is incomplete in $project: $relative."
done
if [ "$shared_frameworks" -eq 1 ]; then
  required=()
  [ "$bmad" -eq 0 ] || required+=(_bmad/config.toml)
  [ "$speckit" -eq 0 ] || required+=(.specify/memory/constitution.md specs/001-example/spec.md)
  for relative in ${required[@]+"${required[@]}"}; do
    if git -C "$project" check-ignore --no-index -q "$relative"; then
      fail "Shared framework path is ignored: $relative. Review existing Git exclusions."
    fi
  done
  echo "Initialized $label in $project. Shared framework files are eligible for tracking. Nothing was staged or committed."
  exit 0
fi
# Existing files expose rules, such as negations, that sample paths cannot.
pathspecs=()
for rule in ${framework[@]+"${framework[@]}"}; do
  rule="${rule#/}"
  case "$rule" in */) rule="$rule**" ;; esac
  pathspecs+=(":(glob)$rule")
done
if [ "${#pathspecs[@]}" -gt 0 ]; then
  leaks="$(git -C "$project" ls-files --others --exclude-standard -- "${pathspecs[@]}")"
  [ -z "$leaks" ] || fail "Local framework files are not ignored: $(printf '%s\n' "$leaks" | head -n 5 | paste -sd, - | sed 's/,/, /g'). Review existing Git exclusions, including negations."
fi
echo "Initialized $label in $project. Framework files are locally ignored. Nothing was staged or committed."
