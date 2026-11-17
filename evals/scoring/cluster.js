// Groups review comments on one pull request that describe the same underlying problem, so the
// panel labels each problem once and every arm that raised it receives the same label.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MAX_PROMPT_CHARS } from '../providers/copilot-grader.js';
import { JSON_ONLY_REMINDER, assertBlind, sanitizeText } from './panel.js';

const MESSAGE_CHARS = 500;

function where(e) {
  return e.lines ? `${e.file}:${e.lines}` : e.file || '(no file)';
}

export function clusterPrompt(entries, { subject = 'code review comments', names = [] } = {}) {
  return [
    `Below are ${entries.length} ${subject} on one pull request, written independently by several reviewers.`,
    'No tools, files, repository or network are available to you. Answer from the text below only.',
    'Group the entries that describe the same underlying problem or point: the same defect, risk or decision at the same place, even when worded differently or proposing different fixes.',
    'Entries about different problems stay in separate groups, even when they touch the same file. An entry that matches no other entry is a group of its own.',
    'Every entry number must appear in exactly one group.',
    'Reply with one JSON object and nothing else, in this form:',
    JSON.stringify({ groups: [[1, 3], [2]] }),
    'Entries:',
    ...entries.map((e, i) => `${i + 1}. [${sanitizeText(where(e), names)}] ${sanitizeText(e.text, names).slice(0, MESSAGE_CHARS)}`),
  ].join('\n');
}

/**
 * Reads {"groups": [[1,2],[3]]} for n entries. Out-of-range or repeated numbers are dropped (the
 * first group keeps a repeated entry) and missing entries become their own groups; `repairs`
 * counts both.
 */
export function parseGroups(answer, n) {
  const text = String(answer ?? '').replace(/```(?:json)?/g, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('cluster answer has no JSON object');
  const parsed = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(parsed.groups)) throw new Error('cluster answer has no groups array');
  const seen = new Set();
  const groups = [];
  let repairs = 0;
  for (const g of parsed.groups) {
    const kept = [];
    for (const v of Array.isArray(g) ? g : [g]) {
      const i = Number(v);
      if (!Number.isInteger(i) || i < 1 || i > n || seen.has(i)) {
        repairs += 1;
        continue;
      }
      seen.add(i);
      kept.push(i);
    }
    if (kept.length) groups.push(kept);
  }
  for (let i = 1; i <= n; i += 1) {
    if (!seen.has(i)) {
      groups.push([i]);
      repairs += 1;
    }
  }
  return { groups, repairs };
}

// Splits a task's entries into chunks whose prompts fit, keeping each file's entries together.
function chunks(entries, opts, maxChars) {
  if (clusterPrompt(entries, opts).length <= maxChars) return [entries];
  const byFile = new Map();
  for (const e of entries) {
    if (!byFile.has(e.file)) byFile.set(e.file, []);
    byFile.get(e.file).push(e);
  }
  const out = [];
  let current = [];
  for (const bucket of byFile.values()) {
    const next = [...current, ...bucket];
    if (current.length && clusterPrompt(next, opts).length > maxChars) {
      out.push(current);
      current = [...bucket];
    } else current = next;
  }
  if (current.length) out.push(current);
  return out;
}

/**
 * Clusters one task's entries ({key, file, lines, text}) with one model call per chunk. The answer
 * is cached in cacheFile against a hash of the input. An unparsable answer is re-asked once with
 * JSON_ONLY_REMINDER; a call that still fails leaves every entry in its chunk on its own and
 * records the failure.
 */
export async function clusterTask({ entries, grade, model, cacheFile, subject, names = [], maxChars = MAX_PROMPT_CHARS - 4000 }) {
  const sorted = [...entries].sort((a, b) => String(a.file).localeCompare(String(b.file)) || (a.start ?? 0) - (b.start ?? 0) || a.key.localeCompare(b.key));
  const hash = crypto.createHash('sha256').update(JSON.stringify({ model, subject, entries: sorted.map((e) => [e.key, e.file, e.lines, e.text]) })).digest('hex');
  if (cacheFile && fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    if (cached.hash === hash) return cached;
  }
  const opts = { subject, names };
  const groups = [];
  const failures = [];
  const answers = [];
  let repairs = 0;
  for (const chunk of sorted.length > 1 ? chunks(sorted, opts, maxChars) : [sorted]) {
    if (chunk.length === 1) {
      groups.push([chunk[0].key]);
      continue;
    }
    const prompt = assertBlind(clusterPrompt(chunk, opts), names);
    let parsed = null;
    const errors = [];
    for (const asked of [prompt, `${prompt}\n${JSON_ONLY_REMINDER}`]) {
      try {
        const answer = await grade(model, asked);
        answers.push(String(answer ?? ''));
        parsed = parseGroups(answer, chunk.length);
        break;
      } catch (err) {
        errors.push(err.message);
      }
    }
    if (!parsed) {
      failures.push({ entries: chunk.map((e) => e.key), reason: errors.join('; then ') });
      for (const e of chunk) groups.push([e.key]);
      continue;
    }
    repairs += parsed.repairs;
    for (const g of parsed.groups) groups.push(g.map((i) => chunk[i - 1].key));
  }
  const result = { hash, model, groups, repairs, failures, answers };
  if (cacheFile) {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, `${JSON.stringify(result, null, 2)}\n`);
  }
  return result;
}

/**
 * Clusters entries per task. entriesByTask maps a task id to its entries. Returns
 * { clusters: { [task]: [[key, ...], ...] }, failures, repairs }.
 */
export async function clusterByTask({ entriesByTask, grade, model, cacheDir, prefix, subject, names = [], maxChars }) {
  const clusters = {};
  const failures = [];
  let repairs = 0;
  for (const [task, entries] of entriesByTask) {
    if (!entries.length) continue;
    const r = await clusterTask({ entries, grade, model, subject, names, ...(maxChars ? { maxChars } : {}), ...(cacheDir ? { cacheFile: path.join(cacheDir, `${prefix}-${task}.json`) } : {}) });
    clusters[task] = r.groups;
    repairs += r.repairs;
    for (const f of r.failures) failures.push({ task, ...f });
  }
  return { model, clusters, failures, repairs };
}
