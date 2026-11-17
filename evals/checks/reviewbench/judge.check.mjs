import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JudgeRejectedError, verifyJudgeRun } from '../../suites/reviewbench/metrics.js';
import { judgeArm, judgeEnv, judgePreflight, PI_MODELS_TEMPLATE, preparePiDir, scoreEntries } from '../../suites/reviewbench/judge.js';
import { gatherCandidates, preflight, scoreRun } from '../../suites/reviewbench/adapter.js';

// Fixtures are synthetic (no ReviewBench data). results.json in each variant was produced by
// ReviewBench's own scorer.ts and exclude-producers.ts at the pinned commit, so these checks
// compare the port against the upstream scorer rather than against itself.
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'judge');
const GOLDEN = join(FIXTURES, 'golden');
const KEYS = ['acme_widgets_1-aaaaaaaa', 'acme_widgets_2-bbbbbbbb', 'acme_gadgets_7-cccccccc'];

function tmp(t) {
  const dir = mkdtempSync(join(tmpdir(), 'rb-judge-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** Copies a fixture run so a test can tamper with it. */
function copyRun(t, variant) {
  const dir = tmp(t);
  cpSync(join(FIXTURES, variant), dir, { recursive: true });
  const resultsPath = join(dir, 'results.json');
  return {
    resultsPath,
    read: () => JSON.parse(readFileSync(resultsPath, 'utf8')),
    write: (value) => writeFileSync(resultsPath, JSON.stringify(value, null, 2)),
    readDetails: () => JSON.parse(readFileSync(join(dir, 'results.details.json'), 'utf8')),
    writeDetails: (value) => writeFileSync(join(dir, 'results.details.json'), JSON.stringify(value, null, 2)),
  };
}

const verify = (resultsPath, excluded = []) =>
  verifyJudgeRun({ resultsPath, goldenDir: GOLDEN, expectedModel: 'claude-sonnet-5', expectedExcludedProducers: excluded });

test('judge: per-PR metrics re-derived from results.details.json reproduce the upstream aggregate', () => {
  const { perPr, aggregate } = verify(join(FIXTURES, 'primary', 'results.json'));
  assert.deepEqual(perPr.map((p) => p.pr_key), KEYS);
  const upstream = JSON.parse(readFileSync(join(FIXTURES, 'primary', 'results.json'), 'utf8'));
  assert.equal(aggregate.macro.overall.grounded_recall, upstream.macro.overall.grounded_recall);
  assert.equal(perPr[2].metrics.overall.grounded_recall, null, 'a PR with no true-positive golden findings stays null');
});

test('judge: the producer-excluded diagnostic run also reproduces, with its filtered golden hash', () => {
  const { perPr } = verify(join(FIXTURES, 'exclude-ccr', 'results.json'), ['ccr:']);
  assert.equal(perPr[0].metrics.overall.golden_tp_count, 1);
  assert.throws(() => verify(join(FIXTURES, 'exclude-ccr', 'results.json'), []), /excluded producers/);
});

test('judge: rejects a run whose macro aggregate does not follow from the per-PR details', (t) => {
  const run = copyRun(t, 'primary');
  const results = run.read();
  results.macro.overall.grounded_recall = 0.9;
  run.write(results);
  assert.throws(() => verify(run.resultsPath), (err) => err instanceof JudgeRejectedError && /macro\.overall\.grounded_recall/.test(err.message));
});

test('judge: rejects a run whose per-PR score or stratum disagrees with its details', (t) => {
  const run = copyRun(t, 'primary');
  const results = run.read();
  results.per_pr[1].metrics.by_severity.high.matched_count += 1;
  run.write(results);
  assert.throws(() => verify(run.resultsPath), /per_pr\.1\.metrics\.by_severity\.high\.matched_count/);
});

test('judge: rejects details that change a match without the aggregate changing', (t) => {
  const run = copyRun(t, 'primary');
  const details = run.readDetails();
  const c = details[0].candidate_findings[3];
  details[0].candidate_findings[3] = { ...c, status: 'novel_tp', classifier_tp_fp: 'tp' };
  run.writeDetails(details);
  assert.throws(() => verify(run.resultsPath), JudgeRejectedError);
});

test('judge: rejects a run scored against different golden data or another PR set', (t) => {
  const run = copyRun(t, 'primary');
  const results = run.read();
  run.write({ ...results, eval_config: { ...results.eval_config, golden_hash: 'f'.repeat(64) } });
  assert.throws(() => verify(run.resultsPath), /golden_hash/);
  run.write({ ...results, eval_config: { ...results.eval_config, evaluated_prs_hash: 'f'.repeat(64) } });
  assert.throws(() => verify(run.resultsPath), /evaluated_prs_hash/);
  run.write({ ...results, eval_config: { ...results.eval_config, matcher_model: 'github-copilot/gpt-6.1-sol' } });
  assert.throws(() => verify(run.resultsPath), /expected claude-sonnet-5/);
});

test('judge: rejects a run with missing details', (t) => {
  const run = copyRun(t, 'primary');
  rmSync(run.resultsPath.replace('results.json', 'results.details.json'));
  assert.throws(() => verify(run.resultsPath), /details missing/);
});

/** Offline stand-in for fetch: copilot_internal/user answers with endpoints.api; model calls go to onModel. */
function fakeFetch(opts = {}) {
  const { userStatus = 200, onModel, calls = [] } = opts;
  const api = 'api' in opts ? opts.api : 'https://api.example-tenant.githubcopilot.com';
  return async (url, init = {}) => {
    calls.push({ url, init });
    if (url === 'https://api.github.com/copilot_internal/user') {
      const body = api === undefined ? { endpoints: {} } : { endpoints: { api } };
      return new Response(JSON.stringify(body), { status: userStatus });
    }
    if (onModel) return onModel(url, init);
    throw new Error(`unexpected fetch ${url}`);
  };
}

test('judge: env passes only the Copilot token and the run-local pi directory', async (t) => {
  const runDir = tmp(t);
  const { piDir } = await preparePiDir(runDir, { env: { COPILOT_GITHUB_TOKEN: 'tok' }, fetchImpl: fakeFetch() });
  const models = JSON.parse(readFileSync(join(piDir, 'models.json'), 'utf8'));
  const sonnet = models.providers['github-copilot'].models.find((m) => m.id === 'claude-sonnet-5');
  assert.equal(sonnet.api, 'anthropic-messages');
  assert.equal(sonnet.headers['Editor-Version'].startsWith('vscode/'), true);
  const env = judgeEnv(piDir, { PATH: 'p', COPILOT_GITHUB_TOKEN: 'tok', ANTHROPIC_API_KEY: 'no', OPENAI_API_KEY: 'no', COPILOT_PROVIDER_BASE_URL: 'no' });
  assert.equal(env.COPILOT_GITHUB_TOKEN, 'tok');
  assert.equal(env.PI_CODING_AGENT_DIR, piDir);
  for (const key of ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'COPILOT_PROVIDER_BASE_URL']) assert.equal(env[key], undefined);
  assert.throws(() => judgeEnv(piDir, { PATH: 'p' }), /COPILOT_GITHUB_TOKEN/);
});

test('judge: the run-local models.json points the github-copilot provider at the token account endpoints.api', async (t) => {
  const calls = [];
  const runDir = tmp(t);
  const { piDir, baseUrl } = await preparePiDir(runDir, { env: { COPILOT_GITHUB_TOKEN: 'gho_x' }, fetchImpl: fakeFetch({ api: 'https://api.enterprise.githubcopilot.com/', calls }) });
  assert.equal(baseUrl, 'https://api.enterprise.githubcopilot.com');
  assert.equal(calls[0].init.headers.Authorization, 'token gho_x');
  const models = JSON.parse(readFileSync(join(piDir, 'models.json'), 'utf8'));
  assert.equal(models.providers['github-copilot'].baseUrl, 'https://api.enterprise.githubcopilot.com');
  assert.ok(models.providers['github-copilot'].models.some((m) => m.id === 'claude-sonnet-5'));
  const template = JSON.parse(readFileSync(PI_MODELS_TEMPLATE, 'utf8'));
  assert.equal(template.providers['github-copilot'].baseUrl, undefined, 'the endpoint is resolved per account, never hard-coded');
});

test('judge: an unresolvable Copilot endpoint stops the judge instead of falling back to a default host', async (t) => {
  const env = { COPILOT_GITHUB_TOKEN: 'tok' };
  await assert.rejects(preparePiDir(tmp(t), { env, fetchImpl: fakeFetch({ userStatus: 401 }) }), /copilot_internal\/user returned 401/);
  await assert.rejects(preparePiDir(tmp(t), { env, fetchImpl: fakeFetch({ api: undefined }) }), /no https endpoints\.api/);
  await assert.rejects(preparePiDir(tmp(t), { env, fetchImpl: fakeFetch({ api: 'http://plain.example' }) }), /no https endpoints\.api/);
  await assert.rejects(preparePiDir(tmp(t), { env: {}, fetchImpl: fakeFetch() }), /COPILOT_GITHUB_TOKEN/);
});

test('judge: preflight makes one minimal model call at the resolved endpoint and records it', async (t) => {
  const runDir = tmp(t);
  const calls = [];
  const onModel = async () => new Response(JSON.stringify({ content: [{ type: 'text', text: 'OK' }] }), { status: 200 });
  const result = await preflight({ judge: JUDGE }, { runDir, env: { COPILOT_GITHUB_TOKEN: 'gho_x' }, fetchImpl: fakeFetch({ api: 'https://api.enterprise.githubcopilot.com', onModel, calls }) });
  assert.equal(result.status, 'ok');
  assert.equal(calls.length, 2);
  const call = calls[1];
  assert.equal(call.url, 'https://api.enterprise.githubcopilot.com/v1/messages');
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.headers.authorization, 'Bearer gho_x');
  assert.equal(call.init.headers['Copilot-Integration-Id'], 'vscode-chat');
  const body = JSON.parse(call.init.body);
  assert.equal(body.model, 'claude-sonnet-5');
  assert.ok(body.max_tokens <= 16);
  const record = JSON.parse(readFileSync(join(runDir, 'judge', 'preflight.json'), 'utf8'));
  assert.deepEqual([record.status, record.model, record.baseUrl], ['ok', 'claude-sonnet-5', 'https://api.enterprise.githubcopilot.com']);
});

test('judge: preflight fails the stage when the judge model does not answer', async (t) => {
  const env = { COPILOT_GITHUB_TOKEN: 'tok' };
  const status = (code, text) => async () => new Response(text, { status: code });
  await assert.rejects(judgePreflight({ runDir: tmp(t), judge: JUDGE, env, fetchImpl: fakeFetch({ onModel: status(401, 'unauthorized') }) }), /returned 401: unauthorized/);
  await assert.rejects(judgePreflight({ runDir: tmp(t), judge: JUDGE, env, fetchImpl: fakeFetch({ onModel: status(200, '<html>') }) }), /non-JSON/);
  await assert.rejects(judgePreflight({ runDir: tmp(t), judge: JUDGE, env, fetchImpl: fakeFetch({ onModel: async () => { throw new Error('ECONNRESET'); } }) }), /failed: ECONNRESET/);
  await assert.rejects(judgePreflight({ runDir: tmp(t), judge: { ...JUDGE, model: 'not-configured' }, env, fetchImpl: fakeFetch() }), /not in the run-local models\.json/);
  const runDir = tmp(t);
  await assert.rejects(judgePreflight({ runDir, judge: JUDGE, env, fetchImpl: fakeFetch({ userStatus: 401 }) }), /copilot_internal\/user returned 401/);
  assert.equal(existsSync(join(runDir, 'judge', 'preflight.json')), false);
});

/** A stand-in for `npm run judge` that copies a fixture run to --output and records its arguments. */
function fakeJudge(variant, calls, mutate) {
  return async (cmd, args, opts) => {
    calls.push({ cmd, args, env: opts.env });
    if (args[0] === 'ci') return { code: 0, log: '' };
    const output = args[args.indexOf('--output') + 1];
    const results = JSON.parse(readFileSync(join(FIXTURES, variant, 'results.json'), 'utf8'));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify(mutate ? mutate(results) : results));
    cpSync(join(FIXTURES, variant, 'results.details.json'), output.replace(/\.json$/, '.details.json'));
    return { code: 0, log: 'judged' };
  };
}

