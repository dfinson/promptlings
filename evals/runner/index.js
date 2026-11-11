import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { delimiter, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { homePaths, isolatedEnv, tokenVariable } from "./env.js";
import { diffWorkspace, hashTree, redaction, scrubToken, snapshotWorkspace } from "./evidence.js";
import { installArm } from "./install.js";
import { artifactRoot } from "./paths.js";

export { isolatedEnv } from "./env.js";
export { hashTree } from "./evidence.js";

const minimumCredits = 30;
// Retries after an infrastructure error, each in a fresh trial home. limits.infraRetries overrides it.
export const infraRetries = 2;
const capPattern = /session limit|max-ai-credits|AI credit limit|credit limit reached/i;

function which(command, env) {
  if (isAbsolute(command) || command.includes("/") || command.includes("\\")) {
    const path = resolve(command);
    return existsSync(path) ? path : null;
  }
  const pathValue = env.PATH ?? env.Path ?? process.env.PATH ?? process.env.Path ?? "";
  const extensions = process.platform === "win32"
    ? ["", ...(env.PATHEXT ?? process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";").map((e) => e.toLowerCase())]
    : [""];
  for (const dir of pathValue.split(delimiter).filter(Boolean)) {
    for (const ext of extensions) {
      const candidate = join(dir, command + ext);
      if (existsSync(candidate) && (process.platform !== "win32" || ext)) return candidate;
    }
  }
  return null;
}

// Turns EVALS_COPILOT_BIN (default `copilot`) into a direct spawn. JavaScript entry points, including the
// one behind an npm .cmd shim, run under this Node.js so prompts never pass through cmd.exe quoting.
export function resolveCopilotCommand(env = process.env) {
  const requested = env.EVALS_COPILOT_BIN || "copilot";
  const found = which(requested, env);
  if (!found) throw new Error(`Copilot CLI not found: ${requested}. Set EVALS_COPILOT_BIN.`);
  const ext = extname(found).toLowerCase();
  if ([".js", ".mjs", ".cjs"].includes(ext)) return { command: process.execPath, prefix: [found], path: found };
  if (ext === ".cmd" || ext === ".bat") {
    const text = readFileSync(found, "utf8");
    const match = text.match(/"%(?:~)?dp0%?\\?([^"]+\.(?:js|mjs|cjs))"/i);
    if (match) {
      const script = join(dirname(found), match[1].replace(/^\\/, ""));
      if (existsSync(script)) return { command: process.execPath, prefix: [script], path: found };
    }
    throw new Error(`Cannot run ${found} without a shell. Point EVALS_COPILOT_BIN at the Copilot executable or its JavaScript entry point.`);
  }
  return { command: found, prefix: [], path: found };
}

function killTree(child) {
  if (!child.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/T", "/F", "/PID", String(child.pid)], { windowsHide: true });
  } else {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
}

/**
 * Runs the Copilot CLI once with a complete isolated environment. `env` is used as given. With `stdoutPath`
 * and `stderrPath`, the CLI writes its output straight to those files. A pipe would make the CLI wait
 * whenever this process is busy with synchronous work (on Windows its pipe writes block once the buffer
 * fills), and the CLI's session host times out such waits.
 */
export function runCopilotOnce({ home, cwd, args, env, timeoutMs, stdoutPath, stderrPath }) {
  const resolved = resolveCopilotCommand(env);
  const fullArgs = [...args];
  if (env[tokenVariable] && !fullArgs.some((a) => a.startsWith("--secret-env-vars"))) {
    fullArgs.push(`--secret-env-vars=${tokenVariable}`);
  }
  return new Promise((resolvePromise) => {
    const started = Date.now();
    const direct = Boolean(stdoutPath && stderrPath);
    const fds = direct ? [openSync(stdoutPath, "w"), openSync(stderrPath, "w")] : [];
    let child;
    try {
      child = spawn(resolved.command, [...resolved.prefix, ...fullArgs], {
        cwd: cwd ?? home,
        env,
        windowsHide: true,
        detached: process.platform !== "win32",
        stdio: ["ignore", ...(direct ? fds : ["pipe", "pipe"])],
      });
    } finally {
      for (const fd of fds) closeSync(fd);
    }
    const out = [];
    const err = [];
    if (!direct) {
      child.stdout.on("data", (chunk) => out.push(chunk));
      child.stderr.on("data", (chunk) => err.push(chunk));
    }
    let timedOut = false;
    const timer = timeoutMs ? setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs) : null;
    const finish = (exitCode, spawnError) => {
      if (timer) clearTimeout(timer);
      if (direct && spawnError) appendFileSync(stderrPath, `\n${spawnError.message}`);
      resolvePromise({
        exitCode,
        stdout: direct ? readFileSync(stdoutPath, "utf8") : Buffer.concat(out).toString("utf8"),
        stderr: direct ? readFileSync(stderrPath, "utf8") : Buffer.concat(err).toString("utf8") + (spawnError ? `\n${spawnError.message}` : ""),
        direct,
        timedOut,
        wallMs: Date.now() - started,
        launched: !spawnError,
        args: fullArgs,
        binary: resolved.path,
      });
    };
    child.on("error", (error) => finish(null, error));
    child.on("close", (code) => finish(code, null));
  });
}

