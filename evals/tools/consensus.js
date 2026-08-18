"use strict";

/**
 * Merge independent reduction inventories into a monotonic cut ladder.
 *
 * Four analysts, each a different model family, tier every part of the agent
 * file. They use different segment names and different granularity, so the
 * merge happens per LINE rather than per named segment: each analyst's entry
 * casts its tier as a vote for every line it covers.
 *
 * Ladder rules. NEVER is a veto at every level, so one analyst calling a line
 * load-bearing keeps that line in every variant.
 *
 *   L1  every vote is TIER1                  unanimous, pure redundancy
 *   L2  every vote is TIER1 or TIER2         no analyst sees more than
 *                                            bounded risk
 *   L3  no vote is NEVER, and a majority
 *       rated it cuttable                    contested, where the real
 *                                            uncertainty about the thesis lives
 *   L4  veto needs 2+ NEVER votes            one dissenter no longer protects
 *   L5  veto needs 3+ NEVER votes            only a strong defense protects
 *   L6  veto needs unanimous NEVER           the floor: only text every
 *                                            analyst independently defended
 *
 * L4-L6 were added after the first run. L1 came out empty and L2/L3 landed at
 * 3.5% and 16.5%, too narrow a span to locate where quality breaks, and L3 and
 * L4 were byte-identical under the original rules. The diagnosis: 298 of 392
 * lines carry at least one NEVER, but only 110 are unanimously NEVER, so 188
 * lines are contested and a single-dissenter veto was doing all the work.
 * Relaxing the veto threshold is the honest axis to striate on, because it asks
 * a real question, how many independent models must defend a line, rather than
 * averaging tiers that different analysts assigned at different granularity.
 * Recording the amendment rather than quietly restating the rules, since the
 * ladder is the experiment and moving its rungs after seeing results is exactly
 * the failure mode worth guarding against.
 *
 * The sets nest by construction, so the result is a dose-response curve rather
 * than three unrelated variants. A line nobody scored is kept: silence is not
 * agreement.
 *
 * Usage: node evals/tools/consensus.js
 */

const fs = require("node:fs");
const path = require("node:path");

const RANK = { TIER1: 1, TIER2: 2, TIER3: 3, NEVER: 4 };

/**
 * Structural lines are never cut, whatever the votes say.
 *
 * Headings and frontmatter are a few hundred bytes total but they carry the
 * agent's skeleton and its output contract. The first ladder run cut the H1 and
 * the whole Output Format section at the deepest level, which does not produce
 * a shorter agent, it produces a broken one, and it would have failed the eval
 * for the wrong reason. The question under test is whether the PROSE is
 * load-bearing, so the structure is held fixed and only prose varies.
 */
function isStructural(line, lineNo, fmEnd) {
  if (lineNo <= fmEnd) return true;
  return /^#{1,6}\s/.test(line);
}

const reductionDir = path.join(__dirname, "..", ".work", "reduction");
const agentFile = path.join(
  __dirname, "..", "..", "agents", "code-review", "pr-walkthrough.agent.md",
);

function parseRange(spec) {
  const s = String(spec);
  const m = s.match(/(\d+)\s*[-\u2013]\s*(\d+)/);
  if (m) return [Number(m[1]), Number(m[2])];
  const single = s.match(/(\d+)/);
  if (single) return [Number(single[1]), Number(single[1])];
  return null;
}

function loadInventories() {
  const found = [];
  for (const f of fs.readdirSync(reductionDir)) {
    if (!/^analyst-[a-z]\.json$/.test(f)) continue;
    let entries;
    try {
      entries = JSON.parse(fs.readFileSync(path.join(reductionDir, f), "utf8"));
    } catch (e) {
      console.error(`skipping ${f}: ${e.message}`);
      continue;
    }
    if (!Array.isArray(entries)) {
      console.error(`skipping ${f}: not a JSON array`);
      continue;
    }
    found.push({ id: f.replace(/^analyst-|\.json$/g, ""), entries });
  }
  return found;
}

