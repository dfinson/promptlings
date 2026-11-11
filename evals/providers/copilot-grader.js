// Shared Copilot grading provider. Every own model-based grade is one tool-less
// `copilot -p` call in a fresh home, and the call's JSONL stream must show no tool use.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadRunner } from './runner.js';

export const MIN_GRADER_CREDITS = 30;
// An allowlist naming only an unknown tool disables every tool. A bare or empty
// `--available-tools` value leaves all tools enabled in Copilot CLI 1.0.106.
export const NO_TOOLS_SENTINEL = 'evals_grader_no_tools';
// Windows limits a command line to 32,767 characters; keep room for the other arguments.
export const MAX_PROMPT_CHARS = 30_000;
const FORBIDDEN_ENV = /^(OPENAI|ANTHROPIC|AZURE_OPENAI|COPILOT_PROVIDER)_/i;

const TOOL_EVENT_TYPES = new Set([
  'assistant.tool_call_delta',
  'tool.execution_start',
  'tool.execution_partial_result',
  'tool.execution_complete',
  'tool.user_requested',
  'external_tool.requested',
  'external_tool.completed',
]);

export function validateGraderConfig(config = {}) {
  const errors = [];
  if (!config.model || typeof config.model !== 'string') errors.push('grader model is required');
  else if (config.model.trim().toLowerCase() === 'auto') errors.push('grader model must be a named model, never auto');
  const credits = config.maxAiCredits ?? MIN_GRADER_CREDITS;
  if (!Number.isFinite(credits) || credits < MIN_GRADER_CREDITS) {
    errors.push(`grader maxAiCredits must be at least ${MIN_GRADER_CREDITS}`);
  }
  return errors;
}

export function parseEvents(stdout) {
  const events = [];
  for (const line of String(stdout ?? '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // Non-JSON progress lines are not events.
    }
  }
  return events;
}

export function findToolEvents(events) {
  return events.filter((event) => {
    const type = String(event?.type ?? '');
    if (TOOL_EVENT_TYPES.has(type) || type.startsWith('subagent.')) return true;
    const requests = event?.data?.toolRequests;
    return type === 'assistant.message' && Array.isArray(requests) && requests.length > 0;
  });
}

export function finalAnswer(events) {
  const messages = events.filter((e) => e?.type === 'assistant.message' && typeof e?.data?.content === 'string' && e.data.content.trim());
  return messages.length ? messages[messages.length - 1].data.content : null;
}

// Promptfoo hands graders a JSON chat array; Copilot takes one plain-text prompt.
export function flattenPrompt(prompt) {
  if (typeof prompt !== 'string') return JSON.stringify(prompt);
  let parsed;
  try {
    parsed = JSON.parse(prompt);
  } catch {
    return prompt;
  }
  if (!Array.isArray(parsed) || !parsed.every((m) => m && typeof m === 'object' && 'role' in m)) return prompt;
  return parsed
    .map((m) => {
      const content = Array.isArray(m.content)
        ? m.content.map((part) => (typeof part === 'string' ? part : part?.text ?? '')).join('\n')
        : String(m.content ?? '');
      return `${String(m.role).toUpperCase()}:\n${content}`;
    })
    .join('\n\n');
}

export function resolveGithubToken(env = process.env) {
  for (const key of ['COPILOT_GITHUB_TOKEN', 'GH_TOKEN', 'GITHUB_TOKEN']) {
    if (env[key]) return env[key];
  }
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

export function graderEnv(home, token, base = process.env) {
  const env = {};
  for (const [key, value] of Object.entries(base)) {
    if (FORBIDDEN_ENV.test(key)) continue;
    if (/^(COPILOT_GITHUB_TOKEN|GH_TOKEN|GITHUB_TOKEN|COPILOT_HOME|XDG_CONFIG_HOME|XDG_STATE_HOME)$/i.test(key)) continue;
    env[key] = value;
  }
  env.COPILOT_HOME = home;
  env.HOME = home;
  env.USERPROFILE = home;
  env.COPILOT_TELEMETRY_DISABLED = 'true';
  env.COPILOT_GITHUB_TOKEN = token;
  return env;
}

export function graderArgs(config, prompt, dirs) {
  const args = ['-p', prompt, '--model', config.model];
  if (config.reasoningEffort) args.push('--reasoning-effort', config.reasoningEffort);
  args.push(
    '--no-custom-instructions',
    '--disable-builtin-mcps',
    `--available-tools=${NO_TOOLS_SENTINEL}`,
    '--no-ask-user',
    '--output-format', 'json',
    '--max-ai-credits', String(config.maxAiCredits ?? MIN_GRADER_CREDITS),
    '--no-auto-update',
    '--disable-client-telemetry',
    '--secret-env-vars=COPILOT_GITHUB_TOKEN',
    '--log-dir', dirs.logs,
    '--usage-output-file', dirs.usage,
  );
  return args;
}

function fileContains(dir, needle) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (fileContains(full, needle)) return true;
    } else if (entry.isFile() && fs.readFileSync(full).includes(needle)) {
      return true;
    }
  }
  return false;
}

