// Lane 10: post-experiment analysis panel (consensus, blindness, coverage, agreement and report).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fakePanelRunner = path.join(here, 'fake-panel-runner.mjs');
const ARMS = ['plain-review', 'the-nitcracker'];
const TASKS = ['pr-1', 'pr-2', 'pr-3', 'pr-4', 'pr-5', 'pr-6'];
const PANEL = ['claude-opus-5.5', 'grok-4.7', 'gpt-6.1-terra'];

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

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

const LEAKY = '## the-nitcracker review\n**Nitcracker** \u{1F50D} The Nitcracker flags a race: cache.js reads the map while the_nitcracker refresh rewrites it';

// Six tasks, two arms, two repeats. plain-review catches golden 0 only; the-nitcracker catches 0
// and 1. Unmatched findings: plain-review once per task, the-nitcracker twice (with arm-revealing text).
function fixture() {
  const runDir = scratch('panel-run');
  const goldenDir = path.join(runDir, 'golden');
  for (const task of TASKS) {
    writeJson(path.join(goldenDir, `${task}.json`), {
      pr_key: task,
      findings: [
        { file: 'src/parse.js', start_line: 10, end_line: 10, message: 'Loop bound is off by one in parse', tp_fp: 'tp', severity: 'high' },
        { file: 'src/db.js', start_line: 40, end_line: 44, message: 'Write is not awaited before commit', tp_fp: 'tp', severity: 'high' },
        { file: 'src/style.js', start_line: 1, message: 'Style preference', tp_fp: 'fp' },
      ],
    });
  }
  for (const arm of ARMS) {
    for (const r of [1, 2]) {
      const dir = path.join(runDir, 'judge', arm, `r${r}`, 'primary');
      const details = TASKS.map((task) => {
        const found = [{ file: 'src/parse.js', start_line: 10, end_line: 10, message: 'off by one', status: 'matched_tp', matched_golden_index: 0, covered_golden_indices: [0] }];
        if (arm === 'the-nitcracker') {
          found.push({ file: 'src/db.js', start_line: 41, end_line: 41, message: 'missing await', status: 'matched_tp', matched_golden_index: 1, covered_golden_indices: [1] });
          found.push({ file: 'src/cache.js', start_line: 7, end_line: 9, message: LEAKY, status: 'novel_tp', covered_golden_indices: [] });
        } else if (r === 1) {
          found.push({ file: 'src/util.js', start_line: 3, end_line: 3, message: 'Possible unused import', status: 'novel_fp', covered_golden_indices: [] });
        }
        return { pr_key: task, candidate_findings: found };
      });
      writeJson(path.join(dir, 'results.details.json'), details);
      writeJson(path.join(dir, 'verified.json'), { status: 'verified' });
    }
  }
  // A rejected judge run must be ignored.
  writeJson(path.join(runDir, 'judge', 'plain-review', 'r3', 'primary', 'results.details.json'), [{ pr_key: 'pr-1', candidate_findings: [] }]);
  writeJson(path.join(runDir, 'judge', 'plain-review', 'r3', 'primary', 'verified.json'), { status: 'rejected' });

  for (const task of TASKS) {
    for (const arm of ARMS) {
      for (const r of [1, 2]) {
        const trialDir = path.join(runDir, 'trials', task, arm, String(r));
        const workspace = path.join(trialDir, 'workspace');
        const ev = [];
        const tool = (toolName, args) => ev.push({ type: 'tool.execution_start', data: { toolCallId: String(ev.length), toolName, arguments: args } });
        tool('view', { path: path.join(workspace, 'src', 'parse.js') });
        tool('view', { path: path.join(workspace, 'src', 'db.js') });
        if (arm === 'the-nitcracker') {
          tool('view', { path: path.join(workspace, 'src', 'cache.js') });
          tool('grep', { pattern: 'refresh' });
          tool('powershell', { command: 'npm test && Get-Content src/config.js' });
          ev.push({ type: 'subagent.started', data: {} });
        }
        writeJson(path.join(trialDir, 'trial.json'), {
          status: 'completed',
          wallMs: arm === 'the-nitcracker' ? 9000 : 4000,
          workspace,
          eventsPath: 'events.jsonl',
          usage: { tokenDetails: { input: { tokenCount: 1000 }, cache_read: { tokenCount: 0 }, cache_write: { tokenCount: 0 }, output: { tokenCount: 100 } } },
        });
        fs.writeFileSync(path.join(trialDir, 'events.jsonl'), ev.map((e) => JSON.stringify(e)).join('\n'));
      }
    }
  }
  return { runDir, goldenDir };
}

