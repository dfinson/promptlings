import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { applyLeakage, scanTrial } from '../../scoring/leakage.js';
import { armPreamble as rbArmPreamble, normalizeFindings } from '../reviewbench/adapter.js';
import { qualifyTrial } from '../reviewbench/qualify.js';
import { judgePreflight } from '../reviewbench/judge.js';
import { judgeTrial, metricsFor } from './judge.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SUITE_PATH = join(HERE, 'suite.yaml');
export const PR_DIR = '.review';
export const BASE_BRANCH = 'review-base';
export const HEAD_BRANCH = 'pr-head';

export function loadSuite(path = SUITE_PATH) {
  return parseYaml(readFileSync(path, 'utf8'));
}

function artifactRootOf(ctx = {}) {
  const root = ctx.artifactRoot ?? process.env.EVALS_ARTIFACT_ROOT;
  if (!root) throw new Error('Martian needs ctx.artifactRoot or EVALS_ARTIFACT_ROOT');
  return root;
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Reads the pinned dataset under <artifactRoot>/datasets/martian and verifies every file hash. */
export function loadDataset(suite, ctx = {}) {
  const dir = join(artifactRootOf(ctx), 'datasets', 'martian');
  for (const [file, want] of Object.entries(suite.dataset.files)) {
    const got = sha256(readFileSync(join(dir, file)));
    if (got !== want) throw new Error(`Martian dataset ${file} has sha256 ${got}, expected ${want}`);
  }
  const prs = JSON.parse(readFileSync(join(dir, 'prs.json'), 'utf8'));
  const golden = new Map();
  for (const file of Object.keys(suite.dataset.files).filter((f) => f.startsWith('golden_comments/'))) {
    for (const entry of JSON.parse(readFileSync(join(dir, file), 'utf8'))) golden.set(entry.url, entry);
  }
  return { dir, prs, golden };
}

function taskId(pr) {
  const repo = pr.repo.replace(/^discourse-graphite$/, 'discourse');
  return `${repo}-${pr.pr_number}`;
}

function toTask(pr, golden) {
  const g = golden.get(pr.url);
  if (!g) throw new Error(`no golden comments for ${pr.url}`);
  return {
    id: taskId(pr),
    url: pr.url,
    set: pr.set,
    nwo: `${pr.owner}/${pr.repo}`,
    repo: `${pr.owner}/${pr.repo}`,
    prNumber: pr.pr_number,
    title: pr.title,
    body: pr.body ?? '',
    // review-base is the merge base, so the reviewed diff is GitHub's pull request diff.
    base: pr.merge_base,
    prBase: pr.base,
    head: pr.head,
    aheadBy: pr.ahead_by,
    golden: g.comments.map((c, i) => ({ index: i + 1, comment: c.comment, severity: c.severity, category: c.category })),
    goldenNote: g.az_comment ?? null,
  };
}

export function listTasks(split, ctx = {}) {
  const suite = ctx.suite ?? loadSuite();
  const { prs, golden } = loadDataset(suite, ctx);
  const def = suite.splits[split];
  if (!def) throw new Error(`unknown split ${split}`);
  let tasks = prs.map((p) => toTask(p, golden));
  if (def.ids) tasks = tasks.filter((t) => def.ids.includes(t.id));
  const ids = new Set(tasks.map((t) => t.id));
  if (ids.size !== tasks.length) throw new Error('duplicate Martian task ids');
  if (def.size && tasks.length !== def.size) throw new Error(`split ${split} has ${tasks.length} tasks, expected ${def.size}`);
  // Round-robin across repositories, so a run that stops at its credit ceiling still covers every repository.
  const byRepo = new Map();
  for (const t of tasks) byRepo.set(t.set, [...(byRepo.get(t.set) ?? []), t]);
  const queues = [...byRepo.values()];
  const ordered = [];
  while (ordered.length < tasks.length) for (const q of queues) if (q.length) ordered.push(q.shift());
  return ordered;
}

export function armPreamble(task, arm, suite = loadSuite()) {
  return rbArmPreamble(task, arm, suite);
}

export function buildPrompt(task, arm, suite = loadSuite()) {
  const request = suite.reviewRequests?.[arm.id] ?? suite.reviewRequests?.default;
  if (!request) throw new Error(`suite.yaml has no review request for arm ${arm.id}`);
  const shared = suite.prompt.replaceAll('{{review_request}}', request.trim()).replaceAll('{{pr_dir}}', PR_DIR);
  const preamble = armPreamble(task, arm, suite);
  return preamble ? `${preamble}\n\n${shared}` : shared;
}

function git(args, cwd) {
  return execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'core.longpaths=true', '-c', 'core.hooksPath=', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1' },
  });
}

