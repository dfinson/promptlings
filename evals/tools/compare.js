"use strict";

/**
 * Turn a promptfoo run into the regression table the experiment actually asks
 * for: per-dimension scores for every rung of the cut ladder, as deltas against
 * the uncut baseline, so the knee is visible rather than inferred.
 *
 * Reading rule, fixed before the numbers came in so it cannot be fitted to
 * them. At n=1 per case a single dimension moving by a few hundredths is noise,
 * so:
 *   - judgment-neutrality and architectural-abstraction scored 1.00 and 0.98 at
 *     baseline. They have no headroom, so any drop there is real.
 *   - elsewhere a move on one case is noise; a consistent move in the same
 *     direction across all three cases is signal.
 *   - the composite is a summary, not the verdict. A rung that holds composite
 *     while collapsing one dimension has still regressed.
 *
 * The baseline is re-run inside the same sweep rather than compared against the
 * stored one, because run-to-run variance and cut-induced variance are
 * otherwise indistinguishable. If a prior baseline file is passed, the gap
 * between the two baselines is reported as the noise floor.
 *
 * Usage:
 *   node evals/tools/compare.js evals/results/ladder.json [evals/results/baseline.json]
 */

const fs = require("node:fs");

const DIMS = [
  "cold-open-quality",
  "narrative-pull",
  "header-quality",
  "voice-intensity",
  "specificity",
  "hunk-gluing-absence",
  "architectural-abstraction",
  "judgment-neutrality",
];

// Dimensions with no headroom at baseline: a drop cannot be noise upward.
const CEILING = new Set(["judgment-neutrality", "architectural-abstraction"]);

function load(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const rows = (j.results && j.results.results) || [];
  const out = new Map();
  for (const r of rows) {
    const label = (r.provider && (r.provider.label || r.provider.id)) || "?";
    const desc =
      (r.testCase && r.testCase.description) ||
      (r.vars && r.vars.target) ||
      `case${r.testIdx}`;
    const key = label;
    if (!out.has(key)) out.set(key, []);
    out.get(key).push({
      case: String(desc).split(" ")[0],
      scores: r.namedScores || {},
      // promptfoo puts a failing rubric's reason in `error`, which is not an
      // execution failure. A run only truly failed if it produced no scores.
      error: Object.keys(r.namedScores || {}).length === 0 ? (r.error || "no scores") : null,
    });
  }
  return out;
}

