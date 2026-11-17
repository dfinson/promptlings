// Post-experiment analysis report (spec lane 10): per-arm recall by defect class and locality,
// unique catches, the unmatched-findings breakdown and behaviour features, from the panel's
// consensus labels. Per-category comparisons are secondary and exploratory: no correction across
// categories is applied and no verdict is issued.
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_RESAMPLES, mean, pairedBootstrap } from '../scoring/stats.js';
import {
  HAND_LABEL_SAMPLE_SIZE,
  PANEL_MODELS,
  SHARED_FAMILY_PANELIST,
  agreementStats,
  blindNames,
  consensusLabels,
  coverageGaps,
  defaultGrade,
  findingKey,
  handLabelSample,
  loadJudged,
  maintainerAgreement,
  membersOf,
  panelItems,
  runPanel,
  splitClusters,
} from '../scoring/panel.js';
import { clusterByTask } from '../scoring/cluster.js';
import { extractDesign } from '../scoring/design.js';
import { FEATURES, collectFeatures } from '../scoring/behaviour.js';

export const RECALL_DIMENSIONS = ['defect_class', 'locality'];

function key(...parts) {
  return parts.join('\u0000');
}

function choosePairs(arms, options) {
  if (options.comparisons?.length) return options.comparisons;
  const baseline = options.baseline ?? arms[0];
  return arms.filter((a) => a !== baseline).map((b) => [baseline, b]);
}

function trialIndex(judged) {
  const repeats = new Map();
  for (const t of judged.trials) {
    const k = key(t.task, t.arm);
    if (!repeats.has(k)) repeats.set(k, []);
    repeats.get(k).push(t.repeat);
  }
  const caught = new Set(judged.catches.map((c) => key(c.task, c.arm, c.repeat, c.goldenIndex)));
  return { repeats, caught };
}

/** Per task and arm: mean over judged repeats of the share of the given golden items caught. */
function taskRecall(index, task, arm, goldenIndices) {
  const reps = index.repeats.get(key(task, arm));
  if (!reps?.length || !goldenIndices.length) return null;
  return mean(reps.map((r) => goldenIndices.filter((gi) => index.caught.has(key(task, arm, r, gi))).length / goldenIndices.length));
}

function goldenByLabel(panel, cons, dimension) {
  const out = new Map();
  for (const it of panel.items) {
    if (it.kind !== 'golden') continue;
    const l = cons.items.get(it.id).labels[dimension];
    if (l.status !== 'accepted') continue;
    if (!out.has(l.label)) out.set(l.label, new Map());
    const byTask = out.get(l.label);
    if (!byTask.has(it.source.task)) byTask.set(it.source.task, []);
    byTask.get(it.source.task).push(it.source.goldenIndex);
  }
  return out;
}

function recallTables({ panel, cons, judged, index, pairs, namedInAdvance, resamples, seed }) {
  const profiles = [];
  const comparisons = [];
  for (const dimension of RECALL_DIMENSIONS) {
    const labels = panel.taxonomy.dimensions.golden[dimension] ?? [];
    const grouped = goldenByLabel(panel, cons, dimension);
    for (const label of labels) {
      const byTask = grouped.get(label) ?? new Map();
      const items = [...byTask.values()].reduce((s, l) => s + l.length, 0);
      const perArm = {};
      for (const arm of judged.arms) {
        const values = [...byTask].map(([task, gis]) => taskRecall(index, task, arm, gis)).filter((v) => v !== null);
        perArm[arm] = { tasks: values.length, recall: values.length ? mean(values) : null };
      }
      profiles.push({ dimension, label, goldenItems: items, tasks: byTask.size, arms: perArm });
      const named = namedInAdvance.includes(`${dimension}:${label}`) || namedInAdvance.includes(label);
      pairs.forEach(([a, b], ci) => {
        const diffs = [];
        for (const [task, gis] of byTask) {
          const ra = taskRecall(index, task, a, gis);
          const rb = taskRecall(index, task, b, gis);
          if (ra !== null && rb !== null) diffs.push(rb - ra);
        }
        const boot = pairedBootstrap(diffs, { resamples, seed: seed + ci });
        const excludesZero = Number.isFinite(boot.ci[0]) && (boot.ci[0] > 0 || boot.ci[1] < 0);
        comparisons.push({
          dimension,
          label,
          a,
          b,
          tasks: diffs.length,
          difference: diffs.length ? boot.mean : null,
          ci: diffs.length ? boot.ci : [null, null],
          excludesZero,
          status: named ? 'pre-named' : 'hypothesis',
          verdict: null,
        });
      });
    }
  }
  return { profiles, comparisons };
}