export async function copilotVersion(env) {
  const result = await runCopilotOnce({ home: env.HOME, cwd: env.HOME, args: ["--version"], env, timeoutMs: 60_000 });
  const match = result.stdout.match(/(\d+\.\d+\.\d+[\w.-]*?)\.?\s*$/m);
  return match ? match[1] : result.stdout.trim() || null;
}

export function buildArgs({ prompt, arm, limits, trialDir }) {
  if (!arm.model || arm.model === "auto") throw new Error(`Arm ${arm.id} must pin a model; auto is not allowed.`);
  if (!arm.reasoningEffort || arm.reasoningEffort === "auto") throw new Error(`Arm ${arm.id} must pin a reasoning effort.`);
  const credits = Math.max(minimumCredits, Number(arm.maxAiCredits ?? limits?.maxAiCredits ?? minimumCredits));
  const args = [
    "-p", prompt,
    "--output-format", "json",
    "--usage-output-file", join(trialDir, "usage.json"),
    "--share", join(trialDir, "transcript.md"),
    "--log-dir", join(trialDir, "logs"),
    "--no-ask-user",
    "--no-auto-update",
    "--disable-client-telemetry",
    "--max-ai-credits", String(credits),
    "--model", arm.model,
    "--reasoning-effort", arm.reasoningEffort,
  ];
  if (arm.agent) args.push("--agent", arm.agent);
  const tools = arm.tools ?? {};
  for (const entry of tools.allow ?? []) args.push(`--allow-tool=${entry}`);
  for (const entry of tools.deny ?? []) args.push(`--deny-tool=${entry}`);
  for (const entry of tools.allowUrl ?? []) args.push(`--allow-url=${entry}`);
  for (const entry of tools.denyUrl ?? []) args.push(`--deny-url=${entry}`);
  if (tools.disableBuiltinMcps) args.push("--disable-builtin-mcps");
  if (arm.sandbox) args.push("--sandbox");
  if (arm.customInstructions === false) args.push("--no-custom-instructions");
  return { args, credits };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

// AI credits are derived from the CLI's nano-AI-unit total (1e9 nano units per credit) when present.
export const creditDerivation = "usage.totalNanoAiu / 1e9";

export function creditsFromUsage(usage) {
  if (typeof usage?.totalNanoAiu === "number") return usage.totalNanoAiu / 1e9;
  return findCredits(usage);
}

function countEvents(events) {
  let toolCalls = 0;
  let subagents = 0;
  for (const event of events) {
    if (event?.type === "tool.execution_start") toolCalls += 1;
    else if (event?.type === "subagent.started") subagents += 1;
  }
  return { toolCalls, subagents };
}

function readEvents(file) {
  try {
    return parseEvents(readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}

function findCredits(value) {
  if (!value || typeof value !== "object") return null;
  for (const [key, inner] of Object.entries(value)) {
    if (/ai_?credits/i.test(key) && typeof inner === "number") return inner;
  }
  for (const inner of Object.values(value)) {
    const found = findCredits(inner);
    if (found !== null) return found;
  }
  return null;
}

function parseEvents(stdout) {
  const events = [];
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      events.push(JSON.parse(trimmed));
    } catch {
      // Non-JSON lines are kept in stdout.txt only.
    }
  }
  return events;
}

// The stdout stream does not carry subagent or skill events, so the session log under COPILOT_HOME is
// retained as evidence. The final result event names the session.
function sessionIdOf(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    const id = event?.sessionId ?? event?.data?.sessionId;
    if (typeof id === "string" && /^[\w.-]+$/.test(id)) return id;
  }
  return null;
}

