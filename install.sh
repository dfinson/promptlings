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
    cat >> "$CLAUDE_MD" << 'READSIDE'

<!-- session-handoff-read-side-start -->
# Session Handoff: Mandatory Context Protocol

These rules apply to EVERY session in every repository. No exceptions.

## FIRST ACTION: Read environment context

On your FIRST tool-calling turn of every session, before doing anything else, run:

    cat "$(git rev-parse --git-common-dir)/session-handoff/environment.md" 2>/dev/null

If this file exists, read it completely. It contains environment facts (auth methods, tool paths, encoding quirks, resource identifiers) that directly affect your ability to work correctly. If you skip this and get something wrong that the file would have told you, that failure is on you.

Do NOT grep, search the codebase, search the filesystem, or answer any question until you have read this file or confirmed it does not exist.

## DURING SESSION: Search decisions before fresh searches

Before performing any fresh search of the codebase, filesystem, or web, grep the decisions file first:

    grep -i "KEYWORD" "$(git rev-parse --git-common-dir)/session-handoff/decisions.md" 2>/dev/null

Replace KEYWORD with terms relevant to your current subtask. If the decisions file has relevant entries, consult them before initiating any fresh search.
<!-- session-handoff-read-side-end -->
READSIDE
    echo "Done."
  fi
fi
