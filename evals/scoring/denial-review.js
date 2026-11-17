// Panel review of a trial the runner invalidated for an environment denial. An agent that loses one
// tool call usually moves on, so the denial alone does not invalidate: the panel reads the denied
// calls, the calls that followed and the final answer, and two "not material" votes restore the trial.
import fs from 'node:fs';
import path from 'node:path';
import { PANEL_MODELS, MIN_AGREEING_VOTES, defaultGrade } from './panel.js';

const SKIP_DIRS = new Set(['workspace', 'workspace-after', 'node_modules', 'AppData']);
const clip = (value, n) => {
  const text = String(value ?? '');
  return text.length > n ? `${text.slice(0, n)} [...]` : text;
};

function jsonlFiles(dir, out = []) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue;
    const file = path.join(dir, name);
    let stat;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;
    }
    if (stat.isDirectory()) jsonlFiles(file, out);
    else if (name.endsWith('.jsonl')) out.push(file);
  }
  return out;
}

// Every tool call in the trial's event streams (the main session and its subagents), in time order.
export function trialToolCalls(trialDir) {
  const calls = new Map();
  for (const file of jsonlFiles(trialDir)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      if (!line.startsWith('{')) continue;
      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      const id = event?.data?.toolCallId;
      if (!id) continue;
      if (event.type === 'tool.execution_start' && !calls.has(id)) {
        calls.set(id, { id, timestamp: String(event.timestamp ?? ''), tool: event.data.toolName ?? null, args: event.data.arguments ?? null, result: null });
      } else if (event.type === 'tool.execution_complete' && calls.has(id)) {
        const data = event.data;
        calls.get(id).result = [data?.result?.content, data?.error?.message].filter((t) => typeof t === 'string').join('\n').replace(/\u0000/g, '');
      }
    }
  }
  return [...calls.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export function buildDenialPrompt({ denials, calls, finalAnswer }) {
  const denied = new Set(denials.map((d) => d.toolCallId).filter(Boolean));
  const first = calls.findIndex((c) => denied.has(c.id));
  const deniedText = denials
    .map((d, i) => {
      const call = calls.find((c) => c.id === d.toolCallId);
      return `Denied call ${i + 1} (${d.source}, tool ${d.tool ?? call?.tool ?? 'unknown'}):\nArguments: ${clip(JSON.stringify(call?.args ?? d.excerpt), 1200)}\nResult: ${clip(call?.result ?? d.excerpt, 1500)}`;
    })
    .join('\n\n');
  const after = (first >= 0 ? calls.slice(first + 1) : calls.slice(-25))
    .slice(0, 25)
    .map((c) => `- ${c.tool}: ${clip(JSON.stringify(c.args), 160)}`)
    .join('\n');
  return `You are auditing one automated code-review trial. During the review the sandbox denied or blocked one or more tool calls. Decide whether the denial MATERIALLY changed the review outcome.

Material means at least one of: the review was cut short or abandoned; the agent lost evidence it needed and a finding it reported, dropped or would plausibly have made depends on that missing evidence; the agent's findings or conclusions are based on the failed step's misleading output.
Not material means: the call was tangential or optional (for example an unrelated web fetch, an optional test run or linter, an environment probe), or the agent moved on or worked around it and the review still covers the change on its merits. A failed tool call that the agent simply moves past is normally not material.

${deniedText}

Tool calls the agent made after the first denial (up to 25):
${after || '(none)'}

The agent's final answer:
${clip(finalAnswer ?? '(none)', 12000)}

You have no tools. Reply with only this JSON object and no other text:
{"material": true or false, "reason": "one or two sentences"}`;
}

export function parseDenialVerdict(text) {
  const match = String(text ?? '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('no JSON object in the answer');
  const value = JSON.parse(match[0]);
  if (typeof value.material !== 'boolean') throw new Error('"material" is not a boolean');
  return { material: value.material, reason: String(value.reason ?? '') };
}

export function denialDecision(votes, { minVotes = MIN_AGREEING_VOTES } = {}) {
  const material = votes.filter((v) => v.material === true).length;
  const immaterial = votes.filter((v) => v.material === false).length;
  if (immaterial >= minVotes) return 'not material';
  if (material >= minVotes) return 'material';
  return 'inconclusive';
}

/**
 * Asks every panelist whether the trial's environment denials materially changed its outcome, and
 * writes the prompt and raw answers under <trialDir>/denial-review/. Returns { decision, votes }.
 * An unparsable answer is re-asked once; a panelist that still fails casts no vote.
 */
export async function reviewDenials(record, { trialDir = record.trialDir, panelists = PANEL_MODELS, graderConfig = {}, grade } = {}) {
  const evidenceDir = path.join(trialDir, 'denial-review');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const finalAnswer = record.outputPath && fs.existsSync(record.outputPath) ? fs.readFileSync(record.outputPath, 'utf8') : null;
  const prompt = buildDenialPrompt({ denials: record.environmentDenials ?? [], calls: trialToolCalls(trialDir), finalAnswer });
  fs.writeFileSync(path.join(evidenceDir, 'prompt.txt'), prompt);
  const ask = grade ?? defaultGrade({ graderConfig, evidenceDir });
  const votes = await Promise.all(
    panelists.map(async (model) => {
      let error;
      for (const attempt of [1, 2]) {
        try {
          const answer = await ask(model, attempt === 1 ? prompt : `${prompt}\nReply now with only the JSON object.`);
          return { model, ...parseDenialVerdict(answer) };
        } catch (err) {
          error = err.message;
        }
      }
      return { model, error };
    }),
  );
  const review = { decision: denialDecision(votes), votes, decidedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(evidenceDir, 'verdict.json'), `${JSON.stringify(review, null, 2)}\n`);
  return review;
}