function finalMessage(events) {
  let message = null;
  for (const event of events) {
    const content = event?.type === "assistant.message" ? event.data?.content : null;
    if (typeof content === "string" && content.trim()) message = content;
  }
  return message;
}

// Signs that the sandbox or the operating system refused a tool call the CLI had already permitted. Policy
// refusals of commands outside the arm's allowance (error code "denied") are agent behaviour and are not matched.
const toolDenialPatterns = [
  /may be caused by the active sandbox policy/i,
  /outside the sandbox's (?:readable|writable) paths/i,
  /unable to access '[^'\n]+': Permission denied/i,
  /The specified drive root "[^"\n]*\\AC\\Temp\\?" either does not exist/i,
];
// Locations a tool needed for itself (git's system config, the sandbox's temp directory), named in its error.
const internalTargetPatterns = [/unable to access '([^'\n]+)': Permission denied/i, /The specified drive root "([^"\n]*\\AC\\Temp\\?)"/i];
// A report of a denial: the final answer, or a subagent's result quoting one.
const reportDenialPattern = /\bsandbox\b[^\n.]{0,40}\b(?:denied|blocked|refused)\b/i;

function denialExcerpt(text, patterns) {
  const lines = text.split(/\r?\n/);
  const line = lines.find((l) => patterns.some((p) => p.test(l))) ?? lines[0];
  return line.trim().slice(0, 300);
}

// Signs that the CLI's own session host failed, as opposed to the agent. Such attempts are retried.
const infrastructurePattern = /session event delivery failed/i;

/** Returns an excerpt naming the infrastructure error in a failed attempt's output, or null. */
export function infrastructureError(output, events) {
  const line = output.split(/\r?\n/).find((l) => infrastructurePattern.test(l));
  if (line) return line.trim().slice(0, 300);
  const error = events.find((e) => e?.type === "session.error" && e.data?.errorType === "query");
  if (error) return `session.error (query): ${String(error.data?.message ?? "").slice(0, 280)}`;
  return null;
}

function insideRoot(path, roots) {
  const norm = (p) => (process.platform === "win32" ? resolve(p).toLowerCase() : resolve(p));
  return roots.some((root) => {
    const rel = relative(norm(root), norm(path));
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  });
}

function deniedTarget(text, args, cwd) {
  for (const pattern of internalTargetPatterns) {
    const match = pattern.exec(text);
    if (match) return { target: match[1], internal: true };
  }
  const path = typeof args?.path === "string" ? args.path : null;
  if (path === null) return { target: null, internal: false };
  return { target: cwd && !isAbsolute(path) ? resolve(cwd, path) : path, internal: false };
}

/**
 * Splits sandbox and operating-system denials into those that invalidate the trial and warnings. A denial
 * invalidates when its target is inside `roots` (the workspace and the trial home), is a location the tool
 * needed for itself, or cannot be resolved. A denial of a path the agent chose outside those roots is the
 * intended confinement, so it is a warning. Reports of a denial (the final answer, a subagent's result)
 * invalidate unless every observed denial is such a warning.
 */
