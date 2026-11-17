import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Re-derives ReviewBench scores from results.details.json and the golden files, then requires
 * them to equal results.json exactly. Mirrors scripts/eval/scorer.ts and
 * scripts/eval/exclude-producers.ts at the pinned commit.
 */

export class JudgeRejectedError extends Error {
  constructor(message, mismatches = []) {
    super(message);
    this.name = 'JudgeRejectedError';
    this.mismatches = mismatches;
  }
}

const COUNT_FIELDS = [
  'candidate_count',
  'golden_tp_count',
  'matched_count',
  'matched_tp_count',
  'unmatched_count',
  'unmatched_tp_count',
  'unmatched_fp_count',
  'golden_covered_count',
];
const RATE_FIELDS = ['grounded_precision', 'grounded_recall', 'augmented_precision', 'augmented_recall', 'novel_tp_yield'];

function computeMetrics({ goldenTp, matched, covered, unmatchedTp, unmatchedFp, candidateCount }) {
  let matchedTp = 0;
  for (const gi of matched.values()) if (goldenTp.has(gi)) matchedTp++;
  let coveredTp = 0;
  for (const gi of covered) if (goldenTp.has(gi)) coveredTp++;
  const augDenom = goldenTp.size + unmatchedTp;
  return {
    grounded_precision: matched.size > 0 ? matchedTp / matched.size : null,
    grounded_recall: goldenTp.size > 0 ? coveredTp / goldenTp.size : null,
    augmented_precision: candidateCount > 0 ? (matchedTp + unmatchedTp) / candidateCount : null,
    augmented_recall: augDenom > 0 ? (coveredTp + unmatchedTp) / augDenom : null,
    novel_tp_count: unmatchedTp,
    novel_tp_yield: candidateCount > 0 ? unmatchedTp / candidateCount : null,
    candidate_count: candidateCount,
    golden_tp_count: goldenTp.size,
    matched_count: matched.size,
    matched_tp_count: matchedTp,
    unmatched_count: unmatchedTp + unmatchedFp,
    unmatched_tp_count: unmatchedTp,
    unmatched_fp_count: unmatchedFp,
    golden_covered_count: coveredTp,
  };
}

function stratum(golden, matched, covered, unmatched, attr) {
  return (value) => {
    const goldenTp = new Set();
    golden.forEach((g, i) => {
      if (g[attr] === value && g.tp_fp === 'tp') goldenTp.add(i);
    });
    const m = new Map([...matched].filter(([, gi]) => golden[gi]?.[attr] === value));
    const c = new Set([...covered].filter((gi) => golden[gi]?.[attr] === value));
    let tp = 0;
    let fp = 0;
    for (const cls of unmatched.values()) {
      if (cls[attr] !== value) continue;
      if (cls.tp_fp === 'tp') tp++;
      else fp++;
    }
    return computeMetrics({ goldenTp, matched: m, covered: c, unmatchedTp: tp, unmatchedFp: fp, candidateCount: m.size + tp + fp });
  };
}

