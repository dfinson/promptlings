// Deterministic activation checks over Copilot CLI event evidence.
//
// Two event sources exist for one `copilot -p` trial:
//   1. the `--output-format json` stdout stream (trialRecord.eventsPath)
//   2. the persisted session log <COPILOT_HOME>/session-state/<sessionId>/events.jsonl
// Only the session log records `subagent.selected` (the `--agent` choice) and
// `skill.invoked`, so both are merged and deduplicated by event id.
// Events produced inside a subagent carry a top-level `agentId` equal to the
// `task` tool call that dispatched it. Top-level events carry no agentId.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const REVIEW_METHODS = Object.freeze([
  'technical-investigation',
  'design-analysis',
  'test-analysis',
  'evidence-verification',
]);
export const ENSEMBLE_WORKERS = Object.freeze(['the-nitcracker', 'pr-walkthrough', 'sparring-partner']);
const FORBIDDEN_SUBAGENTS = Object.freeze(['rubber-duck']);
const EM_DASH = '\u2014';

export function parseJsonl(text) {
  const events = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // A truncated final line after a timeout or cap is expected; skip it.
    }
  }
  return events;
}

function readJsonl(path) {
  return path && existsSync(path) ? parseJsonl(readFileSync(path, 'utf8')) : [];
}

export function normalizeAgentName(name) {
  if (typeof name !== 'string') return null;
  const parts = name.trim().toLowerCase().split(/[:/\\]/);
  return parts[parts.length - 1] || null;
}

export function sessionIdOf(events) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i]?.type === 'result' && typeof events[i].sessionId === 'string') return events[i].sessionId;
  }
  for (const event of events) {
    if (event?.type === 'session.start' && typeof event.data?.sessionId === 'string') return event.data.sessionId;
  }
  return null;
}

// Finds <root>/**/session-state/<sessionId>/events.jsonl within a bounded depth.
export function findSessionEvents(roots, sessionId, maxDepth = 6) {
  if (!sessionId) return null;
  const seen = new Set();
  const visit = (dir, depth) => {
    if (depth > maxDepth || seen.has(dir)) return null;
    seen.add(dir);
    const direct = join(dir, 'session-state', sessionId, 'events.jsonl');
    if (existsSync(direct)) return direct;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') continue;
      const found = visit(join(dir, entry.name), depth + 1);
      if (found) return found;
    }
    return null;
  };
  for (const root of roots) {
    if (!root || !existsSync(root) || !statSync(root).isDirectory()) continue;
    const found = visit(root, 0);
    if (found) return found;
  }
  return null;
}

export function mergeEvents(...lists) {
  const byId = new Map();
  const merged = [];
  let order = 0;
  for (const list of lists) {
    for (const event of list) {
      if (!event || typeof event !== 'object') continue;
      if (typeof event.id === 'string') {
        if (byId.has(event.id)) continue;
        byId.set(event.id, true);
      }
      merged.push({ event, order: order++ });
    }
  }
  const time = (e) => {
    const t = Date.parse(e.timestamp ?? '');
    return Number.isNaN(t) ? null : t;
  };
  merged.sort((a, b) => {
    const ta = time(a.event);
    const tb = time(b.event);
    if (ta !== null && tb !== null && ta !== tb) return ta - tb;
    return a.order - b.order;
  });
  return merged.map((m) => m.event);
}

export function loadTrialEvents(trialRecord = {}) {
  const stream = readJsonl(trialRecord.eventsPath);
  const sessionId = trialRecord.sessionId ?? sessionIdOf(stream);
  const roots = [trialRecord.copilotHome, trialRecord.trialDir, trialRecord.eventsPath && dirname(trialRecord.eventsPath)];
  const sessionEventsPath = trialRecord.sessionEventsPath && existsSync(trialRecord.sessionEventsPath)
    ? trialRecord.sessionEventsPath
    : findSessionEvents(roots, sessionId);
  const session = readJsonl(sessionEventsPath);
  return { events: mergeEvents(stream, session), sessionId, sessionEventsPath, streamCount: stream.length, sessionCount: session.length };
}

const scopeOf = (event) => (typeof event.agentId === 'string' && event.agentId ? event.agentId : null);