function uniqueCatches({ panel, cons, judged, index }) {
  const arms = judged.arms;
  const perArm = Object.fromEntries(arms.map((a) => [a, { count: 0, byClass: {} }]));
  for (const it of panel.items) {
    if (it.kind !== 'golden') continue;
    const { task, goldenIndex } = it.source;
    if (!arms.every((a) => index.repeats.get(key(task, a))?.length)) continue;
    const catchers = arms.filter((a) => index.repeats.get(key(task, a)).some((r) => index.caught.has(key(task, a, r, goldenIndex))));
    if (catchers.length !== 1) continue;
    const l = cons.items.get(it.id).labels.defect_class;
    const cls = l.status === 'accepted' ? l.label : 'disputed';
    const entry = perArm[catchers[0]];
    entry.count += 1;
    entry.byClass[cls] = (entry.byClass[cls] ?? 0) + 1;
  }
  return perArm;
}

function unmatchedBreakdown({ panel, cons, judged }) {
  const labels = panel.taxonomy.dimensions.unmatched.verdict ?? [];
  const trialsPerArm = {};
  for (const t of judged.trials) trialsPerArm[t.arm] = (trialsPerArm[t.arm] ?? 0) + 1;
  const out = {};
  for (const arm of judged.arms) out[arm] = { total: 0, disputed: 0, trials: trialsPerArm[arm] ?? 0, ...Object.fromEntries(labels.map((l) => [l, 0])) };
  if (panel.clusterMatched) for (const row of Object.values(out)) row['cluster-matched'] = 0;
  for (const it of panel.items) {
    if (it.kind !== 'unmatched') continue;
    const l = cons.items.get(it.id).labels.verdict;
    for (const m of membersOf(it)) {
      const row = out[m.arm];
      if (!row) continue;
      row.total += 1;
      if (l?.status === 'accepted') row[l.label] += 1;
      else row.disputed += 1;
    }
  }
  for (const m of panel.clusterMatched ?? []) {
    const row = out[m.arm];
    if (!row) continue;
    row.total += 1;
    row['cluster-matched'] += 1;
  }
  for (const row of Object.values(out)) row.perTrial = row.trials ? row.total / row.trials : null;
  return out;
}

export const VERIFIED_METRICS = ['verified', 'verified_precision', 'wrong', 'unverifiable', 'unverifiable_rate'];
// null marks a metric reported for context with no better direction.
const VERIFIED_HIGHER_IS_BETTER = { verified: true, verified_precision: true, wrong: false, unverifiable: null, unverifiable_rate: null };

/**
 * Per trial: verified = findings matched to the reference review, plus unmatched findings grouped
 * with a matched one, plus unmatched findings the panel accepts as real-missing-from-golden;
 * wrong = unmatched findings the panel accepts as wrong; verified_precision = verified /
 * (verified + wrong), so a finding nobody could confirm or refute does not count against the arm;
 * unverifiable = findings the panel accepts as plausible-unverifiable, reported on its own with
 * unverifiable_rate = unverifiable / findings. Disputed findings count in none of these.
 */
function trialVerificationRows({ panel, cons, judged }) {
  const rows = new Map();
  for (const t of judged.trials) rows.set(key(t.task, t.arm, t.repeat), { ...t, real: 0, wrong: 0, unverifiable: 0, clusterMatched: 0 });
  for (const it of panel.items) {
    if (it.kind !== 'unmatched') continue;
    const l = cons.items.get(it.id).labels.verdict;
    if (l?.status !== 'accepted') continue;
    for (const m of membersOf(it)) {
      const row = rows.get(key(it.source.task, m.arm, m.repeat));
      if (!row) continue;
      if (l.label === 'real-missing-from-golden') row.real += 1;
      else if (l.label === 'wrong') row.wrong += 1;
      else if (l.label === 'plausible-unverifiable') row.unverifiable += 1;
    }
  }
  for (const m of panel.clusterMatched ?? []) {
    const row = rows.get(key(m.task, m.arm, m.repeat));
    if (row) row.clusterMatched += 1;
  }
  return [...rows.values()].map((r) => {
    const verified = (r.matched ?? 0) + r.clusterMatched + r.real;
    return {
      task: r.task,
      arm: r.arm,
      repeat: r.repeat,
      metrics: {
        verified,
        verified_precision: verified + r.wrong ? verified / (verified + r.wrong) : null,
        wrong: r.wrong,
        unverifiable: r.unverifiable,
        unverifiable_rate: r.candidates ? r.unverifiable / r.candidates : null,
      },
    };
  });
}

