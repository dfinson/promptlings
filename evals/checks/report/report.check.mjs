// AC-8: per-metric paired bootstrap interval, Holm verdict, invalidated counts and refusal on confounded arms.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function load(relative) {
  try {
    return await import(new URL(`../../${relative}`, import.meta.url).href);
  } catch (err) {
    assert.fail(`${relative} must load: ${err.message}`);
  }
}

const TASKS = Array.from({ length: 20 }, (_, i) => `pr-${String(i).padStart(2, '0')}`);

// Deterministic per-task scores: base difficulty plus an arm effect plus small noise.
function trialsFor(arm, { effect = 0, precisionEffect = 0, cliVersion = '1.0.0', runDir = '/runs/r1' } = {}) {
  return TASKS.map((task, i) => {
    const base = 0.2 + (i % 5) * 0.1;
    const noise = (((i * 7 + arm.length) % 5) - 2) * 0.01;
    return {
      task,
      arm,
      repeat: 0,
      trialDir: path.join(runDir, 'trials', task, arm, '0'),
      status: 'completed',
      invalidated: false,
      reason: null,
      metrics: { recall: base + effect + noise, precision: 0.6 + precisionEffect + noise, augmented: base },
      process: { wallMs: 1000, nanoAiu: 5000, tokens: { total: 100 }, toolCalls: 3, subagents: 0, exitCode: 0 },
      cliVersion,
    };
  });
}

function scoresDoc(trials, arms, extra = {}) {
  return {
    schema: 1,
    runId: 'r1',
    runDir: '/runs/r1',
    context: { suite: 'reviewbench', datasetPin: 'abc', graders: [{ id: 'rubric', model: 'gpt-5.6-terra' }], judge: { model: 'gpt-6.1-sol' } },
    arms: Object.fromEntries(arms.map((a) => [a.id, a])),
    metrics: { primary: ['recall'], secondary: ['augmented'], guardrail: ['precision'], higherIsBetter: {} },
    trials,
    ...extra,
  };
}

const arm = (id, extra = {}) => ({ id, model: 'gpt-6.1-sol', selection: id === 'stock' ? 'none' : 'all', sandbox: 'workspace', ...extra });

test('report stats: paired bootstrap defaults to 10,000 resamples and Holm adjusts step-down', async () => {
  const { pairedBootstrap, holm } = await load('scoring/stats.js');
  const result = pairedBootstrap([0.1, 0.2, 0.15, 0.05, 0.12]);
  assert.equal(result.resamples, 10000);
  assert.ok(result.ci[0] > 0 && result.ci[1] < 0.21);
  assert.ok(result.p < 0.01);
  assert.deepEqual(pairedBootstrap([0.1, -0.1, 0.05], { seed: 3 }), pairedBootstrap([0.1, -0.1, 0.05], { seed: 3 }));
  const adjusted = holm([0.01, 0.04, 0.03]);
  assert.deepEqual(adjusted.map((p) => Number(p.toFixed(10))), [0.03, 0.06, 0.06]);
});