function itemsInPrompt(prompt) {
  return prompt.split('\n').filter((l) => l.startsWith('{"id":"item-')).map((l) => JSON.parse(l));
}

// claude and grok classify by content; gpt-6.1-terra always differs on defect_class. On unmatched
// verdicts claude and terra agree and grok dissents, so the view without terra is disputed.
function scriptedGrade(calls = []) {
  return async (model, prompt) => {
    calls.push({ model, prompt });
    const golden = prompt.includes('defect_class');
    const annotations = itemsInPrompt(prompt).map((it) => {
      if (golden) {
        const persistence = /await|commit/i.test(it.finding);
        const cls = model === 'gpt-6.1-terra' ? 'security' : persistence ? 'data-persistence' : 'logic';
        return { id: it.id, defect_class: cls, locality: persistence ? 'single-file' : 'single-hunk', detection: 'diff' };
      }
      return { id: it.id, verdict: model === 'grok-4.7' ? 'wrong' : 'real-missing-from-golden' };
    });
    return `Here you go:\n\`\`\`json\n${JSON.stringify({ annotations })}\n\`\`\``;
  };
}

test('panel consensus accepts a 2-of-3 label and disputes a three-way split', async () => {
  const { consensus, consensusLabels, agreementStats } = await load('scoring/panel.js');
  assert.deepEqual(consensus(['logic', 'logic', 'security']).status, 'accepted');
  assert.equal(consensus(['logic', 'logic', 'security']).label, 'logic');
  assert.equal(consensus(['logic', 'security', 'tests']).status, 'disputed');
  assert.equal(consensus(['logic', 'security', 'tests']).label, null);
  assert.equal(consensus(['logic', null, null]).status, 'disputed');

  const taxonomy = { golden: { defect_class: ['logic', 'security', 'tests'] }, unmatched: { verdict: ['real-missing-from-golden', 'wrong'] } };
  const panel = {
    taxonomy: { version: 't', frozen: true, dimensions: taxonomy },
    panelists: PANEL,
    sharedFamily: 'gpt-6.1-terra',
    items: [{ id: 'item-0001', kind: 'golden' }, { id: 'item-0002', kind: 'golden' }, { id: 'item-0003', kind: 'golden' }],
    annotations: [
      ['item-0001', 'logic', 'logic', 'security'],
      ['item-0002', 'logic', 'security', 'tests'],
      ['item-0003', 'logic', 'security', 'logic'],
    ].flatMap(([item, ...labels]) => labels.map((l, i) => ({ item, panelist: PANEL[i], labels: { defect_class: l } }))),
    failures: [],
  };
  const all = consensusLabels(panel);
  assert.equal(all.items.get('item-0001').labels.defect_class.label, 'logic');
  assert.equal(all.items.get('item-0002').labels.defect_class.status, 'disputed');
  assert.equal(all.items.get('item-0003').labels.defect_class.label, 'logic');
  const withoutGpt = consensusLabels(panel, { exclude: ['gpt-6.1-terra'] });
  assert.deepEqual(withoutGpt.panelists, ['claude-opus-5.5', 'grok-4.7']);
  assert.equal(withoutGpt.items.get('item-0001').labels.defect_class.label, 'logic');
  assert.equal(withoutGpt.items.get('item-0003').labels.defect_class.status, 'disputed');
  const stats = agreementStats(panel).dimensions.find((d) => d.dimension === 'defect_class');
  assert.equal(stats.disputed, 1);
  assert.ok(Math.abs(stats.disputedShare - 1 / 3) < 1e-9);
});

