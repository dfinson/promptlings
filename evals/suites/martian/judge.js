import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { preparePiDir } from '../reviewbench/judge.js';

const MED_PLUS = new Set(['Medium', 'High', 'Critical']);
const STRICT = new Set(['bug', 'security', 'concurrency', 'data', 'api']);
const CORE = new Set([...STRICT, 'perf', 'test_gap', 'doc_defect']);

export const DEFAULT_MIN_VOTES = 2;

let apiPromise = null;

function requestHeaders(token, extra = {}) {
  return {
    'content-type': 'application/json',
    accept: 'application/json',
    authorization: `Bearer ${token}`,
    'X-Initiator': 'user',
    'Openai-Intent': 'conversation-edits',
    ...extra,
  };
}

// The Copilot API base, the editor headers from the run-local models.json and, per model id, the
// endpoints the API lists for it (Claude answers on /v1/messages, GPT and Grok on /responses).
function api(runDir, env, fetchImpl) {
  apiPromise ??= (async () => {
    const { piDir, baseUrl } = await preparePiDir(runDir, { env, fetchImpl });
    const template = JSON.parse(readFileSync(join(piDir, 'models.json'), 'utf8')).providers['github-copilot'].models;
    const headers = template[0]?.headers ?? {};
    const endpoints = new Map(template.map((m) => [m.id, m.api === 'anthropic-messages' ? ['/v1/messages'] : []]));
    const res = await fetchImpl(`${baseUrl}/models`, { headers: requestHeaders(env.COPILOT_GITHUB_TOKEN, headers), signal: AbortSignal.timeout(60_000) });
    if (res.ok) for (const m of (await res.json()).data ?? []) endpoints.set(m.id, m.supported_endpoints ?? []);
    return { baseUrl, headers, endpoints };
  })().catch((err) => {
    apiPromise = null;
    throw err;
  });
  return apiPromise;
}

/** The judge models: judge.models when set, otherwise the single judge.model. */
export function judgeModels(judge) {
  const models = judge.models?.length ? judge.models : [judge.model];
  if (!models.every((m) => typeof m === 'string' && m)) throw new Error('judge needs model or models');
  return [...new Set(models)];
}

