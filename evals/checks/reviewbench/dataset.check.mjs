import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_LOCK_PATH,
  DatasetPinError,
  contentHash,
  ensureDataset,
  readLockEntry,
  verifyDataset,
} from '../../suites/reviewbench/dataset.js';
import { keysHash, prKey, resolveSplit } from '../../suites/reviewbench/tasks.js';
import { buildPrompt, listTasks, loadSuite, materialize } from '../../suites/reviewbench/adapter.js';

const GIT_ID = ['-c', 'user.name=evals', '-c', 'user.email=evals@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false'];
const git = (cwd, ...args) => execFileSync('git', [...GIT_ID, ...args], { cwd, encoding: 'utf8' }).trim();

function tmp(t) {
  const dir = mkdtempSync(join(tmpdir(), 'rb-dataset-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const manifest = [
  { repo: 'https://github.com/acme/widgets', pr_number: 1, base: 'a'.repeat(40), head: 'a1'.repeat(20), title: 'one' },
  { repo: 'https://github.com/acme/widgets', pr_number: 2, base: 'b'.repeat(40), head: 'b2'.repeat(20), title: 'two' },
  { repo: 'https://github.com/acme/gadgets', pr_number: 3, base: 'c'.repeat(40), head: 'c3'.repeat(20), title: 'three' },
];

/** A tiny ReviewBench-shaped source repository with one commit. */
function makeSource(root) {
  const src = join(root, 'source');
  mkdirSync(join(src, 'corpus', 'test'), { recursive: true });
  mkdirSync(join(src, 'golden'), { recursive: true });
  writeFileSync(join(src, 'corpus', 'manifest.json'), JSON.stringify(manifest));
  writeFileSync(join(src, 'corpus', 'test', 'test.json'), JSON.stringify(manifest.slice(0, 2)));
  writeFileSync(join(src, 'golden', `${prKey(manifest[0])}.json`), '{"findings":[]}\r\n');
  writeFileSync(join(src, 'package.json'), '{}');
  git(root, 'init', '-q', src);
  git(src, 'add', '-A');
  git(src, 'commit', '-q', '-m', 'pin');
  return { src, commit: git(src, 'rev-parse', 'HEAD') };
}

function writeLock(root, entry) {
  const lockPath = join(root, 'datasets.lock');
  writeFileSync(lockPath, JSON.stringify({ datasets: entry ? { reviewbench: entry } : {} }));
  return lockPath;
}

function pinnedEntry(src, commit, extra = {}) {
  return {
    source: { type: 'git', url: src },
    commit,
    contentHash: contentHash(src, ['corpus', 'golden', 'package.json']),
    contentPaths: ['corpus', 'golden', 'package.json'],
    codeLicense: 'MIT',
    dataLicense: null,
    licenseDecision: { decision: 'approved for internal evaluation', by: 'maintainer', date: '2026-01-01' },
    ...extra,
  };
}

test('dataset: datasets.lock records the ReviewBench pin and its licenses', () => {
  const entry = readLockEntry(DEFAULT_LOCK_PATH);
  assert.equal(entry.source.url, 'https://github.com/review-bench/ReviewBench.git');
  assert.match(entry.commit, /^[0-9a-f]{40}$/);
  assert.match(entry.contentHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(entry.codeLicense, 'MIT');
  assert.ok('dataLicense' in entry, 'data license is recorded, null when ReviewBench states none');
  if (entry.dataLicense === null) assert.deepEqual(Object.keys(entry.licenseDecision ?? {}).sort(), ['by', 'date', 'decision']);
  assert.deepEqual(entry.counts, { full: 219, test: 25, heldout: 194, testGoldenFindings: 565, testGoldenTruePositives: 352 });
});

test('dataset: refuses when datasets.lock is missing or has no ReviewBench entry', (t) => {
  const root = tmp(t);
  assert.throws(() => ensureDataset({ artifactRoot: root, lockPath: join(root, 'absent.lock') }), DatasetPinError);
  assert.throws(() => ensureDataset({ artifactRoot: root, lockPath: writeLock(root, null) }), /unpinned: no entry/);
});

test('dataset: refuses an entry without a commit, content hash or license record', (t) => {
  const root = tmp(t);
  const { src, commit } = makeSource(root);
  const base = pinnedEntry(src, commit);
  for (const [field, value, message] of [
    ['commit', 'main', /full 40-character SHA/],
    ['contentHash', undefined, /contentHash/],
    ['codeLicense', '', /codeLicense/],
  ]) {
    const lockPath = writeLock(root, { ...base, [field]: value });
    assert.throws(() => ensureDataset({ artifactRoot: join(root, 'cache'), lockPath }), message);
  }
  const { dataLicense, ...noData } = base;
  assert.throws(() => ensureDataset({ artifactRoot: join(root, 'cache'), lockPath: writeLock(root, noData) }), /dataLicense must be recorded/);
});

test('dataset: refuses data without a stated license until a maintainer decision is recorded', (t) => {
  const root = tmp(t);
  const { src, commit } = makeSource(root);
  const lockPath = writeLock(root, pinnedEntry(src, commit, { licenseDecision: null }));
  assert.throws(() => ensureDataset({ artifactRoot: join(root, 'cache'), lockPath }), /licenseDecision/);
  assert.throws(() => listTasks('test', { artifactRoot: join(root, 'cache'), lockPath }), /licenseDecision/);
});

test('dataset: fetches the pinned commit byte-exact and verifies it', (t) => {
  const root = tmp(t);
  const { src, commit } = makeSource(root);
  const lockPath = writeLock(root, pinnedEntry(src, commit));
  const result = ensureDataset({ artifactRoot: join(root, 'cache'), lockPath });
  assert.equal(result.commit, commit);
  assert.equal(result.dir, join(root, 'cache', 'datasets', 'reviewbench', commit));
  assert.equal(readFileSync(join(result.dir, 'golden', `${prKey(manifest[0])}.json`), 'utf8'), '{"findings":[]}\r\n');
  assert.equal(ensureDataset({ artifactRoot: join(root, 'cache'), lockPath }).dir, result.dir, 'second call reuses the cache');
});

test('dataset: refuses a cached checkout whose files changed', (t) => {
  const root = tmp(t);
  const { src, commit } = makeSource(root);
  const lockPath = writeLock(root, pinnedEntry(src, commit));
  const { dir } = ensureDataset({ artifactRoot: join(root, 'cache'), lockPath });
  writeFileSync(join(dir, 'golden', `${prKey(manifest[0])}.json`), '{"findings":[{"tp_fp":"tp"}]}');
  assert.throws(() => ensureDataset({ artifactRoot: join(root, 'cache'), lockPath }), /changed: content hash/);
});

test('dataset: refuses a checkout at a different commit than the pin', (t) => {
  const root = tmp(t);
  const { src, commit } = makeSource(root);
  const entry = pinnedEntry(src, commit);
  const { dir } = ensureDataset({ artifactRoot: join(root, 'cache'), lockPath: writeLock(root, entry) });
  writeFileSync(join(dir, 'extra.txt'), 'x');
  git(dir, 'add', 'extra.txt');
  git(dir, 'commit', '-q', '-m', 'drift');
  assert.throws(() => verifyDataset(dir, entry), /changed: checkout is at/);
});

test('dataset: refuses a pin whose upstream content differs from the recorded hash', (t) => {
  const root = tmp(t);
  const { src, commit } = makeSource(root);
  const lockPath = writeLock(root, pinnedEntry(src, commit, { contentHash: `sha256:${'0'.repeat(64)}` }));
  assert.throws(() => ensureDataset({ artifactRoot: join(root, 'cache'), lockPath }), /changed: content hash/);
});

test('dataset: splits resolve with sizes enforced and sampled draws frozen by keysSha256', () => {
  const corpus = { full: manifest, test: manifest.slice(0, 2) };
  const splits = {
    test: { source: 'test', size: 2 },
    heldout: { source: 'full', exclude: ['test'], size: 1 },
    one: { source: 'full', sample: { size: 2, seed: 7 } },
  };
  assert.deepEqual(resolveSplit('heldout', splits, corpus).map(prKey), [prKey(manifest[2])]);
  const drawn = resolveSplit('one', splits, corpus).map(prKey);
  assert.equal(drawn.length, 2);
  assert.deepEqual(resolveSplit('one', splits, corpus).map(prKey), drawn, 'same seed, same draw');
  const frozen = { ...splits, one: { ...splits.one, keysSha256: keysHash(drawn) } };
  assert.doesNotThrow(() => resolveSplit('one', frozen, corpus));
  const stale = { ...splits, one: { ...splits.one, keysSha256: keysHash([prKey(manifest[0])]) } };
  assert.throws(() => resolveSplit('one', stale, corpus), /frozen as/);
  assert.throws(() => resolveSplit('test', { test: { source: 'test', size: 25 } }, corpus), /expects 25/);
});

test('dataset: suite.yaml declares the frozen splits, five arms and three stages', () => {
  const suite = loadSuite();
  assert.deepEqual(suite.arms.map((a) => a.id), ['stock', 'nitcracker', 'sparring-partner', 'ensemble', 'previous']);
  assert.ok(suite.arms.every((a) => a.model === 'gpt-6.1-sol' && a.sandbox === true));
  assert.deepEqual(Object.fromEntries(suite.arms.map((a) => [a.id, a.limits.maxAiCredits])), {
    stock: 1000, nitcracker: 1500, 'sparring-partner': 1500, ensemble: 5000, previous: 1500,
  });
  assert.equal(suite.arms.find((a) => a.id === 'ensemble').agent, null);
  assert.equal(suite.splits.confirmation.sample.size, 60);
  assert.match(suite.splits.confirmation.keysSha256, /^sha256:[0-9a-f]{64}$/);
  assert.equal(suite.stages.qualification.arms.length, 4);
  assert.deepEqual(suite.stages.confirmation.analysis, { verdict: true, minPairedN: 51 });
  for (const s of ['qualification', 'pilot', 'pilot-repeat', 'pilot-previous']) assert.deepEqual(suite.stages[s].analysis, { verdict: false }, s);
  assert.deepEqual(suite.judge, { ...suite.judge, provider: 'github-copilot', model: 'claude-sonnet-5' });
  for (const arm of suite.arms) {
    for (const denied of ['web_fetch', 'web_search', 'shell(gh:*)', 'shell(curl:*)']) assert.ok(arm.tools.deny.includes(denied), `${arm.id} denies ${denied}`);
    assert.ok(arm.tools.denyUrl.includes('github.com'));
  }
  assert.match(buildPrompt({}, { id: 'ensemble' }, suite), /^Run the review ensemble/);
  assert.match(buildPrompt({}, { id: 'stock' }, suite), /^Review the changes on this branch/);
});

test('dataset: materialize checks out the PR head with history and no remote, offline from a mirror', (t) => {
  const root = tmp(t);
  const repo = join(root, 'upstream');
  git(root, 'init', '-q', '-b', 'main', repo);
  writeFileSync(join(repo, 'app.js'), 'export const a = 1;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'base');
  const base = git(repo, 'rev-parse', 'HEAD');
  writeFileSync(join(repo, 'app.js'), 'export const a = 2;\n');
  git(repo, 'commit', '-q', '-am', 'change');
  const head = git(repo, 'rev-parse', 'HEAD');
  const mirrors = join(root, 'mirrors');
  mkdirSync(mirrors);
  git(root, 'clone', '-q', '--bare', repo, join(mirrors, 'acme_widgets.git'));

  const task = { id: `acme_widgets_9-${head.slice(0, 8)}`, repo: 'https://github.com/acme/widgets', nwo: 'acme/widgets', prNumber: 9, base, head, title: 'Bump a', body: 'Changes a.' };
  const workspace = join(root, 'trial', 'workspace');
  const result = materialize(task, workspace, { artifactRoot: join(root, 'artifacts'), mirrorBase: mirrors });
  assert.equal(result.headSha, head);
  assert.equal(git(workspace, 'rev-parse', 'HEAD'), head);
  assert.equal(git(workspace, 'rev-parse', 'review-base'), base);
  assert.equal(git(workspace, 'remote'), '', 'no remote is configured');
  const meta = JSON.parse(readFileSync(join(workspace, '.reviewbench', 'pr.json'), 'utf8'));
  assert.equal(meta.head, head);
  assert.ok(!JSON.stringify(meta).includes('/pull/'), 'no PR URL is written');
  assert.match(readFileSync(join(workspace, '.reviewbench', 'diff.patch'), 'utf8'), /\+export const a = 2;/);
  assert.equal(git(workspace, 'status', '--porcelain'), '', 'PR files are excluded from status');
  assert.ok(existsSync(join(root, 'artifacts', 'datasets', 'reviewbench-repos', 'acme_widgets.git')));
});