function trialVerification(args) {
  const byTaskArm = new Map();
  for (const r of trialVerificationRows(args)) {
    const k = key(r.task, r.arm);
    if (!byTaskArm.has(k)) byTaskArm.set(k, []);
    byTaskArm.get(k).push(r.metrics);
  }
  return byTaskArm;
}

/** Per-trial panel-verified metrics from the all-panelists consensus, for merging into the run's scores. */
export function panelTrialMetrics(panel, judged) {
  return trialVerificationRows({ panel, cons: consensusLabels(panel, { exclude: [] }), judged });
}

function taskValue(byTaskArm, task, arm, metric) {
  const values = (byTaskArm.get(key(task, arm)) ?? []).map((v) => v[metric]).filter((v) => v !== null);
  return values.length ? mean(values) : null;
}

function verifiedFindings({ panel, cons, judged, pairs, resamples, seed }) {
  const byTaskArm = trialVerification({ panel, cons, judged });
  const perArm = {};
  for (const arm of judged.arms) {
    perArm[arm] = { tasks: judged.tasks.filter((t) => byTaskArm.has(key(t, arm))).length };
    for (const metric of VERIFIED_METRICS) {
      const values = judged.tasks.map((t) => taskValue(byTaskArm, t, arm, metric)).filter((v) => v !== null);
      perArm[arm][metric] = values.length ? mean(values) : null;
    }
  }
  const comparisons = [];
  pairs.forEach(([a, b], ci) => {
    VERIFIED_METRICS.forEach((metric, mi) => {
      const diffs = [];
      for (const task of judged.tasks) {
        const va = taskValue(byTaskArm, task, a, metric);
        const vb = taskValue(byTaskArm, task, b, metric);
        if (va !== null && vb !== null) diffs.push(vb - va);
      }
      const boot = pairedBootstrap(diffs, { resamples, seed: seed + 1000 + ci * VERIFIED_METRICS.length + mi });
      comparisons.push({ metric, higherIsBetter: VERIFIED_HIGHER_IS_BETTER[metric], a, b, tasks: diffs.length, difference: diffs.length ? boot.mean : null, ci: diffs.length ? boot.ci : [null, null] });
    });
  });
  return { perArm, comparisons };
}

/**
 * Design commentary, scored on its own rubric and kept out of the defect metrics. Each item is a
 * cluster of design forks and bets that make the same point on one task; it is valid when the
 * panel accepts "yes" on every rubric dimension. Per trial, `valid` counts the distinct valid
 * clusters the trial contributed to and `extracted` the distinct clusters of any quality; arm
 * means are per task over repeats. `unique` counts valid clusters only one arm raised, on tasks
 * every arm has trials for. passRates give, per dimension, the share of the arm's clusters with
 * an accepted "yes".
 */
function designCommentary({ panel, cons, judged, pairs, resamples, seed }) {
  const dims = Object.keys(panel.taxonomy.dimensions.design ?? {});
  const items = panel.items.filter((it) => it.kind === 'design');
  if (!dims.length) return null;
  const isValid = (it) => dims.every((d) => cons.items.get(it.id).labels[d]?.status === 'accepted' && cons.items.get(it.id).labels[d].label === 'yes');
  const perTrial = new Map(judged.trials.map((t) => [key(t.task, t.arm, t.repeat), { task: t.task, arm: t.arm, valid: new Set(), extracted: new Set() }]));
  const armsOf = new Map();
  for (const it of items) {
    const valid = isValid(it);
    armsOf.set(it.id, new Set(membersOf(it).map((m) => m.arm)));
    for (const m of membersOf(it)) {
      const row = perTrial.get(key(it.source.task, m.arm, m.repeat));
      if (!row) continue;
      row.extracted.add(it.id);
      if (valid) row.valid.add(it.id);
    }
  }
  const byTaskArm = new Map();
  for (const r of perTrial.values()) {
    const k = key(r.task, r.arm);
    if (!byTaskArm.has(k)) byTaskArm.set(k, []);
    byTaskArm.get(k).push({ valid: r.valid.size, extracted: r.extracted.size });
  }
  const repeats = trialIndex(judged).repeats;
  const fullTasks = new Set(judged.tasks.filter((t) => judged.arms.every((a) => repeats.get(key(t, a))?.length)));
  const perArm = {};
  for (const arm of judged.arms) {
    const armItems = items.filter((it) => armsOf.get(it.id).has(arm));
    const row = { tasks: judged.tasks.filter((t) => byTaskArm.has(key(t, arm))).length, clusters: armItems.length };
    for (const metric of ['valid', 'extracted']) {
      const values = judged.tasks.map((t) => taskValue(byTaskArm, t, arm, metric)).filter((v) => v !== null);
      row[metric] = values.length ? mean(values) : null;
    }
    row.unique = items.filter((it) => isValid(it) && fullTasks.has(it.source.task) && armsOf.get(it.id).size === 1 && armsOf.get(it.id).has(arm)).length;
    row.passRates = Object.fromEntries(dims.map((d) => [d, armItems.length ? armItems.filter((it) => cons.items.get(it.id).labels[d]?.status === 'accepted' && cons.items.get(it.id).labels[d].label === 'yes').length / armItems.length : null]));
    perArm[arm] = row;
  }
  const comparisons = pairs.map(([a, b], ci) => {
    const diffs = [];
    for (const task of judged.tasks) {
      const va = taskValue(byTaskArm, task, a, 'valid');
      const vb = taskValue(byTaskArm, task, b, 'valid');
      if (va !== null && vb !== null) diffs.push(vb - va);
    }
    const boot = pairedBootstrap(diffs, { resamples, seed: seed + 5000 + ci });
    return { metric: 'valid', a, b, tasks: diffs.length, difference: diffs.length ? boot.mean : null, ci: diffs.length ? boot.ci : [null, null] };
  });
  return { dimensions: dims, items: items.length, valid: items.filter(isValid).length, perArm, comparisons };
}