test('report gives per-metric intervals, Holm verdicts and invalidated counts', async () => {
  const { buildReport, renderMarkdown } = await load('report/index.js');
  const invalid = trialsFor('nitcracker', { effect: 0.15 });
  invalid[0] = { ...invalid[0], invalidated: true, status: 'invalidated', reason: 'fetched the benchmark PR page', metrics: { recall: 1000, precision: 1000, augmented: 1000 } };
  const doc = scoresDoc(
    [
      ...trialsFor('stock'),
      ...invalid,
      ...trialsFor('sparring', { effect: 0, precisionEffect: -0.2 }),
    ],
    [arm('stock'), arm('nitcracker', { agent: 'the-nitcracker' }), arm('sparring', { agent: 'sparring-partner' })],
  );
  doc.context.minPairedN = 18; // as suite.yaml analysis.minPairedN declares it
  const report = buildReport(doc, { baseline: 'stock' });

  assert.equal(report.comparisons.length, 2);
  const nit = report.comparisons.find((c) => c.b === 'nitcracker');
  const spar = report.comparisons.find((c) => c.b === 'sparring');
  assert.equal(nit.confounded, false);
  const recall = nit.metrics.find((m) => m.metric === 'recall');
  assert.equal(recall.resamples, 10000);
  assert.equal(recall.tasks, 19, 'the invalidated trial is excluded from pairing');
  assert.ok(recall.difference > 0.1 && recall.difference < 0.2, 'the invalidated value of 1000 does not reach the metric');
  assert.ok(recall.ci[0] > 0 && recall.ci[1] > recall.ci[0]);
  assert.equal(recall.verdict, 'better');
  assert.ok(recall.pAdjusted >= recall.p);
  assert.equal(nit.pairing.kept, 19);
  assert.deepEqual(nit.pairing.dropped.map((d) => [d.task, d.reasons[0].reason]), [['pr-00', 'invalidated']]);
  assert.equal(nit.pairing.plannedN, 20);
  assert.equal(nit.pairing.minPairedN, 18);
  assert.equal(nit.pairing.shortfall, 0, 'one dropped task of 20 still meets the minimum of 18');

  const sparRecall = spar.metrics.find((m) => m.metric === 'recall');
  assert.equal(sparRecall.verdict, 'inconclusive');
  assert.ok(sparRecall.ci[0] < 0 && sparRecall.ci[1] > 0);
  assert.ok(report.statistics.multiplicity.includes('Holm') && report.statistics.multiplicity.includes('2 primary'));

  const { holm } = await load('scoring/stats.js');
  assert.deepEqual([recall.pAdjusted, sparRecall.pAdjusted], holm([recall.p, sparRecall.p]));

  assert.equal(spar.metrics.find((m) => m.metric === 'precision').guardrailFlag, true);
  assert.equal(spar.metrics.find((m) => m.metric === 'augmented').verdict, undefined, 'secondary metrics get an interval, not a verdict');

  const nitSummary = report.arms.find((a) => a.key === 'nitcracker');
  assert.equal(nitSummary.counts.invalidated, 1);
  assert.equal(nitSummary.invalidated[0].reason, 'fetched the benchmark PR page');
  assert.equal(report.arms.find((a) => a.key === 'stock').counts.invalidated, 0);

  const md = renderMarkdown(report, { outDir: '/runs/r1/report' });
  assert.match(md, /\| recall \| primary \|.*\| better \|/);
  assert.match(md, /fetched the benchmark PR page/);
  assert.match(md, /Invalidated/);
  assert.match(md, /\.\.\/trials\/pr-00\/nitcracker\/0/);
});

test('report refuses a verdict on confounded arms', async () => {
  const { buildReport, renderMarkdown } = await load('report/index.js');
  const doc = scoresDoc(
    [
      ...trialsFor('stock'),
      ...trialsFor('other-model', { effect: 0.3 }),
      ...trialsFor('new-cli', { effect: 0.3, cliVersion: '1.0.1' }),
      ...trialsFor('declared', { effect: 0.3 }),
    ],
    [arm('stock'), arm('other-model', { model: 'gpt-6.1-terra' }), arm('new-cli'), arm('declared', { ref: 'main' })],
  );
  const report = buildReport(doc, { baseline: 'stock' });
  const byArm = Object.fromEntries(report.comparisons.map((c) => [c.b, c]));

  assert.equal(byArm['other-model'].confounded, true);
  assert.deepEqual(byArm['other-model'].confoundedBy, ['arm.model']);
  assert.equal(byArm['new-cli'].confounded, true);
  assert.deepEqual(byArm['new-cli'].confoundedBy, ['cliVersion']);
  for (const key of ['other-model', 'new-cli']) {
    const recall = byArm[key].metrics.find((m) => m.metric === 'recall');
    assert.equal(recall.verdict, null);
    assert.equal(recall.pAdjusted, undefined, 'confounded comparisons stay out of the Holm family');
    assert.ok(Number.isFinite(recall.ci[0]), 'the interval is still shown');
  }
  assert.equal(byArm.declared.confounded, false);
  assert.equal(byArm.declared.metrics.find((m) => m.metric === 'recall').verdict, 'better');
  assert.ok(report.statistics.multiplicity.includes('1 primary'));

  const md = renderMarkdown(report);
  assert.match(md, /\*\*Confounded:\*\* the arms differ in `arm\.model`/);
  assert.match(md, /No verdict is given/);
  assert.match(report.comparisons.find((c) => c.b === 'other-model').metrics[0].verdictNote, /confounded/);

  const otherRun = scoresDoc(trialsFor('promptlings', { effect: 0.3 }), [arm('promptlings')], {
    runId: 'r2',
    context: { suite: 'reviewbench', datasetPin: 'different', graders: [{ id: 'rubric', model: 'gpt-5.6-terra' }], judge: { model: 'gpt-6.1-sol' } },
  });
  const cross = buildReport([scoresDoc(trialsFor('stock'), [arm('stock')]), otherRun], { comparisons: [['r1/stock', 'r2/promptlings']] });
  assert.equal(cross.comparisons[0].confounded, true);
  assert.ok(cross.comparisons[0].confoundedBy.includes('run.datasetPin'));
});

