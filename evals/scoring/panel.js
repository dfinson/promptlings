// Post-experiment analysis panel (spec lane 10). Three tool-less Copilot graders from different
// model families annotate golden findings and judge-unmatched arm findings blind to arm identity;
// only labels at least two panelists agree on are kept.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import CopilotGraderProvider, { MAX_PROMPT_CHARS } from '../providers/copilot-grader.js';
import { trialExclusion } from './behaviour.js';
import { mulberry32 } from './stats.js';

export const PANEL_MODELS = ['claude-opus-5.5', 'grok-4.7', 'gpt-6.1-terra'];
// Shares the OpenAI family with every arm's reviewer model; conclusions are also reported without it.
export const SHARED_FAMILY_PANELIST = 'gpt-6.1-terra';
export const MIN_AGREEING_VOTES = 2;
export const HAND_LABEL_SAMPLE_SIZE = 30;

export const DEFAULT_TAXONOMY = Object.freeze({
  version: 'v1-pilot',
  frozen: false,
  golden: {
    defect_class: ['logic', 'error-handling', 'concurrency', 'security', 'api-contract', 'data-persistence', 'tests', 'performance', 'documentation', 'maintainability'],
    locality: ['single-hunk', 'single-file', 'cross-file', 'outside-diff'],
    detection: ['diff', 'unchanged-code', 'execution', 'history-conventions'],
  },
  unmatched: {
    verdict: ['real-missing-from-golden', 'plausible-unverifiable', 'wrong'],
  },
});

const DIMENSION_HELP = {
  defect_class: 'the kind of defect',
  locality: 'single-hunk (one diff hunk), single-file (several places in one file), cross-file (several changed files), outside-diff (needs code the diff does not show)',
  detection: 'diff (reading the diff is enough), unchanged-code (needs reading unchanged code), execution (needs running or reasoning about execution), history-conventions (needs project history or conventions)',
  verdict: 'real-missing-from-golden (a real problem the reference review did not record), plausible-unverifiable (plausible but cannot be confirmed from the change), wrong (not a problem)',
};

export function validateTaxonomy(taxonomy, { requireFrozen = false } = {}) {
  if (!taxonomy?.version) throw new Error('Panel taxonomy needs a version');
  if (requireFrozen && taxonomy.frozen !== true) throw new Error(`Panel taxonomy ${taxonomy.version} is not frozen; confirmation stages require a frozen taxonomy`);
  for (const kind of ['golden', 'unmatched']) {
    const dims = taxonomy[kind];
    if (!dims || !Object.keys(dims).length) throw new Error(`Panel taxonomy has no ${kind} dimensions`);
    for (const [dim, labels] of Object.entries(dims)) {
      if (!Array.isArray(labels) || labels.length < 2) throw new Error(`Panel taxonomy dimension ${kind}.${dim} needs at least two labels`);
    }
  }
  return taxonomy;
}

