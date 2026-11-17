// Extracts design forks and implicit bets from each trial's review prose, so design commentary is
// scored on its own rubric instead of being invisible to defect matching.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { JSON_ONLY_REMINDER, assertBlind, sanitizeText } from './panel.js';
import { DEFAULT_PANEL_CONCURRENCY, mapPool } from './pool.js';

export const MIN_DESIGN_TEXT = 200;
const MAX_TEXT = 20000;

/** Removes fenced blocks that carry the structured findings, leaving the review's prose. */
export function reviewProse(text) {
  return String(text ?? '')
    .replace(/```[^\n]*\n[\s\S]*?```/g, (block) => (/"findings"\s*:|"start_line"\s*:/.test(block) || /^```json/i.test(block) ? '' : block))
    .trim();
}

export function designPrompt(text, findings, names = []) {
  return [
    'Below is the prose part of a code review of one pull request, followed by the defect findings the same review listed separately.',
    'No tools, files, repository or network are available to you. Answer from the text below only.',
    'List the design commentary in the prose: design forks (a choice the change leaves open or makes, with credible alternatives the reviewer should weigh) and implicit bets (a decision that trades one failure mode or cost for another).',
    'Do not list defects, bugs or requests to fix something. Do not restate any of the listed findings. Do not invent commentary the prose does not contain. If there is none, return an empty list.',
    'Each item gives the file it concerns (or "" when it is not tied to one), the line or range when stated (or ""), kind "fork" or "bet", and a self-contained summary of at most three sentences.',
    'Reply with one JSON object and nothing else, in this form:',
    JSON.stringify({ items: [{ file: 'src/a.ts', lines: '10-20', kind: 'fork', summary: '...' }] }),
    'Listed findings:',
    ...(findings.length ? findings.map((f, i) => `${i + 1}. [${sanitizeText(f.file, names)}] ${sanitizeText(f.message, names).slice(0, 300)}`) : ['(none)']),
    'Review prose:',
    sanitizeText(text, names).slice(0, MAX_TEXT),
  ].join('\n');
}

export function parseDesignItems(answer) {
  const text = String(answer ?? '').replace(/```(?:json)?/g, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('design answer has no JSON object');
  const parsed = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(parsed.items)) throw new Error('design answer has no items array');
  return parsed.items
    .filter((it) => it && typeof it.summary === 'string' && it.summary.trim())
    .map((it) => ({ file: typeof it.file === 'string' ? it.file : '', lines: it.lines === undefined || it.lines === null ? '' : String(it.lines), kind: it.kind === 'bet' ? 'bet' : 'fork', summary: it.summary.trim() }));
}

/**
 * One extraction call per trial whose prose is at least MIN_DESIGN_TEXT characters, cached in
 * <cacheDir>/<task>/<arm>/r<repeat>.json against a hash of the input. trials: [{task, arm,
 * repeat, text, findings}]. Returns { items: [{task, arm, repeat, index, file, lines, kind,
 * summary}], trials: {extracted, skipped}, failures }.
 */
export async function extractDesign({ trials, grade, model, cacheDir, names = [], concurrency = DEFAULT_PANEL_CONCURRENCY }) {
  const items = [];
  const failures = [];
  let extracted = 0;
  let skipped = 0;
  const outcomes = await mapPool(trials, concurrency, async (t) => {
    const prose = reviewProse(t.text);
    if (prose.length < MIN_DESIGN_TEXT) return { skipped: true };
    const prompt = assertBlind(designPrompt(prose, t.findings ?? [], names), names);
    const hash = crypto.createHash('sha256').update(`${model}\u0000${prompt}`).digest('hex');
    const cacheFile = cacheDir ? path.join(cacheDir, t.task, t.arm, `r${t.repeat}.json`) : null;
    if (cacheFile && fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (cached.hash === hash) return { found: cached.items };
    }
    const errors = [];
    const answers = [];
    for (const asked of [prompt, `${prompt}\n${JSON_ONLY_REMINDER}`]) {
      try {
        const answer = await grade(model, asked);
        answers.push(String(answer ?? ''));
        const found = parseDesignItems(answer);
        if (cacheFile) {
          fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
          fs.writeFileSync(cacheFile, `${JSON.stringify({ hash, model, items: found, answers }, null, 2)}\n`);
        }
        return { found };
      } catch (err) {
        errors.push(err.message);
      }
    }
    return { failure: { task: t.task, arm: t.arm, repeat: t.repeat, reason: errors.join('; then ') } };
  });
  trials.forEach((t, i) => {
    const o = outcomes[i];
    if (o.skipped) skipped += 1;
    else if (o.failure) failures.push(o.failure);
    else {
      extracted += 1;
      o.found.forEach((it, index) => items.push({ task: t.task, arm: t.arm, repeat: t.repeat, index, ...it }));
    }
  });
  return { model, items, trials: { extracted, skipped }, failures };
}
