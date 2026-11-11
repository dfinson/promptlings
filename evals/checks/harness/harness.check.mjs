// AC-6: two arms by three repeats yield six distinct trial records, none from cache.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fakeRunner = path.join(here, 'fake-runner.mjs');
const fakeAdapter = path.join(here, 'fake-adapter.mjs');

async function load(relative) {
  try {
    return await import(new URL(`../../${relative}`, import.meta.url).href);
  } catch (err) {
    assert.fail(`${relative} must load: ${err.message}`);
  }
}

test('harness runs two arms by three repeats as six distinct uncached trials', async () => {
  const { runHarness } = await load('providers/harness.js');
  const runner = await import(pathToFileURL(fakeRunner).href);
  const adapter = await import(pathToFileURL(fakeAdapter).href);
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evals-harness-'));
  const artifactRoot = path.join(runDir, 'artifacts');
  const before = runner.trialCalls.length;
  const saved = process.env.FAKE_TRIAL_STATUS;
  delete process.env.FAKE_TRIAL_STATUS;

  const { config, summary, scores } = await runHarness({
    suiteName: 'fake',
    prompt: 'Do: {{task.text}}',
    arms: [
      { id: 'stock', model: 'gpt-5.6-terra', selection: 'none' },
      { id: 'promptlings', model: 'gpt-5.6-terra', selection: 'all' },
    ],
    tasks: [{ id: 'task-a', text: 'FAKE_PASS alpha', score: 1 }],
    adapterModule: fakeAdapter,
    runnerModule: fakeRunner,
    runDir,
    artifactRoot,
    scorers: [{ id: 'quality', kind: 'adapter', primary: true }],
    assertions: [{ type: 'javascript', value: 'output.includes("answer from")', metric: 'answered' }],
    repeats: 3,
    concurrency: 2,
  });
  if (saved !== undefined) process.env.FAKE_TRIAL_STATUS = saved;

  assert.equal(config.evaluateOptions.cache, false);
  assert.equal(config.evaluateOptions.repeat, 3);
  assert.equal(summary.results.length, 6);
  assert.ok(summary.results.every((r) => r.response && r.response.cached === false), 'no result may come from cache');
  assert.ok(summary.results.every((r) => r.success), JSON.stringify(summary.results.map((r) => r.error)));

  const trialDirs = summary.results.map((r) => r.response.metadata.trialDir);
  assert.equal(new Set(trialDirs).size, 6, 'each trial has its own directory');
  for (const dir of trialDirs) {
    assert.ok(fs.existsSync(path.join(dir, 'trial.json')));
    assert.ok(fs.existsSync(path.join(dir, 'workspace', 'TASK.md')));
  }
  const runs = runner.trialCalls.slice(before);
  assert.equal(runs.length, 6, 'the runner ran once per trial');
  assert.deepEqual(runs.map((r) => r.armId).sort(), ['promptlings', 'promptlings', 'promptlings', 'stock', 'stock', 'stock']);
  assert.ok(adapter.materialized.slice(-6).every((m) => m.artifactRoot === artifactRoot));

  assert.equal(scores.trials.length, 6);
  const keys = scores.trials.map((t) => `${t.arm}/${t.repeat}`).sort();
  assert.deepEqual(keys, ['promptlings/0', 'promptlings/1', 'promptlings/2', 'stock/0', 'stock/1', 'stock/2']);
  assert.ok(scores.trials.every((t) => t.metrics.quality === 1 && t.metrics.answered === 1 && t.status === 'completed'));
  assert.ok(fs.existsSync(path.join(runDir, 'scores.json')));
  assert.ok(fs.existsSync(path.join(runDir, 'promptfooconfig.json')));
});

test('harness refuses to overwrite an existing trial directory', async () => {
  const { default: Trial } = await load('providers/copilot-trial.js');
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evals-harness-dup-'));
  const provider = new Trial({ config: { arm: { id: 'stock', model: 'm' }, runDir, adapterModule: fakeAdapter, runnerModule: fakeRunner } });
  const context = { vars: { taskId: 'task-a', task: { id: 'task-a', text: 'x' } }, repeatIndex: 0 };
  const first = await provider.callApi('p', context);
  assert.equal(first.error, undefined, first.error);
  const second = await provider.callApi('p', context);
  assert.match(String(second.error), /already exists/);
});