function featureProfiles(features, arms) {
  const usable = features.filter((f) => f.available);
  const perArm = {};
  for (const arm of arms) {
    const rows = usable.filter((f) => f.arm === arm);
    const excluded = features.filter((f) => f.arm === arm && f.excluded);
    const byStatus = {};
    for (const f of excluded) byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
    perArm[arm] = { trials: rows.length, excluded: excluded.length, excludedByStatus: byStatus, unavailable: features.filter((f) => f.arm === arm && !f.available && !f.excluded).length };
    for (const name of FEATURES) {
      const values = rows.map((r) => r[name]).filter((v) => Number.isFinite(v));
      perArm[arm][name] = values.length ? mean(values) : null;
    }
  }
  return perArm;
}

function featureDifferences(features, a, b) {
  const byTask = (arm, name) => {
    const m = new Map();
    for (const f of features) {
      if (!f.available || f.arm !== arm || !Number.isFinite(f[name])) continue;
      if (!m.has(f.task)) m.set(f.task, []);
      m.get(f.task).push(f[name]);
    }
    return m;
  };
  const out = {};
  for (const name of FEATURES) {
    const ma = byTask(a, name);
    const mb = byTask(b, name);
    const diffs = [...ma.keys()].filter((t) => mb.has(t)).map((t) => mean(mb.get(t)) - mean(ma.get(t)));
    out[name] = diffs.length ? { tasks: diffs.length, difference: mean(diffs) } : null;
  }
  return out;
}

function associations({ pairs, features, recall }) {
  return pairs.map(([a, b]) => {
    const behaviour = featureDifferences(features, a, b);
    const classes = recall.comparisons
      .filter((r) => r.a === a && r.b === b && r.excludesZero)
      .map((r) => ({ dimension: r.dimension, label: r.label, difference: r.difference, status: r.status }));
    const changed = Object.entries(behaviour).filter(([, v]) => v && v.difference !== 0);
    let note;
    if (!classes.length) note = `No defect class or locality shows a recall difference between ${b} and ${a} whose interval excludes zero, so no behaviour is associated with a caught-problem difference.`;
    else {
      const beh = changed.length ? changed.map(([n, v]) => `${n} ${v.difference > 0 ? '+' : ''}${fmt(v.difference)}`).join(', ') : 'no measured behaviour difference';
      const cls = classes.map((c) => `${c.label} (${c.dimension}, ${c.difference > 0 ? '+' : ''}${fmt(c.difference)}, ${c.status})`).join('; ');
      note = `Association only: relative to ${a}, ${b} shows ${beh}, and its recall differs on ${cls}. The arm changes both, so this suggests a mechanism but does not demonstrate one; test it with an ablation arm.`;
    }
    return { a, b, behaviour, classes, note };
  });
}

function analysisView({ panel, judged, features, pairs, namedInAdvance, handLabels, resamples, seed, exclude }) {
  const cons = consensusLabels(panel, { exclude });
  const index = trialIndex(judged);
  const recall = recallTables({ panel, cons, judged, index, pairs, namedInAdvance, resamples, seed });
  return {
    panelists: cons.panelists,
    excluded: exclude,
    agreement: agreementStats(panel, { exclude }).dimensions,
    maintainerAgreement: maintainerAgreement(panel, handLabels, { exclude }),
    recall,
    uniqueCatches: uniqueCatches({ panel, cons, judged, index }),
    unmatched: unmatchedBreakdown({ panel, cons, judged }),
    verified: verifiedFindings({ panel, cons, judged, pairs, resamples, seed }),
    design: designCommentary({ panel, cons, judged, pairs, resamples, seed }),
    associations: associations({ pairs, features, recall }),
    consensus: Object.fromEntries([...cons.items].map(([id, c]) => [id, Object.fromEntries(Object.entries(c.labels).map(([d, l]) => [d, l.status === 'accepted' ? l.label : null]))])),
  };
}