test('panel prompts are blind: no arm name or arm-revealing formatting, items shuffled', async () => {
  const { loadJudged, panelItems, runPanel, blindNames, assertBlind } = await load('scoring/panel.js');
  const { runDir, goldenDir } = fixture();
  const judged = loadJudged({ runDir, goldenDir });
  assert.deepEqual(judged.arms, ARMS);
  assert.equal(judged.trials.filter((t) => t.arm === 'plain-review').length, 12, 'the rejected r3 judge run is skipped');
  const aliases = ['Nitcracker'];
  const items = panelItems(judged, { arms: ARMS, aliases, seed: 7 });
  assert.equal(items.length, 30);
  assert.ok(items.some((it, i) => i > 0 && it.kind !== items[i - 1].kind), 'golden and unmatched items are interleaved');

  const calls = [];
  const panel = await runPanel({ items, panelists: PANEL, names: blindNames(ARMS, aliases), grade: scriptedGrade(calls), seed: 7 });
  assert.equal(calls.length, 6);
  const armPattern = /nit\s*-?_?cracker|plain[\s_-]*review/i;
  for (const { prompt } of calls) {
    assert.doesNotMatch(prompt, armPattern);
    assert.doesNotMatch(prompt, /\p{Extended_Pictographic}/u);
    assert.doesNotMatch(prompt, /\*\*|^#{1,6}\s/m);
    assert.ok(!/"(?:arm|task|repeat|source)"/.test(prompt), 'no source metadata in prompts');
  }
  assert.deepEqual(panel.prompts.map((p) => p.text), calls.map((c) => c.prompt));
  const orders = PANEL.map((m) => panel.prompts.filter((p) => p.panelist === m && p.kind === 'unmatched').flatMap((p) => p.items).join(','));
  assert.ok(new Set(orders).size > 1, 'each panelist sees its own item order');
  const leaky = items.find((it) => it.kind === 'unmatched' && it.source.arm === 'the-nitcracker');
  assert.match(leaky.content.finding, /race/);
  assert.throws(() => assertBlind('The Nitcracker found a race', blindNames(ARMS, aliases)), /reveals arm identity/);
  assert.throws(() => assertBlind('see the_nitcracker output', blindNames(ARMS)), /reveals arm identity/);
});

test('panel records an annotation or an explicit failure for every item and panelist', async () => {
  const { runPanel, coverageGaps } = await load('scoring/panel.js');
  const items = Array.from({ length: 4 }, (_, i) => ({ id: `item-000${i + 1}`, kind: 'golden', source: {}, content: { file: 'a.js', lines: '1', finding: `finding ${i}` } }));
  items.push({ id: 'item-0005', kind: 'unmatched', source: {}, content: { file: 'b.js', lines: '2', finding: 'maybe' } });
  const grade = async (model, prompt) => {
    if (model === 'grok-4.7' && prompt.includes('defect_class')) throw new Error('rate limited');
    const ids = itemsInPrompt(prompt).map((it) => it.id);
    if (model === 'gpt-6.1-terra') return 'I cannot answer in JSON';
    return JSON.stringify({
      annotations: ids.filter((id) => id !== 'item-0002').map((id) => (id === 'item-0005'
        ? { id, verdict: 'real-missing-from-golden' }
        : { id, defect_class: id === 'item-0003' ? 'not-a-class' : 'logic', locality: 'single-hunk', detection: 'diff' })),
    });
  };
  const panel = await runPanel({ items, panelists: PANEL, grade });
  assert.deepEqual(coverageGaps(panel), []);
  for (const it of items) {
    for (const p of PANEL) {
      const n = panel.annotations.filter((a) => a.item === it.id && a.panelist === p).length + panel.failures.filter((f) => f.item === it.id && f.panelist === p).length;
      assert.equal(n, 1, `${it.id} ${p}`);
    }
  }
  const reason = (item, panelist) => panel.failures.find((f) => f.item === item && f.panelist === panelist)?.reason ?? '';
  assert.match(reason('item-0001', 'grok-4.7'), /panelist call failed: rate limited/);
  assert.match(reason('item-0001', 'gpt-6.1-terra'), /no JSON object/);
  assert.match(reason('item-0002', 'claude-opus-5.5'), /no annotation returned/);
  assert.match(reason('item-0003', 'claude-opus-5.5'), /outside taxonomy .*defect_class="not-a-class"/);
  assert.ok(panel.annotations.some((a) => a.item === 'item-0005' && a.panelist === 'grok-4.7'));
  await assert.rejects(runPanel({ items, panelists: PANEL.slice(0, 2), grade }), /at least three distinct panelists/);
  await assert.rejects(runPanel({ items, panelists: PANEL, grade, requireFrozen: true }), /not frozen/);
});

test('panel agreement: Krippendorff alpha and maintainer hand-label agreement', async () => {
  const { krippendorffAlpha, maintainerAgreement, handLabelSample, HAND_LABEL_SAMPLE_SIZE } = await load('scoring/panel.js');
  assert.ok(Math.abs(krippendorffAlpha([['a', 'a'], ['a', 'b'], ['b', 'b']]) - 4 / 9) < 1e-9);
  assert.equal(krippendorffAlpha([['a', 'a', 'a'], ['b', 'b', null]]), 1);
  assert.equal(krippendorffAlpha([['a', 'a']]), null);
  assert.equal(HAND_LABEL_SAMPLE_SIZE, 30);

  const panel = {
    taxonomy: { version: 't', frozen: true, dimensions: { golden: { defect_class: ['logic', 'security'] }, unmatched: { verdict: ['wrong', 'real-missing-from-golden'] } } },
    panelists: PANEL,
    items: Array.from({ length: 40 }, (_, i) => ({ id: `item-${String(i + 1).padStart(4, '0')}`, kind: 'golden', content: { file: 'a.js', lines: '1', finding: 'x' } })),
    annotations: [],
    failures: [],
  };
  panel.items.forEach((it, i) => PANEL.forEach((p) => panel.annotations.push({ item: it.id, panelist: p, labels: { defect_class: i % 2 ? 'security' : 'logic' } })));
  const sample = handLabelSample(panel, { seed: 3 });
  assert.equal(sample.length, 30);
  assert.ok(sample.every((s) => !('source' in s) && s.dimensions.defect_class));
  const hand = Object.fromEntries(sample.map((s, i) => {
    const idx = Number(s.id.slice(5)) - 1;
    const panelLabel = idx % 2 ? 'security' : 'logic';
    return [s.id, { defect_class: i < 3 ? (panelLabel === 'logic' ? 'security' : 'logic') : panelLabel }];
  }));
  const agreement = maintainerAgreement(panel, hand).dimensions.find((d) => d.dimension === 'defect_class');
  assert.deepEqual({ labelled: agreement.labelled, agree: agreement.agree }, { labelled: 30, agree: 27 });
  assert.equal(agreement.agreement, 0.9);
  assert.equal(maintainerAgreement(panel, null), null);
});

test('panel behaviour features are counted from trial transcripts without a model', async () => {
  const { trialFeatures } = await load('scoring/behaviour.js');
  const { runDir } = fixture();
  const nit = trialFeatures(path.join(runDir, 'trials', 'pr-1', 'the-nitcracker', '1'), { diffFiles: ['src/parse.js', 'src/db.js'] });
  assert.deepEqual(
    { ...nit },
    { available: true, filesRead: 4, filesReadInDiff: 2, filesReadOutsideDiff: 2, searches: 1, commands: 1, verificationAttempts: 1, subagents: 1, toolCalls: 5, tokens: 1100, durationMs: 9000 },
  );
  const plain = trialFeatures(path.join(runDir, 'trials', 'pr-1', 'plain-review', '1'));
  assert.equal(plain.filesRead, 2);
  assert.equal(plain.filesReadInDiff, null);
  assert.equal(trialFeatures(path.join(runDir, 'missing')).available, false);
});

test('panel report: recall by class with paired intervals, unique catches, unmatched, views with and without GPT', async () => {
  const { runPanelAnalysis } = await load('report/panel.js');
  const { runDir, goldenDir } = fixture();
  const calls = [];
  const { report, outDir } = await runPanelAnalysis({
    runDir,
    goldenDir,
    arms: ARMS,
    aliases: ['Nitcracker'],
    grade: scriptedGrade(calls),
    namedInAdvance: ['defect_class:data-persistence'],
    diffFilesFor: () => ['src/parse.js', 'src/db.js'],
    resamples: 2000,
  });
  for (const f of ['panel.json', 'report.json', 'report.md', 'hand-label-sample.json']) assert.ok(fs.existsSync(path.join(outDir, f)), f);
  assert.equal(JSON.parse(fs.readFileSync(path.join(outDir, 'hand-label-sample.json'), 'utf8')).length, 30);
  assert.deepEqual(report.items, { total: 30, golden: 12, unmatched: 18 });
  assert.deepEqual(report.comparisons, [['plain-review', 'the-nitcracker']]);
  assert.match(report.disclosure, /gpt-6\.1-terra/);
  assert.deepEqual(report.views.map((v) => v.name), ['all panelists', 'without gpt-6.1-terra']);

  for (const view of report.views) {
    const persistence = view.recall.comparisons.find((c) => c.dimension === 'defect_class' && c.label === 'data-persistence');
    assert.equal(persistence.tasks, 6);
    assert.equal(persistence.difference, 1);
    assert.deepEqual(persistence.ci, [1, 1]);
    assert.equal(persistence.status, 'pre-named');
    assert.equal(persistence.verdict, null);
    const logic = view.recall.comparisons.find((c) => c.dimension === 'defect_class' && c.label === 'logic');
    assert.equal(logic.difference, 0);
    assert.equal(logic.status, 'hypothesis');
    const locality = view.recall.comparisons.find((c) => c.dimension === 'locality' && c.label === 'single-file');
    assert.equal(locality.status, 'hypothesis');
    assert.equal(view.uniqueCatches['the-nitcracker'].count, 6);
    assert.deepEqual(view.uniqueCatches['the-nitcracker'].byClass, { 'data-persistence': 6 });
    assert.equal(view.uniqueCatches['plain-review'].count, 0);
    assert.match(view.associations[0].note, /^Association only: .*does not demonstrate one/);
    assert.ok(view.associations[0].behaviour.filesReadOutsideDiff.difference > 0);
  }
  const [all, withoutGpt] = report.views;
  assert.equal(all.unmatched['the-nitcracker']['real-missing-from-golden'], 12);
  assert.equal(all.unmatched['plain-review'].total, 6);
  assert.equal(withoutGpt.unmatched['the-nitcracker'].disputed, 12);
  assert.equal(all.agreement.find((d) => d.dimension === 'defect_class').disputed, 0);
  assert.equal(report.features['the-nitcracker'].verificationAttempts, 1);
  assert.equal(report.features['plain-review'].verificationAttempts, 0);
  assert.equal(report.handLabels.provided, 0);
  const md = fs.readFileSync(path.join(outDir, 'report.md'), 'utf8');
  assert.match(md, /Disclosure: gpt-6\.1-terra/);
  assert.match(md, /## View: without gpt-6\.1-terra/);
  assert.match(md, /\| the-nitcracker vs plain-review \| defect_class \| data-persistence \| 6 \|/);
  assert.match(md, /hypothesis/);
  assert.doesNotMatch(md, /\u2014/);
  for (const { prompt } of calls) assert.doesNotMatch(prompt, /nitcracker|plain-review/i);
});

test('panel default grading goes through the tool-less Copilot grader for each model', async () => {
  const { runPanel } = await load('scoring/panel.js');
  const { NO_TOOLS_SENTINEL } = await load('providers/copilot-grader.js');
  const runner = await import(new URL('./fake-panel-runner.mjs', import.meta.url).href);
  const evidenceDir = scratch('panel-graders');
  const items = [
    { id: 'item-0001', kind: 'golden', source: {}, content: { file: 'a.js', lines: '1', finding: 'off by one' } },
    { id: 'item-0002', kind: 'unmatched', source: {}, content: { file: 'b.js', lines: '2', finding: 'maybe a leak' } },
  ];
  const saved = process.env.COPILOT_GITHUB_TOKEN;
  process.env.COPILOT_GITHUB_TOKEN = 'ghu_fakePanelToken0123456789';
  let panel;
  try {
    panel = await runPanel({ items, panelists: PANEL, graderConfig: { runnerModule: fakePanelRunner }, evidenceDir });
  } finally {
    if (saved === undefined) delete process.env.COPILOT_GITHUB_TOKEN;
    else process.env.COPILOT_GITHUB_TOKEN = saved;
  }
  assert.deepEqual(panel.failures, []);
  assert.equal(panel.annotations.length, 6);
  assert.deepEqual([...new Set(runner.calls.map((c) => c.model))].sort(), [...PANEL].sort());
  for (const call of runner.calls) {
    assert.equal(call.args[0], '-p');
    assert.ok(call.args.includes('--no-custom-instructions'));
    assert.ok(call.args.includes(`--available-tools=${NO_TOOLS_SENTINEL}`));
    assert.ok(!call.args.some((a) => a === '--allow-all-tools' || a === '--yolo' || a.startsWith('--add-dir')));
    assert.equal(call.env.HOME, call.env.COPILOT_HOME);
    assert.ok(path.resolve(call.home).startsWith(path.resolve(evidenceDir, call.model)));
  }
  for (const model of PANEL) {
    const dirs = fs.readdirSync(path.join(evidenceDir, model)).filter((d) => d.startsWith('grade-'));
    assert.equal(dirs.length, 2);
    for (const d of dirs) assert.equal(JSON.parse(fs.readFileSync(path.join(evidenceDir, model, d, 'grade.json'), 'utf8')).toolCalls, 0);
  }
});

test('panel re-asks an unparsable answer once, keeps every raw answer and records a failure only after the retry', async () => {
  const { runPanel, JSON_ONLY_REMINDER } = await load('scoring/panel.js');
  const runner = await import(new URL('./fake-panel-runner.mjs', import.meta.url).href);
  runner.calls.length = 0;
  runner.unparsableFirst.add('grok-4.7');
  runner.unparsableAlways.add('gpt-6.1-terra');
  const evidenceDir = scratch('panel-retry');
  const items = [
    { id: 'item-0001', kind: 'golden', source: {}, content: { file: 'a.js', lines: '1', finding: 'off by one' } },
    { id: 'item-0002', kind: 'unmatched', source: {}, content: { file: 'b.js', lines: '2', finding: 'maybe a leak' } },
  ];
  const saved = process.env.COPILOT_GITHUB_TOKEN;
  process.env.COPILOT_GITHUB_TOKEN = 'ghu_fakePanelToken0123456789';
  let panel;
  try {
    panel = await runPanel({ items, panelists: PANEL, graderConfig: { runnerModule: fakePanelRunner }, evidenceDir });
  } finally {
    runner.unparsableFirst.clear();
    runner.unparsableAlways.clear();
    if (saved === undefined) delete process.env.COPILOT_GITHUB_TOKEN;
    else process.env.COPILOT_GITHUB_TOKEN = saved;
  }
  const callsFor = (model) => runner.calls.filter((c) => c.model === model);
  assert.equal(callsFor('claude-opus-5.5').length, 2, 'a parsable answer is not re-asked');
  assert.equal(callsFor('grok-4.7').length, 4);
  assert.equal(callsFor('gpt-6.1-terra').length, 4, 'one retry only');
  const [first, retry] = callsFor('grok-4.7');
  assert.equal(retry.prompt, `${first.prompt}\n${JSON_ONLY_REMINDER}`, 'the retry repeats the same blind prompt plus the reminder');

  for (const it of items) {
    const grok = panel.annotations.find((a) => a.item === it.id && a.panelist === 'grok-4.7');
    assert.ok(grok, `${it.id} grok annotated after its retry`);
    assert.equal(grok.answers.length, 2);
    const gpt = panel.failures.find((f) => f.item === it.id && f.panelist === 'gpt-6.1-terra');
    assert.match(gpt.reason, /unparsable after retry: panelist answer has no JSON object; then panelist answer has no JSON object/);
    assert.equal(gpt.answers.length, 2);
    assert.ok(!panel.failures.some((f) => f.item === it.id && f.panelist === 'grok-4.7'));
  }
  assert.equal(panel.answers.length, 10);
  const grokFirst = panel.answers.find((a) => a.panelist === 'grok-4.7' && a.kind === 'golden' && a.attempt === 1);
  assert.match(grokFirst.error, /no JSON object/);
  assert.equal(fs.readFileSync(path.join(evidenceDir, grokFirst.file), 'utf8'), 'These findings look like logic problems in a single hunk.');
  const perItem = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'grok-4.7', 'items', 'item-0001.json'), 'utf8'));
  assert.deepEqual(perItem.attempts.map((a) => [a.attempt, a.error === null]), [[1, false], [2, true]]);
  assert.ok(perItem.outcome.labels.defect_class);
  for (const a of perItem.attempts) assert.ok(fs.existsSync(path.join(evidenceDir, a.file)), a.file);
  const gptItem = JSON.parse(fs.readFileSync(path.join(evidenceDir, 'gpt-6.1-terra', 'items', 'item-0002.json'), 'utf8'));
  assert.match(gptItem.outcome.failure, /unparsable after retry/);
  assert.equal(gptItem.attempts.length, 2);
});

