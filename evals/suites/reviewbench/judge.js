import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prKey } from './tasks.js';
import { verifyJudgeRun } from './metrics.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PI_MODELS_TEMPLATE = join(HERE, 'pi-models.json');

/** Only these variables reach the judge. Model keys for other providers are never passed. */
const ENV_ALLOW = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'ComSpec', 'PATHEXT', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'REVIEW_BENCH_JUDGE_TIMEOUT_MS'];

export function judgeEnv(piDir, source = process.env) {
  const env = {};
  for (const k of ENV_ALLOW) if (source[k] !== undefined) env[k] = source[k];
  env.COPILOT_GITHUB_TOKEN = judgeToken(source);
  env.PI_CODING_AGENT_DIR = piDir;
  return env;
}

export const COPILOT_USER_URL = 'https://api.github.com/copilot_internal/user';

function judgeToken(env) {
  if (!env.COPILOT_GITHUB_TOKEN) throw new Error('COPILOT_GITHUB_TOKEN is required for the github-copilot judge');
  return env.COPILOT_GITHUB_TOKEN;
}

/**
 * The Copilot API host differs by account (individual, business, enterprise), and pi's default
 * host answers 401 for accounts served elsewhere. The account's own host is endpoints.api.
 */
export async function resolveCopilotApiBase(token, fetchImpl = fetch) {
  let res;
  try {
    res = await fetchImpl(COPILOT_USER_URL, {
      headers: { Authorization: `token ${token}`, Accept: 'application/json', 'User-Agent': 'promptlings-evals' },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new Error(`cannot resolve the judge's Copilot API endpoint: ${COPILOT_USER_URL} failed: ${err.message}`);
  }
  if (!res.ok) throw new Error(`cannot resolve the judge's Copilot API endpoint: ${COPILOT_USER_URL} returned ${res.status}`);
  const api = (await res.json())?.endpoints?.api;
  if (typeof api !== 'string' || !/^https:\/\/[^\s/]+/.test(api)) {
    throw new Error(`cannot resolve the judge's Copilot API endpoint: ${COPILOT_USER_URL} has no https endpoints.api`);
  }
  return api.replace(/\/+$/, '');
}

/**
 * Run-local pi directory holding the models.json that adds the judge model to the github-copilot
 * provider, with the provider baseUrl set to the judge token's own Copilot API host.
 */
export async function preparePiDir(runDir, { env = process.env, fetchImpl = fetch, template = PI_MODELS_TEMPLATE } = {}) {
  const baseUrl = await resolveCopilotApiBase(judgeToken(env), fetchImpl);
  const models = JSON.parse(readFileSync(template, 'utf8'));
  models.providers['github-copilot'].baseUrl = baseUrl;
  const piDir = join(runDir, 'judge', 'pi-agent');
  mkdirSync(piDir, { recursive: true });
  writeFileSync(join(piDir, 'models.json'), `${JSON.stringify(models, null, 2)}\n`);
  return { piDir, baseUrl };
}

/**
 * One minimal judge-model call, made the way pi's anthropic-messages provider calls Copilot
 * (Bearer token, POST <baseUrl>/v1/messages, the model's headers). Run it before any trial so a
 * judge that cannot answer fails the stage before trial credits are spent.
 */
export async function judgePreflight({ runDir, judge, env = process.env, fetchImpl = fetch, template = PI_MODELS_TEMPLATE }) {
  if (judge?.provider !== 'github-copilot') throw new Error(`judge preflight supports the github-copilot provider, not ${judge?.provider}`);
  const { piDir, baseUrl } = await preparePiDir(runDir, { env, fetchImpl, template });
  const models = JSON.parse(readFileSync(join(piDir, 'models.json'), 'utf8'));
  const model = models.providers['github-copilot'].models.find((m) => m.id === judge.model);
  if (!model) throw new Error(`judge preflight: ${judge.model} is not in the run-local models.json`);
  if (model.api !== 'anthropic-messages') throw new Error(`judge preflight: unsupported api ${model.api} for ${judge.model}`);
  const url = `${baseUrl}/v1/messages`;
  let res;
  let body;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'anthropic-version': '2023-06-01',
        authorization: `Bearer ${judgeToken(env)}`,
        'X-Initiator': 'user',
        'Openai-Intent': 'conversation-edits',
        ...(model.headers ?? {}),
      },
      body: JSON.stringify({ model: judge.model, max_tokens: 16, messages: [{ role: 'user', content: 'Reply with OK.' }] }),
      signal: AbortSignal.timeout(120_000),
    });
    body = await res.text();
  } catch (err) {
    throw new Error(`judge preflight: ${judge.model} at ${url} failed: ${err.message}`);
  }
  if (!res.ok) throw new Error(`judge preflight: ${judge.model} at ${url} returned ${res.status}: ${body.slice(0, 300)}`);
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`judge preflight: ${judge.model} at ${url} returned a non-JSON body: ${body.slice(0, 300)}`);
  }
  if (!Array.isArray(parsed?.content)) throw new Error(`judge preflight: ${judge.model} at ${url} returned no message content`);
  const record = { status: 'ok', provider: judge.provider, model: judge.model, baseUrl, at: new Date().toISOString() };
  writeFileSync(join(runDir, 'judge', 'preflight.json'), `${JSON.stringify(record, null, 2)}\n`);
  return { ...record, piDir };
}