export function extractTimeline(events) {
  const timeline = {
    selectedAgents: [],
    skillLoads: [],
    subagents: new Map(),
    dispatches: [],
    finalText: '',
  };
  const skillCalls = new Map();
  const addSkill = (name, scope, source) => {
    if (!name) return;
    if (timeline.skillLoads.some((s) => s.name === name && s.scope === scope)) return;
    timeline.skillLoads.push({ name, scope, source });
  };

  events.forEach((event, index) => {
    const data = event.data ?? {};
    const scope = scopeOf(event);
    switch (event.type) {
      case 'subagent.selected':
        if (!scope) timeline.selectedAgents.push(normalizeAgentName(data.agentName));
        break;
      case 'skill.invoked':
      case 'skill.invoked_ref':
        addSkill(data.name, scope, event.type);
        break;
      case 'tool.execution_start':
        if (data.toolName === 'skill') {
          skillCalls.set(data.toolCallId, { name: data.arguments?.skill, scope });
        } else if (data.toolName === 'task') {
          timeline.dispatches.push({ agent: normalizeAgentName(data.arguments?.agent_type), scope, toolCallId: data.toolCallId, index });
        }
        break;
      case 'tool.execution_complete': {
        const call = skillCalls.get(data.toolCallId);
        const telemetryName = data.toolTelemetry?.restrictedProperties?.skillName;
        const found = data.toolTelemetry?.properties?.found;
        if ((call || telemetryName) && data.success === true && found !== 'false') {
          addSkill(call?.name ?? telemetryName, call?.scope ?? scope, 'tool');
        }
        break;
      }
      case 'subagent.started':
      case 'subagent.completed':
      case 'subagent.failed': {
        const id = scope ?? data.toolCallId;
        const entry = timeline.subagents.get(id) ?? { id, name: normalizeAgentName(data.agentName), started: null, completed: null, failed: null };
        entry.name ??= normalizeAgentName(data.agentName);
        if (event.type === 'subagent.started') entry.started ??= index;
        if (event.type === 'subagent.completed') entry.completed ??= index;
        if (event.type === 'subagent.failed') entry.failed ??= index;
        timeline.subagents.set(id, entry);
        break;
      }
      case 'assistant.message':
        if (!scope && typeof data.content === 'string' && data.content.trim()) timeline.finalText = data.content;
        break;
      default:
        break;
    }
  });
  return timeline;
}

const check = (id, pass, detail) => ({ id, pass: Boolean(pass), detail });

function hasSkill(timeline, name, scope) {
  return timeline.skillLoads.some((s) => s.name === name && s.scope === scope);
}

function subagentsNamed(timeline, name) {
  return [...timeline.subagents.values()].filter((s) => s.name === name);
}

function forbiddenCheck(timeline) {
  const used = new Set([
    ...[...timeline.subagents.values()].map((s) => s.name),
    ...timeline.dispatches.map((d) => d.agent),
  ].filter((n) => FORBIDDEN_SUBAGENTS.includes(n)));
  return check('no-rubber-duck', used.size === 0, used.size ? `dispatched ${[...used].join(', ')}` : 'no rubber-duck dispatch');
}

function topAgentCheck(timeline, expected) {
  const selected = timeline.selectedAgents.filter(Boolean);
  if (expected === null) {
    return check('top-agent', selected.length === 0, selected.length ? `unexpected --agent ${selected.join(', ')}` : 'default agent');
  }
  return check('top-agent', selected.includes(expected), selected.length ? `selected ${selected.join(', ')}` : 'no subagent.selected event (session log missing?)');
}

function skillsCheck(id, timeline, names, scope) {
  const missing = names.filter((n) => !hasSkill(timeline, n, scope));
  return check(id, missing.length === 0, missing.length ? `missing ${missing.join(', ')}` : `loaded ${names.join(', ')}`);
}

function anchorCovers(text, anchor) {
  const escaped = anchor.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`\\*\\*Anchor:\\*\\*\\s*\`?(?:\\.?/)?(?:[\\w.-]+/)*${escaped}\`?,\\s*RIGHT,\\s*lines?\\s*(\\d+)(?:\\s*-\\s*(\\d+))?`, 'gi');
  for (const match of text.matchAll(pattern)) {
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (anchor.line >= start && anchor.line <= end) return true;
  }
  return false;
}