export function classifyEnvironmentDenials(events, message, { roots = [], cwd = roots[0] } = {}) {
  const starts = new Map();
  const denials = [];
  const warnings = [];
  const reports = [];
  for (const event of events) {
    if (event?.type === "tool.execution_start") starts.set(event.data?.toolCallId, event.data);
    if (event?.type !== "tool.execution_complete" || event.data?.error?.code === "denied") continue;
    const data = event.data;
    const text = [data?.result?.content, data?.error?.message].filter((t) => typeof t === "string").join("\n");
    const flagged = data?.error?.remediation === "review_sandbox_policy" || data?.toolTelemetry?.properties?.sandbox_denied === "true";
    const toolCallId = data?.toolCallId ?? null;
    const start = starts.get(toolCallId);
    if (flagged || toolDenialPatterns.some((p) => p.test(text))) {
      const { target, internal } = deniedTarget(text, start?.arguments, cwd);
      const entry = { source: "session", toolCallId, tool: start?.toolName ?? null, target, excerpt: denialExcerpt(text, toolDenialPatterns) };
      if (internal || target === null || !roots.length || insideRoot(target, roots)) denials.push(entry);
      else warnings.push({ ...entry, note: "Denied path is outside the trial's workspace and home." });
    } else if (reportDenialPattern.test(text)) {
      reports.push({ source: "session", toolCallId, tool: start?.toolName ?? null, target: null, excerpt: denialExcerpt(text, [reportDenialPattern]) });
    }
  }
  if (typeof message === "string" && reportDenialPattern.test(message)) {
    reports.push({ source: "output", toolCallId: null, tool: null, target: null, excerpt: denialExcerpt(message, [reportDenialPattern]) });
  }
  if (warnings.length && !denials.length) {
    for (const report of reports) warnings.push({ ...report, note: "Reports a denial, and every observed denial is outside the trial's workspace and home." });
  } else denials.push(...reports);
  return { denials, warnings };
}

export function environmentDenials(events, message, options) {
  return classifyEnvironmentDenials(events, message, options).denials;
}

// Names the workspace's commit state (HEAD and refs), which the file snapshot skips with .git.
function gitState(workspace) {
  let dir = join(workspace, ".git");
  if (!existsSync(dir)) return "";
  if (statSync(dir).isFile()) {
    const match = /gitdir:\s*(.+)/.exec(readFileSync(dir, "utf8"));
    if (!match) return "";
    dir = resolve(workspace, match[1].trim());
  }
  const dirs = [dir];
  if (existsSync(join(dir, "commondir"))) dirs.push(resolve(dir, readFileSync(join(dir, "commondir"), "utf8").trim()));
  const read = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "");
  return JSON.stringify(dirs.map((d) => [read(join(d, "HEAD")), read(join(d, "packed-refs")), existsSync(join(d, "refs")) ? hashTree(join(d, "refs")) : {}]));
}

const attemptEvidence = ["home", "logs", "stdout.txt", "stderr.txt", "events.jsonl", "output.md", "transcript.md", "usage.json", "workspace-diff.json", "workspace-after", "trial.json"];

// Moves a failed attempt's evidence to attempts/<n>/ so the retry starts from a fresh home.
function archiveAttempt(trialDir, n) {
  const dir = join(trialDir, "attempts", String(n));
  mkdirSync(dir, { recursive: true });
  for (const name of attemptEvidence) {
    if (existsSync(join(trialDir, name))) renameSync(join(trialDir, name), join(dir, name));
  }
  return dir;
}

function attemptEntry(record, n) {
  return {
    attempt: n,
    status: record.status,
    reason: record.reason ?? null,
    infrastructure: record.infrastructure === true,
    exitCode: record.exitCode,
    launched: record.launched,
    aiCredits: record.aiCredits,
    creditsCharged: null,
    creditsEstimated: null,
    wallMs: record.wallMs,
    dir: record.trialDir,
  };
}

/**
 * Runs one isolated trial. `env` carries only trial-specific additions such as COPILOT_GITHUB_TOKEN
 * and EVALS_COPILOT_BIN; parent credentials are never inherited. An attempt that fails on an
 * infrastructure error (see infrastructureError) without changing the workspace is retried up to
 * limits.infraRetries times (default 2) in a fresh home. Every attempt is listed in `attempts`, and earlier
 * attempts' evidence moves to attempts/<n>/. `retryGate(record)` may refuse a retry, for example when the
 * budget cannot hold another attempt; it is expected to charge the failed attempt when it allows one.
 */