function main() {
  const analysts = loadInventories();
  if (analysts.length < 2) {
    console.error("need at least two inventories to form a consensus");
    process.exit(1);
  }

  const src = fs.readFileSync(agentFile, "utf8").split("\n");
  const totalLines = src.length;
  const total = Buffer.byteLength(fs.readFileSync(agentFile));

  const votes = Array.from({ length: totalLines + 1 }, () => ({}));
  for (const { id, entries } of analysts) {
    for (const e of entries) {
      const r = parseRange(e.lines);
      if (!r) continue;
      const tier = String(e.tier || "").toUpperCase();
      if (!RANK[tier]) continue;
      for (let ln = r[0]; ln <= Math.min(r[1], totalLines); ln++) {
        const prev = votes[ln][id];
        // Most protective vote wins when one analyst covers a line twice.
        if (!prev || RANK[tier] > RANK[prev]) votes[ln][id] = tier;
      }
    }
  }

  const picks = { L1: [], L2: [], L3: [], L4: [], L5: [], L6: [] };
  let unscored = 0;
  let structural = 0;
  const stats = { neverAny: 0, neverAll: 0, split: 0 };

  // End of the YAML frontmatter block, so it is protected wholesale.
  let fmEnd = 0;
  if (src[0] === "---") {
    for (let i = 1; i < src.length; i++) {
      if (src[i] === "---") { fmEnd = i + 1; break; }
    }
  }

  for (let ln = 1; ln <= totalLines; ln++) {
    if (isStructural(src[ln - 1], ln, fmEnd)) { structural++; continue; }
    const cast = Object.values(votes[ln]);
    if (cast.length === 0) { unscored++; continue; }

    const nevers = cast.filter((t) => t === "NEVER").length;
    const cuttable = cast.length - nevers;
    if (nevers > 0) stats.neverAny++;
    if (nevers === cast.length) stats.neverAll++;
    if (nevers > 0 && nevers < cast.length) stats.split++;

    if (cast.every((t) => t === "TIER1")) picks.L1.push(ln);
    if (cast.every((t) => t === "TIER1" || t === "TIER2")) picks.L2.push(ln);
    if (nevers === 0 && cuttable > cast.length / 2) picks.L3.push(ln);
    if (nevers < 2) picks.L4.push(ln);
    if (nevers < 3) picks.L5.push(ln);
    if (nevers < cast.length) picks.L6.push(ln);
  }

  // Enforce nesting rather than trusting the predicates to imply it.
  const l1 = new Set(picks.L1);
  const l2 = new Set([...l1, ...picks.L2]);
  const l3 = new Set([...l2, ...picks.L3]);
  const l4 = new Set([...l3, ...picks.L4]);
  const l5 = new Set([...l4, ...picks.L5]);
  const l6 = new Set([...l5, ...picks.L6]);

  const bytesOf = (set) =>
    [...set].reduce((n, ln) => n + Buffer.byteLength(src[ln - 1] || "") + 1, 0);

  const report = {
    analysts: analysts.map((a) => a.id),
    totalBytes: total,
    totalLines,
    unscoredLines: unscored,
    structuralLines: structural,
    voteShape: stats,
    levels: {},
  };

  for (const [k, set] of [
    ["L1", l1], ["L2", l2], ["L3", l3], ["L4", l4], ["L5", l5], ["L6", l6],
  ]) {
    const cut = bytesOf(set);
    report.levels[k] = {
      lines: [...set].sort((a, b) => a - b),
      cutBytes: cut,
      remainingBytes: total - cut,
      reductionPct: Math.round((cut / total) * 1000) / 10,
    };
  }

  fs.writeFileSync(
    path.join(reductionDir, "consensus.json"),
    JSON.stringify(report, null, 2),
  );

  console.log(`analysts: ${report.analysts.join(", ")}`);
  console.log(`baseline: ${total} bytes over ${totalLines} lines`);
  console.log(`lines no analyst scored: ${unscored} (kept)`);
  console.log(`structural lines held fixed: ${structural}`);
  console.log(
    `lines with >=1 NEVER: ${stats.neverAny}, unanimously NEVER: ` +
      `${stats.neverAll}, contested: ${stats.split}\n`,
  );
  for (const k of ["L1", "L2", "L3", "L4", "L5", "L6"]) {
    const L = report.levels[k];
    console.log(
      `${k}  cut ${String(L.cutBytes).padStart(6)}B ` +
        `(${String(L.reductionPct).padStart(4)}%)  ` +
        `remaining ${String(L.remainingBytes).padStart(6)}B  ` +
        `${L.lines.length} lines`,
    );
  }
}

main();
