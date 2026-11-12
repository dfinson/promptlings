// Qualification checks read from a trial's Copilot events (spec lane 8, Amendment 3). They are
// recorded in collected.json for the qualification report; they do not change trial status.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PERSPECTIVES = ['functional', 'standards', 'accessibility', 'security', 'readiness'];
// Subagents appear by display name ("Code Review Security") or by the CLI's plugin-namespaced id
// ("hve-core:code-review-security").
const NS = '(?:[\\w.-]+:)?';
const PERSPECTIVE_AGENT = new RegExp(`^${NS}code[- ]review[- ](?:${PERSPECTIVES.join('|')})$`, 'i');
const CODE_REVIEW_AGENT = new RegExp(`^${NS}code[- ]review(?:[- ][a-z]+)?$`, 'i');
const SKILL_FILE = /code-review[\\/]+(?:SKILL\.md|references[\\/])/i;
const PERSPECTIVE_FILE = new RegExp(`(?:${PERSPECTIVES.join('|')})-findings\\.json`, 'i');
const PERSPECTIVE_TAG = new RegExp(`\\[(?:${PERSPECTIVES.join('|')})\\]`, 'i');
// Interactive-mode pause text from the agent's Step 2; seeing it means workflow mode was not entered.
const INTERACTIVE_PAUSE = /Confirm before dispatch/i;

function readEvents(path) {
  if (!path || !existsSync(path)) return null;
  const events = [];
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      // truncated final line
    }
  }
  return events;
}

function text(value) {
  return typeof value === 'string' ? value : JSON.stringify(value ?? '');
}

function flagValue(flags, name) {
  if (!Array.isArray(flags)) return null;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i] === name) return flags[i + 1] ?? null;
    if (typeof flags[i] === 'string' && flags[i].startsWith(`${name}=`)) return flags[i].slice(name.length + 1);
  }
  return null;
}

function touchesSkill(toolName, args) {
  if (toolName === 'skill') return /^code-review$/i.test(args?.skill ?? '');
  return SKILL_FILE.test(text(args));
}

/**
 * Checks one trial of an arm that declares qualificationChecks (gates) or
 * qualificationObservations (recorded with `observation: true`, never gating). `record` is the trial record
 * (trial.json); `findingsSource` is where collect read the findings, if anywhere.
 */
export function qualifyTrial({ record = {}, trialDir, armConfig, findingsSource, findingsPath }) {
  const wanted = armConfig?.qualificationChecks ?? [];
  // Observations are evaluated and recorded but never gate `passed` (Amendment 5: perspectives).
  const observed = (armConfig?.qualificationObservations ?? []).filter((id) => !wanted.includes(id));
  const eventsPath = record.eventsPath ?? (trialDir ? join(trialDir, 'events.jsonl') : null);
  const events = readEvents(eventsPath);
  const results = {};
  if (!events) {
    for (const id of wanted) results[id] = { pass: false, evidence: `no events at ${eventsPath}` };
    for (const id of observed) results[id] = { observation: true, mode: null, evidence: `no events at ${eventsPath}` };
    return { passed: false, checks: results };
  }

  const outcome = new Map();
  const failure = new Map();
  for (const e of events) {
    if (e?.type !== 'tool.execution_complete' || !e.data?.toolCallId) continue;
    outcome.set(e.data.toolCallId, e.data.success);
    if (e.data.success === false) failure.set(e.data.toolCallId, e.data.error?.message ?? e.data.error?.code ?? 'failed');
  }
  const calls = events.filter((e) => e?.type === 'tool.execution_start').map((e) => ({ id: e.data?.toolCallId, name: e.data?.toolName, args: e.data?.arguments }));
  const subagents = events.filter((e) => e?.type === 'subagent.started').map((e) => e.data?.agentName ?? e.data?.agentType ?? '');
  const taskAgents = calls.filter((c) => c.name === 'task').map((c) => c.args?.agent_type ?? '');
  const messages = events.filter((e) => e?.type === 'assistant.message').map((e) => text(e.data?.content));

  const skillCalls = calls.filter((c) => touchesSkill(c.name, c.args));
  const skillOk = skillCalls.filter((c) => outcome.get(c.id) === true);
  const skillRefused = skillCalls.filter((c) => outcome.get(c.id) === false);
  const askUser = calls.filter((c) => c.name === 'ask_user');
  const paused = messages.some((m) => INTERACTIVE_PAUSE.test(m));
  const dispatched = [...subagents, ...taskAgents].filter((n) => PERSPECTIVE_AGENT.test(n));
  const inlinedFiles = calls.filter((c) => outcome.get(c.id) !== false && PERSPECTIVE_FILE.test(text(c.args)));
  const inlinedTags = messages.some((m) => PERSPECTIVE_TAG.test(m));
  const codeReviewSubagents = [...subagents, ...taskAgents].filter((n) => CODE_REVIEW_AGENT.test(n));

  const agentFlag = flagValue(record.flags, '--agent');
  const plugin = record.plugin ?? null;
  const pinned = armConfig?.plugin ?? null;

  const all = {
    'agent-ran': () => {
      // The flag must carry the arm's configured id (for plugins, the namespaced <plugin>:<stem> id).
      const flagOk = agentFlag === armConfig?.agent;
      const pluginOk = !pinned || (plugin?.commit === pinned.commit && (!armConfig.external?.version || plugin?.version === armConfig.external.version));
      const activity = skillOk.length > 0 || codeReviewSubagents.length > 0;
      return {
        pass: flagOk && pluginOk && activity,
        evidence: `--agent ${agentFlag ?? 'absent'}; plugin ${plugin ? `${plugin.repo ?? '?'}@${plugin.commit ?? '?'} v${plugin.version ?? '?'}` : 'not recorded'}; ${skillOk.length} code-review skill reads, ${codeReviewSubagents.length} Code Review subagents`,
      };
    },
    'workflow-mode': () => ({
      pass: askUser.length === 0 && !paused,
      evidence: `${askUser.length} ask_user calls; interactive confirmation text ${paused ? 'present' : 'absent'}`,
    }),
    'skill-read': () => ({
      pass: skillOk.length > 0 && skillRefused.length === 0,
      evidence: `${skillOk.length} successful and ${skillRefused.length} refused code-review skill reads${skillRefused.length ? `: ${skillRefused.map((c) => failure.get(c.id)).join('; ').slice(0, 300)}` : ''}`,
    }),
    perspectives: () => {
      const mode = dispatched.length ? 'dispatched' : inlinedFiles.length || inlinedTags ? 'inlined' : 'none';
      return {
        pass: mode !== 'none',
        mode,
        evidence: mode === 'dispatched' ? `subagents: ${[...new Set(dispatched)].join(', ')}` : mode === 'inlined' ? `${inlinedFiles.length} perspective findings writes; perspective tags ${inlinedTags ? 'present' : 'absent'}` : 'no perspective subagent, findings file or tag',
      };
    },
    'findings-file': () => {
      const pass = Boolean(findingsPath && findingsSource === findingsPath && existsSync(findingsPath));
      return { pass, evidence: pass ? findingsPath : `findings read from ${findingsSource ?? 'nowhere'}, expected ${findingsPath}` };
    },
  };
  for (const id of [...wanted, ...observed]) if (!all[id]) throw new Error(`unknown qualification check ${id}`);
  for (const id of wanted) results[id] = all[id]();
  const passed = wanted.every((id) => results[id].pass);
  for (const id of observed) {
    const { pass, ...rest } = all[id]();
    results[id] = { observation: true, ...rest };
  }
  return { passed, checks: results };
}
