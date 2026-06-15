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
)

# Detect target directory
if [ -d "$HOME/.copilot/agents" ] || command -v copilot &>/dev/null; then
  TARGET="$HOME/.copilot/agents"
  TOOL="GitHub Copilot CLI"
elif [ -d "$HOME/.claude/commands" ]; then
  TARGET="$HOME/.claude/commands"
  TOOL="Claude Code"
else
  TARGET="$HOME/.copilot/agents"
  TOOL="GitHub Copilot CLI (default)"
fi

echo "Installing promptlings to: $TARGET ($TOOL)"
mkdir -p "$TARGET"

for agent in "${AGENTS[@]}"; do
  filename=$(basename "$agent")
  echo "  Downloading $filename..."
  curl -sL "$BASE_URL/$agent" -o "$TARGET/$filename"
done

echo ""
echo "Done. Installed ${#AGENTS[@]} agents to $TARGET"
echo "Restart your coding assistant to pick them up."