export async function runTrial({ trialDir, workspace, prompt, arm, limits = {}, env = {}, retryGate }) {
  trialDir = resolve(trialDir);
  workspace = resolve(workspace);
  const maxAttempts = 1 + Math.max(0, Number(limits.infraRetries ?? infraRetries));
  const attempts = [];
  for (let n = 1; ; n += 1) {
    const commits = gitState(workspace);
    const { record, save } = await runAttempt({ trialDir, workspace, prompt, arm, limits, env });
    const entry = attemptEntry(record, n);
    attempts.push(entry);
    let stop = null;
    if (record.infrastructure) {
      if (n >= maxAttempts) stop = `not retried: ${n} attempts failed on infrastructure errors`;
      else if (record.workspaceChanged || gitState(workspace) !== commits) stop = "not retried: the attempt changed the workspace";
      else if (retryGate && !(await retryGate(record))) stop = "not retried: another attempt could exceed the credit ceiling";
    }
    if (!record.infrastructure || stop) {
      if (stop) record.retryStopped = entry.retryStopped = stop;
      record.attempts = attempts;
      save();
      return record;
    }
    if (record.creditsCharged !== undefined) {
      entry.creditsCharged = record.creditsCharged;
      entry.creditsEstimated = record.creditsEstimated;
    }
    entry.dir = archiveAttempt(trialDir, n);
  }
}

async function runAttempt({ trialDir, workspace, prompt, arm, limits, env }) {
  mkdirSync(join(trialDir, "logs"), { recursive: true });
  const home = join(trialDir, "home");
  mkdirSync(home, { recursive: true });
  const token = env[tokenVariable] || null;
  const extra = { ...env };
  if (!extra.EVALS_COPILOT_BIN && process.env.EVALS_COPILOT_BIN) extra.EVALS_COPILOT_BIN = process.env.EVALS_COPILOT_BIN;
  const installEnv = isolatedEnv(home, { ...extra, [tokenVariable]: undefined });
  const trialEnv = isolatedEnv(home, extra);
  writeFileSync(join(trialDir, "prompt.txt"), prompt);

  const paths = {
    outputPath: join(trialDir, "output.md"),
    eventsPath: join(trialDir, "events.jsonl"),
    transcriptPath: join(trialDir, "transcript.md"),
    workspaceDiffPath: join(trialDir, "workspace-diff.json"),
    usagePath: join(trialDir, "usage.json"),
  };
  const record = {
    status: "errored",
    launched: false,
    exitCode: null,
    wallMs: 0,
    cliVersion: null,
    flags: [],
    installedHashes: {},
    usage: {},
    aiCredits: null,
    ...paths,
    trialDir,
    homePath: home,
    copilotHome: homePaths(home).copilotHome,
    sessionId: null,
    sessionEventsPath: null,
    workspacePath: workspace,
    armId: arm.id,
    arm,
    limits,
    sourceSha: null,
  };
  const save = () => {
    let text = `${JSON.stringify(record, null, 2)}\n`;
    if (token && text.includes(token)) {
      record.status = "errored";
      record.tokenLeak = true;
      text = `${JSON.stringify(record, null, 2)}\n`.split(token).join(redaction);
    }
    writeFileSync(join(trialDir, "trial.json"), text);
  };

  let built;
  try {
    built = buildArgs({ prompt, arm, limits, trialDir });
    const installed = installArm(arm, { home, env: installEnv, root: env.EVALS_ARTIFACT_ROOT || artifactRoot() });
    record.installedHashes = installed.installedHashes;
    record.sourceSha = installed.sourceSha;
    record.cliVersion = await copilotVersion(installEnv);
  } catch (error) {
    record.reason = error.message;
    const leaks = scrubToken([trialDir], token);
    if (leaks.length) record.reason += ` Token found and redacted in: ${leaks.join(", ")}`;
    save();
    return { record, save };
  }

  const before = snapshotWorkspace(workspace);
  const result = await runCopilotOnce({
    home,
    cwd: workspace,
    args: built.args,
    env: trialEnv,
    timeoutMs: limits.timeoutMs,
    stdoutPath: join(trialDir, "stdout.txt"),
    stderrPath: join(trialDir, "stderr.txt"),
  });
  record.launched = result.launched;
  try {
    return { record: finishTrial({ record, result, built, paths, prompt, token, workspace, before, limits, save }), save };
  } catch (error) {
    // Copilot already ran, so the budget must charge this trial even though its evidence was not processed.
    error.launched = record.launched;
    throw error;
  }
}