/** Judged entries left out of every per-arm panel aggregate because their trial is unusable. */
function excludedTrials(judged) {
  const out = Object.fromEntries(judged.arms.map((a) => [a, { count: 0, byStatus: {}, trials: [] }]));
  for (const t of judged.excluded ?? []) {
    out[t.arm] ??= { count: 0, byStatus: {}, trials: [] };
    out[t.arm].count += 1;
    out[t.arm].byStatus[t.status] = (out[t.arm].byStatus[t.status] ?? 0) + 1;
    out[t.arm].trials.push({ task: t.task, repeat: t.repeat, status: t.status, reason: t.reason });
  }
  return out;
}

export function buildPanelReport({ panel, judged, features = [], comparisons, baseline, namedInAdvance = [], handLabels = null, resamples = DEFAULT_RESAMPLES, seed = 20251111 }) {
  const gaps = coverageGaps(panel);
  if (gaps.length) throw new Error(`Panel coverage is incomplete: ${gaps.length} item and panelist pair(s) have neither an annotation nor a failure record`);
  const pairs = choosePairs(judged.arms, { comparisons, baseline });
  const common = { panel, judged, features, pairs, namedInAdvance, handLabels, resamples, seed };
  const views = [{ name: 'all panelists', ...analysisView({ ...common, exclude: [] }) }];
  if (panel.sharedFamily) views.push({ name: `without ${panel.sharedFamily}`, ...analysisView({ ...common, exclude: [panel.sharedFamily] }) });
  return {
    kind: 'panel-analysis',
    taxonomy: { version: panel.taxonomy.version, frozen: panel.taxonomy.frozen },
    panelists: panel.panelists,
    disclosure: panel.sharedFamily
      ? `${panel.sharedFamily} shares the OpenAI model family with every arm's reviewer model; each conclusion is reported with all panelists and without it.`
      : null,
    rule: 'A label is accepted when at least two panelists agree; otherwise it is disputed and excluded from pattern claims.',
    scope: 'Per-category recall comparisons are secondary and exploratory, with paired bootstrap intervals over tasks and no correction across categories; categories not named in advance are hypotheses. Behaviour links are associations.',
    items: {
      total: panel.items.length,
      golden: panel.items.filter((i) => i.kind === 'golden').length,
      unmatched: panel.items.filter((i) => i.kind === 'unmatched').length,
      ...(panel.items.some((i) => i.kind === 'design') ? { design: panel.items.filter((i) => i.kind === 'design').length } : {}),
    },
    ...(panel.clustering ? { clustering: panel.clustering } : {}),
    ...(panel.designExtraction ? { designExtraction: panel.designExtraction } : {}),
    failures: panel.failures,
    handLabels: handLabels ? { provided: Object.keys(handLabels).length } : { provided: 0, note: `maintainer hand-label sample of ${HAND_LABEL_SAMPLE_SIZE} items pending` },
    comparisons: pairs,
    features: featureProfiles(features, judged.arms),
    excludedTrials: excludedTrials(judged),
    views,
  };
}

function fmt(v, digits = 3) {
  return v === null || v === undefined || !Number.isFinite(v) ? 'n/a' : v.toFixed(digits);
}

function pct(v) {
  return v === null || v === undefined ? 'n/a' : `${(v * 100).toFixed(1)}%`;
}