test('harness passes ctx to adapter hooks, uses buildPrompt, accepts a runTrial-only runner and merges scoreRun', async () => {
  const { runHarness } = await load('providers/harness.js');
  const { buildReport } = await load('report/index.js');
  const adapterPath = path.join(here, 'fake-judged-adapter.mjs');
  const adapter = await import(pathToFileURL(adapterPath).href);
  const budgeted = await import(pathToFileURL(path.join(here, 'fake-budgeted.mjs')).href);
  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evals-harness-judged-'));
  const artifactRoot = path.join(runDir, 'artifacts');
  const suite = { name: 'reviewbench', prompt: 'Review {{review_request}}', reviewRequests: { default: 'Review this PR.', promptlings: 'Use the-nitcracker.' }, analysis: { minPairedN: 2 } };
  const saved = process.env.FAKE_TRIAL_STATUS;
  delete process.env.FAKE_TRIAL_STATUS;

  const { scores } = await runHarness({
    suite,
    split: 'eval',
    arms: [
      { id: 'stock', model: 'gpt-5.6-terra', selection: 'none' },
      { id: 'promptlings', model: 'gpt-5.6-terra', selection: 'all' },
    ],
    adapterModule: adapterPath,
    runnerModule: path.join(here, 'fake-budgeted.mjs'),
    runDir,
    artifactRoot,
    metrics: { primary: ['grounded_recall'], guardrail: ['grounded_precision'] },
    scoreRun: true,
    repeats: 2,
  });
  if (saved !== undefined) process.env.FAKE_TRIAL_STATUS = saved;

  assert.equal(budgeted.budgetedCalls.length, 8, 'the runTrial-only module ran every trial');
  const listed = adapter.calls.listTasks.at(-1);
  assert.equal(listed.split, 'eval');
  assert.equal(listed.ctx.artifactRoot, artifactRoot);
  assert.equal(listed.ctx.suite.name, 'reviewbench');
  for (const call of [...adapter.calls.materialize, ...adapter.calls.collect]) {
    for (const key of ['workspace', 'trialDir', 'arm', 'artifactRoot', 'runDir', 'suite']) assert.ok(call.ctx[key], `ctx.${key} reaches ${call.task}`);
    assert.equal(call.ctx.workspace, path.join(call.ctx.trialDir, 'workspace'));
    assert.equal(call.ctx.runDir, path.resolve(runDir));
  }
  const promptOf = (arm) => fs.readFileSync(path.join(runDir, 'trials', 'owner_repo_1-aaaaaaaa', arm, '0', 'prompt.txt'), 'utf8');
  assert.equal(promptOf('promptlings'), 'Use the-nitcracker. owner_repo_1-aaaaaaaa');
  assert.equal(promptOf('stock'), 'Review this PR. owner_repo_1-aaaaaaaa');

  assert.equal(adapter.calls.scoreRun.at(-1).runDir, path.resolve(runDir));
  const onDisk = JSON.parse(fs.readFileSync(path.join(runDir, 'scores.json'), 'utf8'));
  assert.deepEqual(onDisk.trials, scores.trials);
  assert.deepEqual(scores.context.plannedTasks, ['owner_repo_1-aaaaaaaa', 'owner_repo_2-bbbbbbbb']);
  assert.equal(scores.context.minPairedN, 2, 'the suite minimum is recorded for the report');
  const trial = (task, arm, repeat) => scores.trials.find((t) => t.task === task && t.arm === arm && t.repeat === repeat);
  const scored = trial('owner_repo_1-aaaaaaaa', 'promptlings', 1);
  assert.equal(scored.judge, 'scored');
  assert.equal(scored.metrics.grounded_recall, 0.6);
  assert.equal(scored.metrics.grounded_precision, undefined, 'a null rate is not a value');
  assert.deepEqual(scored.strata.by_severity, { high: { recall: 0.5 } });
  assert.equal(scored.variants['exclude-producers'].grounded_recall, 0.6);
  assert.equal(trial('owner_repo_2-bbbbbbbb', 'stock', 0).judge, 'missing');

  const report = buildReport(scores, { baseline: 'stock' });
  const [c] = report.comparisons;
  assert.equal(c.pairing.kept, 1);
  assert.deepEqual(c.pairing.dropped.map((d) => [d.task, d.reasons[0].reason]), [['owner_repo_2-bbbbbbbb', 'absent from judge output']]);
  assert.equal(c.pairing.shortfall, 1);
  assert.equal(c.metrics.find((m) => m.metric === 'grounded_recall').verdict, null);
});
