// Behaviour features per trial, counted from the runner's transcript evidence without a model:
// files read inside and outside the diff, searches, commands, verification attempts, subagents,
// tokens and duration.
import fs from 'node:fs';
import path from 'node:path';

const READ_TOOLS = /^(view|read|read_file|readfile|open_file|cat)$/i;
const SEARCH_TOOLS = /^(grep|glob|rg|ripgrep|find|search|file_search|code_search|semantic_code_search|search_code|list_dir|ls)$/i;
const SHELL_TOOLS = /^(powershell|bash|shell|sh|cmd|terminal|run_in_terminal|execute|exec)$/i;
const SUBAGENT_TOOLS = /^(task|subagent|dispatch_agent)$/i;
const SHELL_SEARCH = /^\s*(?:rg|grep|git\s+grep|select-string|findstr|find|ag|ack|get-childitem|dir|ls)\b/i;
const SHELL_READ = /^\s*(?:cat|type|get-content|gc|less|more|head|tail|bat|git\s+show)\s+(?:-\S+\s+)*["']?([^\s"'|;&]+)/i;
export const VERIFICATION = /\b(?:test|tests|pytest|jest|vitest|mocha|ava|tap|build|tsc|lint|eslint|ruff|mypy|flake8|pyright|cargo|go\s+(?:test|build|vet)|dotnet|mvn|gradle|make|ctest|node\s+--test|npm\s+(?:run\s+)?(?:test|build|lint|check)|pnpm|yarn)\b/i;

export const FEATURES = ['filesReadInDiff', 'filesReadOutsideDiff', 'filesRead', 'searches', 'commands', 'verificationAttempts', 'subagents', 'toolCalls', 'tokens', 'durationMs'];

function readEvents(file) {
  if (!file || !fs.existsSync(file)) return null;
  const events = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('{')) continue;
    try {
      events.push(JSON.parse(t));
    } catch {
      // A truncated line is not an event.
    }
  }
  return events;
}

export function normalizePath(p, workspace) {
  if (typeof p !== 'string' || !p.trim()) return null;
  let s = p.trim().replace(/^["']|["']$/g, '');
  if (workspace && path.isAbsolute(s)) {
    const rel = path.relative(workspace, s);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
    s = rel;
  }
  s = s.split(path.sep).join('/').replace(/\\/g, '/').replace(/^\.\//, '');
  return s || null;
}

function pathArg(args) {
  for (const key of ['path', 'file_path', 'filePath', 'file', 'filename', 'target_file']) {
    if (typeof args?.[key] === 'string') return args[key];
  }
  return null;
}

function commandArg(args) {
  for (const key of ['command', 'cmd', 'script', 'input']) if (typeof args?.[key] === 'string') return args[key];
  return '';
}

function tokenCount(usage) {
  const d = usage?.tokenDetails;
  if (!d) return null;
  return ['input', 'cache_read', 'cache_write', 'output'].reduce((sum, k) => sum + (d[k]?.tokenCount ?? 0), 0);
}

/**
 * Counts one trial's behaviour. diffFiles lists the PR's changed paths (repository-relative); when
 * absent, reads are counted but not split by diff membership.
 */
export function trialFeatures(trialDir, { diffFiles } = {}) {
  const recordPath = path.join(trialDir, 'trial.json');
  if (!fs.existsSync(recordPath)) return { available: false, reason: 'no trial.json' };
  const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  const resolve = (p) => (p ? (path.isAbsolute(p) ? p : path.join(trialDir, p)) : null);
  const events = readEvents(resolve(record.sessionEventsPath)) ?? readEvents(resolve(record.eventsPath)) ?? readEvents(path.join(trialDir, 'events.jsonl'));
  if (!events) return { available: false, reason: 'no transcript events' };
  const workspace = record.workspace ?? path.join(trialDir, 'workspace');
  const diff = Array.isArray(diffFiles) ? new Set(diffFiles.map((f) => normalizePath(f, null))) : null;

  const read = new Set();
  let searches = 0;
  let commands = 0;
  let verificationAttempts = 0;
  let subagentEvents = 0;
  let subagentTools = 0;
  let toolCalls = 0;
  for (const e of events) {
    if (e?.type === 'subagent.started') subagentEvents += 1;
    if (e?.type !== 'tool.execution_start') continue;
    toolCalls += 1;
    const name = String(e.data?.toolName ?? '');
    const args = e.data?.arguments ?? {};
    if (READ_TOOLS.test(name) || (name === 'str_replace_editor' && args.command === 'view')) {
      const p = normalizePath(pathArg(args), workspace);
      if (p) read.add(p);
    } else if (SEARCH_TOOLS.test(name)) {
      searches += 1;
    } else if (SHELL_TOOLS.test(name)) {
      const command = commandArg(args);
      commands += 1;
      if (VERIFICATION.test(command)) verificationAttempts += 1;
      for (const part of command.split(/&&|\|\||;|\n/)) {
        if (SHELL_SEARCH.test(part)) searches += 1;
        const m = SHELL_READ.exec(part);
        if (m) {
          const p = normalizePath(m[1], workspace);
          if (p) read.add(p);
        }
      }
    } else if (SUBAGENT_TOOLS.test(name)) {
      subagentTools += 1;
    }
  }
  const files = [...read];
  return {
    available: true,
    filesRead: files.length,
    filesReadInDiff: diff ? files.filter((f) => diff.has(f)).length : null,
    filesReadOutsideDiff: diff ? files.filter((f) => !diff.has(f)).length : null,
    searches,
    commands,
    verificationAttempts,
    subagents: Math.max(subagentEvents, subagentTools),
    toolCalls,
    tokens: tokenCount(record.usage),
    durationMs: Number.isFinite(record.wallMs) ? record.wallMs : null,
  };
}

/** Features for every trial directory <runDir>/trials/<task>/<arm>/<repeat>. */
export function collectFeatures(runDir, { diffFilesFor } = {}) {
  const out = [];
  const root = path.join(runDir, 'trials');
  if (!fs.existsSync(root)) return out;
  for (const task of fs.readdirSync(root).sort()) {
    const diffFiles = diffFilesFor ? diffFilesFor(task) : undefined;
    for (const arm of fs.readdirSync(path.join(root, task)).sort()) {
      for (const repeat of fs.readdirSync(path.join(root, task, arm)).sort()) {
        const dir = path.join(root, task, arm, repeat);
        if (!fs.statSync(dir).isDirectory()) continue;
        out.push({ task, arm, repeat: /^\d+$/.test(repeat) ? Number(repeat) : repeat, ...trialFeatures(dir, { diffFiles }) });
      }
    }
  }
  return out;
}