/** Rebuilds scorer inputs for one PR from its details entry and the (producer-filtered) golden findings. */
export function derivePR(detail, golden) {
  const key = detail.pr_key;
  if (!Array.isArray(detail.candidate_findings)) throw new JudgeRejectedError(`${key}: details lack candidate_findings`);
  const inRange = (gi) => Number.isInteger(gi) && gi >= 0 && gi < golden.length;
  const matched = new Map();
  const claimed = new Set();
  const covered = new Set();
  const unmatched = new Map();
  detail.candidate_findings.forEach((f, ci) => {
    for (const gi of f.covered_golden_indices ?? []) {
      if (!inRange(gi)) throw new JudgeRejectedError(`${key}: candidate ${ci} covers golden index ${gi} out of range`);
      covered.add(gi);
    }
    if (f.matched_golden_index !== undefined) {
      const gi = f.matched_golden_index;
      if (!inRange(gi)) throw new JudgeRejectedError(`${key}: candidate ${ci} matches golden index ${gi} out of range`);
      if (claimed.has(gi)) throw new JudgeRejectedError(`${key}: golden index ${gi} is matched twice`);
      claimed.add(gi);
      const expected = golden[gi].tp_fp === 'tp' ? 'matched_tp' : 'matched_fp';
      if (f.status !== expected) throw new JudgeRejectedError(`${key}: candidate ${ci} status ${f.status} contradicts golden ${golden[gi].tp_fp}`);
      if ((f.covered_golden_indices ?? []).indexOf(gi) === -1) throw new JudgeRejectedError(`${key}: candidate ${ci} matched golden ${gi} it does not cover`);
      matched.set(ci, gi);
    } else if (f.classifier_tp_fp !== undefined) {
      const expected = f.classifier_tp_fp === 'tp' ? 'novel_tp' : 'novel_fp';
      if (f.status !== expected) throw new JudgeRejectedError(`${key}: candidate ${ci} status ${f.status} contradicts classifier ${f.classifier_tp_fp}`);
      unmatched.set(ci, { tp_fp: f.classifier_tp_fp, severity: f.classifier_severity, category: f.classifier_category });
    } else if (f.status !== 'novel_fp' || (f.covered_golden_indices ?? []).length > 0) {
      throw new JudgeRejectedError(`${key}: candidate ${ci} has neither a match nor a classification`);
    }
  });

  const goldenTp = new Set();
  golden.forEach((g, i) => {
    if (g.tp_fp === 'tp') goldenTp.add(i);
  });
  let tp = 0;
  let fp = 0;
  for (const cls of unmatched.values()) {
    if (cls.tp_fp === 'tp') tp++;
    else fp++;
  }
  const overall = computeMetrics({
    goldenTp,
    matched,
    covered,
    unmatchedTp: tp,
    unmatchedFp: fp,
    candidateCount: detail.candidate_findings.length,
  });
  const strata = (attr) => {
    const values = new Set(golden.map((g) => g[attr]));
    for (const cls of unmatched.values()) values.add(cls[attr]);
    const compute = stratum(golden, matched, covered, unmatched, attr);
    return Object.fromEntries([...values].map((v) => [v, compute(v)]));
  };
  return { pr_key: key, metrics: { overall, by_severity: strata('severity'), by_category: strata('category') } };
}

const mean = (values) => {
  const valid = values.filter((v) => v !== null);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
};
const sum = (sets, field) => sets.reduce((a, m) => a + m[field], 0);

function macroSet(sets) {
  const out = {};
  for (const f of ['grounded_precision', 'grounded_recall', 'augmented_precision', 'augmented_recall']) out[f] = mean(sets.map((m) => m[f]));
  out.novel_tp_count = sum(sets, 'novel_tp_count');
  out.novel_tp_yield = mean(sets.map((m) => m.novel_tp_yield));
  for (const f of COUNT_FIELDS) out[f] = sum(sets, f);
  return out;
}

function microSet(sets) {
  const mtp = sum(sets, 'matched_tp_count');
  const mt = sum(sets, 'matched_count');
  const gtp = sum(sets, 'golden_tp_count');
  const gc = sum(sets, 'golden_covered_count');
  const utp = sum(sets, 'unmatched_tp_count');
  const ufp = sum(sets, 'unmatched_fp_count');
  const cc = sum(sets, 'candidate_count');
  return {
    grounded_precision: mt > 0 ? mtp / mt : null,
    grounded_recall: gtp > 0 ? gc / gtp : null,
    augmented_precision: cc > 0 ? (mtp + utp) / cc : null,
    augmented_recall: gtp + utp > 0 ? (gc + utp) / (gtp + utp) : null,
    novel_tp_count: utp,
    novel_tp_yield: cc > 0 ? utp / cc : null,
    candidate_count: cc,
    golden_tp_count: gtp,
    matched_count: mt,
    matched_tp_count: mtp,
    unmatched_count: utp + ufp,
    unmatched_tp_count: utp,
    unmatched_fp_count: ufp,
    golden_covered_count: gc,
  };
}

function aggregateWith(results, combine) {
  const strata = (attr) => {
    const keys = new Set();
    for (const r of results) Object.keys(r.metrics[attr]).forEach((k) => keys.add(k));
    return Object.fromEntries(
      [...keys].map((k) => [k, combine(results.map((r) => r.metrics[attr][k]).filter(Boolean))]),
    );
  };
  return {
    overall: combine(results.map((r) => r.metrics.overall)),
    by_severity: strata('by_severity'),
    by_category: strata('by_category'),
  };
}

export function aggregate(perPr) {
  return { macro: aggregateWith(perPr, macroSet), micro: aggregateWith(perPr, microSet), pr_count: perPr.length, per_pr: perPr };
}