function judgeDataset(root) {
  const datasetDir = join(root, 'dataset');
  cpSync(GOLDEN, join(datasetDir, 'golden'), { recursive: true });
  mkdirSync(join(datasetDir, 'node_modules'), { recursive: true });
  writeFileSync(join(datasetDir, 'node_modules', '.package-lock.json'), '{}');
  return datasetDir;
}

const candidates = KEYS.map((k) => {
  const m = k.match(/^(.+?)_(.+)_(\d+)-([0-9a-f]{8})$/);
  return { pr: { repo: `https://github.com/${m[1]}/${m[2]}`, pr_number: Number(m[3]), base: '0'.repeat(40), head: m[4].repeat(5) }, agent: 'stock', findings: [] };
});
const JUDGE = { provider: 'github-copilot', model: 'claude-sonnet-5', concurrency: 2 };

test('judge: judgeArm runs the pinned judge with claude-sonnet-5 and records a verified run', async (t) => {
  const root = tmp(t);
  const calls = [];
  const result = await judgeArm({
    datasetDir: judgeDataset(root), runDir: join(root, 'run'), artifactRoot: join(root, 'art'), arm: 'stock', repeat: 0,
    candidates, judge: JUDGE, env: { PATH: 'p', COPILOT_GITHUB_TOKEN: 'tok' }, fetchImpl: fakeFetch(), runner: fakeJudge('primary', calls),
  });
  const args = calls[0].args;
  assert.equal(calls[0].cmd, process.execPath);
  assert.ok(args[0].endsWith(join('tsx', 'dist', 'cli.mjs')));
  assert.equal(args[1], join('scripts', 'eval', 'eval.ts'));
  assert.equal(args[args.indexOf('--model') + 1], 'claude-sonnet-5');
  assert.equal(args[args.indexOf('--provider') + 1], 'github-copilot');
  assert.ok(args.includes('--strict'));
  assert.ok(args[args.indexOf('--repo-dir') + 1].startsWith(join(root, 'art')));
  const piModels = JSON.parse(readFileSync(join(calls[0].env.PI_CODING_AGENT_DIR, 'models.json'), 'utf8'));
  assert.equal(piModels.providers['github-copilot'].baseUrl, 'https://api.example-tenant.githubcopilot.com');
  assert.equal(JSON.parse(readFileSync(join(result.dir, 'verified.json'), 'utf8')).status, 'verified');
  assert.ok(existsSync(join(result.dir, 'candidates', `${KEYS[0]}.json`)));
  const scores = scoreEntries({ arm: 'stock', repeat: 0, perPr: result.perPr });
  assert.deepEqual(scores.map((s) => s.task), KEYS);
  assert.equal(scores[0].metrics.grounded_recall, result.perPr[0].metrics.overall.grounded_recall);
});