test('report counts a resolvedRef difference as declared when ref is declared', async () => {
  const { buildReport } = await load('report/index.js');
  const doc = scoresDoc(
    [...trialsFor('stock'), ...trialsFor('candidate', { effect: 0.3 })],
    [arm('stock', { resolvedRef: 'aaaa111' }), arm('candidate', { ref: 'dfinson/review-agent', resolvedRef: 'bbbb222' })],
  );
  const declaredRef = buildReport(doc, { baseline: 'stock' }).comparisons[0];
  assert.equal(declaredRef.confounded, false);
  assert.deepEqual(declaredRef.differences.filter((d) => d.field.endsWith('Ref') || d.field === 'arm.ref').map((d) => [d.field, d.declared]), [['arm.ref', true], ['arm.resolvedRef', true]]);
  assert.equal(declaredRef.metrics.find((m) => m.metric === 'recall').verdict, 'better');

  const refUndeclared = buildReport(doc, { baseline: 'stock', declaredDifferences: ['id', 'label', 'selection', 'agent'] }).comparisons[0];
  assert.equal(refUndeclared.confounded, true);
  assert.deepEqual(refUndeclared.confoundedBy, ['arm.ref', 'arm.resolvedRef']);
});

test('report drops tasks with missing pairs, counts kept and dropped, and refuses a verdict below the minimum paired n', async () => {
  const { buildReport, renderMarkdown } = await load('report/index.js');
  const { mergeScoreEntries } = await load('scoring/scores.js');
  const stock = trialsFor('stock');
  const nit = trialsFor('nitcracker', { effect: 0.15 }).filter((t) => t.task !== 'pr-19');
  nit[1] = { ...nit[1], status: 'errored', reason: 'exit code 1' };
  const doc = scoresDoc([...stock, ...nit], [arm('stock'), arm('nitcracker', { agent: 'the-nitcracker' })]);
  doc.context.plannedTasks = TASKS;

  // Judge output as scoreRun returns it: string repeats, no entry for pr-02 under stock.
  const entries = [...stock, ...nit]
    .filter((t) => !(t.arm === 'stock' && t.task === 'pr-02'))
    .map((t) => ({ task: t.task, arm: t.arm, repeat: String(t.repeat), variant: 'primary', metrics: t.metrics }));
  const judged = mergeScoreEntries(doc, { entries });
  const report = buildReport(judged, { baseline: 'stock' });
  const [c] = report.comparisons;
  assert.equal(c.pairing.plannedN, 20);
  assert.equal(c.pairing.minPairedN, 20, 'without a declared minimum the planned count is required');
  assert.equal(c.pairing.kept, 17);
  const reasons = Object.fromEntries(c.pairing.dropped.map((d) => [d.task, d.reasons.map((r) => `${r.arm}:${r.reason}`)]));
  assert.deepEqual(reasons, {
    'pr-01': ['nitcracker:errored'],
    'pr-02': ['stock:absent from judge output'],
    'pr-19': ['nitcracker:absent'],
  });
  assert.equal(c.pairing.shortfall, 3);
  const recall = c.metrics.find((m) => m.metric === 'recall');
  assert.equal(recall.tasks, 17, 'only kept tasks enter the bootstrap');
  assert.equal(recall.verdict, null);
  assert.match(recall.verdictNote, /17 tasks paired, below the minimum paired n of 20 \(planned 20\), shortfall 3/);
  assert.equal(recall.pAdjusted, undefined, 'an underpowered comparison stays out of the Holm family');
  assert.ok(Number.isFinite(recall.ci[0]), 'the interval is still shown');

  const md = renderMarkdown(report);
  assert.match(md, /Tasks: 17 kept, 3 dropped, planned n 20, minimum paired n 20\./);
  assert.match(md, /\*\*Shortfall:\*\* 3 task\(s\) below the minimum paired n/);
  assert.match(md, /- pr-02: stock repeat 0 absent from judge output/);

  // The suite's power-derived minimum, not the planned count, decides the refusal.
  const atMin = buildReport({ ...judged, context: { ...judged.context, minPairedN: 17 } }, { baseline: 'stock' }).comparisons[0];
  assert.equal(atMin.pairing.shortfall, 0);
  assert.equal(atMin.metrics.find((m) => m.metric === 'recall').verdict, 'better');
  const belowMin = buildReport(judged, { baseline: 'stock', minPairedN: 18 }).comparisons[0];
  assert.equal(belowMin.pairing.shortfall, 1);
  assert.equal(belowMin.metrics.find((m) => m.metric === 'recall').verdict, null);

  // Per-stage analysis (stages.<name>.analysis): its minimum applies and verdict: false withholds verdicts.
  const stageMin = buildReport(judged, { baseline: 'stock', stageAnalysis: { verdict: true, minPairedN: 17 } }).comparisons[0];
  assert.equal(stageMin.pairing.minPairedN, 17);
  assert.equal(stageMin.metrics.find((m) => m.metric === 'recall').verdict, 'better');
  const pilot = buildReport({ ...judged, context: { ...judged.context, stageAnalysis: { verdict: false, minPairedN: 17 } } }, { baseline: 'stock' });
  assert.equal(pilot.stage.verdictIssued, false);
  const pilotRecall = pilot.comparisons[0].metrics.find((m) => m.metric === 'recall');
  assert.equal(pilotRecall.verdict, null);
  assert.equal(pilotRecall.verdictNote, 'verdict not issued at this stage');
  assert.ok(Number.isFinite(pilotRecall.ci[0]) && Number.isFinite(pilotRecall.ci[1]), 'intervals are still reported');
  assert.match(renderMarkdown(pilot), /Verdict not issued at this stage/);
  assert.equal(buildReport(judged, { baseline: 'stock', analysis: { verdict: false } }).comparisons[0].metrics.find((m) => m.metric === 'recall').verdict, null);

  const rejected = mergeScoreEntries(doc, { entries: entries.filter((e) => e.arm !== 'nitcracker'), rejected: [{ arm: 'nitcracker', repeat: '0', variant: 'primary', reason: 'verification failed' }] });
  const none = buildReport(rejected, { baseline: 'stock' }).comparisons[0];
  assert.equal(none.pairing.kept, 0);
  assert.ok(none.pairing.dropped.some((d) => d.reasons.some((r) => r.reason === 'judge rejected' && r.detail === 'verification failed')));
  assert.throws(() => mergeScoreEntries(doc, { entries: [{ task: 'pr-99', arm: 'stock', repeat: '0', metrics: {} }] }), /match no trial/);
});

test('report writes Markdown and JSON with same-model disclosure', async () => {
  const { writeReport } = await load('report/index.js');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'evals-report-'));
  const doc = scoresDoc([...trialsFor('stock'), ...trialsFor('graded', { effect: 0.1 })], [arm('stock'), arm('graded')]);
  doc.arms.graded.model = 'gpt-6.1-sol';
  const { jsonPath, mdPath, report } = writeReport(doc, out, { baseline: 'stock' });
  assert.ok(fs.existsSync(jsonPath) && fs.existsSync(mdPath));
  assert.deepEqual(JSON.parse(fs.readFileSync(jsonPath, 'utf8')).comparisons[0].metrics[0].metric, 'recall');
  assert.ok(report.disclosures.sameModel.some((d) => d.arm === 'graded' && d.role === 'judge'));
  assert.match(fs.readFileSync(mdPath, 'utf8'), /same model as the judge/);
});