/** Lists paths where two JSON values differ; doubles must be bit-identical, key order is ignored. */
export function diffJson(expected, actual, path = '$', out = []) {
  if (out.length >= 20) return out;
  if (expected === null || actual === null || typeof expected !== 'object' || typeof actual !== 'object') {
    if (!Object.is(expected, actual)) out.push(`${path}: judge ${JSON.stringify(actual)}, derived ${JSON.stringify(expected)}`);
    return out;
  }
  if (Array.isArray(expected) !== Array.isArray(actual)) {
    out.push(`${path}: shape differs`);
    return out;
  }
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const k of keys) {
    if (!(k in expected)) out.push(`${path}.${k}: present in judge output only`);
    else if (!(k in actual)) out.push(`${path}.${k}: missing from judge output`);
    else diffJson(expected[k], actual[k], `${path}.${k}`, out);
  }
  return out;
}

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** Loads golden findings the way the judge's GoldenStore does, applying producer exclusions. */
export function loadGolden(goldenDir, key, excludedProducers = []) {
  const file = join(goldenDir, `${key}.json`);
  if (!existsSync(file)) throw new JudgeRejectedError(`${key}: no golden file`);
  const raw = readFileSync(file, 'utf8');
  const parsed = JSON.parse(raw);
  const findings = parsed.findings.filter(
    (f) => !(typeof f.producer === 'string' && excludedProducers.some((p) => f.producer.startsWith(p))),
  );
  const excluded = parsed.findings.length - findings.length;
  return { findings, hashText: excluded > 0 ? JSON.stringify({ ...parsed, findings }) : raw };
}

/**
 * Verifies a judge run. Throws JudgeRejectedError unless every per-PR score and every aggregate
 * in results.json equals what results.details.json and the golden set imply.
 * Returns the derived per-PR metrics.
 */
export function verifyJudgeRun({ resultsPath, detailsPath = resultsPath.replace(/\.json$/i, '.details.json'), goldenDir, expectedModel, expectedExcludedProducers }) {
  if (!existsSync(resultsPath)) throw new JudgeRejectedError(`judge results missing: ${resultsPath}`);
  if (!existsSync(detailsPath)) throw new JudgeRejectedError(`judge details missing: ${detailsPath}`);
  const results = JSON.parse(readFileSync(resultsPath, 'utf8'));
  const details = JSON.parse(readFileSync(detailsPath, 'utf8'));
  const config = results.eval_config ?? {};
  const excluded = config.excluded_producers ?? [];

  if (expectedModel && !(String(config.matcher_model).endsWith(`/${expectedModel}`) && String(config.classifier_model).endsWith(`/${expectedModel}`))) {
    throw new JudgeRejectedError(`judge ran ${config.matcher_model} / ${config.classifier_model}, expected ${expectedModel}`);
  }
  if (expectedExcludedProducers && JSON.stringify([...expectedExcludedProducers].sort()) !== JSON.stringify(excluded)) {
    throw new JudgeRejectedError(`judge excluded producers ${JSON.stringify(excluded)}, expected ${JSON.stringify(expectedExcludedProducers)}`);
  }
  if (!Array.isArray(details) || !Array.isArray(results.per_pr)) throw new JudgeRejectedError('judge output lacks per_pr or details array');
  const detailKeys = details.map((d) => d.pr_key);
  const resultKeys = results.per_pr.map((r) => r.pr_key);
  if (JSON.stringify(detailKeys) !== JSON.stringify(resultKeys)) {
    throw new JudgeRejectedError(`details cover ${detailKeys.length} PRs, results cover ${resultKeys.length}, or their order differs`);
  }

  const hashTexts = new Map();
  const derived = details.map((d) => {
    const golden = loadGolden(goldenDir, d.pr_key, excluded);
    hashTexts.set(d.pr_key, golden.hashText);
    return derivePR(d, golden.findings);
  });
  const recomputed = aggregate(derived);

  const mismatches = [];
  diffJson(recomputed.per_pr, results.per_pr, '$.per_pr', mismatches);
  diffJson(recomputed.macro, results.macro, '$.macro', mismatches);
  diffJson(recomputed.micro, results.micro, '$.micro', mismatches);
  if (recomputed.pr_count !== results.pr_count) mismatches.push(`$.pr_count: judge ${results.pr_count}, derived ${recomputed.pr_count}`);
  const sortedKeys = [...resultKeys].sort();
  if (config.evaluated_prs_hash !== sha256(sortedKeys.join('\n'))) mismatches.push('$.eval_config.evaluated_prs_hash does not match the scored PRs');
  if (config.golden_hash !== sha256(sortedKeys.map((k) => hashTexts.get(k)).join('\n'))) {
    mismatches.push('$.eval_config.golden_hash does not match the pinned golden files');
  }
  if (mismatches.length) {
    throw new JudgeRejectedError(`judge aggregate does not reproduce from per-PR details: ${mismatches.join('; ')}`, mismatches);
  }
  return { perPr: derived, aggregate: recomputed, evalConfig: config };
}

export { COUNT_FIELDS, RATE_FIELDS };
