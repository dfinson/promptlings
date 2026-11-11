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
