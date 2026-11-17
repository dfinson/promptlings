// Qualification checks read from a trial's Copilot events (spec lane 8, Amendments 3 and 6). They
// are recorded in collected.json for the qualification report; they do not change trial status.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Subagents appear by display name ("Code Review Security") or by the CLI's plugin-namespaced id
// ("hve-core:code-review-security").
const NS = '(?:[\\w.-]+:)?';
const memberAgent = (name) => new RegExp(`^${NS}code[- ]review[- ]${name}$`, 'i');
const CODE_REVIEW_AGENT = new RegExp(`^${NS}code[- ]review(?:[- ][a-z]+)?$`, 'i');
const SKILL_FILE = /code-review[\\/]+(?:SKILL\.md|references[\\/])/i;
const memberFile = (name) => new RegExp(`${name}-findings\\.json`, 'i');
const memberTag = (name) => new RegExp(`\\[${name}\\]`, 'i');
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

const STATUS_RANK = { completed: 3, failed: 2, started: 1 };

/**
 * Checks one trial of an arm that declares qualificationChecks. `record` is the trial record
 * (trial.json); `findingsSource` is where collect read the findings, if anywhere.
 */
export function qualifyTrial({ record = {}, trialDir, armConfig, findingsSource, findingsPath }) {
  const wanted = armConfig?.qualificationChecks ?? [];
  const eventsPath = record.eventsPath ?? (trialDir ? join(trialDir, 'events.jsonl') : null);
  const events = readEvents(eventsPath);
  const results = {};
  if (!events) {
    for (const id of wanted) results[id] = { pass: false, evidence: `no events at ${eventsPath}` };
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
  // Every agent name seen per toolCallId (task arguments and subagent lifecycle events), and how
  // each dispatch ended. subagent.selected carries no toolCallId and is not a dispatch.
  const dispatchNames = new Map();
  const lifecycle = new Map();
  const addName = (id, n) => {
    if (!id || !n) return;
    if (!dispatchNames.has(id)) dispatchNames.set(id, new Set());
    dispatchNames.get(id).add(n);
  };
  for (const c of calls) if (c.name === 'task') addName(c.id, c.args?.agent_type);
  for (const e of events) {
    if (!/^subagent\.(?:started|completed|failed)$/.test(e?.type ?? '')) continue;
    const id = e.data?.toolCallId;
    for (const n of [e.data?.agentName, e.data?.agentDisplayName, e.data?.agentType]) addName(id, n);
    if (id) lifecycle.set(id, new Set([...(lifecycle.get(id) ?? []), e.type]));
  }
  const dispatchStatus = (id) => {
    const seen = lifecycle.get(id) ?? new Set();
    if (outcome.get(id) === false || seen.has('subagent.failed')) return 'failed';
    if (seen.has('subagent.completed') || outcome.get(id) === true) return 'completed';
    return 'started';
  };
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
    // Amendment 6: every member of the arm's requiredTeam must finish as its own subagent.
    'team-dispatched': () => {
      const team = armConfig?.requiredTeam ?? [];
      const members = {};
      for (const name of team) {
        const re = memberAgent(name);
        const ids = [...dispatchNames].filter(([, names]) => [...names].some((n) => re.test(n))).map(([id]) => id);
        if (ids.length) {
          const runs = ids.map((id) => ({ id, status: dispatchStatus(id), agent: [...dispatchNames.get(id)].find((n) => re.test(n)) }));
          const best = runs.reduce((a, b) => (STATUS_RANK[b.status] > STATUS_RANK[a.status] ? b : a));
          members[name] = { status: best.status, evidence: runs.map((r) => `task ${r.id} ${r.agent}: ${r.status}`).join('; ') };
          continue;
        }
        const files = calls.filter((c) => outcome.get(c.id) !== false && memberFile(name).test(text(c.args)));
        const tagged = messages.some((m) => memberTag(name).test(m));
        members[name] = files.length || tagged
          ? { status: 'inlined', evidence: `no subagent; ${files.length} ${name}-findings writes${tagged ? `, [${name}] tags in messages` : ''}` }
          : { status: 'missing', evidence: 'no subagent dispatch, findings file or tag' };
      }
      const pass = team.length > 0 && team.every((n) => members[n].status === 'completed');
      return {
        pass,
        members,
        evidence: team.length ? team.map((n) => `${n} ${members[n].status}`).join(', ') : 'arm declares no requiredTeam',
      };
    },
    'findings-file': () => {
      const pass = Boolean(findingsPath && findingsSource === findingsPath && existsSync(findingsPath));
      return { pass, evidence: pass ? findingsPath : `findings read from ${findingsSource ?? 'nowhere'}, expected ${findingsPath}` };
    },
  };
  for (const id of wanted) if (!all[id]) throw new Error(`unknown qualification check ${id}`);
  for (const id of wanted) results[id] = all[id]();
  return { passed: wanted.every((id) => results[id].pass), checks: results };
}
