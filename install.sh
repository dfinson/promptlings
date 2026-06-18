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
