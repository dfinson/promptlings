import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  if (!source.COPILOT_GITHUB_TOKEN) throw new Error('COPILOT_GITHUB_TOKEN is required for the github-copilot judge');
  env.COPILOT_GITHUB_TOKEN = source.COPILOT_GITHUB_TOKEN;
  env.PI_CODING_AGENT_DIR = piDir;
  return env;
}

/** Run-local pi directory holding the models.json that adds the judge model to the github-copilot provider. */
export function preparePiDir(runDir, template = PI_MODELS_TEMPLATE) {
  const piDir = join(runDir, 'judge', 'pi-agent');
  mkdirSync(piDir, { recursive: true });
  copyFileSync(template, join(piDir, 'models.json'));
  return piDir;
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
}) {
  const dir = judgeDir(runDir, arm, repeat, variant);
  const { candDir, keys } = writeCandidates(dir, candidates);
  const output = join(dir, 'results.json');
  const piDir = preparePiDir(runDir);
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