const bareGit = (cache, args) => git(['--git-dir', cache, ...args]);

function hasCommit(cache, sha) {
  try {
    bareGit(cache, ['cat-file', '-e', `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// mkdir is atomic, so it serializes fetches into one cache across concurrent trials.
function withLock(lockDir, fn) {
  const started = Date.now();
  for (;;) {
    try {
      mkdirSync(lockDir);
      break;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      if (Date.now() - started > 60 * 60 * 1000) throw new Error(`timed out waiting for ${lockDir}`);
      sleep(2000);
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lockDir, { recursive: true, force: true });
  }
}

/** Per-task shallow bare cache holding head (with its PR commits) and the merge base under refs/mt/<sha>. */
export function ensureRepoCache(task, ctx = {}) {
  const root = join(artifactRootOf(ctx), 'datasets', 'martian-repos');
  mkdirSync(root, { recursive: true });
  const cache = join(root, `${task.id}.git`);
  return withLock(`${cache}.lock`, () => {
    if (!existsSync(cache)) git(['init', '-q', '--bare', cache]);
    const url = `https://github.com/${task.nwo}.git`;
    if (!hasCommit(cache, task.head)) {
      const depth = String((task.aheadBy ?? 1) + 2);
      try {
        bareGit(cache, ['fetch', '-q', '--no-tags', `--depth=${depth}`, url, `+${task.head}:refs/mt/${task.head}`]);
      } catch {
        bareGit(cache, ['fetch', '-q', '--no-tags', `--depth=${depth}`, url, `+refs/pull/${task.prNumber}/head:refs/mt/pull`]);
      }
    }
    if (!hasCommit(cache, task.base)) bareGit(cache, ['fetch', '-q', '--no-tags', '--depth=1', url, `+${task.base}:refs/mt/${task.base}`]);
    for (const sha of [task.head, task.base]) {
      if (!hasCommit(cache, sha)) throw new Error(`${task.id}: commit ${sha} unavailable from ${url}`);
      bareGit(cache, ['update-ref', `refs/mt/${sha}`, sha]);
    }
    bareGit(cache, ['update-ref', `refs/heads/${HEAD_BRANCH}`, task.head]);
    bareGit(cache, ['update-ref', `refs/heads/${BASE_BRANCH}`, task.base]);
    bareGit(cache, ['symbolic-ref', 'HEAD', `refs/heads/${HEAD_BRANCH}`]);
    return cache;
  });
}

/** Fetches every task's cache up front, one at a time, so trials only clone locally. */
export function prefetch(split = 'offline', ctx = {}) {
  const out = [];
  for (const task of listTasks(split, ctx)) {
    const started = Date.now();
    ensureRepoCache(task, ctx);
    out.push({ task: task.id, ms: Date.now() - started });
    console.log(`${task.id} ${Date.now() - started} ms`);
  }
  return out;
}

/** Checks the PR out at its head with its PR history and the merge base, with no remote configured. */
export function materialize(task, workspace, ctx = {}) {
  mkdirSync(workspace, { recursive: true });
  if (readdirSync(workspace).length) throw new Error(`workspace is not empty: ${workspace}`);
  const cache = ensureRepoCache(task, ctx);
  // A local clone hardlinks the cache's objects, so large repositories cost no pack transfer.
  git(['clone', '-q', '--local', '--no-checkout', '--no-tags', cache, workspace]);
  git(['config', 'core.longpaths', 'true'], workspace);
  git(['branch', '-q', '-f', BASE_BRANCH, `origin/${BASE_BRANCH}`], workspace);
  git(['remote', 'remove', 'origin'], workspace);
  git(['-c', 'advice.detachedHead=false', 'checkout', '-q', HEAD_BRANCH], workspace);
  const head = git(['rev-parse', 'HEAD'], workspace).trim();
  if (head !== task.head) throw new Error(`${task.id}: checked out ${head}, expected ${task.head}`);
  const prDir = join(workspace, PR_DIR);
  mkdirSync(prDir, { recursive: true });
  const meta = { repo: task.repo, pr_number: task.prNumber, base: task.base, head: task.head, base_branch: BASE_BRANCH, title: task.title, body: task.body };
  writeFileSync(join(prDir, 'pr.json'), `${JSON.stringify(meta, null, 2)}\n`);
  // Two-dot from the merge base: the shallow history may not reach a common ancestor for three-dot.
  writeFileSync(join(prDir, 'diff.patch'), git(['diff', '--no-color', BASE_BRANCH, HEAD_BRANCH], workspace));
  appendFileSync(join(workspace, '.git', 'info', 'exclude'), `\n/${PR_DIR}/\n/.copilot-tracking/\n`);
  return { workspace, base: BASE_BRANCH, head: HEAD_BRANCH, baseSha: task.base, headSha: task.head };
}

function trialDirOf(record, ctx) {
  if (ctx.trialDir) return ctx.trialDir;
  if (record.trialDir) return record.trialDir;
  const anchor = record.outputPath ?? record.eventsPath ?? record.transcriptPath;
  if (!anchor) throw new Error('collect cannot locate the trial directory');
  return dirname(anchor);
}

function lastJsonBlock(text) {
  const blocks = [...text.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n```/g)].map((m) => m[1]);
  for (let i = blocks.length - 1; i >= 0; i--) {
    try {
      const value = JSON.parse(blocks[i]);
      if (value && Array.isArray(value.findings)) return value;
    } catch {
      // not the findings block
    }
  }
  return null;
}

function armIdOf(record, ctx) {
  return ctx.arm?.id ?? (typeof record.arm === 'string' ? record.arm : record.arm?.id) ?? record.armId ?? null;
}

// Large repositories: drop the checkout once findings and the diff are kept beside the trial.
function dropWorkspace(workspace, trialDir) {
  try {
    const patch = join(workspace, PR_DIR, 'diff.patch');
    if (existsSync(patch)) copyFileSync(patch, join(trialDir, 'diff.patch'));
    const findings = join(workspace, PR_DIR, 'findings.json');
    if (existsSync(findings)) copyFileSync(findings, join(trialDir, 'findings.raw.json'));
    rmSync(workspace, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
  } catch {
    // Disk cleanup only; a leftover workspace does not change the result.
  }
}

export function collect(trialRecord, task, ctx = {}) {
  const trialDir = trialDirOf(trialRecord, ctx);
  const scan = scanTrial(trialRecord);
  const audited = applyLeakage(trialRecord, scan);
  const armId = armIdOf(trialRecord, ctx) ?? trialDir.split(/[\\/]/).at(-2);
  const suite = ctx.suite ?? loadSuite();
  const armConfig = suite.arms?.find((a) => a.id === armId) ?? ctx.arm ?? null;
  const workspace = ctx.workspace ?? join(trialDir, 'workspace');
  const findingsPath = join(workspace, PR_DIR, 'findings.json');
  const base = { trialDir, leakage: audited.leakage };
  if (armConfig?.promptPreamble) {
    const preamble = armPreamble(task, armConfig, suite);
    base.promptPreamble = { text: preamble, sha256: sha256(preamble) };
  }
  const qualification = (findingsSource) =>
    armConfig?.qualificationChecks?.length
      ? { qualification: qualifyTrial({ record: trialRecord, trialDir, armConfig, findingsSource, findingsPath }) }
      : {};
  const finish = (result) => {
    dropWorkspace(workspace, trialDir);
    return result;
  };
  if (audited.status === 'invalidated') return finish({ ...base, ...qualification(null), status: 'invalidated', invalidated: true, reason: audited.reason });
  if (trialRecord.status !== 'completed') return finish({ ...base, ...qualification(null), status: trialRecord.status, invalidated: false, reason: trialRecord.reason ?? `trial ${trialRecord.status}` });
  let raw;
  let source;
  try {
    if (existsSync(findingsPath)) {
      raw = JSON.parse(readFileSync(findingsPath, 'utf8'));
      source = findingsPath;
    } else if (trialRecord.outputPath && existsSync(trialRecord.outputPath)) {
      raw = lastJsonBlock(readFileSync(trialRecord.outputPath, 'utf8'));
      source = trialRecord.outputPath;
    }
    if (!raw) throw new Error(`no findings file at ${findingsPath} and no findings block in the final answer`);
    const candidate = normalizeFindings(raw, task, armId, trialRecord.wallMs);
    const candidatePath = join(trialDir, 'candidate.json');
    writeFileSync(candidatePath, `${JSON.stringify(candidate, null, 2)}\n`);
    const quals = qualification(source);
    return finish({ ...base, ...quals, status: 'completed', invalidated: false, candidatePath, findingsSource: source, findingsCount: candidate.findings.length, output: JSON.stringify(candidate) });
  } catch (err) {
    return finish({ ...base, ...qualification(source ?? null), status: 'errored', invalidated: false, reason: `findings: ${err.message}` });
  }
}

function gatherTrials(runDir) {
  const out = [];
  const trialsDir = join(runDir, 'trials');
  if (!existsSync(trialsDir)) return out;
  for (const task of readdirSync(trialsDir)) {
    for (const arm of readdirSync(join(trialsDir, task))) {
      const armDir = join(trialsDir, task, arm);
      if (!statSync(armDir).isDirectory()) continue;
      for (const repeat of readdirSync(armDir)) {
        const file = join(armDir, repeat, 'candidate.json');
        if (existsSync(file)) out.push({ task, arm, repeat: /^\d+$/.test(repeat) ? Number(repeat) : repeat, trialDir: join(armDir, repeat), candidate: JSON.parse(readFileSync(file, 'utf8')) });
      }
    }
  }
  return out;
}

async function pool(items, size, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  }));
}

/**
 * Judges every collected trial blind to its arm: one call per trial lists the PR's golden
 * comments and the trial's findings and asks which findings raise the same underlying issue as
 * each golden comment. A trial whose judging fails three times has no score entry; it drops out of
 * pairing and is listed in judgeFailures.
 */
export async function scoreRun({ runDir, suite = loadSuite(), env = process.env, fetchImpl = fetch, ...ctx }) {
  const tasks = new Map(listTasks(Object.keys(suite.splits)[0], { ...ctx, suite }).map((t) => [t.id, t]));
  const entries = [];
  const judgeFailures = [];
  const trials = gatherTrials(runDir);
  await pool(trials, suite.judge.concurrency ?? 4, async (t) => {
    const task = tasks.get(t.task);
    if (!task) {
      judgeFailures.push({ task: t.task, arm: t.arm, repeat: t.repeat, reason: 'unknown task' });
      return;
    }
    try {
      const verdict = await judgeTrial({ runDir, task, trial: t, judge: suite.judge, env, fetchImpl });
      entries.push({ task: t.task, arm: t.arm, repeat: t.repeat, variant: 'primary', metrics: metricsFor(task, t.candidate.findings, verdict) });
    } catch (err) {
      judgeFailures.push({ task: t.task, arm: t.arm, repeat: t.repeat, reason: err.message });
    }
  });
  entries.sort((a, b) => `${a.task}${a.arm}`.localeCompare(`${b.task}${b.arm}`));
  return { entries, rejected: [], judgeFailures };
}

export async function preflight(suite = loadSuite(), ctx = {}) {
  if (!ctx.runDir) throw new Error('preflight needs ctx.runDir');
  return judgePreflight({ runDir: ctx.runDir, judge: suite.judge, env: ctx.env ?? process.env, ...(ctx.fetchImpl ? { fetchImpl: ctx.fetchImpl } : {}) });
}