function meanOf(entries, dim) {
  const vals = entries
    .map((e) => e.scores[dim])
    .filter((v) => typeof v === "number");
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function fmt(n) {
  return n === null ? "  -  " : n.toFixed(2);
}

function sign(d) {
  if (d === null) return "     ";
  const s = d >= 0 ? "+" : "-";
  return `${s}${Math.abs(d).toFixed(2)}`;
}

function main() {
  const [file, priorFile] = process.argv.slice(2);
  if (!file) {
    console.error("usage: node evals/tools/compare.js <ladder.json> [prior-baseline.json]");
    process.exit(1);
  }

  const byProvider = load(file);
  const labels = [...byProvider.keys()];
  const baseLabel =
    labels.find((l) => /^baseline$/i.test(l)) || labels[0];
  const rungs = labels.filter((l) => l !== baseLabel);

  const errs = [];
  for (const [label, entries] of byProvider) {
    for (const e of entries) if (e.error) errs.push(`${label}/${e.case}: ${e.error}`);
  }
  if (errs.length) {
    console.log(`errors in ${errs.length} run(s):`);
    for (const e of errs.slice(0, 10)) console.log(`  ${e}`);
    console.log("");
  }

  const base = {};
  for (const d of DIMS) base[d] = meanOf(byProvider.get(baseLabel) || [], d);

  const header = ["dimension".padEnd(27), fmt2(baseLabel)]
    .concat(rungs.map(fmt2))
    .join(" ");
  console.log(header);
  console.log("-".repeat(header.length));

  const regressions = [];
  for (const d of DIMS) {
    const cells = [d.padEnd(27), fmt(base[d]).padStart(fmt2(baseLabel).length)];
    for (const r of rungs) {
      const m = meanOf(byProvider.get(r) || [], d);
      const delta = m === null || base[d] === null ? null : m - base[d];
      cells.push(`${fmt(m)}${sign(delta) === "     " ? "" : ` ${sign(delta)}`}`
        .padStart(fmt2(r).length));
      if (delta !== null && CEILING.has(d) && delta < -0.005) {
        regressions.push(`${r}: ${d} ${fmt(base[d])} -> ${fmt(m)} (ceiling dimension)`);
      }
    }
    console.log(cells.join(" "));
  }

  // Composite, unweighted across dimensions then across cases.
  const comp = (label) => {
    const vals = DIMS.map((d) => meanOf(byProvider.get(label) || [], d)).filter(
      (v) => typeof v === "number",
    );
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const cb = comp(baseLabel);
  const row = ["composite".padEnd(27), fmt(cb).padStart(fmt2(baseLabel).length)];
  for (const r of rungs) {
    const c = comp(r);
    row.push(`${fmt(c)} ${sign(c === null || cb === null ? null : c - cb)}`.padStart(fmt2(r).length));
  }
  console.log("-".repeat(header.length));
  console.log(row.join(" "));

  // Per-case consistency: a move that repeats on all three cases is signal.
  console.log("\nconsistent multi-case moves (all cases same direction, >=0.05 mean):");
  let found = 0;
  for (const r of rungs) {
    for (const d of DIMS) {
      const bEntries = byProvider.get(baseLabel) || [];
      const rEntries = byProvider.get(r) || [];
      const perCase = [];
      for (const be of bEntries) {
        const re = rEntries.find((x) => x.case === be.case);
        if (!re) continue;
        const a = be.scores[d], b = re.scores[d];
        if (typeof a === "number" && typeof b === "number") perCase.push(b - a);
      }
      if (perCase.length < 2) continue;
      const allDown = perCase.every((v) => v < 0);
      const allUp = perCase.every((v) => v > 0);
      const mean = perCase.reduce((a, b) => a + b, 0) / perCase.length;
      if ((allDown || allUp) && Math.abs(mean) >= 0.05) {
        found++;
        console.log(
          `  ${r.padEnd(12)} ${d.padEnd(27)} ${sign(mean)}  ` +
            `[${perCase.map((v) => v.toFixed(2)).join(", ")}]`,
        );
        if (allDown) regressions.push(`${r}: ${d} down on every case (mean ${sign(mean)})`);
      }
    }
  }
  if (!found) console.log("  none");

  if (priorFile && fs.existsSync(priorFile)) {
    const prior = load(priorFile);
    const pLabel = [...prior.keys()].find((l) => /^baseline$/i.test(l));
    if (pLabel) {
      console.log("\nnoise floor, this run's baseline vs the prior stored baseline:");
      let worst = 0;
      for (const d of DIMS) {
        const a = meanOf(prior.get(pLabel), d);
        const b = base[d];
        if (a === null || b === null) continue;
        worst = Math.max(worst, Math.abs(b - a));
        console.log(`  ${d.padEnd(27)} ${fmt(a)} -> ${fmt(b)}  ${sign(b - a)}`);
      }
      console.log(`  largest same-config swing: ${worst.toFixed(2)}`);
      console.log("  treat ladder deltas smaller than this as indistinguishable from noise.");
    }
  }

  console.log("\nverdict:");
  if (!regressions.length) {
    console.log("  no rung regressed on a ceiling dimension or on all cases at once.");
  } else {
    for (const r of [...new Set(regressions)]) console.log(`  ${r}`);
  }
}

function fmt2(label) {
  return String(label).padStart(12);
}

main();
