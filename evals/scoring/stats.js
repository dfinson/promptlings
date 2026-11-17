// Paired bootstrap over tasks and Holm step-down correction.

export const DEFAULT_RESAMPLES = 10_000;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mean(values) {
  if (!values.length) return NaN;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

// Linear interpolation between order statistics (Hyndman and Fan type 7).
export function percentile(sorted, q) {
  if (!sorted.length) return NaN;
  const h = (sorted.length - 1) * q;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

// diffs: one paired difference (arm B minus arm A) per task.
export function pairedBootstrap(diffs, { resamples = DEFAULT_RESAMPLES, seed = 1, level = 0.95 } = {}) {
  const n = diffs.length;
  if (n === 0) return { n, mean: NaN, ci: [NaN, NaN], p: NaN, resamples, level };
  const observed = mean(diffs);
  const random = mulberry32(seed);
  const means = new Float64Array(resamples);
  let atOrBelowZero = 0;
  let atOrAboveZero = 0;
  for (let b = 0; b < resamples; b += 1) {
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += diffs[Math.floor(random() * n)];
    const m = sum / n;
    means[b] = m;
    if (m <= 0) atOrBelowZero += 1;
    if (m >= 0) atOrAboveZero += 1;
  }
  means.sort();
  const alpha = 1 - level;
  const ci = [percentile(means, alpha / 2), percentile(means, 1 - alpha / 2)];
  // Two-sided bootstrap p for a zero mean difference, with the +1 correction so p is never 0.
  const p = Math.min(1, (2 * (Math.min(atOrBelowZero, atOrAboveZero) + 1)) / (resamples + 1));
  return { n, mean: observed, ci, p, resamples, level };
}

// Returns Holm-adjusted p-values in input order.
export function holm(pValues) {
  const m = pValues.length;
  const order = pValues.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const adjusted = new Array(m);
  let running = 0;
  order.forEach(([p, i], rank) => {
    running = Math.max(running, Math.min(1, (m - rank) * p));
    adjusted[i] = running;
  });
  return adjusted;
}