export function renderPanelMarkdown(report) {
  const out = ['# Post-experiment analysis panel', ''];
  out.push(`Panel: ${report.panelists.join(', ')}. Taxonomy ${report.taxonomy.version}${report.taxonomy.frozen ? ' (frozen)' : ' (not frozen)'}.`);
  if (report.disclosure) out.push('', `Disclosure: ${report.disclosure}`);
  out.push('', report.rule, '', report.scope, '');
  out.push(`Items: ${report.items.golden} golden, ${report.items.unmatched} unmatched${report.items.design !== undefined ? `, ${report.items.design} design` : ''}. Failure records: ${report.failures.length}.`);
  if (report.clustering) out.push(`Unmatched findings were grouped by problem before labelling (${report.clustering.model}): ${report.clustering.findings} findings became ${report.clustering.panelItems} panel items, and ${report.clustering.clusterMatched} share a group with a matched finding and count as verified without a panel call. Clustering failures: ${report.clustering.failures.length}.`);
  if (report.designExtraction) out.push(`Design commentary was extracted from ${report.designExtraction.trials.extracted} trials (${report.designExtraction.trials.skipped} had too little prose) by ${report.designExtraction.model}: ${report.designExtraction.items} items in ${report.designExtraction.clusters} groups. Extraction failures: ${report.designExtraction.failures.length}.`);
  out.push(`Maintainer hand labels: ${report.handLabels.provided}${report.handLabels.note ? ` (${report.handLabels.note})` : ''}.`, '');
  const arms = Object.keys(report.features);
  const statusText = (byStatus) => Object.entries(byStatus).map(([s, n]) => `${s} ${n}`).join(', ');
  out.push('## Behaviour features (mean per trial)', '', 'Only trials that completed and were not invalidated are counted; the Excluded column gives the rest.', '', `| Arm | Trials | Excluded | ${FEATURES.join(' | ')} |`, `|---|---|---|${FEATURES.map(() => '---').join('|')}|`);
  for (const arm of arms) {
    const f = report.features[arm];
    out.push(`| ${arm} | ${f.trials} | ${f.excluded ?? 0}${f.excluded ? ` (${statusText(f.excludedByStatus)})` : ''} | ${FEATURES.map((name) => fmt(f[name], 1)).join(' | ')} |`);
  }
  const judgedOut = Object.entries(report.excludedTrials ?? {}).filter(([, e]) => e.count);
  out.push('', judgedOut.length
    ? `Judged trials excluded from panel aggregates (not completed or invalidated): ${judgedOut.map(([arm, e]) => `${arm} ${e.count} (${statusText(e.byStatus)})`).join('; ')}.`
    : 'Judged trials excluded from panel aggregates (not completed or invalidated): none.');
  out.push('');
  for (const view of report.views) {
    out.push(`## View: ${view.name}`, '', '### Agreement', '', '| Items | Dimension | Krippendorff alpha | Disputed share |', '|---|---|---|---|');
    for (const d of view.agreement) out.push(`| ${d.kind} | ${d.dimension} | ${fmt(d.alpha)} | ${pct(d.disputedShare)} (${d.disputed}/${d.items}) |`);
    if (view.maintainerAgreement) {
      out.push('', 'Agreement with the maintainer:', '');
      for (const d of view.maintainerAgreement.dimensions.filter((r) => r.labelled)) out.push(`- ${d.kind} ${d.dimension}: ${d.agree}/${d.labelled} (${pct(d.agreement)}), ${d.disputed} disputed`);
    }
    out.push('', '### Recall by defect class and locality', '', `| Dimension | Label | Golden items | ${arms.join(' | ')} |`, `|---|---|---|${arms.map(() => '---').join('|')}|`);
    for (const p of view.recall.profiles.filter((r) => r.goldenItems > 0)) out.push(`| ${p.dimension} | ${p.label} | ${p.goldenItems} | ${arms.map((a) => fmt(p.arms[a]?.recall)).join(' | ')} |`);
    out.push('', '| Comparison | Dimension | Label | Tasks | Difference | 95% CI | Status |', '|---|---|---|---|---|---|---|');
    for (const c of view.recall.comparisons.filter((r) => r.tasks > 0)) out.push(`| ${c.b} vs ${c.a} | ${c.dimension} | ${c.label} | ${c.tasks} | ${fmt(c.difference)} | [${fmt(c.ci[0])}, ${fmt(c.ci[1])}] | ${c.status} |`);
    out.push('', '### Unique catches', '');
    for (const [arm, u] of Object.entries(view.uniqueCatches)) out.push(`- ${arm}: ${u.count}${u.count ? ` (${Object.entries(u.byClass).map(([c, n]) => `${c} ${n}`).join(', ')})` : ''}`);
    const verdicts = Object.keys(Object.values(view.unmatched)[0] ?? {}).filter((k) => !['total', 'disputed', 'trials', 'perTrial'].includes(k));
    out.push('', '### Unmatched findings', '', 'Counts are findings; a group of findings that describe the same problem receives one label.', '', `| Arm | Total | Per trial | ${verdicts.join(' | ')} | disputed |`, `|---|---|---|${verdicts.map(() => '---').join('|')}|---|`);
    for (const [arm, u] of Object.entries(view.unmatched)) out.push(`| ${arm} | ${u.total} | ${fmt(u.perTrial, 2)} | ${verdicts.map((v) => u[v]).join(' | ')} | ${u.disputed} |`);
    out.push('', '### Panel-verified findings', '', 'Verified findings are those matched to the reference review, those grouped with a matched finding, and unmatched findings the panel accepts as real-missing-from-golden, so a real problem outside the reference set counts for the arm. Wrong counts unmatched findings the panel accepts as wrong. Verified precision is verified over verified plus wrong: a finding the panel accepts as plausible but unverifiable is neither confirmed nor refuted, so it is reported separately as unverifiable (count and share of all findings) and does not lower precision. Means are per task over repeats.', '', `| Arm | Tasks | ${VERIFIED_METRICS.join(' | ')} |`, `|---|---|${VERIFIED_METRICS.map(() => '---').join('|')}|`);
    for (const [arm, v] of Object.entries(view.verified.perArm)) out.push(`| ${arm} | ${v.tasks} | ${VERIFIED_METRICS.map((m) => fmt(v[m])).join(' | ')} |`);
    out.push('', '| Comparison | Metric | Tasks | Difference | 95% CI | Better |', '|---|---|---|---|---|---|');
    for (const c of view.verified.comparisons.filter((r) => r.tasks > 0)) out.push(`| ${c.b} vs ${c.a} | ${c.metric} | ${c.tasks} | ${fmt(c.difference)} | [${fmt(c.ci[0])}, ${fmt(c.ci[1])}] | ${c.higherIsBetter === null ? 'neutral' : c.higherIsBetter ? 'higher' : 'lower'} |`);
    if (view.design) {
      const d = view.design;
      out.push('', '### Design commentary', '', `Design forks and implicit bets, grouped by point and judged on their own rubric (${d.dimensions.join(', ')}), separate from the defect metrics. A group is valid when the panel accepts "yes" on every dimension: ${d.valid} of ${d.items} groups. Valid and extracted are distinct groups per trial, averaged per task over repeats; unique counts valid groups only that arm raised, on tasks every arm covers.`, '', `| Arm | Tasks | Groups | Valid per trial | Extracted per trial | Unique valid | ${d.dimensions.join(' | ')} |`, `|---|---|---|---|---|---|${d.dimensions.map(() => '---').join('|')}|`);
      for (const [arm, r] of Object.entries(d.perArm)) out.push(`| ${arm} | ${r.tasks} | ${r.clusters} | ${fmt(r.valid, 2)} | ${fmt(r.extracted, 2)} | ${r.unique} | ${d.dimensions.map((dim) => pct(r.passRates[dim])).join(' | ')} |`);
      out.push('', '| Comparison | Metric | Tasks | Difference | 95% CI |', '|---|---|---|---|---|');
      for (const c of d.comparisons.filter((r) => r.tasks > 0)) out.push(`| ${c.b} vs ${c.a} | valid per trial | ${c.tasks} | ${fmt(c.difference)} | [${fmt(c.ci[0])}, ${fmt(c.ci[1])}] |`);
    }
    out.push('', '### Associations', '');
    for (const a of view.associations) out.push(`- ${a.b} vs ${a.a}: ${a.note}`);
    out.push('');
  }
  if (report.failures.length) {
    out.push('## Failure records', '');
    for (const f of report.failures) out.push(`- ${f.item} ${f.panelist}: ${f.reason}`);
    out.push('');
  }
  return out.join('\n');
}