export function dimensionsFor(taxonomy, kind) {
  return Object.keys(taxonomy[kind]);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Reads a judged stage: golden findings per task and, for every arm and repeat, the judge's
 * per-candidate match records (judge/<arm>/r<repeat>/<variant>/results.details.json).
 */
export function loadJudged({ runDir, goldenDir, variant = 'primary', arms } = {}) {
  const judgeRoot = path.join(runDir, 'judge');
  if (!fs.existsSync(judgeRoot)) throw new Error(`No judged results under ${judgeRoot}`);
  const golden = new Map();
  const goldenFor = (task) => {
    if (!golden.has(task)) {
      const file = path.join(goldenDir, `${task}.json`);
      if (!fs.existsSync(file)) throw new Error(`No golden file for ${task} in ${goldenDir}`);
      golden.set(task, readJson(file).findings ?? []);
    }
    return golden.get(task);
  };
  const trials = [];
  const catches = [];
  const unmatched = [];
  const excluded = [];
  // A judged entry counts only when its trial record (when present) is completed and not invalidated.
  const exclusionFor = (task, arm, repeat) => {
    const file = path.join(runDir, 'trials', task, arm, String(repeat), 'trial.json');
    return fs.existsSync(file) ? trialExclusion(readJson(file)) : null;
  };
  const armIds = arms ?? fs.readdirSync(judgeRoot).filter((d) => fs.statSync(path.join(judgeRoot, d)).isDirectory()).sort();
  for (const arm of armIds) {
    const armDir = path.join(judgeRoot, arm);
    if (!fs.existsSync(armDir)) continue;
    for (const rdir of fs.readdirSync(armDir).sort()) {
      const m = /^r(\d+)$/.exec(rdir);
      if (!m) continue;
      const repeat = Number(m[1]);
      const dir = path.join(armDir, rdir, variant);
      const details = path.join(dir, 'results.details.json');
      if (!fs.existsSync(details)) continue;
      const verified = path.join(dir, 'verified.json');
      if (fs.existsSync(verified) && readJson(verified).status !== 'verified') continue;
      for (const pr of readJson(details)) {
        const task = pr.pr_key;
        const unusable = exclusionFor(task, arm, repeat);
        if (unusable) {
          excluded.push({ task, arm, repeat, ...unusable });
          continue;
        }
        const g = goldenFor(task);
        trials.push({ task, arm, repeat });
        (pr.candidate_findings ?? []).forEach((f, index) => {
          for (const gi of f.covered_golden_indices ?? []) {
            if (g[gi]?.tp_fp === 'tp') catches.push({ task, arm, repeat, goldenIndex: gi });
          }
          const matched = f.matched_golden_index !== undefined || String(f.status ?? '').startsWith('matched');
          if (!matched && !(f.covered_golden_indices ?? []).length) {
            unmatched.push({ task, arm, repeat, index, file: f.file, start_line: f.start_line, end_line: f.end_line, message: f.message ?? '', status: f.status ?? null });
          }
        });
      }
    }
  }
  const tasks = [...new Set(trials.map((t) => t.task))].sort();
  const goldenItems = [];
  for (const task of tasks) {
    goldenFor(task).forEach((f, goldenIndex) => {
      if (f.tp_fp === 'tp') goldenItems.push({ task, goldenIndex, file: f.file, start_line: f.start_line, end_line: f.end_line, message: f.message ?? '', severity: f.severity ?? null });
    });
  }
  return { variant, arms: armIds, tasks, trials, golden: goldenItems, catches, unmatched, excluded };
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Matches a name with its separators interchangeable: "the-nitcracker", "the nitcracker", "the_nitcracker".
function namePattern(name) {
  const parts = String(name).trim().split(/[\s_-]+/).filter(Boolean).map(escapeRegex);
  return new RegExp(`(?<![A-Za-z0-9])${parts.join('[\\s_-]*')}(?![A-Za-z0-9])`, 'gi');
}

export function blindNames(arms = [], aliases = []) {
  const names = new Set();
  for (const arm of arms) {
    if (typeof arm === 'string') names.add(arm);
    else if (arm) for (const key of ['id', 'agent', 'name', 'label']) if (typeof arm[key] === 'string') names.add(arm[key]);
  }
  for (const a of aliases) if (typeof a === 'string') names.add(a);
  return [...names].filter((n) => n.trim().length > 0);
}

/** Strips arm names and formatting that could reveal an arm (headings, emphasis, emoji, bullets, tags). */
export function sanitizeText(text, names = []) {
  let s = String(text ?? '');
  s = s.replace(/^\s{0,3}#{1,6}\s+.*$/gm, ' ');
  s = s.replace(/\p{Extended_Pictographic}/gu, '');
  s = s.replace(/(\*\*|__|~~)/g, '');
  s = s.replace(/^\s*(?:[-*+>]|\d+[.)])\s+/gm, '');
  s = s.replace(/^\s*\[[^\]\n]{1,40}\]\s*/gm, '');
  for (const name of names) s = s.replace(namePattern(name), '[agent]');
  return s.replace(/\s+/g, ' ').trim();
}

export function assertBlind(prompt, names = []) {
  const leaked = names.filter((n) => namePattern(n).test(prompt));
  if (leaked.length) throw new Error(`Panel prompt reveals arm identity (${leaked.join(', ')})`);
  return prompt;
}

export function shuffle(values, seed) {
  const out = [...values];
  const random = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function lines(f) {
  if (!Number.isInteger(f.start_line)) return null;
  return f.end_line && f.end_line !== f.start_line ? `${f.start_line}-${f.end_line}` : String(f.start_line);
}

/**
 * Builds the blinded annotation pool: every golden finding and every unmatched arm finding,
 * shuffled together and given opaque ids. `source` stays with the analysis and never enters a prompt.
 */
export function panelItems(judged, { arms = judged.arms, aliases = [], seed = 20251111, contextFor } = {}) {
  const names = blindNames(arms, aliases);
  const raw = [
    ...judged.golden.map((g) => ({ kind: 'golden', source: { task: g.task, goldenIndex: g.goldenIndex }, f: g })),
    ...judged.unmatched.map((u) => ({ kind: 'unmatched', source: { task: u.task, arm: u.arm, repeat: u.repeat, index: u.index }, f: u })),
  ];
  return shuffle(raw, seed).map((r, i) => {
    const excerpt = contextFor ? contextFor(r) : null;
    return {
      id: `item-${String(i + 1).padStart(4, '0')}`,
      kind: r.kind,
      source: r.source,
      content: {
        file: sanitizeText(r.f.file, names),
        lines: lines(r.f),
        finding: sanitizeText(r.f.message, names),
        ...(excerpt ? { excerpt: sanitizeText(excerpt, names).slice(0, 2000) } : {}),
      },
    };
  });
}

export function buildPanelPrompt(kind, items, taxonomy) {
  const dims = taxonomy[kind];
  const intro = kind === 'golden'
    ? 'Each item is a code review finding that reviewers confirmed on a pull request. Classify the problem it describes.'
    : 'Each item is a code review finding that matched no confirmed finding for its pull request. Judge whether it describes a real problem.';
  const schema = Object.entries(dims).map(([dim, labels]) => `- ${dim}: one of ${labels.join(', ')}. Meaning: ${DIMENSION_HELP[dim] ?? dim}.`);
  const example = { id: items[0]?.id ?? 'item-0001', ...Object.fromEntries(Object.entries(dims).map(([d, l]) => [d, l[0]])) };
  return [
    'You are one member of an independent annotation panel. Answer from the text below only.',
    intro,
    `Taxonomy version ${taxonomy.version}. Label every item on these dimensions:`,
    ...schema,
    'Reply with one JSON object and nothing else, in this form:',
    JSON.stringify({ annotations: [example] }),
    'Items (one JSON object per line):',
    ...items.map((it) => JSON.stringify({ id: it.id, ...it.content })),
  ].join('\n');
}

function batches(kind, items, taxonomy, { maxChars, maxItems }) {
  const out = [];
  let current = [];
  for (const item of items) {
    const next = [...current, item];
    if (current.length && (next.length > maxItems || buildPanelPrompt(kind, next, taxonomy).length > maxChars)) {
      out.push(current);
      current = [item];
    } else current = next;
  }
  if (current.length) out.push(current);
  return out;
}

export function parseAnnotations(answer) {
  const text = String(answer ?? '').replace(/```(?:json)?/g, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('panelist answer has no JSON object');
  const parsed = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(parsed.annotations)) throw new Error('panelist answer has no annotations array');
  return parsed.annotations;
}

export function defaultGrade({ graderConfig = {}, evidenceDir } = {}) {
  const graders = new Map();
  return async (model, prompt) => {
    if (!graders.has(model)) {
      graders.set(model, new CopilotGraderProvider({ config: { maxAiCredits: 30, ...graderConfig, model, evidenceDir: path.join(evidenceDir, model) } }));
    }
    const result = await graders.get(model).callApi(prompt);
    if (result.error) throw new Error(result.error);
    return result.output;
  };
}

export const JSON_ONLY_REMINDER = 'Reminder: reply with only the JSON object described above, with no other text.';

/**
 * Sends every item to every panelist. Each (item, panelist) pair ends with either an annotation
 * whose labels all belong to the taxonomy, or an explicit failure record with its reason. An
 * unparsable answer is re-asked once with the same prompt plus JSON_ONLY_REMINDER. Every raw answer
 * is kept in panel.answers and, with evidenceDir, written to <evidenceDir>/<panelist>/answers/ with
 * a per-item attempt record in <evidenceDir>/<panelist>/items/<item>.json.
 */
export async function runPanel({
  items,
  panelists = PANEL_MODELS,
  taxonomy = DEFAULT_TAXONOMY,
  requireFrozen = false,
  names = [],
  grade,
  graderConfig,
  evidenceDir,
  seed = 20251111,
  maxItems = 25,
  maxChars = MAX_PROMPT_CHARS - 4000,
}) {
  validateTaxonomy(taxonomy, { requireFrozen });
  if (new Set(panelists).size !== panelists.length || panelists.length < 3) throw new Error('The panel needs at least three distinct panelists');
  if (!grade) {
    if (!evidenceDir) throw new Error('runPanel needs grade or evidenceDir for the Copilot grader');
    grade = defaultGrade({ graderConfig, evidenceDir });
  }
  const annotations = [];
  const failures = [];
  const prompts = [];
  const answers = [];
  const writeEvidence = (model, relative, content) => {
    if (!evidenceDir) return null;
    const file = path.join(evidenceDir, model, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
    return path.relative(evidenceDir, file).split(path.sep).join('/');
  };
  for (const [p, model] of panelists.entries()) {
    for (const kind of ['golden', 'unmatched']) {
      const pool = shuffle(items.filter((it) => it.kind === kind), seed + 7919 * (p + 1));
      const dims = dimensionsFor(taxonomy, kind);
      for (const [b, batch] of batches(kind, pool, taxonomy, { maxChars, maxItems }).entries()) {
        const prompt = assertBlind(buildPanelPrompt(kind, batch, taxonomy), names);
        prompts.push({ panelist: model, kind, items: batch.map((it) => it.id), sha256: crypto.createHash('sha256').update(prompt).digest('hex'), text: prompt });
        const attempts = [];
        let returned = null;
        let outcome = null;
        for (const attempt of [1, 2]) {
          const asked = attempt === 1 ? prompt : assertBlind(`${prompt}\n${JSON_ONLY_REMINDER}`, names);
          const record = { id: `${model}/${kind}-b${String(b + 1).padStart(2, '0')}-a${attempt}`, panelist: model, kind, batch: b + 1, attempt, items: batch.map((it) => it.id), promptSha256: crypto.createHash('sha256').update(asked).digest('hex'), text: null, error: null, file: null };
          answers.push(record);
          attempts.push(record);
          let raw;
          try {
            raw = await grade(model, asked);
          } catch (err) {
            record.error = `panelist call failed: ${err.message}`;
            outcome = attempt === 1 ? record.error : `panelist answer unparsable (${attempts[0].error}); retry ${record.error}`;
            break;
          }
          record.text = String(raw ?? '');
          record.file = writeEvidence(model, `answers/${kind}-b${String(b + 1).padStart(2, '0')}-a${attempt}.txt`, record.text);
          try {
            returned = parseAnnotations(raw);
            break;
          } catch (err) {
            record.error = err.message;
            outcome = attempt === 1 ? null : `panelist answer unparsable after retry: ${attempts.map((a) => a.error).join('; then ')}`;
          }
        }
        const answerIds = attempts.map((a) => a.id);
        const finish = (it, result) => {
          if (result.reason) failures.push({ item: it.id, panelist: model, reason: result.reason, answers: answerIds });
          else annotations.push({ item: it.id, panelist: model, labels: result.labels, answers: answerIds });
          writeEvidence(model, `items/${it.id}.json`, {
            item: it.id,
            panelist: model,
            kind,
            attempts: attempts.map(({ id, attempt, promptSha256, file, error }) => ({ id, attempt, promptSha256, file, error })),
            outcome: result.reason ? { failure: result.reason } : { labels: result.labels },
          });
        };
        if (!returned) {
          for (const it of batch) finish(it, { reason: outcome });
          continue;
        }
        const byId = new Map();
        for (const a of returned) if (a && typeof a.id === 'string' && !byId.has(a.id)) byId.set(a.id, a);
        for (const it of batch) {
          const a = byId.get(it.id);
          if (!a) {
            finish(it, { reason: 'no annotation returned for this item' });
            continue;
          }
          const bad = dims.filter((d) => !taxonomy[kind][d].includes(a[d]));
          if (bad.length) {
            finish(it, { reason: `labels outside taxonomy ${taxonomy.version}: ${bad.map((d) => `${d}=${JSON.stringify(a[d] ?? null)}`).join(', ')}` });
            continue;
          }
          finish(it, { labels: Object.fromEntries(dims.map((d) => [d, a[d]])) });
        }
      }
    }
  }
  return { taxonomy: { version: taxonomy.version, frozen: taxonomy.frozen === true, dimensions: { golden: taxonomy.golden, unmatched: taxonomy.unmatched } }, panelists, sharedFamily: panelists.includes(SHARED_FAMILY_PANELIST) ? SHARED_FAMILY_PANELIST : null, items, annotations, failures, prompts, answers };
}

/** Item and panelist pairs with neither an annotation nor a failure record. */
export function coverageGaps(panel) {
  const seen = new Set([...panel.annotations, ...panel.failures].map((r) => `${r.item}\u0000${r.panelist}`));
  const gaps = [];
  for (const it of panel.items) for (const p of panel.panelists) if (!seen.has(`${it.id}\u0000${p}`)) gaps.push({ item: it.id, panelist: p });
  return gaps;
}

/** A label is accepted when at least `minVotes` panelists chose it and no other label ties it. */
export function consensus(votes, { minVotes = MIN_AGREEING_VOTES } = {}) {
  const counts = new Map();
  for (const v of votes) if (v !== null && v !== undefined) counts.set(v, (counts.get(v) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  if (top && top[1] >= minVotes && !(second && second[1] === top[1])) return { status: 'accepted', label: top[0], votes: [...votes] };
  return { status: 'disputed', label: null, votes: [...votes] };
}

/**
 * Consensus labels per item and dimension. `exclude` drops panelists (for the view without the
 * shared-family panelist); the agreement threshold stays at two votes.
 */
export function consensusLabels(panel, { exclude = [] } = {}) {
  const panelists = panel.panelists.filter((p) => !exclude.includes(p));
  const byItem = new Map();
  for (const a of panel.annotations) {
    if (!panelists.includes(a.panelist)) continue;
    if (!byItem.has(a.item)) byItem.set(a.item, new Map());
    byItem.get(a.item).set(a.panelist, a.labels);
  }
  const out = new Map();
  for (const it of panel.items) {
    const dims = Object.keys(panel.taxonomy.dimensions[it.kind]);
    const given = byItem.get(it.id) ?? new Map();
    const labels = {};
    for (const d of dims) labels[d] = consensus(panelists.map((p) => given.get(p)?.[d] ?? null));
    out.set(it.id, { kind: it.kind, labels });
  }
  return { panelists, items: out };
}

/** Krippendorff's alpha for nominal data. units: one array of labels per item; null marks a missing label. */
export function krippendorffAlpha(units) {
  const coincidence = new Map();
  const totals = new Map();
  let n = 0;
  for (const unit of units) {
    const values = unit.filter((v) => v !== null && v !== undefined);
    const m = values.length;
    if (m < 2) continue;
    for (let i = 0; i < m; i += 1) {
      for (let j = 0; j < m; j += 1) {
        if (i === j) continue;
        const key = `${values[i]}\u0000${values[j]}`;
        coincidence.set(key, (coincidence.get(key) ?? 0) + 1 / (m - 1));
      }
      totals.set(values[i], (totals.get(values[i]) ?? 0) + 1);
    }
    n += m;
  }
  if (n < 2) return null;
  let observed = 0;
  for (const [key, count] of coincidence) {
    const [c, k] = key.split('\u0000');
    if (c !== k) observed += count;
  }
  let expected = 0;
  const labels = [...totals.keys()];
  for (const c of labels) for (const k of labels) if (c !== k) expected += totals.get(c) * totals.get(k);
  if (expected === 0) return null;
  return 1 - ((n - 1) * observed) / expected;
}

export function agreementStats(panel, { exclude = [] } = {}) {
  const panelists = panel.panelists.filter((p) => !exclude.includes(p));
  const cons = consensusLabels(panel, { exclude });
  const labelsOf = new Map();
  for (const a of panel.annotations) {
    if (!panelists.includes(a.panelist)) continue;
    if (!labelsOf.has(a.item)) labelsOf.set(a.item, new Map());
    labelsOf.get(a.item).set(a.panelist, a.labels);
  }
  const dims = [];
  for (const kind of ['golden', 'unmatched']) {
    for (const d of Object.keys(panel.taxonomy.dimensions[kind])) {
      const items = panel.items.filter((it) => it.kind === kind);
      const units = items.map((it) => panelists.map((p) => labelsOf.get(it.id)?.get(p)?.[d] ?? null));
      const disputed = items.filter((it) => cons.items.get(it.id).labels[d].status === 'disputed').length;
      dims.push({ kind, dimension: d, items: items.length, alpha: krippendorffAlpha(units), disputed, disputedShare: items.length ? disputed / items.length : null });
    }
  }
  return { panelists, dimensions: dims };
}

/** A seeded sample of blinded items for the maintainer to hand-label (content only, no source). */
export function handLabelSample(panel, { n = HAND_LABEL_SAMPLE_SIZE, seed = 20251111 } = {}) {
  return shuffle(panel.items, seed + 31).slice(0, n).map((it) => ({ id: it.id, kind: it.kind, ...it.content, dimensions: panel.taxonomy.dimensions[it.kind] }));
}

/** Agreement between the panel's accepted labels and the maintainer's hand labels ({ [itemId]: labels }). */
export function maintainerAgreement(panel, handLabels, { exclude = [] } = {}) {
  if (!handLabels || !Object.keys(handLabels).length) return null;
  const cons = consensusLabels(panel, { exclude });
  const rows = [];
  for (const kind of ['golden', 'unmatched']) {
    for (const d of Object.keys(panel.taxonomy.dimensions[kind])) {
      let labelled = 0;
      let agree = 0;
      let disputed = 0;
      for (const [id, labels] of Object.entries(handLabels)) {
        const c = cons.items.get(id);
        if (!c || c.kind !== kind || labels?.[d] === undefined) continue;
        labelled += 1;
        const l = c.labels[d];
        if (l.status === 'disputed') disputed += 1;
        else if (l.label === labels[d]) agree += 1;
      }
      rows.push({ kind, dimension: d, labelled, agree, disputed, agreement: labelled ? agree / labelled : null });
    }
  }
  return { items: Object.keys(handLabels).length, dimensions: rows };
}
