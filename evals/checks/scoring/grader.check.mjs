// AC-7: model grading runs only through a tool-less, isolated `copilot -p` call.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const evalsDir = path.resolve(here, '..', '..');
const fakeRunner = path.join(evalsDir, 'checks', 'harness', 'fake-runner.mjs');
const fakeAdapter = path.join(evalsDir, 'checks', 'harness', 'fake-adapter.mjs');
const TOKEN = 'ghu_fakeGraderToken0123456789';

async function load(relative) {
  try {
    return await import(new URL(`../../${relative}`, import.meta.url).href);
  } catch (err) {
    assert.fail(`${relative} must load: ${err.message}`);
  }
}

function scratch(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `evals-${name}-`));
}

function readLog(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
}

function withEnv(values, fn) {
  const saved = {};
  for (const key of Object.keys(values)) {
    saved[key] = process.env[key];
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  const restore = () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  return Promise.resolve().then(fn).finally(restore);
}

test('grader runs tool-less copilot -p in an isolated home and records zero tool calls', async () => {
  const { default: Grader, NO_TOOLS_SENTINEL } = await load('providers/copilot-grader.js');
  const dir = scratch('grader');
  const log = path.join(dir, 'copilot.log');
  await withEnv(
    { COPILOT_GITHUB_TOKEN: TOKEN, FAKE_COPILOT_LOG: log, FAKE_COPILOT_MODE: 'pass', OPENAI_API_KEY: 'sk-should-not-leak', COPILOT_PROVIDER_BASE_URL: 'http://x' },
    async () => {
      const grader = new Grader({ config: { model: 'gpt-5.6-terra', reasoningEffort: 'low', maxAiCredits: 30, evidenceDir: dir, runnerModule: fakeRunner } });
      assert.equal(grader.isCopilotGrader, true);
      const first = await grader.callApi(JSON.stringify([{ role: 'system', content: 'grade' }, { role: 'user', content: 'FAKE_PASS output' }]));
      const second = await grader.callApi('plain prompt');
      assert.equal(first.error, undefined, first.error);
      assert.equal(second.error, undefined, second.error);
      assert.equal(JSON.parse(first.output).pass, true);
      assert.equal(JSON.parse(second.output).pass, false);
      assert.equal(first.cached, false);
      assert.notEqual(first.metadata.graderDir, second.metadata.graderDir);

      const calls = readLog(log).filter((c) => !c.argv.includes('--version'));
      assert.equal(calls.length, 2);
      for (const call of calls) {
        assert.equal(call.argv[0], '-p');
        assert.ok(call.argv.includes('--no-custom-instructions'));
        assert.ok(call.argv.includes(`--available-tools=${NO_TOOLS_SENTINEL}`));
        assert.ok(call.argv.includes('--disable-builtin-mcps'));
        assert.deepEqual(call.argv.slice(call.argv.indexOf('--model'), call.argv.indexOf('--model') + 2), ['--model', 'gpt-5.6-terra']);
        assert.ok(!call.argv.some((a) => a === '--allow-all-tools' || a === '--yolo' || a.startsWith('--add-dir')));
        assert.equal(call.env.HOME, call.env.COPILOT_HOME);
        assert.equal(call.env.USERPROFILE, call.env.COPILOT_HOME);
        assert.ok(call.env.COPILOT_HOME.startsWith(path.resolve(dir)));
        assert.deepEqual(call.cwdEntries, []);
        assert.equal(call.env.hasToken, true);
        assert.deepEqual(call.env.forbidden, []);
      }
      assert.notEqual(calls[0].env.COPILOT_HOME, calls[1].env.COPILOT_HOME);

      for (const result of [first, second]) {
        const record = JSON.parse(fs.readFileSync(path.join(result.metadata.graderDir, 'grade.json'), 'utf8'));
        assert.equal(record.toolCalls, 0);
        assert.equal(record.cliVersion, 'GitHub Copilot CLI 9.9.9-fake');
        const events = fs.readFileSync(path.join(result.metadata.graderDir, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
        assert.ok(events.length > 0);
        assert.ok(!events.some((e) => String(e.type).startsWith('tool.')));
        assert.ok(!fs.readFileSync(path.join(result.metadata.graderDir, 'grade.json'), 'utf8').includes(TOKEN));
      }
    },
  );
});

test('grader rejects a stream that contains tool calls', async () => {
  const { default: Grader } = await load('providers/copilot-grader.js');
  const dir = scratch('grader-tools');
  await withEnv({ COPILOT_GITHUB_TOKEN: TOKEN, FAKE_COPILOT_MODE: 'tool-call', FAKE_COPILOT_LOG: undefined }, async () => {
    const grader = new Grader({ config: { model: 'gpt-5.6-terra', evidenceDir: dir, runnerModule: fakeRunner } });
    const result = await grader.callApi('FAKE_PASS');
    assert.match(String(result.error), /tool event/);
    assert.equal(result.output, undefined);
    const record = JSON.parse(fs.readFileSync(path.join(result.metadata.graderDir, 'grade.json'), 'utf8'));
    assert.ok(record.toolCalls > 0);
  });
});

test('grader config refuses auto, a missing model and a credit cap below 30', async () => {
  const { default: Grader } = await load('providers/copilot-grader.js');
  assert.throws(() => new Grader({ config: { model: 'auto' } }), /never auto/);
  assert.throws(() => new Grader({ config: {} }), /model is required/);
  assert.throws(() => new Grader({ config: { model: 'gpt-5.6-terra', maxAiCredits: 10 } }), /at least 30/);
});

test('grader validation rejects configs that would fall back to the default grader', async () => {
  const { buildPromptfooConfig, validatePromptfooConfig } = await load('providers/config.js');
  const runDir = scratch('grader-config');
  const base = () =>
    buildPromptfooConfig({
      suiteName: 'fake',
      prompt: 'Do: {{task.text}}',
      arms: [{ id: 'baseline', model: 'gpt-5.6-terra' }],
      tasks: [{ id: 'task-a' }],
      assertions: [{ type: 'llm-rubric', value: 'is good' }],
      grader: { model: 'gpt-5.6-terra' },
      runDir,
    });
  assert.doesNotThrow(() => validatePromptfooConfig(base()));

  const noProvider = base();
  delete noProvider.defaultTest.options;
  delete noProvider.defaultTest.assert[0].provider;
  assert.throws(() => validatePromptfooConfig(noProvider), /default grader/);

  const openai = base();
  openai.defaultTest.assert[0].provider = 'openai:gpt-4.1';
  assert.throws(() => validatePromptfooConfig(openai), /not the Copilot grader/);

  const optionsOpenai = base();
  delete optionsOpenai.defaultTest.assert[0].provider;
  optionsOpenai.defaultTest.options.provider = { id: 'openai:chat:gpt-4.1' };
  assert.throws(() => validatePromptfooConfig(optionsOpenai), /not the Copilot grader/);

  const nested = base();
  nested.tests[0].assert = [{ type: 'assert-set', assert: [{ type: 'g-eval', value: 'x', provider: 'anthropic:messages:x' }] }];
  assert.throws(() => validatePromptfooConfig(nested), /not the Copilot grader/);

  const similar = base();
  similar.defaultTest.assert.push({ type: 'similar', value: 'x' });
  assert.throws(() => validatePromptfooConfig(similar), /not allowed/);

  const auto = base();
  auto.defaultTest.assert[0].provider.config.model = 'auto';
  assert.throws(() => validatePromptfooConfig(auto), /never auto/);

  const cached = base();
  cached.evaluateOptions.cache = true;
  assert.throws(() => validatePromptfooConfig(cached), /cache must be false/);

  const envKey = base();
  envKey.env = { OPENAI_API_KEY: 'x' };
  assert.throws(() => validatePromptfooConfig(envKey), /OPENAI_API_KEY/);
});

test('grader handles llm-rubric in a real Promptfoo evaluation with no other model service', async () => {
  const { buildPromptfooConfig } = await load('providers/config.js');
  const { runPromptfooEvaluation } = await load('providers/evaluate.js');
  const runDir = scratch('grader-e2e');
  const log = path.join(runDir, 'copilot.log');
  await withEnv(
    { COPILOT_GITHUB_TOKEN: TOKEN, FAKE_COPILOT_LOG: log, FAKE_COPILOT_MODE: 'pass', OPENAI_API_KEY: undefined, ANTHROPIC_API_KEY: undefined, PROMPTFOO_CONFIG_DIR: undefined },
    async () => {
      const config = buildPromptfooConfig({
        suiteName: 'fake',
        prompt: 'Do: {{task.text}}',
        arms: [{ id: 'baseline', model: 'gpt-5.6-terra' }],
        tasks: [{ id: 'task-a', text: 'FAKE_PASS alpha' }, { id: 'task-b', text: 'beta' }],
        scorers: [{ id: 'rubric', kind: 'llm-rubric', rubric: 'The answer is correct.', model: 'gpt-5.6-terra' }],
        grader: { model: 'gpt-5.6-terra' },
        runDir,
        adapterModule: fakeAdapter,
        runnerModule: fakeRunner,
      });
      const summary = await runPromptfooEvaluation(config, { runDir });
      const byTask = Object.fromEntries(summary.results.map((r) => [r.vars.taskId, r]));
      assert.equal(summary.results.length, 2);
      assert.equal(byTask['task-a'].success, true, JSON.stringify(byTask['task-a'].gradingResult));
      assert.equal(byTask['task-b'].success, false);
      assert.equal(byTask['task-a'].namedScores.rubric, 1);
      const gradingCalls = readLog(log).filter((c) => c.argv[0] === '-p');
      assert.equal(gradingCalls.length, 2);
      const graderDirs = fs.readdirSync(path.join(runDir, 'graders'));
      assert.equal(graderDirs.length, 2);
      for (const d of graderDirs) {
        assert.equal(JSON.parse(fs.readFileSync(path.join(runDir, 'graders', d, 'grade.json'), 'utf8')).toolCalls, 0);
      }
    },
  );
});