test('judge: judgeArm rejects and records a run whose aggregate does not reproduce', async (t) => {
  const root = tmp(t);
  const tamper = (r) => ({ ...r, micro: { ...r.micro, overall: { ...r.micro.overall, grounded_precision: 0.123 } } });
  await assert.rejects(
    judgeArm({
      datasetDir: judgeDataset(root), runDir: join(root, 'run'), artifactRoot: join(root, 'art'), arm: 'stock', repeat: 0,
      candidates, judge: JUDGE, env: { COPILOT_GITHUB_TOKEN: 'tok' }, fetchImpl: fakeFetch(), runner: fakeJudge('primary', [], tamper),
    }),
    JudgeRejectedError,
  );
  const verdict = JSON.parse(readFileSync(join(root, 'run', 'judge', 'stock', 'r0', 'primary', 'verified.json'), 'utf8'));
  assert.equal(verdict.status, 'rejected');
  assert.match(verdict.reason, /micro\.overall\.grounded_precision/);
});

test('judge: judgeArm rejects a run that silently skipped a candidate PR', async (t) => {
  const root = tmp(t);
  const extra = { ...candidates[0], pr: { ...candidates[0].pr, pr_number: 99, head: 'd'.repeat(40) } };
  await assert.rejects(
    judgeArm({
      datasetDir: judgeDataset(root), runDir: join(root, 'run'), artifactRoot: join(root, 'art'), arm: 'stock', repeat: 0,
      candidates: [...candidates, extra], judge: JUDGE, env: { COPILOT_GITHUB_TOKEN: 'tok' }, fetchImpl: fakeFetch(), runner: fakeJudge('primary', []),
    }),
    /skipped 1 candidate PRs/,
  );
});

