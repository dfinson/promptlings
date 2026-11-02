#!/usr/bin/env bash
set -euo pipefail

source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_root="$source_root/tests/.install-fixture-$$-$RANDOM"
trap 'rm -rf -- "$fixture_root"' EXIT
export HOME="$fixture_root/home"
unset COPILOT_HOME
export PROMPTLINGS_TEST_SOURCE="$source_root"
mkdir -p "$HOME/.copilot" "$HOME/.claude" "$fixture_root/bin"

cat > "$fixture_root/bin/curl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[ "$1" = "-fsSL" ]
relative="${2#https://raw.githubusercontent.com/dfinson/promptlings/main/}"
[ "$relative" != "$2" ]
if [ "$#" -eq 2 ]; then
  cat "$PROMPTLINGS_TEST_SOURCE/$relative"
  exit 0
fi
[ "$3" = "-o" ]
if [ "${PROMPTLINGS_FAIL_BOOTSTRAP:-0}" = 1 ] && [ "$relative" = "agents/orchestration/bmad/bootstrap.md" ]; then
  printf 'partial download' > "$4"
  exit 1
fi
cp "$PROMPTLINGS_TEST_SOURCE/$relative" "$4"
MOCK
chmod +x "$fixture_root/bin/curl"
export PATH="$fixture_root/bin:$PATH"

sources=(
  "agents/orchestration/bmad-orchestrator.agent.md"
  "agents/orchestration/bmad/setup.md"
  "agents/orchestration/bmad/bootstrap.md"
  "skills/design-writing/SKILL.md"
  "skills/design-writing/references/adr.md"
  "skills/design-writing/references/specification.md"
  "skills/design-writing/references/design-document.md"
  "skills/design-writing/references/tickets.md"
  "skills/design-writing/references/sources.md"
  "skills/reasoning-first-writing/SKILL.md"
  "skills/reasoning-first-writing/references/sources.md"
)
destinations=(
  "agents/bmad-orchestrator.agent.md"
  "promptlings/bmad/setup.md"
  "promptlings/bmad/bootstrap.md"
  "skills/design-writing/SKILL.md"
  "skills/design-writing/references/adr.md"
  "skills/design-writing/references/specification.md"
  "skills/design-writing/references/design-document.md"
  "skills/design-writing/references/tickets.md"
  "skills/design-writing/references/sources.md"
  "skills/reasoning-first-writing/SKILL.md"
  "skills/reasoning-first-writing/references/sources.md"
)
assert_plan() {
  local plan="$1" host_root index
  shift
  for host_root in "$@"; do
    for index in "${!destinations[@]}"; do
      grep -qF "$host_root/${destinations[$index]}" <<< "$plan"
    done
  done
  if grep -qE 'skills[/\\]promptlings-bmad' <<< "$plan"; then exit 1; fi
}
assert_assets() {
  local host_root index
  for host_root in "$@"; do
    for index in "${!sources[@]}"; do
      cmp "$source_root/${sources[$index]}" "$host_root/${destinations[$index]}"
    done
    [ "$(for directory in "$host_root"/skills/*; do basename "$directory"; done | sort)" = "$(printf '%s\n' design-writing reasoning-first-writing)" ]
  done
}
plan="$(bash "$source_root/install.sh" --agents bmad-orchestrator --dry-run)"
assert_plan "$plan" "$HOME/.copilot" "$HOME/.claude"
grep -qF 'Global instruction files modified: none.' <<< "$plan"
[ -z "$(find "$HOME" -type f -print)" ]
bash "$source_root/install.sh" --agents the-nitcracker --yes
[ -z "$(find "$HOME" -type d -name promptlings -print)" ]
bash "$source_root/install.sh" --agents bmad-orchestrator --yes
assert_assets "$HOME/.copilot" "$HOME/.claude"
for host in .copilot .claude; do
  [ ! -e "$HOME/$host/copilot-instructions.md" ]
  [ ! -e "$HOME/$host/CLAUDE.md" ]
done
export COPILOT_HOME="$fixture_root/alternate host"
plan="$(bash "$source_root/install.sh" --agents bmad-orchestrator --dry-run)"
assert_plan "$plan" "$COPILOT_HOME" "$HOME/.claude"
[ ! -e "$COPILOT_HOME" ]
bash "$source_root/install.sh" --agents bmad-orchestrator --yes
assert_assets "$COPILOT_HOME" "$HOME/.claude"
instruction_files=("$COPILOT_HOME/copilot-instructions.md" "$HOME/.claude/CLAUDE.md")
printf '\xef\xbb\xbfExisting instructions\r\nKeep this text.' > "$fixture_root/existing"
for file in "${instruction_files[@]}"; do cp "$fixture_root/existing" "$file"; done
cp "$COPILOT_HOME/promptlings/bmad/bootstrap.md" "$fixture_root/bootstrap"
status=0
PROMPTLINGS_FAIL_BOOTSTRAP=1 bash "$source_root/install.sh" --agents bmad-orchestrator \
  --yes > "$fixture_root/failure.log" 2>&1 || status=$?
[ "$status" -ne 0 ]
grep -qF 'failed to download agents/orchestration/bmad/bootstrap.md' "$fixture_root/failure.log"
cmp "$fixture_root/bootstrap" "$COPILOT_HOME/promptlings/bmad/bootstrap.md"
for file in "${instruction_files[@]}"; do cmp "$fixture_root/existing" "$file"; done
bash "$source_root/install.sh" --agents bmad-orchestrator --yes
for file in "${instruction_files[@]}"; do cmp "$fixture_root/existing" "$file"; done
bash "$source_root/install.sh" --agents bmad-orchestrator,memory-manager --with-readside --yes
for file in "${instruction_files[@]}"; do
  [ "$(grep -cF '<!-- memory-manager-read-side-start -->' "$file")" -eq 1 ]
  grep -qF 'Existing instructions' "$file"
done
echo "Installer private-resource, custom-root, preservation and download-failure checks passed."
