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
  handLabelSample,
  loadJudged,
  maintainerAgreement,
  panelItems,
  runPanel,
} from '../scoring/panel.js';
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
  for (const it of panel.items) {
    if (it.kind !== 'unmatched') continue;
    const row = out[it.source.arm];
    if (!row) continue;
    row.total += 1;
    const l = cons.items.get(it.id).labels.verdict;
    if (l?.status === 'accepted') row[l.label] += 1;
    else row.disputed += 1;
  }
  for (const row of Object.values(out)) row.perTrial = row.trials ? row.total / row.trials : null;
  return out;
}

function featureProfiles(features, arms) {
  const usable = features.filter((f) => f.available);
  const perArm = {};
  for (const arm of arms) {
    const rows = usable.filter((f) => f.arm === arm);
    perArm[arm] = { trials: rows.length, unavailable: features.filter((f) => f.arm === arm && !f.available).length };
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
    associations: associations({ pairs, features, recall }),
    consensus: Object.fromEntries([...cons.items].map(([id, c]) => [id, Object.fromEntries(Object.entries(c.labels).map(([d, l]) => [d, l.status === 'accepted' ? l.label : null]))])),
  };
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
    items: { total: panel.items.length, golden: panel.items.filter((i) => i.kind === 'golden').length, unmatched: panel.items.filter((i) => i.kind === 'unmatched').length },
    failures: panel.failures,
    handLabels: handLabels ? { provided: Object.keys(handLabels).length } : { provided: 0, note: `maintainer hand-label sample of ${HAND_LABEL_SAMPLE_SIZE} items pending` },
    comparisons: pairs,
    features: featureProfiles(features, judged.arms),
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
  out.push(`Items: ${report.items.golden} golden, ${report.items.unmatched} unmatched. Failure records: ${report.failures.length}.`);
  out.push(`Maintainer hand labels: ${report.handLabels.provided}${report.handLabels.note ? ` (${report.handLabels.note})` : ''}.`, '');
  const arms = Object.keys(report.features);
  out.push('## Behaviour features (mean per trial)', '', `| Arm | Trials | ${FEATURES.join(' | ')} |`, `|---|---|${FEATURES.map(() => '---').join('|')}|`);
  for (const arm of arms) out.push(`| ${arm} | ${report.features[arm].trials} | ${FEATURES.map((f) => fmt(report.features[arm][f], 1)).join(' | ')} |`);
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
    out.push('', '### Unmatched findings', '', `| Arm | Total | Per trial | ${verdicts.join(' | ')} | disputed |`, `|---|---|---|${verdicts.map(() => '---').join('|')}|---|`);
    for (const [arm, u] of Object.entries(view.unmatched)) out.push(`| ${arm} | ${u.total} | ${fmt(u.perTrial, 2)} | ${verdicts.map((v) => u[v]).join(' | ')} | ${u.disputed} |`);
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
  seed = 20251111,
  resamples = DEFAULT_RESAMPLES,
}) {
  const judged = loadJudged({ runDir, goldenDir, variant, arms: arms?.map((a) => (typeof a === 'string' ? a : a.id)) });
  const names = blindNames(arms ?? judged.arms, aliases);
  const items = panelItems(judged, { arms: arms ?? judged.arms, aliases, seed, contextFor });
  const outDir = path.join(runDir, 'panel');
  fs.mkdirSync(outDir, { recursive: true });
  const panel = await runPanel({ items, panelists, ...(taxonomy ? { taxonomy } : {}), requireFrozen, names, grade, graderConfig, evidenceDir: path.join(outDir, 'graders'), seed });
  const features = collectFeatures(runDir, { diffFilesFor });
  const report = buildPanelReport({ panel, judged, features, comparisons, baseline, namedInAdvance, handLabels, resamples, seed });
  const write = (name, value) => fs.writeFileSync(path.join(outDir, name), typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  write('panel.json', panel);
  write('report.json', report);
  write('report.md', renderPanelMarkdown(report));
  write('hand-label-sample.json', handLabelSample(panel, { seed }));
  return { panel, report, outDir };
}
