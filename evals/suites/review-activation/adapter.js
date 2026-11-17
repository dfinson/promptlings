// review-activation adapter: in-repo fixtures, git workspaces and
// deterministic activation scoring. ESM, no dependencies beyond Node.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateTrial, loadTrialEvents } from './checks.js';

const SUITE_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(SUITE_DIR, 'fixtures');
const FIXED_DATE = '2026-01-01T00:00:00Z';

export const BASE_BRANCH = 'main';
export const HEAD_BRANCH = 'review';

// README wording for the ensemble, so the skill must activate from the request
// alone. Agent arms use the suite prompt.
export const ENSEMBLE_PROMPT = 'Run the review ensemble on this branch against main. '
  + 'The requirements and constraints are in REQUIREMENTS.md. Return the review in this conversation. '
  + 'Do not push, fetch, or post anything.';

function readTask(split, id) {
  const task = JSON.parse(readFileSync(join(FIXTURES_DIR, split, id, 'task.json'), 'utf8'));
  if (task.id !== id) throw new Error(`fixture ${split}/${id} declares id ${task.id}`);
  return { ...task, split };
}

export function listTasks(split, ctx = {}) {
  const declared = ctx.suite?.splits?.[split];
  const splitDir = join(FIXTURES_DIR, split);
  if (!existsSync(splitDir)) throw new Error(`review-activation has no split ${split}`);
  const ids = Array.isArray(declared)
    ? declared
    : readdirSync(splitDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  return ids.map((id) => readTask(split, id));
}

export function buildPrompt(task, arm, suite = {}) {
  return arm?.agent == null ? ENSEMBLE_PROMPT : suite.prompt;
}

function writeTree(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const target = resolve(root, rel);
    if (!target.startsWith(resolve(root) + sep)) throw new Error(`fixture path escapes workspace: ${rel}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

function git(workspace, args) {
  return execFileSync('git', ['-c', 'user.name=evals', '-c', 'user.email=evals@example.invalid', '-c', 'core.hooksPath=', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], {
    cwd: workspace,
    env: { ...process.env, GIT_AUTHOR_DATE: FIXED_DATE, GIT_COMMITTER_DATE: FIXED_DATE },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  }).trim();
}

export function materialize(task, workspace, ctx = {}) {
  mkdirSync(workspace, { recursive: true });
  if (readdirSync(workspace).length) throw new Error(`workspace is not empty: ${workspace}`);
  git(workspace, ['init', '-q', '-b', BASE_BRANCH]);
  writeTree(workspace, { 'REQUIREMENTS.md': task.requirements, ...task.base });
  git(workspace, ['add', '-A']);
  git(workspace, ['commit', '-q', '-m', 'Base for review']);
  git(workspace, ['checkout', '-q', '-b', HEAD_BRANCH]);
  writeTree(workspace, task.head);
  git(workspace, ['add', '-A']);
  git(workspace, ['commit', '-q', '-m', task.commitMessage ?? 'Change under review']);
  return {
    workspace,
    base: BASE_BRANCH,
    head: HEAD_BRANCH,
    baseSha: git(workspace, ['rev-parse', BASE_BRANCH]),
    headSha: git(workspace, ['rev-parse', HEAD_BRANCH]),
  };
}

function resolveArm(trialRecord, ctx) {
  if (trialRecord.arm && typeof trialRecord.arm === 'object') return trialRecord.arm;
  if (ctx.arm && typeof ctx.arm === 'object') return ctx.arm;
  const id = typeof trialRecord.arm === 'string' ? trialRecord.arm : trialRecord.armId ?? ctx.armId;
  const arm = ctx.suite?.arms?.find((a) => a.id === id);
  if (!arm) throw new Error(`review-activation collect cannot resolve arm ${id ?? '(none)'}`);
  return arm;
}

export function collect(trialRecord, task, ctx = {}) {
  const arm = resolveArm(trialRecord, ctx);
  const { events, sessionEventsPath, sessionId, streamCount, sessionCount } = loadTrialEvents(trialRecord);
  const outputText = trialRecord.outputPath && trialRecord.outputPath !== trialRecord.eventsPath && existsSync(trialRecord.outputPath)
    ? readFileSync(trialRecord.outputPath, 'utf8')
    : '';
  const result = evaluateTrial({ trialRecord, arm, task, events, outputText });
  return {
    ...result,
    evidence: { sessionId, sessionEventsPath, streamEvents: streamCount, sessionEvents: sessionCount },
  };
}
