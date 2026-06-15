#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$SCRIPT_DIR/src"
OUT_DIR="$SCRIPT_DIR/review"

mkdir -p "$OUT_DIR"

# Build an agent from its manifest file.
# Manifest format: one filename per line (relative to src/), blank lines and # comments ignored.
build_agent() {
  local manifest="$1"
  local agent_name
  agent_name="$(basename "$(dirname "$manifest")")"
  local output="$OUT_DIR/${agent_name}.agent.md"

  local content=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip blank lines and comments
    [[ -z "$line" || "$line" == \#* ]] && continue
    local file="$SRC_DIR/$line"
    if [[ ! -f "$file" ]]; then
      echo "ERROR: $manifest references missing file: $line" >&2
      exit 1
    fi
    if [[ -n "$content" ]]; then
      content+=$'\n\n'
    fi
    content+="$(cat "$file")"
  done < "$manifest"

  printf '%s\n' "$content" > "$output"
  echo "Built: $output"
}

# Each agent has a manifest.txt in its overlay directory listing the files to concatenate
for manifest in "$SRC_DIR"/overlays/*/manifest.txt; do
  if [[ -f "$manifest" ]]; then
    build_agent "$manifest"
  fi
done

echo "Build complete."
