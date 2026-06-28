#!/usr/bin/env bash
set -euo pipefail

# promptlings installer (Linux/macOS)
# Usage: curl -sL https://raw.githubusercontent.com/dfinson/promptlings/main/install.sh | bash

REPO="dfinson/promptlings"
BRANCH="main"
BASE_URL="https://raw.githubusercontent.com/$REPO/$BRANCH"
READSIDE_PATH="agents/context/session-handoff-read-side.md"

AGENTS=(
  "agents/code-review/pr-walkthrough.agent.md"
  "agents/code-review/the-nitcracker.agent.md"
  "agents/code-review/pr-rescue.agent.md"
  "agents/context/session-handoff.agent.md"
)

install_agents() {
  local target="$1"
  local tool="$2"
  echo "Installing promptlings for $tool -> $target"
  mkdir -p "$target"
  for agent in "${AGENTS[@]}"; do
    filename=$(basename "$agent")
    echo "  Downloading $filename..."
    curl -sL "$BASE_URL/$agent" -o "$target/$filename"
  done
  echo "  Done. Installed ${#AGENTS[@]} agents."
}

installed_targets=()
copilot_installed=0
claude_installed=0

# GitHub Copilot CLI: directory already exists or gh copilot extension is available
if [ -d "$HOME/.copilot/agents" ] || (command -v gh &>/dev/null && gh copilot --version &>/dev/null 2>&1); then
  install_agents "$HOME/.copilot/agents" "GitHub Copilot CLI"
  installed_targets+=("$HOME/.copilot/agents")
  copilot_installed=1
fi

# Claude Code: ~/.claude directory exists or claude command is available
# Agents live in ~/.claude/agents/, not ~/.claude/commands/
if [ -d "$HOME/.claude" ] || command -v claude &>/dev/null; then
  install_agents "$HOME/.claude/agents" "Claude Code"
  installed_targets+=("$HOME/.claude/agents")
  claude_installed=1
fi

# Default fallback when neither tool is detected
if [ "${#installed_targets[@]}" -eq 0 ]; then
  echo "No supported coding assistant detected. Installing to default GitHub Copilot CLI location."
  install_agents "$HOME/.copilot/agents" "GitHub Copilot CLI (default)"
  installed_targets+=("$HOME/.copilot/agents")
  copilot_installed=1
fi

echo ""
echo "Done. Installed ${#AGENTS[@]} agents to: ${installed_targets[*]}"
echo "Restart your coding assistant to pick them up."
echo ""
echo "NOTE: session-handoff needs a companion read-side instruction so future sessions read the"
echo "environment handoff file. Wiring it into your tool's user instructions now:"

# Wire the read-side protocol into the user instruction file of each installed tool
# (non-destructive). Copilot CLI reads $HOME/.copilot/copilot-instructions.md; Claude Code reads
# $HOME/.claude/CLAUDE.md.
MARKER="session-handoff-read-side-start"
COPILOT_INSTRUCTIONS="$HOME/.copilot/copilot-instructions.md"
CLAUDE_MD="$HOME/.claude/CLAUDE.md"

readside_block=""
if [ "$copilot_installed" -eq 1 ] || [ "$claude_installed" -eq 1 ]; then
  readside_block=$(curl -fsSL "$BASE_URL/$READSIDE_PATH" || true)
fi

append_readside() {
  local instr_file="$1"
  if [ -z "$readside_block" ]; then
    echo ""
    echo "Warning: failed to fetch $READSIDE_PATH. Add the read-side block from agents/context/session-handoff.agent.md to $instr_file manually."
    return
  fi
  if grep -qF "$MARKER" "$instr_file" 2>/dev/null; then
    echo ""
    echo "Read-side protocol already present in $instr_file. Skipping."
  else
    echo ""
    echo "Appending read-side protocol to $instr_file ..."
    mkdir -p "$(dirname "$instr_file")"
    printf '\n%s\n' "$readside_block" >> "$instr_file"
    echo "Done."
  fi
}

if [ "$copilot_installed" -eq 1 ]; then
  append_readside "$COPILOT_INSTRUCTIONS"
fi
if [ "$claude_installed" -eq 1 ]; then
  append_readside "$CLAUDE_MD"
fi