function finishTrial({ record, result, built, paths, prompt, token, workspace, before, limits, save }) {
  const { trialDir } = record;
  record.exitCode = result.exitCode;
  record.wallMs = result.wallMs;
  record.flags = result.args.map((arg) => (arg === prompt ? "@prompt.txt" : arg));
  if (!result.direct) {
    writeFileSync(join(trialDir, "stdout.txt"), result.stdout);
    writeFileSync(join(trialDir, "stderr.txt"), result.stderr);
  }
  const events = parseEvents(result.stdout);
  writeFileSync(paths.eventsPath, events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : ""));
  const message = finalMessage(events);
  if (message !== null) writeFileSync(paths.outputPath, message);
  record.sessionId = sessionIdOf(events);
  if (record.sessionId) {
    const sessionEvents = join(record.copilotHome, "session-state", record.sessionId, "events.jsonl");
    if (existsSync(sessionEvents)) record.sessionEventsPath = sessionEvents;
  }
  const { diff } = diffWorkspace(before, workspace, trialDir);
  record.workspaceChanged = diff.added.length + diff.removed.length + diff.modified.length > 0;
  const changed = [...diff.added, ...diff.modified].map((rel) => join(workspace, rel));
  const leaks = scrubToken([trialDir], token, changed);

  const usage = readJson(paths.usagePath);
  const sessionEvents = record.sessionEventsPath ? readEvents(record.sessionEventsPath) : [];
  record.usage = { ...(usage ?? {}), ...countEvents(sessionEvents.length ? sessionEvents : events) };
  record.aiCredits = creditsFromUsage(usage);
  record.aiCreditsDerivation = typeof usage?.totalNanoAiu === "number" ? creditDerivation : null;

  const missing = [];
  if (!events.length) missing.push("events");
  if (message === null) missing.push("final message");
  if (!existsSync(paths.transcriptPath)) missing.push("transcript");
  if (!usage) missing.push("usage");
  record.missing = missing;

  const capped = capPattern.test(result.stdout + result.stderr) || (record.aiCredits !== null && record.aiCredits >= built.credits);
  if (result.timedOut) {
    record.status = "timed_out";
    record.reason = `Exceeded ${limits.timeoutMs} ms.`;
  } else if (capped) {
    record.status = "capped";
    record.reason = `Reached the ${built.credits} AI credit cap.`;
  } else if (result.exitCode !== 0) {
    record.status = "errored";
    record.reason = `Copilot exited ${result.exitCode}.`;
    const infrastructure = infrastructureError(`${result.stderr}\n${result.stdout}`, events);
    if (infrastructure) {
      record.infrastructure = true;
      record.reason = `Infrastructure error (Copilot exited ${result.exitCode}): ${infrastructure}`;
    }
  } else if (missing.length) {
    record.status = "errored";
    record.reason = `Missing evidence: ${missing.join(", ")}.`;
  } else {
    record.status = "completed";
  }

  const classified = classifyEnvironmentDenials(sessionEvents.length ? sessionEvents : events, message, { roots: [workspace, record.homePath], cwd: workspace });
  record.environmentDenials = classified.denials;
  record.environmentWarnings = classified.warnings;
  if (record.environmentDenials.length) {
    const [first] = record.environmentDenials;
    record.status = "invalidated";
    record.invalidated = true;
    record.reason = `Environment denial (${first.source}${first.toolCallId ? ` ${first.toolCallId}` : ""}): ${first.excerpt}`;
  }

  if (leaks.length) {
    delete record.invalidated;
    record.status = "errored";
    record.reason = `${tokenVariable} appeared in stored evidence and was replaced with ${redaction} in: ${leaks.join(", ")}`;
    record.tokenLeak = true;
  }
  record.infrastructure = record.status === "errored" && !record.tokenLeak && record.infrastructure === true;
  save();
  return record;
}

// Other lanes use this to invalidate a trial after the fact (for example, a contaminated task).
export function markInvalidated(trialDir, reason) {
  const file = join(trialDir, "trial.json");
  const record = JSON.parse(readFileSync(file, "utf8"));
  record.status = "invalidated";
  record.invalidated = true;
  record.reason = reason;
  writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);
  return record;
}