export function judgeDir(runDir, arm, repeat, variant = 'primary') {
  return join(runDir, 'judge', arm, `r${repeat}`, variant);
}

/**
 * Writes one candidate file per PR. The judge merges files for the same PR, so each arm and
 * repeat gets its own directory; the judged set is the candidate keys present in golden.
 */
export function writeCandidates(dir, candidates) {
  const candDir = join(dir, 'candidates');
  mkdirSync(candDir, { recursive: true });
  const keys = [];
  for (const c of candidates) {
    const key = prKey(c.pr);
    if (keys.includes(key)) throw new Error(`two candidates for ${key} in ${candDir}`);
    keys.push(key);
    writeFileSync(join(candDir, `${key}.json`), `${JSON.stringify(c, null, 2)}\n`);
  }
  return { candDir, keys };
}

function run(cmd, args, options) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'], shell: cmd === 'npm' && process.platform === 'win32' });
    let log = '';
    child.stdout.on('data', (d) => (log += d));
    child.stderr.on('data', (d) => (log += d));
    child.on('error', reject);
    child.on('close', (code) => resolvePromise({ code, log }));
  });
}

export async function ensureJudgeDependencies(datasetDir, runner = run) {
  if (existsSync(join(datasetDir, 'node_modules', '.package-lock.json'))) return;
  const { code, log } = await runner('npm', ['ci', '--no-audit', '--no-fund'], { cwd: datasetDir, env: process.env });
  if (code !== 0) throw new Error(`npm ci for the ReviewBench judge failed (${code}):\n${log}`);
}

/**
 * Judges one arm and repeat, then verifies the run: per-PR metrics re-derived from
 * results.details.json must reproduce results.json exactly or the run is rejected.
 */
export async function judgeArm({
  datasetDir,
  runDir,
  artifactRoot,
  arm,
  repeat = 0,
  candidates,
  judge,
  variant = 'primary',
  excludeProducers = [],
  env = process.env,
  runner = run,
  fetchImpl = fetch,
  piDir,
}) {
  const dir = judgeDir(runDir, arm, repeat, variant);
  const { candDir, keys } = writeCandidates(dir, candidates);
  const output = join(dir, 'results.json');
  piDir ??= (await preparePiDir(runDir, { env, fetchImpl })).piDir;
  await ensureJudgeDependencies(datasetDir, runner);
  // `npm run judge` is `tsx scripts/eval/eval.ts`; calling tsx directly avoids a shell, so
  // paths with spaces stay single arguments on Windows.
  const args = [
    join(datasetDir, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    join('scripts', 'eval', 'eval.ts'),
    '--candidate', candDir,
    '--golden', join(datasetDir, 'golden'),
    '--manifest', join(datasetDir, 'corpus', 'manifest.json'),
    '--output', output,
    '--provider', judge.provider,
    '--model', judge.model,
    '--repo-dir', join(artifactRoot, 'reviewbench', 'judge-repos'),
    '--concurrency', String(judge.concurrency ?? 2),
    '--strict',
    ...excludeProducers.flatMap((p) => ['--exclude-producer', p]),
  ];
  const { code, log } = await runner(process.execPath, args, { cwd: datasetDir, env: judgeEnv(piDir, env) });
  writeFileSync(join(dir, 'judge.log'), log);
  if (code !== 0) throw new Error(`ReviewBench judge failed for ${arm} r${repeat} ${variant} (exit ${code}); see ${join(dir, 'judge.log')}`);

  try {
    const verified = verifyJudgeRun({
      resultsPath: output,
      goldenDir: join(datasetDir, 'golden'),
      expectedModel: judge.model,
      expectedExcludedProducers: excludeProducers,
    });
    const missing = keys.filter((k) => !verified.perPr.some((p) => p.pr_key === k));
    if (missing.length) throw new Error(`judge skipped ${missing.length} candidate PRs: ${missing.join(', ')}`);
    writeFileSync(join(dir, 'per-pr.json'), `${JSON.stringify(verified.perPr, null, 2)}\n`);
    writeFileSync(join(dir, 'verified.json'), `${JSON.stringify({ status: 'verified', prCount: verified.perPr.length }, null, 2)}\n`);
    return { arm, repeat, variant, dir, ...verified };
  } catch (err) {
    writeFileSync(join(dir, 'verified.json'), `${JSON.stringify({ status: 'rejected', reason: err.message }, null, 2)}\n`);
    throw err;
  }
}

/** Score entries in the runner's scores.json shape: one per task, arm and repeat. */
export function scoreEntries({ arm, repeat, variant = 'primary', perPr }) {
  return perPr.map((p) => ({
    task: p.pr_key,
    arm,
    repeat,
    variant,
    metrics: {
      grounded_recall: p.metrics.overall.grounded_recall,
      grounded_precision: p.metrics.overall.grounded_precision,
      augmented_recall: p.metrics.overall.augmented_recall,
      augmented_precision: p.metrics.overall.augmented_precision,
      candidate_count: p.metrics.overall.candidate_count,
      golden_tp_count: p.metrics.overall.golden_tp_count,
      by_severity: p.metrics.by_severity,
      by_category: p.metrics.by_category,
    },
  }));
}

/** Reads a collected trial's normalized candidate (written by adapter.collect). */
export function readCandidate(trialDir) {
  return JSON.parse(readFileSync(join(trialDir, 'candidate.json'), 'utf8'));
}
