#!/usr/bin/env bash
set -euo pipefail

source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_root="$(mktemp -d "${TMPDIR:-/tmp}/promptlings-install.XXXXXX")"
trap 'rm -rf -- "$fixture_root"' EXIT
export HOME="$fixture_root/home"
export PROMPTLINGS_TEST_SOURCE="$source_root"
mkdir -p "$HOME/.copilot" "$HOME/.claude" "$fixture_root/bin"

cat > "$fixture_root/bin/curl" <<'MOCK'
#!/usr/bin/env bash
set -euo pipefail
[ "$1" = "-fsSL" ] && [ "$3" = "-o" ]
relative="${2#https://raw.githubusercontent.com/dfinson/promptlings/main/}"
[ "$relative" != "$2" ]
cp "$PROMPTLINGS_TEST_SOURCE/$relative" "$4"
MOCK
chmod +x "$fixture_root/bin/curl"
export PATH="$fixture_root/bin:$PATH"

bash "$source_root/install.sh" --agents bmad-orchestrator --dry-run
[ -z "$(find "$HOME" -type f -print)" ]
bash "$source_root/install.sh" --agents the-nitcracker --yes
[ -z "$(find "$HOME" -name SKILL.md -print)" ]
bash "$source_root/install.sh" --agents bmad-orchestrator --yes
for host in .copilot .claude; do
  cmp "$source_root/agents/orchestration/bmad-orchestrator.agent.md" \
    "$HOME/$host/agents/bmad-orchestrator.agent.md"
  cmp "$source_root/skills/promptlings-bmad-setup/SKILL.md" \
    "$HOME/$host/skills/promptlings-bmad-setup/SKILL.md"
  [ ! -e "$HOME/$host/copilot-instructions.md" ]
  [ ! -e "$HOME/$host/CLAUDE.md" ]
done
echo "Installer dry-run, selection, paired installation, and content checks passed."
