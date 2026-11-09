#!/usr/bin/env bash
# Render one PNG still per NxrStyle into examples/stills/ (downscaled to 1280 wide).
# Usage: bash scripts/render-stills.sh [NN ...]   (run from repo root or examples/)
set -euo pipefail
cd "$(dirname "$0")/../examples"
mkdir -p stills
node -e '
const fs=require("fs");const src=fs.readFileSync("src/styles/registry.ts","utf8");
for (const m of src.matchAll(/\{n: (\d+), slug: .(.+?)., id: .(.+?)., .*?w: (\d+), h: (\d+), dur: \d+, still: (\d+)\}/g)) console.log(m.slice(1).join(" "));
' | while read -r n slug id w h frame; do
  nn=$(printf "%02d" "$n")
  if [ "$#" -gt 0 ] && [[ ! " $* " =~ " $nn " ]]; then continue; fi
  scale=$(node -e "console.log(($w>$h?1280:720)/$w)")
  npx remotion still src/index.ts "$id" "stills/NxrStyle-$nn-$slug.png" --frame="$frame" --scale="$scale" --log=error
  echo "rendered NxrStyle-$nn-$slug.png (frame $frame)"
done