export function nitcrackerChecks(timeline, text, expect = {}) {
  const anchors = expect.nitcrackerAnchors ?? [];
  const missing = anchors.filter((a) => !anchorCovers(text, a));
  const ruleIndex = text.search(/^\s*---\s*$/m);
  return [
    topAgentCheck(timeline, 'the-nitcracker'),
    forbiddenCheck(timeline),
    check('narrative-title', /^#\s+\S/m.test(text), 'H1 title opens the writeup'),
    check('appendix-rule', ruleIndex > 0 && /^#\s+\S/m.test(text.slice(0, ruleIndex)), 'narrative precedes a --- appendix'),
    check('anchors', missing.length === 0, missing.length ? `missing anchors ${missing.map((a) => `${a.path}:${a.line}`).join(', ')}` : `${anchors.length} anchor(s) present`),
  ];
}

export function sparringChecks(timeline) {
  return [
    topAgentCheck(timeline, 'sparring-partner'),
    forbiddenCheck(timeline),
    skillsCheck('review-methods', timeline, REVIEW_METHODS, null),
  ];
}

export function ensembleChecks(timeline) {
  const workers = ENSEMBLE_WORKERS.map((name) => ({ name, runs: subagentsNamed(timeline, name) }));
  const missingStart = workers.filter((w) => !w.runs.some((r) => r.started !== null)).map((w) => w.name);
  const missingDone = workers.filter((w) => !w.runs.some((r) => r.completed !== null)).map((w) => w.name);
  const firsts = workers.map((w) => w.runs.find((r) => r.started !== null)).filter(Boolean);
  const lastStart = Math.max(...firsts.map((r) => r.started));
  const completions = firsts.map((r) => r.completed).filter((c) => c !== null);
  const parallel = firsts.length === workers.length && completions.every((c) => c > lastStart);
  const sparring = workers[2].runs.find((r) => r.started !== null);
  const sparringScope = sparring?.id ?? null;
  const sparringSkills = ['intent-alignment', ...REVIEW_METHODS];
  const missingSparring = sparringScope ? sparringSkills.filter((n) => !hasSkill(timeline, n, sparringScope)) : sparringSkills;
  return [
    topAgentCheck(timeline, null),
    skillsCheck('ensemble-skill', timeline, ['review-ensemble'], null),
    check('workers-started', missingStart.length === 0, missingStart.length ? `not started: ${missingStart.join(', ')}` : 'all three workers started'),
    check('workers-completed', missingDone.length === 0, missingDone.length ? `not completed: ${missingDone.join(', ')}` : 'all three workers completed'),
    check('workers-parallel', parallel, parallel ? 'every worker started before any completed' : 'a worker completed before the last worker started'),
    check('sparring-methods', missingSparring.length === 0, missingSparring.length ? `sparring worker missing ${missingSparring.join(', ')}` : 'sparring worker loaded intent-alignment and the four methods'),
    forbiddenCheck(timeline),
  ];
}

export function commonChecks(trialRecord, text, expect = {}) {
  const mentions = expect.mentions ?? [];
  const missing = mentions.filter((m) => !text.includes(m));
  return [
    check('trial-completed', trialRecord.status === 'completed', `status ${trialRecord.status ?? 'unknown'}${trialRecord.reason ? `: ${trialRecord.reason}` : ''}`),
    check('final-output', text.trim().length > 0, text.trim() ? `${text.length} chars` : 'no top-level assistant output'),
    check('mentions', missing.length === 0, missing.length ? `missing ${missing.map((m) => JSON.stringify(m)).join(', ')}` : 'all expected terms present'),
    check('no-em-dash', !text.includes(EM_DASH), text.includes(EM_DASH) ? 'output contains an em dash' : 'no em dash'),
  ];
}

export function armKind(arm) {
  const agent = normalizeAgentName(arm?.agent ?? null);
  if (agent === 'the-nitcracker') return 'nitcracker';
  if (agent === 'sparring-partner') return 'sparring-partner';
  if (agent === null) return 'ensemble';
  throw new Error(`review-activation has no checks for agent ${arm.agent}`);
}

export function evaluateTrial({ trialRecord, arm, task, events, outputText }) {
  const timeline = extractTimeline(events);
  const text = timeline.finalText || outputText || '';
  const expect = task?.expect ?? {};
  const kind = armKind(arm);
  const specific = kind === 'nitcracker'
    ? nitcrackerChecks(timeline, text, expect)
    : kind === 'sparring-partner'
      ? sparringChecks(timeline)
      : ensembleChecks(timeline);
  const checks = [...commonChecks(trialRecord, text, expect), ...specific];
  const passed = checks.filter((c) => c.pass).length;
  return {
    kind,
    output: text,
    checks,
    pass: passed === checks.length,
    metrics: { activation: passed === checks.length ? 1 : 0, checks_passed: passed, checks_total: checks.length },
  };
}
