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
echo "Done. Installed ${#AGENTS[@]} agents to $TARGET"
echo "Restart your coding assistant to pick them up."
echo ""
echo "NOTE: session-handoff requires a companion user instruction to ensure future sessions"
echo "read the environment handoff file. See agents/context/session-handoff.agent.md for the"
echo "block to add to your user instructions."

# For Claude Code installs, append the read-side protocol to ~/.claude/CLAUDE.md (non-destructive).
CLAUDE_MD="$HOME/.claude/CLAUDE.md"
MARKER="session-handoff-read-side-start"

if [[ "$TOOL" == "Claude Code" ]] || [ -d "$HOME/.claude" ]; then
  if grep -qF "$MARKER" "$CLAUDE_MD" 2>/dev/null; then
    echo ""
    echo "Read-side protocol already present in $CLAUDE_MD. Skipping."
  else
    echo ""
    echo "Appending read-side protocol to $CLAUDE_MD ..."
    mkdir -p "$(dirname "$CLAUDE_MD")"
    if curl -fsSL "$BASE_URL/$READSIDE_PATH" >> "$CLAUDE_MD"; then
      echo "Done."
    else
      echo "Warning: failed to fetch $READSIDE_PATH. Add the read-side block from agents/context/session-handoff.agent.md manually."
    fi
  fi
fi
