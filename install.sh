#!/usr/bin/env bash
set -euo pipefail

# promptlings installer (Linux/macOS)
# Usage: curl -sL https://raw.githubusercontent.com/dfinson/promptlings/main/install.sh | bash

REPO="dfinson/promptlings"
BRANCH="main"
BASE_URL="https://raw.githubusercontent.com/$REPO/$BRANCH"

AGENTS=(
  "agents/code-review/pr-walkthrough.agent.md"
  "agents/code-review/the-nitcracker.agent.md"
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

installed=0

# GitHub Copilot CLI: directory already exists or gh copilot extension is available
if [ -d "$HOME/.copilot/agents" ] || (command -v gh &>/dev/null && gh copilot --version &>/dev/null 2>&1); then
  install_agents "$HOME/.copilot/agents" "GitHub Copilot CLI"
  installed=1
fi

# Claude Code: ~/.claude directory exists or claude command is available
# Agents live in ~/.claude/agents/, not ~/.claude/commands/
if [ -d "$HOME/.claude" ] || command -v claude &>/dev/null; then
  install_agents "$HOME/.claude/agents" "Claude Code"
  installed=1
fi

# Default fallback when neither tool is detected
if [ "$installed" -eq 0 ]; then
  echo "No supported coding assistant detected. Installing to default GitHub Copilot CLI location."
  install_agents "$HOME/.copilot/agents" "GitHub Copilot CLI (default)"
fi

echo ""
echo "Restart your coding assistant to pick up the new agents."