test('judge: scoreRun judges each arm from collected candidates and reports the diagnostic beside the primary', async (t) => {
  const root = tmp(t);
  const runDir = join(root, 'run');
  candidates.forEach((c, i) => {
    const dir = join(runDir, 'trials', KEYS[i], 'stock', '0');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'candidate.json'), JSON.stringify(c));
  });
  assert.equal(gatherCandidates(runDir).size, 1);
  const calls = [];
  const runner = async (cmd, args, opts) => {
    const excluded = args.includes('--exclude-producer');
    return fakeJudge(excluded ? 'exclude-ccr' : 'primary', calls)(cmd, args, opts);
  };
  const dataset = judgeDataset(root);
  const suite = { judge: { ...JUDGE, diagnosticExcludeProducers: ['ccr:'] } };
  const { entries, rejected } = await scoreRun({
    runDir, suite, diagnostic: true, runner, env: { COPILOT_GITHUB_TOKEN: 'tok' }, fetchImpl: fakeFetch(), artifactRoot: join(root, 'art'),
    datasetDir: dataset,
  });
  assert.deepEqual(rejected, []);
  assert.deepEqual([...new Set(entries.map((e) => e.variant))], ['primary', 'exclude-producers']);
  assert.deepEqual([...new Set(entries.map((e) => e.repeat))], [0]);
  for (const variant of ['primary', 'exclude-producers']) assert.ok(existsSync(join(runDir, 'judge', 'stock', 'r0', variant, 'verified.json')), variant);
  assert.equal(entries.length, 6);
});
