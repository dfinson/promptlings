import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { ensureDataset } from './dataset.js';
import { loadCorpus, resolveSplit, toTask, prKey } from './tasks.js';
import { applyLeakage, scanTrial } from '../../scoring/leakage.js';
import { judgeArm, judgePreflight, preparePiDir, scoreEntries } from './judge.js';
import { qualifyTrial } from './qualify.js';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SUITE_PATH = join(HERE, 'suite.yaml');
export const PR_DIR = '.reviewbench';
export const BASE_BRANCH = 'review-base';
export const HEAD_BRANCH = 'pr-head';

export function loadSuite(path = SUITE_PATH) {
  return parseYaml(readFileSync(path, 'utf8'));
}

function artifactRootOf(ctx = {}) {
  const root = ctx.artifactRoot ?? process.env.EVALS_ARTIFACT_ROOT;
  if (!root) throw new Error('ReviewBench needs ctx.artifactRoot or EVALS_ARTIFACT_ROOT for data downloads');
  return root;
}

function datasetFor(ctx) {
  return ensureDataset({ artifactRoot: artifactRootOf(ctx), lockPath: ctx.lockPath, sourceUrl: ctx.datasetSourceUrl });
}

export function listTasks(split, ctx = {}) {
  const suite = ctx.suite ?? loadSuite();
  const { dir } = datasetFor(ctx);
  return resolveSplit(split, suite.splits, loadCorpus(dir)).map((e) => toTask(e, split));
}

/** The arm's declared host preamble with task commits filled in, or null when the arm has none. */
export function armPreamble(task, arm, suite = loadSuite()) {
  const template = suite.arms?.find((a) => a.id === arm.id)?.promptPreamble ?? arm.promptPreamble;
  if (!template) return null;
  for (const [key, value] of [['base_sha', task?.base], ['head_sha', task?.head]]) {
    if (template.includes(`{{${key}}}`) && !/^[0-9a-f]{40}$/.test(value ?? '')) throw new Error(`arm ${arm.id} preamble needs the task's ${key}`);
  }
  return template.replaceAll('{{base_sha}}', task?.base).replaceAll('{{head_sha}}', task?.head).trim();
}

export function buildPrompt(task, arm, suite = loadSuite()) {
  const request = suite.reviewRequests?.[arm.id] ?? suite.reviewRequests?.default;
  if (!request) throw new Error(`suite.yaml has no review request for arm ${arm.id}`);
  const shared = suite.prompt.replaceAll('{{review_request}}', request.trim()).replaceAll('{{pr_dir}}', PR_DIR);
  const preamble = armPreamble(task, arm, suite);
  return preamble ? `${preamble}\n\n${shared}` : shared;
}

function git(args, cwd) {
  return execFileSync('git', ['-c', 'core.autocrlf=false', '-c', 'core.hooksPath=', ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1' },
  });
}

// The cache is addressed with --git-dir because hosts may set safe.bareRepository=explicit.
function bareGit(cache, args) {
  return git(['--git-dir', cache, ...args]);
}