const cliVersions = new Map();
async function cliVersion(runner, home, cwd, env) {
  const key = runner;
  if (!cliVersions.has(key)) {
    cliVersions.set(key, runner.runCopilotOnce({ home, cwd, args: ['--version'], env, timeoutMs: 60_000 })
      .then((r) => (r.exitCode === 0 ? String(r.stdout).trim() : null))
      .catch(() => null));
  }
  return cliVersions.get(key);
}

let callSequence = 0;
function allocateCallDir(evidenceDir) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  for (;;) {
    callSequence += 1;
    const dir = path.join(evidenceDir, `grade-${process.pid}-${String(callSequence).padStart(5, '0')}`);
    try {
      fs.mkdirSync(dir);
      return dir;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
}

export default class CopilotGraderProvider {
  constructor(options = {}) {
    this.config = { ...(options.config ?? {}) };
    const errors = validateGraderConfig(this.config);
    if (errors.length) throw new Error(`Invalid Copilot grader config: ${errors.join('; ')}`);
    this.label = options.label ?? `copilot-grader:${this.config.model}`;
    this.isCopilotGrader = true;
  }

  id() {
    return `copilot-grader:${this.config.model}`;
  }

  toString() {
    return `[Copilot grader ${this.config.model}]`;
  }

  async callApi(prompt) {
    const evidenceDir = this.config.evidenceDir ?? process.env.EVALS_GRADER_EVIDENCE_DIR;
    if (!evidenceDir) return { error: 'Copilot grader needs config.evidenceDir or EVALS_GRADER_EVIDENCE_DIR to record its calls' };
    const text = flattenPrompt(prompt);
    if (text.length > MAX_PROMPT_CHARS) {
      return { error: `Grader prompt is ${text.length} characters, above the ${MAX_PROMPT_CHARS} character command-line limit` };
    }
    const token = resolveGithubToken();
    if (!token) return { error: 'No GitHub credential for the Copilot grader (COPILOT_GITHUB_TOKEN or gh auth token)' };

    const callDir = allocateCallDir(path.resolve(evidenceDir));
    const dirs = {
      home: path.join(callDir, 'home'),
      cwd: path.join(callDir, 'cwd'),
      logs: path.join(callDir, 'logs'),
      usage: path.join(callDir, 'usage.json'),
    };
    for (const d of [dirs.home, dirs.cwd, dirs.logs]) fs.mkdirSync(d);
    fs.writeFileSync(path.join(callDir, 'prompt.txt'), text);

    const runner = await loadRunner(this.config.runnerModule);
    const env = graderEnv(dirs.home, token);
    const version = await cliVersion(runner, dirs.home, dirs.cwd, env);
    const args = graderArgs(this.config, text, dirs);
    const started = Date.now();
    const result = await runner.runCopilotOnce({ home: dirs.home, cwd: dirs.cwd, args, env, timeoutMs: this.config.timeoutMs ?? 600_000 });
    const wallMs = Date.now() - started;

    const redact = (s) => String(s ?? '').split(token).join('[REDACTED]');
    const eventsPath = path.join(callDir, 'events.jsonl');
    fs.writeFileSync(eventsPath, redact(result.stdout));
    fs.writeFileSync(path.join(callDir, 'stderr.txt'), redact(result.stderr));

    const events = parseEvents(result.stdout);
    const toolEvents = findToolEvents(events);
    const answer = finalAnswer(events);
    const usage = fs.existsSync(dirs.usage) ? JSON.parse(fs.readFileSync(dirs.usage, 'utf8')) : null;
    const record = {
      model: this.config.model,
      reasoningEffort: this.config.reasoningEffort ?? null,
      maxAiCredits: this.config.maxAiCredits ?? MIN_GRADER_CREDITS,
      cliVersion: version,
      args: args.map((a) => (a === text ? '<prompt.txt>' : a)),
      exitCode: result.exitCode,
      wallMs,
      eventCount: events.length,
      toolCalls: toolEvents.length,
      toolEventTypes: toolEvents.map((e) => e.type),
      usage,
      promptPath: 'prompt.txt',
      eventsPath: 'events.jsonl',
    };
    fs.writeFileSync(path.join(callDir, 'grade.json'), JSON.stringify(record, null, 2));

    const metadata = { graderDir: callDir, model: this.config.model, cliVersion: version, toolCalls: toolEvents.length };
    if (fileContains(callDir, token)) return { error: `Grader evidence in ${callDir} contains the credential`, metadata };
    if (result.exitCode !== 0) return { error: `Copilot grader exited ${result.exitCode}; see ${callDir}`, metadata };
    if (toolEvents.length) return { error: `Copilot grader stream shows ${toolEvents.length} tool event(s); grading must be tool-less (${callDir})`, metadata };
    if (!answer) return { error: `Copilot grader produced no answer; see ${callDir}`, metadata };

    const details = usage?.tokenDetails;
    const prompt_ = details ? (details.input?.tokenCount ?? 0) + (details.cache_read?.tokenCount ?? 0) + (details.cache_write?.tokenCount ?? 0) : undefined;
    const completion = details?.output?.tokenCount;
    return {
      output: answer,
      cached: false,
      tokenUsage: details ? { prompt: prompt_, completion, total: prompt_ + (completion ?? 0), numRequests: 1 } : { numRequests: 1 },
      metadata,
    };
  }
}
