// Turns one or more scores.json documents into a paired comparison report (Markdown and JSON).
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_RESAMPLES, holm, mean, pairedBootstrap } from '../scoring/stats.js';

export const DEFAULT_DECLARED_DIFFERENCES = ['id', 'label', 'ref', 'selection', 'agent'];
// Separate runs are comparable only when these match.
export const CROSS_RUN_KEYS = ['suite', 'datasetPin', 'prompt', 'judge'];
const PROCESS_KEYS = ['wallMs', 'nanoAiu', 'tokens', 'toolCalls', 'subagents'];

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function loadScores(input) {
  if (typeof input !== 'string') return input;
  const file = fs.statSync(input).isDirectory() ? path.join(input, 'scores.json') : input;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function armKey(run, armId, multi) {
  return multi ? `${run.runId}/${armId}` : armId;
}

function collectArms(runs) {
  const multi = runs.length > 1;
  const arms = new Map();
  for (const run of runs) {
    const ids = new Set([...Object.keys(run.arms ?? {}), ...run.trials.map((t) => t.arm)]);
    for (const id of ids) {
      const key = armKey(run, id, multi);
      arms.set(key, { key, id, run, config: run.arms?.[id] ?? { id }, trials: run.trials.filter((t) => t.arm === id) });
    }
  }
  return arms;
}

function configDifferences(a, b, declared) {
  const diffs = [];
  const keys = new Set([...Object.keys(a.config), ...Object.keys(b.config)]);
  for (const key of [...keys].sort()) {
    if (stable(a.config[key]) === stable(b.config[key])) continue;
    diffs.push({ field: `arm.${key}`, a: a.config[key] ?? null, b: b.config[key] ?? null, declared: declared.includes(key) });
  }
  const versions = (arm) => [...new Set(arm.trials.map((t) => t.cliVersion).filter(Boolean))].sort();
  if (stable(versions(a)) !== stable(versions(b))) {
    diffs.push({ field: 'cliVersion', a: versions(a), b: versions(b), declared: declared.includes('cliVersion') });
  }
  if (a.run !== b.run) {
    for (const key of CROSS_RUN_KEYS) {
      const va = a.run.context?.[key];
      const vb = b.run.context?.[key];
      if (stable(va) !== stable(vb)) diffs.push({ field: `run.${key}`, a: va ?? null, b: vb ?? null, declared: false });
    }
    if (stable(a.run.context?.graders) !== stable(b.run.context?.graders)) {
      diffs.push({ field: 'run.graders', a: a.run.context?.graders ?? null, b: b.run.context?.graders ?? null, declared: false });
    }
  }
  return diffs;
}

function taskMeans(arm, metric, keep) {
  const byTask = new Map();
  for (const t of arm.trials) {
    if (!keep.has(t.task)) continue;
    const v = t.metrics?.[metric];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (!byTask.has(t.task)) byTask.set(t.task, { values: [], trialDirs: [] });
    byTask.get(t.task).values.push(v);
    byTask.get(t.task).trialDirs.push(t.trialDir);
  }
  return byTask;
}

// Why a trial cannot be paired; null when usable. A judged run also needs the trial's judge entry.
function unusableReason(trial, run) {
  if (trial.invalidated || trial.status === 'invalidated') return 'invalidated';
  if (trial.status !== 'completed') return trial.status ?? 'errored';
  if (run.judged && trial.judge !== 'scored') return trial.judge === 'rejected' ? 'judge rejected' : 'absent from judge output';
  return null;
}

function plannedTasksFor(a, b, options) {
  if (options.plannedTasks) return [...new Set(options.plannedTasks.map(String))].sort();
  const declared = [a.run.context?.plannedTasks, b.run.context?.plannedTasks].filter(Array.isArray);
  const source = declared.length ? declared.flat() : [...a.trials, ...b.trials].map((t) => t.task);
  return [...new Set(source.map(String))].sort();
}

function plannedNFor(a, b, planned, options) {
  if (Number.isInteger(options.plannedN)) return options.plannedN;
  const declared = [a.run.context?.plannedN, b.run.context?.plannedN].filter(Number.isInteger);
  return declared.length ? Math.max(...declared) : planned.length;
}

// Tasks drop out of a comparison when either arm has no trial for them or any trial is unusable.
function pairTasks(a, b, planned) {
  const kept = [];
  const dropped = [];
  for (const task of planned) {
    const reasons = [];
    for (const arm of [a, b]) {
      const trials = arm.trials.filter((t) => t.task === task);
      if (!trials.length) {
        reasons.push({ arm: arm.key, reason: 'absent' });
        continue;
      }
      for (const t of trials) {
        const reason = unusableReason(t, arm.run);
        if (reason) reasons.push({ arm: arm.key, repeat: t.repeat, reason, detail: t.judgeReason ?? t.reason ?? null, trialDir: t.trialDir ?? null });
      }
    }
    if (reasons.length) dropped.push({ task, reasons });
    else kept.push(task);
  }
  return { kept, dropped };
}

function compareMetric(a, b, metric, keep, { resamples, seed }) {
  const ma = taskMeans(a, metric, keep);
  const mb = taskMeans(b, metric, keep);
  const tasks = [...ma.keys()].filter((t) => mb.has(t)).sort();
  const va = tasks.map((t) => mean(ma.get(t).values));
  const vb = tasks.map((t) => mean(mb.get(t).values));
  const diffs = tasks.map((_, i) => vb[i] - va[i]);
  const boot = pairedBootstrap(diffs, { resamples, seed });
  const count = (m) => tasks.reduce((n, t) => n + m.get(t).values.length, 0);
  return {
    metric,
    tasks: tasks.length,
    withoutValue: keep.size - tasks.length,
    repeats: { a: count(ma), b: count(mb) },
    a: mean(va),
    b: mean(vb),
    difference: boot.mean,
    ci: boot.ci,
    p: boot.p,
    resamples: boot.resamples,
    trialDirs: { a: tasks.flatMap((t) => ma.get(t).trialDirs), b: tasks.flatMap((t) => mb.get(t).trialDirs) },
  };
}

function armSummary(arm) {
  const counts = { total: arm.trials.length, completed: 0, failed: 0, invalidated: 0 };
  for (const t of arm.trials) {
    if (t.invalidated) counts.invalidated += 1;
    else if (t.status === 'completed') counts.completed += 1;
    else counts.failed += 1;
  }
  const process = {};
  for (const key of PROCESS_KEYS) {
    const values = arm.trials
      .map((t) => (key === 'tokens' ? t.process?.tokens?.total : t.process?.[key]))
      .filter((v) => typeof v === 'number' && Number.isFinite(v));
    process[key] = values.length ? { mean: mean(values), total: values.reduce((s, v) => s + v, 0), n: values.length } : null;
  }
  return {
    key: arm.key,
    id: arm.id,
    runId: arm.run.runId,
    model: arm.config.model ?? null,
    counts,
    process,
    invalidated: arm.trials.filter((t) => t.invalidated).map((t) => ({ task: t.task, repeat: t.repeat, reason: t.reason, trialDir: t.trialDir })),
    failed: arm.trials.filter((t) => !t.invalidated && t.status !== 'completed').map((t) => ({ task: t.task, repeat: t.repeat, status: t.status, reason: t.reason, trialDir: t.trialDir })),
  };
}

function choosePairs(arms, { comparisons, baseline }) {
  const keys = [...arms.keys()];
  if (comparisons?.length) return comparisons.map(([a, b]) => [a, b]);
  if (baseline) return keys.filter((k) => k !== baseline).map((k) => [baseline, k]);
  const pairs = [];
  for (let i = 0; i < keys.length; i += 1) for (let j = i + 1; j < keys.length; j += 1) pairs.push([keys[i], keys[j]]);
  return pairs;
}

export function buildReport(inputs, options = {}) {
  const runs = (Array.isArray(inputs) ? inputs : [inputs]).map(loadScores);
  if (!runs.length) throw new Error('Report needs at least one scores document');
  const declared = options.declaredDifferences ?? DEFAULT_DECLARED_DIFFERENCES;
  const resamples = options.resamples ?? DEFAULT_RESAMPLES;
  const seed = options.seed ?? 20251111;
  const alpha = options.alpha ?? 0.05;
  const metricsDecl = runs[0].metrics ?? {};
  const primary = options.primary ?? metricsDecl.primary ?? [];
  const secondary = options.secondary ?? metricsDecl.secondary ?? [];
  const guardrail = options.guardrail ?? metricsDecl.guardrail ?? [];
  const higherIsBetter = { ...(metricsDecl.higherIsBetter ?? {}), ...(options.higherIsBetter ?? {}) };
  if (!primary.length) throw new Error('Report needs at least one primary metric');

  const arms = collectArms(runs);
  const comparisons = choosePairs(arms, options).map(([ka, kb]) => {
    const a = arms.get(ka);
    const b = arms.get(kb);
    if (!a || !b) throw new Error(`Unknown arm in comparison ${ka} vs ${kb}`);
    const differences = configDifferences(a, b, declared);
    const undeclared = differences.filter((d) => !d.declared);
    const planned = plannedTasksFor(a, b, options);
    const plannedN = plannedNFor(a, b, planned, options);
    const { kept, dropped } = pairTasks(a, b, planned);
    const keep = new Set(kept);
    const metricRows = [...new Set([...primary, ...secondary, ...guardrail])].map((metric) => ({
      ...compareMetric(a, b, metric, keep, { resamples, seed }),
      role: primary.includes(metric) ? 'primary' : guardrail.includes(metric) ? 'guardrail' : 'secondary',
      higherIsBetter: higherIsBetter[metric] ?? true,
    }));
    return {
      a: ka,
      b: kb,
      confounded: undeclared.length > 0,
      confoundedBy: undeclared.map((d) => d.field),
      differences,
      pairing: { planned: planned.length, plannedN, kept: kept.length, dropped, shortfall: Math.max(0, plannedN - kept.length) },
      metrics: metricRows,
    };
  });

  // Holm family: every primary metric of every unconfounded, fully powered comparison with a computable p.
  const family = [];
  for (const c of comparisons) {
    for (const row of c.metrics) {
      if (c.confounded) {
        row.verdict = null;
        row.verdictNote = `confounded by ${c.confoundedBy.join(', ')}; no verdict`;
        continue;
      }
      const worseSide = row.higherIsBetter ? row.ci[1] < 0 : row.ci[0] > 0;
      if (row.role === 'guardrail') row.guardrailFlag = Number.isFinite(row.ci[0]) && worseSide;
      if (row.role !== 'primary') continue;
      if (c.pairing.shortfall > 0) {
        row.verdict = null;
        row.verdictNote = `${c.pairing.kept} of planned ${c.pairing.plannedN} tasks paired, shortfall ${c.pairing.shortfall}; no verdict`;
      } else if (Number.isFinite(row.p)) family.push(row);
      else {
        row.verdict = null;
        row.verdictNote = 'no paired tasks; no verdict';
      }
    }
  }
  const adjusted = holm(family.map((r) => r.p));
  family.forEach((row, i) => {
    row.pAdjusted = adjusted[i];
    const improved = row.higherIsBetter ? row.difference > 0 : row.difference < 0;
    row.verdict = adjusted[i] < alpha ? (improved ? 'better' : 'worse') : 'inconclusive';
  });

  const armSummaries = [...arms.values()].map(armSummary);
  const graderModels = runs.flatMap((r) => (r.context?.graders ?? []).map((g) => g.model)).filter(Boolean);
  const judgeModel = runs.map((r) => r.context?.judge?.model).find(Boolean);
  const sameModel = armSummaries
    .filter((s) => s.model && (graderModels.includes(s.model) || s.model === judgeModel))
    .map((s) => ({ arm: s.key, model: s.model, role: graderModels.includes(s.model) ? 'grader' : 'judge' }));

  return {
    schema: 1,
    generatedAt: new Date().toISOString(),
    runs: runs.map((r) => ({ runId: r.runId, runDir: r.runDir ?? null, context: r.context ?? {} })),
    statistics: {
      interval: `paired bootstrap over tasks, ${resamples} resamples, 95% percentile interval`,
      multiplicity: `Holm step-down over ${family.length} primary comparison(s), family-wise alpha ${alpha}`,
      repeats: 'repeats are averaged within each task before pairing',
      invalidated: 'invalidated trials are excluded from every metric',
      pairing: 'a task drops out of a comparison when either arm has an invalidated, errored, unjudged or absent trial for it; fewer kept tasks than the planned n gives no verdict',
      seed,
    },
    metrics: { primary, secondary, guardrail, higherIsBetter },
    arms: armSummaries,
    comparisons,
    disclosures: { sameModel },
  };
}

const fmt = (v, digits = 3) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : 'n/a');
const cell = (v) => String(v ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

export function renderMarkdown(report, { outDir } = {}) {
  const link = (dir) => {
    if (!dir) return 'no trial directory recorded';
    const target = outDir ? path.relative(outDir, dir) || '.' : dir;
    return `[${path.basename(path.dirname(path.dirname(dir)))}/${path.basename(path.dirname(dir))}/${path.basename(dir)}](${target.replace(/\\/g, '/')})`;
  };
  const lines = ['# Evaluation report', ''];
  lines.push(`Runs: ${report.runs.map((r) => `\`${r.runId}\``).join(', ')}.`);
  lines.push(`Statistics: ${report.statistics.interval}; ${report.statistics.multiplicity}; ${report.statistics.repeats}; ${report.statistics.invalidated}; ${report.statistics.pairing}.`, '');

  lines.push('## Comparisons', '');
  for (const c of report.comparisons) {
    lines.push(`### ${c.b} vs ${c.a}`, '');
    if (c.confounded) {
      lines.push(`**Confounded:** the arms differ in ${c.confoundedBy.map((f) => `\`${f}\``).join(', ')}, beyond their declared difference. No verdict is given.`, '');
    }
    const pr = c.pairing;
    lines.push(`Tasks: ${pr.kept} kept, ${pr.dropped.length} dropped, planned n ${pr.plannedN}.`);
    if (pr.shortfall > 0) lines.push(`**Shortfall:** ${pr.shortfall} task(s) below the planned n. No verdict is given.`);
    lines.push('');
    if (pr.dropped.length) {
      lines.push('Dropped tasks:', '');
      for (const d of pr.dropped) {
        const why = d.reasons.map((r) => `${cell(r.arm)}${r.repeat !== undefined ? ` repeat ${r.repeat}` : ''} ${r.reason}${r.detail ? ` (${cell(r.detail)})` : ''}`);
        lines.push(`- ${cell(d.task)}: ${why.join('; ')}`);
      }
      lines.push('');
    }
    lines.push(`| Metric | Role | ${cell(c.a)} | ${cell(c.b)} | Difference | 95% CI | Tasks | Trials (a/b) | p | Holm p | Verdict |`);
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const r of c.metrics) {
      const verdict = r.role === 'primary' ? r.verdict ?? `none (${r.verdictNote})` : r.guardrailFlag ? 'flag: interval entirely worse' : 'interval only';
      lines.push(`| ${cell(r.metric)} | ${r.role} | ${fmt(r.a)} | ${fmt(r.b)} | ${fmt(r.difference)} | [${fmt(r.ci[0])}, ${fmt(r.ci[1])}] | ${r.tasks} | ${r.repeats.a}/${r.repeats.b} | ${fmt(r.p, 4)} | ${r.role === 'primary' ? fmt(r.pAdjusted, 4) : 'n/a'} | ${verdict} |`);
    }
    lines.push('');
    if (c.differences.length) {
      lines.push('Configuration differences:', '');
      for (const d of c.differences) lines.push(`- \`${d.field}\`: ${cell(stable(d.a))} vs ${cell(stable(d.b))}${d.declared ? ' (declared)' : ' (undeclared)'}`);
      lines.push('');
    }
  }

  lines.push('## Trials and process metrics', '', 'Process metrics are reported separately from quality; a cheaper arm is not an improvement on its own.', '');
  lines.push('| Arm | Model | Trials | Completed | Failed | Invalidated | Mean wall ms | Mean nano AIU | Mean tokens | Mean tool calls | Mean subagents |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const a of report.arms) {
    const p = (k) => fmt(a.process[k]?.mean, 1);
    lines.push(`| ${cell(a.key)} | ${cell(a.model)} | ${a.counts.total} | ${a.counts.completed} | ${a.counts.failed} | ${a.counts.invalidated} | ${p('wallMs')} | ${p('nanoAiu')} | ${p('tokens')} | ${p('toolCalls')} | ${p('subagents')} |`);
  }
  lines.push('');
  const excluded = report.arms.flatMap((a) => [
    ...a.invalidated.map((t) => ({ arm: a.key, kind: 'invalidated', ...t })),
    ...a.failed.map((t) => ({ arm: a.key, kind: t.status, ...t })),
  ]);
  if (excluded.length) {
    lines.push('Invalidated and failed trials (invalidated trials are excluded from metrics):', '');
    for (const t of excluded) lines.push(`- ${cell(t.arm)} ${cell(t.task)} repeat ${t.repeat}: ${t.kind}${t.reason ? `, ${cell(t.reason)}` : ''} (${link(t.trialDir)})`);
    lines.push('');
  }
  if (report.disclosures.sameModel.length) {
    lines.push('## Disclosures', '');
    for (const d of report.disclosures.sameModel) lines.push(`- Arm ${cell(d.arm)} uses \`${cell(d.model)}\`, the same model as the ${d.role}.`);
    lines.push('');
  }
  lines.push('## Trial directories', '');
  for (const c of report.comparisons) {
    for (const r of c.metrics) {
      if (!r.trialDirs.a.length && !r.trialDirs.b.length) continue;
      lines.push(`- ${cell(c.b)} vs ${cell(c.a)}, ${cell(r.metric)}: ${[...r.trialDirs.a, ...r.trialDirs.b].map(link).join(', ')}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

export function writeReport(inputs, outDir, options = {}) {
  const report = buildReport(inputs, options);
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'report.json');
  const mdPath = path.join(outDir, 'report.md');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, renderMarkdown(report, { outDir }));
  return { report, jsonPath, mdPath };
}
