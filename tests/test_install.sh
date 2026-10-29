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
if [ "${PROMPTLINGS_FAIL_STARTUP:-0}" = 1 ] && [ "$relative" = "skills/promptlings-bmad-bootstrap/startup.md" ]; then
  printf 'partial download' > "$4"
  exit 1
fi
cp "$PROMPTLINGS_TEST_SOURCE/$relative" "$4"
MOCK
chmod +x "$fixture_root/bin/curl"
export PATH="$fixture_root/bin:$PATH"

assets=(
  "skills/promptlings-bmad-setup/SKILL.md"
  "skills/promptlings-bmad-bootstrap/SKILL.md"
  "skills/promptlings-bmad-bootstrap/startup.md"
)
assert_plan() {
  local plan="$1" host_root asset
  shift
  for host_root in "$@"; do
    grep -qF "$host_root/agents/bmad-orchestrator.agent.md" <<< "$plan"
    for asset in "${assets[@]}"; do grep -qF "$host_root/$asset" <<< "$plan"; done
  done
}
plan="$(bash "$source_root/install.sh" --agents bmad-orchestrator --dry-run)"
assert_plan "$plan" "$HOME/.copilot" "$HOME/.claude"
grep -qF 'Global instruction files modified: none.' <<< "$plan"
plan="$(bash "$source_root/install.sh" --agents bmad-orchestrator --with-bmad-bootstrap --dry-run)"
assert_plan "$plan" "$HOME/.copilot" "$HOME/.claude"
grep -qF "$HOME/.copilot/copilot-instructions.md" <<< "$plan"
grep -qF "$HOME/.claude/CLAUDE.md" <<< "$plan"
if grep -qF 'Global instruction files modified: none.' <<< "$plan"; then exit 1; fi
[ -z "$(find "$HOME" -type f -print)" ]
bash "$source_root/install.sh" --agents the-nitcracker --yes
[ -z "$(find "$HOME" -name SKILL.md -print)" ]
[ -z "$(find "$HOME" -type d -name skills -print)" ]
status=0
bash "$source_root/install.sh" --agents the-nitcracker --with-bmad-bootstrap --yes \
  > "$fixture_root/invalid.log" 2>&1 || status=$?
[ "$status" -eq 2 ]
grep -qF 'requires the bmad-orchestrator agent' "$fixture_root/invalid.log"
bash "$source_root/install.sh" --agents bmad-orchestrator --yes
for host in .copilot .claude; do
  cmp "$source_root/agents/orchestration/bmad-orchestrator.agent.md" \
    "$HOME/$host/agents/bmad-orchestrator.agent.md"
  for asset in "${assets[@]}"; do cmp "$source_root/$asset" "$HOME/$host/$asset"; done
  [ ! -e "$HOME/$host/copilot-instructions.md" ]
  [ ! -e "$HOME/$host/CLAUDE.md" ]
done
export COPILOT_HOME="$fixture_root/alternate host"
plan="$(bash "$source_root/install.sh" --agents bmad-orchestrator --dry-run)"
assert_plan "$plan" "$COPILOT_HOME" "$HOME/.claude"
[ ! -e "$COPILOT_HOME" ]
bash "$source_root/install.sh" --agents bmad-orchestrator --yes
cmp "$source_root/agents/orchestration/bmad-orchestrator.agent.md" \
  "$COPILOT_HOME/agents/bmad-orchestrator.agent.md"
for asset in "${assets[@]}"; do cmp "$source_root/$asset" "$COPILOT_HOME/$asset"; done
[ ! -e "$COPILOT_HOME/copilot-instructions.md" ]
instruction_files=("$COPILOT_HOME/copilot-instructions.md" "$HOME/.claude/CLAUDE.md")
printf 'Existing user instructions: café\r\nKeep this text.' > "$fixture_root/existing"
for file in "${instruction_files[@]}"; do cp "$fixture_root/existing" "$file"; done
status=0
PROMPTLINGS_FAIL_STARTUP=1 bash "$source_root/install.sh" --agents bmad-orchestrator \
  --with-bmad-bootstrap --yes > "$fixture_root/failure.log" 2>&1 || status=$?
[ "$status" -ne 0 ]
grep -qF 'failed to download skills/promptlings-bmad-bootstrap/startup.md' "$fixture_root/failure.log"
for file in "${instruction_files[@]}"; do cmp "$fixture_root/existing" "$file"; done
bash "$source_root/install.sh" --agents bmad-orchestrator --with-bmad-bootstrap --yes
{
  cat "$fixture_root/existing"
  printf '\n'
  cat "$source_root/skills/promptlings-bmad-bootstrap/startup.md"
  printf '\n'
} > "$fixture_root/expected"
for file in "${instruction_files[@]}"; do cmp "$fixture_root/expected" "$file"; done
bash "$source_root/install.sh" --agents bmad-orchestrator --with-bmad-bootstrap --yes
for file in "${instruction_files[@]}"; do cmp "$fixture_root/expected" "$file"; done
[ ! -e "$HOME/.copilot/copilot-instructions.md" ]
rm -- "${instruction_files[@]}"
bash "$source_root/install.sh" --agents bmad-orchestrator --with-bmad-bootstrap --yes
{
  printf '\n'
  cat "$source_root/skills/promptlings-bmad-bootstrap/startup.md"
  printf '\n'
} > "$fixture_root/expected"
for file in "${instruction_files[@]}"; do cmp "$fixture_root/expected" "$file"; done
for encoded in '\xff\xfeX\x00' '\xfe\xff\x00X' '\xff\xfe\x00\x00X\x00\x00\x00' '\x00\x00\xfe\xff\x00\x00\x00X'; do
  printf '%b' "$encoded" > "$fixture_root/encoded"
  for file in "${instruction_files[@]}"; do cp "$fixture_root/encoded" "$file"; done
  for attempt in 1 2; do
    status=0
    bash "$source_root/install.sh" --agents bmad-orchestrator --with-bmad-bootstrap --yes \
      > "$fixture_root/encoding.log" 2>&1 || status=$?
    [ "$status" -ne 0 ]
    grep -qF 'UTF-16 or UTF-32' "$fixture_root/encoding.log"
    for file in "${instruction_files[@]}"; do cmp "$fixture_root/encoded" "$file"; done
  done
done
for file in "${instruction_files[@]}"; do
  { printf '\xef\xbb\xbf'; cat "$fixture_root/existing"; } > "$file"
done
bash "$source_root/install.sh" --agents bmad-orchestrator,memory-manager --with-bmad-bootstrap --with-readside --yes
for file in "${instruction_files[@]}"; do
  [ "$(grep -cF '<!-- promptlings-bmad-bootstrap-start -->' "$file")" -eq 1 ]
  [ "$(grep -cF '<!-- memory-manager-read-side-start -->' "$file")" -eq 1 ]
  grep -qF 'Existing user instructions: café' "$file"
done
cp "${instruction_files[0]}" "$fixture_root/combined-copilot"
cp "${instruction_files[1]}" "$fixture_root/combined-claude"
bash "$source_root/install.sh" --agents bmad-orchestrator,memory-manager --with-bmad-bootstrap --with-readside --yes
cmp "$fixture_root/combined-copilot" "${instruction_files[0]}"
cmp "$fixture_root/combined-claude" "${instruction_files[1]}"
echo "Installer asset, plan, selection, custom-root, opt-in, encoding, combined-flag and failure checks passed."
