import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { preparePiDir } from '../reviewbench/judge.js';

const MED_PLUS = new Set(['Medium', 'High', 'Critical']);
const STRICT = new Set(['bug', 'security', 'concurrency', 'data', 'api']);
const CORE = new Set([...STRICT, 'perf', 'test_gap', 'doc_defect']);

let apiPromise = null;

function api(runDir, env, fetchImpl) {
  apiPromise ??= preparePiDir(runDir, { env, fetchImpl }).then(({ piDir, baseUrl }) => {
    const models = JSON.parse(readFileSync(join(piDir, 'models.json'), 'utf8'));
    return { baseUrl, models: models.providers['github-copilot'].models };
  });
  return apiPromise;
}

/** The judge prompt. It names no arm, agent or tool, only the PR, its golden comments and one candidate list. */
export function judgePrompt(task, findings) {
  const golden = task.golden.map((g) => `G${g.index}. ${g.comment}`).join('\n');
  const cands = findings.length
    ? findings.map((f, i) => `C${i + 1}. ${f.file}:${f.start_line}-${f.end_line}: ${f.message.replace(/\s+/g, ' ').slice(0, 2000)}`).join('\n')
    : '(none)';
  return `You are evaluating an automated code review of one pull request against a set of known, human-verified issues in that pull request.

Pull request: ${task.title}

Known issues (golden comments):
${golden}

Review findings to evaluate:
${cands}

For each known issue, decide which review findings identify the same underlying issue. A finding matches when it points at the same problem, even if it is worded differently, describes it at a different level of detail, or cites a nearby line. A finding does not match when it only touches the same code without identifying that problem. A finding may match more than one known issue.

Answer with only this JSON and nothing else:
{"matches": [{"golden": <known issue number>, "candidates": [<matching finding numbers, possibly empty>], "reasoning": "<one sentence>"}]}
There are exactly ${task.golden.length} known issues, G1 to G${task.golden.length}. Return exactly ${task.golden.length} entries, one per known issue, in order, and no others.`;
}

function parseVerdict(text, task, count) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('judge answer has no JSON object');
  const value = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(value.matches)) throw new Error('judge answer has no matches array');
  const byGolden = new Map();
  const num = (v, prefix) => Number(typeof v === 'string' ? v.trim().replace(new RegExp(`^${prefix}`, 'i'), '') : v);
  for (const m of value.matches) {
    const g = num(m.golden, 'G');
    // Entries naming no known issue, and repeats of one already given, are ignored: the first entry per known issue counts.
    if (!task.golden.some((x) => x.index === g) || byGolden.has(g)) continue;
    const cands = (Array.isArray(m.candidates) ? m.candidates : []).map((c) => num(c, 'C'));
    for (const c of cands) if (!Number.isInteger(c) || c < 1 || c > count) throw new Error(`judge named unknown finding ${c}`);
    byGolden.set(g, { golden: g, candidates: [...new Set(cands)], reasoning: String(m.reasoning ?? '') });
  }
  const missing = task.golden.filter((g) => !byGolden.has(g.index)).map((g) => g.index);
  if (missing.length) throw new Error(`judge omitted golden ${missing.join(', ')}`);
  return [...byGolden.values()].sort((a, b) => a.golden - b.golden);
}

async function callJudge({ baseUrl, model, token, prompt, fetchImpl }) {
  const res = await fetchImpl(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'anthropic-version': '2023-06-01',
      authorization: `Bearer ${token}`,
      'X-Initiator': 'user',
      'Openai-Intent': 'conversation-edits',
      ...(model.headers ?? {}),
    },
    body: JSON.stringify({ model: model.id, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(300_000),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`judge returned ${res.status}: ${body.slice(0, 300)}`);
  const parsed = JSON.parse(body);
  return (parsed.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('');
}

/** Judges one trial (cached in <runDir>/judge/<task>/<arm>/r<repeat>/verdict.json). Three attempts. */
export async function judgeTrial({ runDir, task, trial, judge, env = process.env, fetchImpl = fetch }) {
  const dir = join(runDir, 'judge', task.id, trial.arm, `r${trial.repeat}`);
  const file = join(dir, 'verdict.json');
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')).matches;
  mkdirSync(dir, { recursive: true });
  const findings = trial.candidate.findings;
  if (!findings.length) {
    const matches = task.golden.map((g) => ({ golden: g.index, candidates: [], reasoning: 'no findings' }));
    writeFileSync(file, `${JSON.stringify({ model: judge.model, matches, skipped: 'no findings' }, null, 2)}\n`);
    return matches;
  }
  const { baseUrl, models } = await api(runDir, env, fetchImpl);
  const model = models.find((m) => m.id === judge.model);
  if (!model) throw new Error(`judge model ${judge.model} not in models.json`);
  const prompt = judgePrompt(task, findings);
  writeFileSync(join(dir, 'prompt.txt'), prompt);
  const errors = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const text = await callJudge({ baseUrl, model, token: env.COPILOT_GITHUB_TOKEN, prompt, fetchImpl });
      writeFileSync(join(dir, `answer-${attempt}.txt`), text);
      const matches = parseVerdict(text, task, findings.length);
      writeFileSync(file, `${JSON.stringify({ model: judge.model, attempt, matches }, null, 2)}\n`);
      return matches;
    } catch (err) {
      errors.push(err.message);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  throw new Error(`judge failed 3 times: ${errors.join(' | ')}`);
}

const ratio = (num, den) => (den ? num / den : null);

/** Per-trial metrics from the judge's matches. Recall is over golden comments; precision over findings. */
export function metricsFor(task, findings, matches) {
  const hit = new Set(matches.filter((m) => m.candidates.length).map((m) => m.golden));
  const matchedCands = new Set(matches.flatMap((m) => m.candidates));
  const recallOf = (pred) => {
    const gs = task.golden.filter(pred);
    return { r: ratio(gs.filter((g) => hit.has(g.index)).length, gs.length), n: gs.length };
  };
  const by = (key) => {
    const out = {};
    for (const v of [...new Set(task.golden.map((g) => g[key]))]) {
      const { r, n } = recallOf((g) => g[key] === v);
      out[v] = { recall: r, golden: n };
    }
    return out;
  };
  const precision = ratio(matchedCands.size, findings.length);
  const recall = recallOf(() => true).r;
  return {
    recall,
    recall_medplus: recallOf((g) => MED_PLUS.has(g.severity)).r,
    recall_strict: recallOf((g) => STRICT.has(g.category)).r,
    recall_core: recallOf((g) => CORE.has(g.category)).r,
    precision,
    f1: precision !== null && recall !== null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : precision === null ? null : 0,
    candidate_count: findings.length,
    golden_count: task.golden.length,
    golden_tp_count: hit.size,
    matched_candidate_count: matchedCands.size,
    by_severity: by('severity'),
    by_category: by('category'),
  };
}