export function judgeMinVotes(judge) {
  const models = judgeModels(judge);
  return models.length === 1 ? 1 : Math.min(judge.minVotes ?? DEFAULT_MIN_VOTES, models.length);
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

/** One model call on the endpoint the API lists for that model. Returns the answer text. */
export async function callModel({ baseUrl, headers = {}, endpoints, model, token, prompt, fetchImpl = fetch, maxTokens = 8000 }) {
  const supported = endpoints?.get(model) ?? [];
  const endpoint = ['/v1/messages', '/responses', '/chat/completions'].find((e) => supported.includes(e)) ?? (/^claude-/.test(model) ? '/v1/messages' : '/responses');
  const body = endpoint === '/v1/messages'
    ? { model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }
    : endpoint === '/responses'
      ? { model, max_output_tokens: maxTokens, input: [{ role: 'user', content: prompt }] }
      : { model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] };
  const res = await fetchImpl(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: requestHeaders(token, { ...(endpoint === '/v1/messages' ? { 'anthropic-version': '2023-06-01' } : {}), ...headers }),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${model} ${endpoint} returned ${res.status}: ${text.slice(0, 300)}`);
  const parsed = JSON.parse(text);
  if (endpoint === '/v1/messages') return (parsed.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  if (endpoint === '/responses') {
    if (typeof parsed.output_text === 'string' && parsed.output_text) return parsed.output_text;
    return (parsed.output ?? []).filter((o) => o.type === 'message').flatMap((o) => o.content ?? []).filter((c) => c.type === 'output_text').map((c) => c.text).join('');
  }
  return parsed.choices?.[0]?.message?.content ?? '';
}

/**
 * Majority vote over the judges' matches: a finding matches a known issue when at least minVotes
 * judges paired them. votes records, per known issue, how many judges named each finding.
 */
export function voteMatches(task, verdicts, minVotes) {
  return task.golden.map((g) => {
    const counts = new Map();
    for (const v of verdicts) {
      for (const c of v.matches.find((m) => m.golden === g.index)?.candidates ?? []) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const candidates = [...counts].filter(([, n]) => n >= minVotes).map(([c]) => c).sort((a, b) => a - b);
    return { golden: g.index, candidates, votes: Object.fromEntries([...counts].sort((a, b) => a[0] - b[0])), reasoning: `${candidates.length ? `matched by at least ${minVotes} of ${verdicts.length} judges` : 'no finding reached the vote threshold'}` };
  });
}

const safeName = (model) => model.replace(/[^A-Za-z0-9._-]/g, '_');

async function judgeWithModel({ dir, task, findings, prompt, model, api: conn, token, fetchImpl }) {
  const file = join(dir, `verdict.${safeName(model)}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const errors = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const text = await callModel({ ...conn, model, token, prompt, fetchImpl });
      writeFileSync(join(dir, `answer.${safeName(model)}-${attempt}.txt`), text);
      const matches = parseVerdict(text, task, findings.length);
      const verdict = { model, attempt, matches };
      writeFileSync(file, `${JSON.stringify(verdict, null, 2)}\n`);
      return verdict;
    } catch (err) {
      errors.push(err.message);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  return { model, error: `failed 3 times: ${errors.join(' | ')}` };
}

/**
 * Judges one trial with every judge model and keeps the pairs at least minVotes of them agree on.
 * Each model's verdict is cached in <runDir>/judge/<task>/<arm>/r<repeat>/verdict.<model>.json and
 * the consensus in verdict.json. A model that fails three times drops out of the vote; the trial
 * fails when fewer than minVotes models answer.
 */
export async function judgeTrial({ runDir, task, trial, judge, env = process.env, fetchImpl = fetch }) {
  const dir = join(runDir, 'judge', task.id, trial.arm, `r${trial.repeat}`);
  const file = join(dir, 'verdict.json');
  const models = judgeModels(judge);
  const minVotes = judgeMinVotes(judge);
  if (existsSync(file)) {
    const cached = JSON.parse(readFileSync(file, 'utf8'));
    const cachedModels = cached.models ?? [cached.model];
    if (cached.skipped || (cachedModels.length === models.length && models.every((m) => cachedModels.includes(m)) && (cached.minVotes ?? 1) === minVotes)) return cached.matches;
  }
  mkdirSync(dir, { recursive: true });
  const findings = trial.candidate.findings;
  if (!findings.length) {
    const matches = task.golden.map((g) => ({ golden: g.index, candidates: [], reasoning: 'no findings' }));
    writeFileSync(file, `${JSON.stringify({ models, minVotes, matches, skipped: 'no findings' }, null, 2)}\n`);
    return matches;
  }
  const conn = await api(runDir, env, fetchImpl);
  const prompt = judgePrompt(task, findings);
  writeFileSync(join(dir, 'prompt.txt'), prompt);
  const results = await Promise.all(models.map((model) => judgeWithModel({ dir, task, findings, prompt, model, api: conn, token: env.COPILOT_GITHUB_TOKEN, fetchImpl })));
  const answered = results.filter((r) => !r.error);
  const failed = results.filter((r) => r.error).map((r) => ({ model: r.model, error: r.error }));
  if (answered.length < minVotes) throw new Error(`only ${answered.length} of ${models.length} judges answered (${minVotes} needed): ${failed.map((f) => `${f.model}: ${f.error}`).join(' | ')}`);
  const matches = voteMatches(task, answered, minVotes);
  writeFileSync(file, `${JSON.stringify({ models, minVotes, answered: answered.map((r) => r.model), failed, matches }, null, 2)}\n`);
  return matches;
}

/** One minimal call per judge model, so a run stops before trials when a judge is unreachable. */
export async function judgePreflight({ runDir, judge, env = process.env, fetchImpl = fetch }) {
  const conn = await api(runDir, env, fetchImpl);
  const checked = [];
  for (const model of judgeModels(judge)) {
    const text = await callModel({ ...conn, model, token: env.COPILOT_GITHUB_TOKEN, prompt: 'Reply with OK.', fetchImpl, maxTokens: 256 }).catch((err) => {
      throw new Error(`judge preflight: ${err.message}`);
    });
    checked.push({ model, answered: text.trim().length > 0 });
  }
  const record = { status: 'ok', provider: judge.provider, models: checked, minVotes: judgeMinVotes(judge), baseUrl: conn.baseUrl, at: new Date().toISOString() };
  mkdirSync(join(runDir, 'judge'), { recursive: true });
  writeFileSync(join(runDir, 'judge', 'preflight.json'), `${JSON.stringify(record, null, 2)}\n`);
  return record;
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