test('panel excludes errored and invalidated trials from behaviour features and per-arm aggregates', async () => {
  const { trialFeatures, collectFeatures } = await load('scoring/behaviour.js');
  const { runPanelAnalysis } = await load('report/panel.js');
  const { runDir, goldenDir } = fixture();
  const recordAt = (task, arm, r) => path.join(runDir, 'trials', task, arm, String(r), 'trial.json');
  const patch = (file, change) => writeJson(file, { ...JSON.parse(fs.readFileSync(file, 'utf8')), ...change });
  patch(recordAt('pr-1', 'the-nitcracker', 1), { status: 'errored', reason: 'Copilot exited 1.' });
  patch(recordAt('pr-2', 'the-nitcracker', 1), { status: 'errored', reason: 'Copilot exited 1.' });
  patch(recordAt('pr-3', 'plain-review', 1), { invalidated: true, reason: 'fetched the benchmark PR page' });

  const errored = trialFeatures(path.dirname(recordAt('pr-1', 'the-nitcracker', 1)));
  assert.deepEqual(errored, { available: false, excluded: true, status: 'errored', reason: 'Copilot exited 1.' });
  assert.equal(collectFeatures(runDir).filter((f) => f.excluded).length, 3);

  const { report, outDir } = await runPanelAnalysis({ runDir, goldenDir, arms: ARMS, aliases: ['Nitcracker'], grade: scriptedGrade(), resamples: 500 });
  assert.deepEqual(
    Object.fromEntries(ARMS.map((a) => [a, [report.features[a].trials, report.features[a].excluded, report.features[a].excludedByStatus]])),
    { 'plain-review': [11, 1, { invalidated: 1 }], 'the-nitcracker': [10, 2, { errored: 2 }] },
  );
  assert.equal(report.features['the-nitcracker'].toolCalls, 5, 'excluded trials do not pull the mean toward zero');
  assert.equal(report.excludedTrials['the-nitcracker'].count, 2);
  assert.deepEqual(report.excludedTrials['plain-review'].byStatus, { invalidated: 1 });
  assert.deepEqual(report.items, { total: 27, golden: 12, unmatched: 15 }, 'findings from excluded trials are not panel items');
  const [all] = report.views;
  assert.equal(all.unmatched['the-nitcracker'].trials, 10);
  assert.equal(all.unmatched['plain-review'].trials, 11);
  assert.equal(all.unmatched['plain-review'].total, 5);
  const md = fs.readFileSync(path.join(outDir, 'report.md'), 'utf8');
  assert.match(md, /\| the-nitcracker \| 10 \| 2 \(errored 2\) \|/);
  assert.match(md, /Judged trials excluded from panel aggregates \(not completed or invalidated\): plain-review 1 \(invalidated 1\); the-nitcracker 2 \(errored 2\)\./);
});