function hasCommit(cache, sha) {
  try {
    bareGit(cache, ['cat-file', '-e', `${sha}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/** Bare per-repository cache holding base and head under refs/rb/<sha>, fetched from the ReviewBench mirror. */
export function ensureRepoCache(task, ctx = {}) {
  const cache = join(artifactRootOf(ctx), 'datasets', 'reviewbench-repos', `${task.nwo.replace('/', '_')}.git`);
  if (!existsSync(cache)) {
    mkdirSync(cache, { recursive: true });
    git(['init', '-q', '--bare', cache]);
  }
  const missing = [task.base, task.head].filter((sha) => !hasCommit(cache, sha));
  if (missing.length) {
    const mirrorBase = ctx.mirrorBase ?? 'https://github.com/review-bench';
    const mirror = `${mirrorBase}/${task.nwo.replace('/', '_')}.git`;
    const refspecs = missing.map((sha) => `+${sha}:refs/rb/${sha}`);
    try {
      bareGit(cache, ['fetch', '-q', '--no-tags', mirror, ...refspecs]);
    } catch (err) {
      if (ctx.mirrorBase) throw err;
      bareGit(cache, ['fetch', '-q', '--no-tags', `https://github.com/${task.nwo}.git`, ...refspecs]);
    }
  }
  for (const sha of [task.base, task.head]) {
    if (!hasCommit(cache, sha)) throw new Error(`${task.id}: commit ${sha} unavailable from the mirror`);
    bareGit(cache, ['update-ref', `refs/rb/${sha}`, sha]);
  }
  return cache;
}

/**
 * Checks the PR out at its head commit with history, with no remote configured, and writes the
 * PR metadata and diff where the prompt points. The PR URL is left out on purpose.
 */
export function materialize(task, workspace, ctx = {}) {
  mkdirSync(workspace, { recursive: true });
  if (readdirSync(workspace).length) throw new Error(`workspace is not empty: ${workspace}`);
  const cache = ensureRepoCache(task, ctx);
  git(['init', '-q'], workspace);
  git(['fetch', '-q', '--no-tags', cache, `refs/rb/${task.head}:refs/heads/${HEAD_BRANCH}`, `refs/rb/${task.base}:refs/heads/${BASE_BRANCH}`], workspace);
  git(['-c', 'advice.detachedHead=false', 'checkout', '-q', HEAD_BRANCH], workspace);
  const head = git(['rev-parse', 'HEAD'], workspace).trim();
  if (head !== task.head) throw new Error(`${task.id}: checked out ${head}, expected ${task.head}`);

  const prDir = join(workspace, PR_DIR);
  mkdirSync(prDir, { recursive: true });
  const meta = { repo: task.repo, pr_number: task.prNumber, base: task.base, head: task.head, base_branch: BASE_BRANCH, title: task.title, body: task.body };
  writeFileSync(join(prDir, 'pr.json'), `${JSON.stringify(meta, null, 2)}\n`);
  writeFileSync(join(prDir, 'diff.patch'), git(['diff', '--no-color', `${BASE_BRANCH}...${HEAD_BRANCH}`], workspace));
  // .copilot-tracking/ is excluded so an agent's own working artifacts (hve-core's
  // pr-reference.xml and review folders) never show up as untracked changes under review.
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

function normalizeFile(file) {
  if (typeof file !== 'string' || !file.trim()) return null;
  const f = file.trim().replace(/\\/g, '/').replace(/^\.\//, '');
  if (f.startsWith('/') || /^[a-z]:/i.test(f) || f.split('/').includes('..')) return null;
  return f;
}

/** Validates the agent's findings against the PR and returns them in the judge's candidate shape. */
export function normalizeFindings(raw, task, armId, wallMs) {
  if (!raw || typeof raw !== 'object') throw new Error('findings file is not a JSON object');
  if (raw.pr) {
    if (raw.pr.head && raw.pr.head !== task.head) throw new Error(`findings name head ${raw.pr.head}, PR head is ${task.head}`);
    if (raw.pr.pr_number !== undefined && Number(raw.pr.pr_number) !== task.prNumber) throw new Error(`findings name PR ${raw.pr.pr_number}, expected ${task.prNumber}`);
  }
  if (!Array.isArray(raw.findings)) throw new Error('findings must be an array');
  const findings = raw.findings.map((f, i) => {
    const file = normalizeFile(f?.file);
    if (!file) throw new Error(`finding ${i} has an invalid file path`);
    const start = Number(f.start_line);
    const end = f.end_line === undefined || f.end_line === null ? start : Number(f.end_line);
    if (!Number.isInteger(start) || start < 1 || !Number.isInteger(end) || end < start) throw new Error(`finding ${i} has invalid line numbers`);
    if (typeof f.message !== 'string' || !f.message.trim()) throw new Error(`finding ${i} has no message`);
    return { producer: armId, file, start_line: start, end_line: end, message: f.message.trim() };
  });
  return {
    pr: { repo: task.repo, pr_number: task.prNumber, base: task.base, head: task.head },
    agent: armId,
    findings,
    ...(Number.isFinite(wallMs) ? { usage: { time_in_ms: wallMs } } : {}),
  };
}

function armIdOf(record, ctx) {
  if (ctx.arm?.id) return ctx.arm.id;
  if (typeof record.arm === 'string') return record.arm;
  if (record.arm?.id) return record.arm.id;
  if (record.armId) return record.armId;
  return null;
}

/**
 * Audits the transcript for leakage first; a leaking trial is invalidated and its findings are
 * not judged. Otherwise reads the findings file (falling back to the last JSON block in the
 * final answer) and writes candidate.json beside trial.json.
 */
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
    // Evidence for the report's disclosure: the exact preamble this trial was given.
    const preamble = armPreamble(task, armConfig, suite);
    base.promptPreamble = { text: preamble, sha256: createHash('sha256').update(preamble).digest('hex') };
  }
  const qualification = (findingsSource) =>
    armConfig?.qualificationChecks?.length
      ? { qualification: qualifyTrial({ record: trialRecord, trialDir, armConfig, findingsSource, findingsPath }) }
      : {};
  if (audited.status === 'invalidated') {
    return { ...base, ...qualification(null), status: 'invalidated', invalidated: true, reason: audited.reason };
  }
  if (trialRecord.status !== 'completed') {
    return { ...base, ...qualification(null), status: trialRecord.status, invalidated: false, reason: trialRecord.reason ?? `trial ${trialRecord.status}` };
  }
  let raw;
  let source;
  try {
    // Only the contract path or the final answer is read; other workspace files (for example
    // hve-core's .copilot-tracking/pr/pr-reference.xml or per-perspective findings) are never findings.
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
    return {
      ...base,
      ...qualification(source),
      status: 'completed',
      invalidated: false,
      candidatePath,
      findingsSource: source,
      findingsCount: candidate.findings.length,
      output: JSON.stringify(candidate),
      prKey: prKey(candidate.pr),
    };
  } catch (err) {
    return { ...base, ...qualification(source ?? null), status: 'errored', invalidated: false, reason: `findings: ${err.message}` };
  }
}

/** Groups collected candidates in <runDir>/trials/<task>/<arm>/<repeat>/candidate.json by arm and repeat. */
export function gatherCandidates(runDir) {
  const groups = new Map();
  const trialsDir = join(runDir, 'trials');
  if (!existsSync(trialsDir)) return groups;
  for (const task of readdirSync(trialsDir)) {
    for (const arm of readdirSync(join(trialsDir, task))) {
      for (const repeat of readdirSync(join(trialsDir, task, arm))) {
        const file = join(trialsDir, task, arm, repeat, 'candidate.json');
        if (!existsSync(file)) continue;
        const key = `${arm}\u0000${repeat}`;
        // Directory names are the runner's repeat index (0-based); keep it numeric for score joins.
        if (!groups.has(key)) groups.set(key, { arm, repeat: /^\d+$/.test(repeat) ? Number(repeat) : repeat, candidates: [] });
        groups.get(key).candidates.push(JSON.parse(readFileSync(file, 'utf8')));
      }
    }
  }
  return groups;
}

/**
 * Judges every arm and repeat of a finished stage with the pinned judge and verifies each run.
 * With diagnostic set, also judges with the suite's excluded producer prefixes and labels the
 * entries as that variant; they are reported beside the primary result, never instead of it.
 */
export async function scoreRun({ runDir, suite = loadSuite(), diagnostic = false, runner, env = process.env, fetchImpl, datasetDir, ...ctx }) {
  // datasetDir is for offline checks; runs resolve and verify the pinned dataset.
  const dir = datasetDir ?? datasetFor(ctx).dir;
  const artifactRoot = artifactRootOf(ctx);
  const { piDir } = await preparePiDir(runDir, { env, ...(fetchImpl ? { fetchImpl } : {}) });
  const entries = [];
  const rejected = [];
  const variants = [{ variant: 'primary', excludeProducers: [] }];
  if (diagnostic) variants.push({ variant: 'exclude-producers', excludeProducers: suite.judge.diagnosticExcludeProducers });
  for (const { arm, repeat, candidates } of gatherCandidates(runDir).values()) {
    for (const v of variants) {
      try {
        const result = await judgeArm({ datasetDir: dir, runDir, artifactRoot, arm, repeat, candidates, judge: suite.judge, ...v, runner, env, piDir });
        entries.push(...scoreEntries({ arm, repeat, variant: v.variant, perPr: result.perPr }));
      } catch (err) {
        rejected.push({ arm, repeat, variant: v.variant, reason: err.message });
      }
    }
  }
  return { entries, rejected };
}

/**
 * Judge preflight for core's bin/eval.js: call before any trial of a stage. It resolves the
 * judge token's Copilot API host and makes one minimal judge-model call; a rejection means the
 * stage must stop before trial credits are spent.
 */
export async function preflight(suite = loadSuite(), ctx = {}) {
  if (!ctx.runDir) throw new Error('preflight needs ctx.runDir');
  return judgePreflight({ runDir: ctx.runDir, judge: suite.judge, env: ctx.env ?? process.env, ...(ctx.fetchImpl ? { fetchImpl: ctx.fetchImpl } : {}) });
}

// Unquotes a path git printed in C style ("a/caf\303\251.txt"): octal escapes are UTF-8 bytes.
function gitPath(raw) {
  if (!raw.startsWith('"')) return raw;
  const bytes = [];
  const body = raw.slice(1, -1);
  const simple = { n: 10, t: 9, r: 13, a: 7, b: 8, f: 12, v: 11, '"': 34, '\\': 92 };
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '\\') {
      bytes.push(...Buffer.from(body[i]));
    } else if (/[0-7]/.test(body[i + 1])) {
      bytes.push(parseInt(body.slice(i + 1, i + 4), 8));
      i += 3;
    } else {
      bytes.push(simple[body[i + 1]] ?? body.charCodeAt(i + 1));
      i += 1;
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

/** Changed file paths (post-change names; deleted files keep their old name) in a git diff. */
export function diffFiles(patch) {
  const files = new Set();
  for (const block of patch.split(/^diff --git /m).slice(1)) {
    // git ends ---/+++ names that contain spaces with a tab.
    const line = (re) => block.match(re)?.[1]?.replace(/\t$/, '');
    const plus = line(/^\+\+\+ (.+)$/m);
    const minus = line(/^--- (.+)$/m);
    const renamed = line(/^rename to (.+)$/m);
    let path;
    if (plus && plus !== '/dev/null') path = gitPath(plus).replace(/^b\//, '');
    else if (renamed) path = gitPath(renamed);
    else if (minus && minus !== '/dev/null') path = gitPath(minus).replace(/^a\//, '');
    else {
      // Mode-only or binary change without ---/+++ lines: the header is "a/<p> b/<p>".
      const header = block.split('\n')[0];
      const quoted = header.match(/^"a\/(?:[^"\\]|\\.)*" ("b\/(?:[^"\\]|\\.)*")$/);
      path = quoted ? gitPath(quoted[1]).slice(2) : header.slice(header.length / 2 + 1).replace(/^b\//, '');
    }
    files.add(path);
  }
  return [...files];
}

function findPatch(runDir, taskId) {
  // Core's layout is <runDir>/workspaces/<task>/<arm>/<repeat>; collect's default is <trialDir>/workspace.
  const roots = [join(runDir, 'workspaces', taskId), join(runDir, 'trials', taskId)];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const arm of readdirSync(root).sort()) {
      const armDir = join(root, arm);
      if (!statSync(armDir).isDirectory()) continue;
      for (const repeat of readdirSync(armDir).sort()) {
        for (const ws of [join(armDir, repeat), join(armDir, repeat, 'workspace')]) {
          const patch = join(ws, PR_DIR, 'diff.patch');
          if (existsSync(patch)) return patch;
        }
      }
    }
  }
  return null;
}

/**
 * Inputs for the classification panel (#100's runPanelAnalysis). goldenDir holds upstream
 * golden files named <pr_key>.json, which is also the task id and trial directory name.
 * diffFilesFor(task) takes a task id or task and returns the PR's changed file paths from the
 * diff materialize wrote; a task with no materialized diff throws rather than skipping the split.
 */
export function panelInputs(runDir, suite = loadSuite(), ctx = {}) {
  const panel = suite.panel ?? {};
  const datasetDir = ctx.datasetDir ?? datasetFor(ctx).dir;
  const taxonomyPath = panel.taxonomy ? join(HERE, panel.taxonomy) : null;
  const cache = new Map();
  return {
    goldenDir: join(datasetDir, 'golden'),
    taxonomyPath,
    taxonomy: taxonomyPath ? JSON.parse(readFileSync(taxonomyPath, 'utf8')) : null,
    namedInAdvance: panel.namedInAdvance ?? [],
    requireFrozen: (stage) => panel.requireFrozen?.[stage] === true,
    diffFilesFor(task) {
      const id = typeof task === 'string' ? task : task?.id;
      if (!id) throw new Error('diffFilesFor needs a task id');
      if (!cache.has(id)) {
        const patch = findPatch(runDir, id);
        if (!patch) throw new Error(`no materialized diff for ${id} under ${runDir}`);
        cache.set(id, diffFiles(readFileSync(patch, 'utf8')));
      }
      return cache.get(id);
    },
  };
}