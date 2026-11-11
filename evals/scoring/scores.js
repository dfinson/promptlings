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
        const invalidated = record.status === 'invalidated' || collected.invalidated === true;
        const status = invalidated ? 'invalidated' : record.status ?? 'errored';
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
