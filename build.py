#!/usr/bin/env python3
"""Build agent prompt files from the promptlings.yml manifest."""

import os
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    print("ERROR: PyYAML is required. Install with: pip install pyyaml", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
MANIFEST = ROOT / "promptlings.yml"


def build():
    with open(MANIFEST) as f:
        config = yaml.safe_load(f)

    agents = config.get("agents", [])
    if not agents:
        print("No agents defined in promptlings.yml", file=sys.stderr)
        sys.exit(1)

    for agent in agents:
        name = agent["name"]
        output_path = ROOT / agent["output"]
        sources = agent["sources"]

        parts = []
        for source in sources:
            src_file = SRC / source
            if not src_file.exists():
                print(f"ERROR: {name} references missing file: {source}", file=sys.stderr)
                sys.exit(1)
            parts.append(src_file.read_text(encoding="utf-8").rstrip())

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("\n\n".join(parts) + "\n", encoding="utf-8", newline="\n")
        print(f"Built: {output_path.relative_to(ROOT)}")

    print("Build complete.")


if __name__ == "__main__":
    build()