/**
 * Runs the whole panel pass for one judged stage and writes <runDir>/panel/: panel.json (items,
 * prompts, annotations, failures), report.json, report.md and hand-label-sample.json.
 */
export async function runPanelAnalysis({
  runDir,
  goldenDir,
  arms,
  aliases = [],
  variant = 'primary',
  panelists = PANEL_MODELS,
  taxonomy,
  requireFrozen = false,
  grade,
  graderConfig,
  comparisons,
  baseline,
  namedInAdvance = [],
  handLabels,
  diffFilesFor,
  contextFor,
  judgeRoot,
  cluster = false,
  clusterModel,
  designTextFor,
  seed = 20251111,
  resamples = DEFAULT_RESAMPLES,
}) {
  const judged = loadJudged({ runDir, goldenDir, variant, arms: arms?.map((a) => (typeof a === 'string' ? a : a.id)), ...(judgeRoot ? { judgeRoot } : {}) });
  const names = blindNames(arms ?? judged.arms, aliases);
  const outDir = path.join(runDir, 'panel');
  fs.mkdirSync(outDir, { recursive: true });
  const evidenceDir = path.join(outDir, 'graders');
  const ask = grade ?? defaultGrade({ graderConfig, evidenceDir });
  const helperModel = clusterModel ?? panelists[0];
  let clustering = null;
  if (cluster) {
    const byTask = new Map();
    for (const f of judged.findings) {
      if (!byTask.has(f.task)) byTask.set(f.task, []);
      byTask.get(f.task).push({ key: findingKey(f), file: f.file ?? '', lines: f.start_line ? (f.end_line && f.end_line !== f.start_line ? `${f.start_line}-${f.end_line}` : String(f.start_line)) : '', start: f.start_line ?? 0, text: f.message });
    }
    // Tasks with no unmatched finding need no grouping: every finding there is already matched.
    for (const task of [...byTask.keys()]) if (!judged.unmatched.some((u) => u.task === task)) byTask.delete(task);
    clustering = await clusterByTask({ entriesByTask: byTask, grade: ask, model: helperModel, cacheDir: path.join(outDir, 'clusters'), prefix: 'findings', subject: 'code review comments', names });
  }
  let design = [];
  let designExtraction = null;
  if (designTextFor) {
    const trials = judged.trials.map((t) => {
      const d = designTextFor({ task: t.task, arm: t.arm, repeat: t.repeat }) ?? {};
      return { task: t.task, arm: t.arm, repeat: t.repeat, text: d.text ?? '', findings: d.findings ?? judged.findings.filter((f) => f.task === t.task && f.arm === t.arm && f.repeat === t.repeat) };
    });
    const extracted = await extractDesign({ trials, grade: ask, model: helperModel, cacheDir: path.join(outDir, 'design'), names });
    const byTask = new Map();
    extracted.items.forEach((it) => {
      if (!byTask.has(it.task)) byTask.set(it.task, []);
      byTask.get(it.task).push({ key: findingKey(it), file: it.file, lines: it.lines, start: Number.parseInt(it.lines, 10) || 0, text: `(${it.kind}) ${it.summary}`, item: it });
    });
    const grouped = await clusterByTask({ entriesByTask: byTask, grade: ask, model: helperModel, cacheDir: path.join(outDir, 'clusters'), prefix: 'design', subject: 'design commentary points (forks and implicit bets)', names });
    for (const [task, groups] of Object.entries(grouped.clusters)) {
      const byKey = new Map(byTask.get(task).map((e) => [e.key, e.item]));
      for (const group of groups) {
        const members = group.map((k) => byKey.get(k)).filter(Boolean);
        const rep = members.reduce((a, b) => (b.summary.length > a.summary.length ? b : a));
        const span = /^(\d+)(?:-(\d+))?$/.exec(rep.lines ?? '');
        const nearby = rep.file ? judged.findings.filter((f) => f.task === task && f.file === rep.file).slice(0, 8).map((f) => f.message) : [];
        design.push({
          task,
          members: members.map((m) => ({ arm: m.arm, repeat: m.repeat, index: m.index })),
          file: rep.file,
          lines: rep.lines,
          ...(span ? { start_line: Number(span[1]), end_line: Number(span[2] ?? span[1]) } : {}),
          kind: rep.kind,
          summary: rep.summary,
          nearby,
        });
      }
    }
    designExtraction = { model: helperModel, trials: extracted.trials, items: extracted.items.length, clusters: design.length, failures: [...extracted.failures, ...grouped.failures.map((f) => ({ ...f, stage: 'grouping' }))] };
  }
  const items = panelItems(judged, { arms: arms ?? judged.arms, aliases, seed, contextFor, ...(clustering ? { clusters: clustering.clusters } : {}), design });
  const panel = await runPanel({ items, panelists, ...(taxonomy ? { taxonomy } : {}), requireFrozen, names, grade: ask, evidenceDir, seed });
  if (clustering) {
    const { clusterMatched } = splitClusters(judged, clustering.clusters);
    panel.clusterMatched = clusterMatched;
    panel.clustering = { model: helperModel, findings: judged.unmatched.length, panelItems: items.filter((i) => i.kind === 'unmatched').length, clusterMatched: clusterMatched.length, repairs: clustering.repairs, failures: clustering.failures, clusters: clustering.clusters };
  }
  if (designExtraction) panel.designExtraction = designExtraction;
  const features = collectFeatures(runDir, { diffFilesFor });
  const report = buildPanelReport({ panel, judged, features, comparisons, baseline, namedInAdvance, handLabels, resamples, seed });
  const write = (name, value) => fs.writeFileSync(path.join(outDir, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  write('panel.json', panel);
  write('report.json', report);
  write('report.md', renderPanelMarkdown(report));
  write('hand-label-sample.json', handLabelSample(panel, { seed }));
  const trialMetrics = panelTrialMetrics(panel, judged);
  write('trial-metrics.json', trialMetrics);
  return { panel, report, outDir, trialMetrics };
}
