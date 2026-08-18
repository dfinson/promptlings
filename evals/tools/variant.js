"use strict";

/**
 * Materialize the cut ladder as real agent files.
 *
 * Reads consensus.json, deletes the chosen line sets from the baseline agent,
 * and writes one variant per level. Deleting whole lines keeps the markdown
 * structurally intact in a way a token-level trim would not.
 *
 * Guards, because a variant that fails these is not a smaller agent, it is a
 * broken one and would poison the comparison:
 *   - frontmatter survives, with name and description intact
 *   - each variant is strictly smaller than the one above it
 *   - no variant collapses below a floor that would make it a different agent
 *
 * Usage: node evals/tools/variant.js
 */

const fs = require("node:fs");
const path = require("node:path");

const reductionDir = path.join(__dirname, "..", ".work", "reduction");
const agentsDir = path.join(__dirname, "..", "..", "agents", "code-review");
const baseline = path.join(agentsDir, "pr-walkthrough.agent.md");
const outDir = path.join(reductionDir, "variants");

const FLOOR_BYTES = 8000;

// Headings that define the agent's contract. If any variant loses one, the
// comparison stops being about prose length and starts being about a mangled
// file, so this is a hard failure rather than a warning.
const REQUIRED_HEADINGS = [
  "# PR Walkthrough Agent",
  "## Output Format",
  "## Required Steps",
  "## Core Principles",
];

function frontmatterOf(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const name = m[1].match(/^name:\s*(.+)$/m);
  const desc = m[1].match(/^description:\s*(.+)$/m);
  return name && desc ? { name: name[1].trim(), desc: desc[1].trim() } : null;
}

function main() {
  const report = JSON.parse(
    fs.readFileSync(path.join(reductionDir, "consensus.json"), "utf8"),
  );
  const src = fs.readFileSync(baseline, "utf8");
  const lines = src.split("\n");
  const baseFm = frontmatterOf(src);
  if (!baseFm) {
    console.error("baseline has no parseable frontmatter; refusing to proceed");
    process.exit(1);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const levels = Object.keys(report.levels).sort();
  const written = [];
  let prevBytes = Buffer.byteLength(src);

  for (const level of levels) {
    const cut = new Set(report.levels[level].lines);
    if (cut.size === 0) {
      console.log(`${level}  skipped, nothing to cut`);
      continue;
    }

    const kept = lines.filter((_, i) => !cut.has(i + 1));
    // Collapse runs of blank lines left behind by a deletion.
    const text = kept.join("\n").replace(/\n{3,}/g, "\n\n");
    const bytes = Buffer.byteLength(text);

    const fm = frontmatterOf(text);
    if (!fm) {
      console.error(`${level}  REJECTED: frontmatter destroyed`);
      process.exit(1);
    }
    if (fm.name !== baseFm.name || fm.desc !== baseFm.desc) {
      console.error(`${level}  REJECTED: frontmatter identity changed`);
      process.exit(1);
    }
    if (bytes >= prevBytes) {
      console.error(
        `${level}  REJECTED: ${bytes}B is not smaller than ${prevBytes}B`,
      );
      process.exit(1);
    }
    if (bytes < FLOOR_BYTES) {
      console.error(`${level}  REJECTED: ${bytes}B is below the ${FLOOR_BYTES}B floor`);
      process.exit(1);
    }
    const missing = REQUIRED_HEADINGS.filter((h) => !text.includes(`\n${h}`) && !text.startsWith(h));
    if (missing.length) {
      console.error(`${level}  REJECTED: lost required headings: ${missing.join(", ")}`);
      process.exit(1);
    }

    const name = `pr-walkthrough-${level.toLowerCase()}.agent.md`;
    fs.writeFileSync(path.join(outDir, name), text);
    written.push({ level, name, bytes });
    prevBytes = bytes;

    const pct = Math.round((1 - bytes / Buffer.byteLength(src)) * 1000) / 10;
    console.log(
      `${level}  ${String(bytes).padStart(6)}B  ` +
        `(-${String(pct).padStart(4)}%)  ${cut.size} lines removed  -> ${name}`,
    );
  }

  fs.writeFileSync(
    path.join(reductionDir, "variants.json"),
    JSON.stringify({ baselineBytes: Buffer.byteLength(src), written }, null, 2),
  );
  console.log(`\n${written.length} variants in ${outDir}`);
}

main();
