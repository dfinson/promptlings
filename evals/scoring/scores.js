// Collects per-trial metrics from a run directory into scores.json, consumed by the report.
import fs from 'node:fs';
import path from 'node:path';

export const SCORES_SCHEMA = 1;

function readJson(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

function subdirs(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [];
}

function sameDir(a, b) {
  const norm = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
  return Boolean(a && b) && norm(a) === norm(b);
}

function numericEntries(object) {
  return Object.fromEntries(Object.entries(object ?? {}).filter(([, v]) => typeof v === 'number' && Number.isFinite(v)));
}

function tokenCounts(usage) {
  const d = usage?.tokenDetails;
  if (!d) return null;
  const input = d.input?.tokenCount ?? 0;
  const cacheRead = d.cache_read?.tokenCount ?? 0;
  const cacheWrite = d.cache_write?.tokenCount ?? 0;
  const output = d.output?.tokenCount ?? 0;
  return { input, cacheRead, cacheWrite, output, total: input + cacheRead + cacheWrite + output };
}

// The adapter can downgrade a completed run (invalidated by leakage, errored on unreadable output), never upgrade it.
export function trialStatus(record, collected = {}) {
  if (record?.status === 'invalidated' || collected?.invalidated === true) return 'invalidated';
  const status = record?.status ?? 'errored';
  if (status === 'completed' && collected?.status && collected.status !== 'completed') return collected.status;
  return status;
}

export function metricsFromScorers(scorers = []) {
  const primary = [];
  const secondary = [];
  const higherIsBetter = {};
  const guardrail = [];
  for (const s of scorers) {
    (s.primary ? primary : secondary).push(s.id);
    higherIsBetter[s.id] = s.higherIsBetter ?? true;
    if (s.guardrail) guardrail.push(s.id);
  }
  return { primary, secondary, higherIsBetter, guardrail };
}

// promptfooResults: the `results` array of a Promptfoo evaluate summary (optional).
export function buildScores({ runDir, runId, promptfooResults = [], context = {}, arms = [], metrics = {} }) {
  const root = path.resolve(runDir);
  const trialsDir = path.join(root, 'trials');
  const trials = [];
  for (const task of subdirs(trialsDir)) {
    for (const arm of subdirs(path.join(trialsDir, task))) {
      for (const repeat of subdirs(path.join(trialsDir, task, arm))) {
        const trialDir = path.join(trialsDir, task, arm, repeat);
        const record = readJson(path.join(trialDir, 'trial.json')) ?? {};
        const meta = readJson(path.join(trialDir, 'harness.json')) ?? {};
        const collected = readJson(path.join(trialDir, 'collected.json')) ?? {};
        const result = promptfooResults.find((r) => sameDir(r?.response?.metadata?.trialDir, trialDir));
        const status = trialStatus(record, collected);
        const invalidated = status === 'invalidated';
        trials.push({
          task: meta.taskId ?? task,
          arm: meta.armId ?? arm,
          repeat: meta.repeat ?? Number(repeat),
          trialDir,
          status,
          invalidated,
          reason: collected.reason ?? record.reason ?? null,
          metrics: { ...numericEntries(collected.metrics), ...numericEntries(result?.namedScores) },
          assertionsPassed: result ? Boolean(result.success) : null,
          process: {
            wallMs: record.wallMs ?? null,
            nanoAiu: record.usage?.totalNanoAiu ?? null,
            tokens: tokenCounts(record.usage),
            toolCalls: record.toolCalls ?? record.usage?.toolCalls ?? null,
            subagents: record.subagents ?? record.usage?.subagents ?? null,
            exitCode: record.exitCode ?? null,
          },
          cliVersion: record.cliVersion ?? null,
        });
      }
    }
  }
  trials.sort((a, b) => a.task.localeCompare(b.task) || a.arm.localeCompare(b.arm) || a.repeat - b.repeat);
  return {
    schema: SCORES_SCHEMA,
    runId: runId ?? path.basename(root),
    runDir: root,
    context,
    arms: Object.fromEntries(arms.map((arm) => [arm.id, arm])),
    metrics: { primary: [], secondary: [], higherIsBetter: {}, guardrail: [], ...metrics },
    trials,
  };
}

export function writeScores(scores, runDir) {
  const file = path.join(path.resolve(runDir), 'scores.json');
  fs.writeFileSync(file, JSON.stringify(scores, null, 2));
  return file;
}

const segment = (value) => {
  const text = String(value ?? '').replace(/[^A-Za-z0-9._-]/g, '_');
  return text && text !== '.' && text !== '..' ? text : '_';
};
// scoreRun names arms by their trial directory segment, so both sides are keyed by it.
const entryKey = (task, arm, repeat) => `${task}\u0000${segment(arm)}\u0000${Number(repeat)}`;

/**
 * Folds an adapter's scoreRun result ({ entries, rejected }) into scores.json. Entries are
 * { task, arm, repeat, variant, metrics } per trial (ReviewBench: one per PR, arm and repeat).
 * The primary variant becomes trial.metrics; other variants are kept under trial.variants.
 * Once a run is judged, a usable trial without a primary entry has no judged metrics and
 * drops out of every comparison it belongs to.
 */
export function mergeScoreEntries(scores, { entries = [], rejected = [] } = {}, { primaryVariant = 'primary' } = {}) {
  const byKey = new Map();
  for (const e of entries) {
    const key = entryKey(e.task, e.arm, e.repeat);
    if (!byKey.has(key)) byKey.set(key, new Map());
    const variant = e.variant ?? primaryVariant;
    if (byKey.get(key).has(variant)) throw new Error(`Duplicate score entry for ${e.task} ${e.arm} repeat ${e.repeat} (${variant})`);
    byKey.get(key).set(variant, e.metrics ?? {});
  }
  const rejectedBy = new Map(rejected.filter((r) => (r.variant ?? primaryVariant) === primaryVariant).map((r) => [`${segment(r.arm)}\u0000${Number(r.repeat)}`, r.reason]));
  const matched = new Set();
  const trials = scores.trials.map((t) => {
    const key = entryKey(t.task, t.arm, t.repeat);
    const variants = byKey.get(key);
    if (variants) matched.add(key);
    const primary = variants?.get(primaryVariant);
    const rejectedReason = rejectedBy.get(`${segment(t.arm)}\u0000${Number(t.repeat)}`);
    const judge = primary ? 'scored' : rejectedReason ? 'rejected' : 'missing';
    const out = { ...t, judge, metrics: { ...t.metrics, ...numericEntries(primary) } };
    if (primary) out.strata = Object.fromEntries(Object.entries(primary).filter(([, v]) => v && typeof v === 'object'));
    if (rejectedReason) out.judgeReason = rejectedReason;
    const others = [...(variants ?? new Map())].filter(([v]) => v !== primaryVariant);
    if (others.length) out.variants = Object.fromEntries(others.map(([v, m]) => [v, numericEntries(m)]));
    return out;
  });
  const orphans = [...byKey.keys()].filter((k) => !matched.has(k)).map((k) => {
    const [task, arm, repeat] = k.split('\u0000');
    return { task, arm, repeat: Number(repeat) };
  });
  if (orphans.length) throw new Error(`Score entries match no trial: ${orphans.slice(0, 5).map((o) => `${o.task} ${o.arm} r${o.repeat}`).join(', ')}`);
  return { ...scores, judged: { primaryVariant, entries: entries.length, rejected }, trials };
}

/** Reads <runDir>/scores.json, merges scoreRun output and writes it back. */
export function applyScoreRun(runDir, result, options) {
  const file = path.join(path.resolve(runDir), 'scores.json');
  const merged = mergeScoreEntries(JSON.parse(fs.readFileSync(file, 'utf8')), result, options);
  fs.writeFileSync(file, JSON.stringify(merged, null, 2));
  return merged;
}
