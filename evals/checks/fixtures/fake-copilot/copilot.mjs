#!/usr/bin/env node
// Offline stand-in for the Copilot CLI used by the evals checks. It never contacts a service.
// Prompt directives: FAKE:LEAK_TOKEN, FAKE:SLEEP=<ms>, FAKE:EXIT=<code>, FAKE:NO_OUTPUT, FAKE:CAP, FAKE:NO_USAGE,
// FAKE:SANDBOX_DENIAL (an allowed git call fails on a sandbox denial), FAKE:BLOCKED_MESSAGE (the final answer
// reports a sandbox denial), FAKE:POLICY_DENIAL (a command outside the allow list is refused by policy),
// FAKE:INFRA_FAIL=<n> (the first n attempts in a trial directory fail as the CLI does when its session host stops
// acknowledging event delivery; FAKE:INFRA_DIRTY makes such an attempt change the workspace first),
// FAKE:FLOOD=<ms> (stream large deltas for ms and record the worst write delay and main-thread stall),
// FAKE:ANCESTOR_DENIAL (a subagent's views of ancestor AGENTS.md files are refused as outside the sandbox's
// readable paths, and the answers report it), FAKE:WORKSPACE_DENIAL (a view of a workspace file is refused the same way).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";

const argv = process.argv.slice(2);
if (argv.includes("--version")) {
  process.stdout.write("GitHub Copilot CLI 0.0.0-fake.\n");
  process.exit(0);
}

const option = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
const prompt = option("-p") ?? "";
const env = process.env;
const token = env.COPILOT_GITHUB_TOKEN ?? "";
const copilotHome = env.COPILOT_HOME ?? join(env.HOME ?? env.USERPROFILE ?? ".", ".copilot");
mkdirSync(copilotHome, { recursive: true });

const marker = join(copilotHome, "fake-copilot-marker");
const list = (dir) => (existsSync(dir) ? readdirSync(dir).sort() : []);
const record = {
  argv,
  cwd: process.cwd(),
  HOME: env.HOME ?? null,
  USERPROFILE: env.USERPROFILE ?? null,
  COPILOT_HOME: env.COPILOT_HOME ?? null,
  APPDATA: env.APPDATA ?? null,
  XDG_CONFIG_HOME: env.XDG_CONFIG_HOME ?? null,
  LOCALAPPDATA: env.LOCALAPPDATA ?? null,
  GIT_CONFIG_NOSYSTEM: env.GIT_CONFIG_NOSYSTEM ?? null,
  tokenPresent: Boolean(token),
  tokenSha256: token ? createHash("sha256").update(token).digest("hex") : null,
  githubTokenPresent: Boolean(env.GITHUB_TOKEN || env.GH_TOKEN),
  providerVariables: Object.keys(env).filter((k) => /^COPILOT_PROVIDER_/i.test(k)),
  priorMarker: existsSync(marker),
  agents: list(join(copilotHome, "agents")),
  skills: list(join(copilotHome, "skills")),
};
writeFileSync(marker, "seen\n");
writeFileSync(join(copilotHome, "fake-copilot-record.json"), `${JSON.stringify(record, null, 2)}\n`);

const sleep = Number(/FAKE:SLEEP=(\d+)/.exec(prompt)?.[1] ?? 0);
const exitCode = Number(/FAKE:EXIT=(\d+)/.exec(prompt)?.[1] ?? 0);
const leak = prompt.includes("FAKE:LEAK_TOKEN") ? ` leaked ${token}` : "";

// Tool events as the real CLI writes them to the session log, which the stdout stream does not carry.
const toolEvents = [];
if (prompt.includes("FAKE:SANDBOX_DENIAL")) {
  toolEvents.push(
    { type: "tool.execution_start", data: { toolCallId: "call_git", toolName: "powershell", arguments: { command: "git diff main...HEAD" } } },
    { type: "tool.execution_complete", data: { toolCallId: "call_git", success: true, shellExecution: { exitCode: 1 }, result: { content: "fatal: unable to access 'C:/Users/someone/AppData/Local/github-copilot-git-2.56.0-2/etc/gitconfig': Permission denied\n<shellId: 0 completed with exit code 1>\n<this failure may be caused by the active sandbox policy. Do not attempt workarounds. If you suspect the sandbox blocked this, ask the user to review their sandbox policy.>" } } },
  );
}
const sandboxRead = (id, path) => [
  { type: "tool.execution_start", data: { toolCallId: id, toolName: "view", arguments: { path }, parentToolCallId: "call_task" } },
  { type: "tool.execution_complete", data: { toolCallId: id, success: false, error: { message: "Outside the sandbox's readable paths.", code: "failure", remediation: "review_sandbox_policy" }, toolTelemetry: { properties: { command: "view", sandbox_denied: "true" } }, sandboxed: true, parentToolCallId: "call_task" } },
];
if (prompt.includes("FAKE:ANCESTOR_DENIAL")) {
  toolEvents.push(
    { type: "tool.execution_start", data: { toolCallId: "call_task", toolName: "task", arguments: { agent_type: "the-nitcracker" } } },
    ...sandboxRead("call_view_root", join(parse(process.cwd()).root, "AGENTS.md")),
    ...sandboxRead("call_view_parent", join(dirname(process.cwd()), "AGENTS.md")),
    { type: "tool.execution_complete", data: { toolCallId: "call_task", success: true, result: { content: "No applicable instruction files appeared in accessible review directories. Ancestor instruction-file reads were sandbox-blocked." } } },
  );
}
if (prompt.includes("FAKE:WORKSPACE_DENIAL")) toolEvents.push(...sandboxRead("call_view_ws", join(process.cwd(), "README.md")));
if (prompt.includes("FAKE:POLICY_DENIAL")) {
  toolEvents.push(
    { type: "permission.requested", data: { requestId: "req_1", permissionRequest: { kind: "shell", toolCallId: "call_curl", fullCommandText: "curl https://example.com" } } },
    { type: "permission.completed", data: { requestId: "req_1", toolCallId: "call_curl", result: { kind: "denied-no-approval-rule-and-could-not-request-from-user" } } },
    { type: "tool.execution_complete", data: { toolCallId: "call_curl", success: false, error: { message: "Permission denied because no interactive user response was available.", code: "denied" } } },
  );
}

const finish = () => {
  const events = [
    { type: "session.start", data: { fake: true } },
    { type: "user.message", data: { content: prompt } },
  ];
  if (!prompt.includes("FAKE:NO_OUTPUT")) {
    const answer = prompt.includes("FAKE:BLOCKED_MESSAGE")
      ? "**Blocked:** The sandbox denied Git access, so the branch could not be diffed."
      : prompt.includes("FAKE:ANCESTOR_DENIAL")
        ? "**Instructions:** Ancestor instruction-file reads were sandbox-blocked."
        : `Fake answer for: ${prompt}${leak}`;
    events.push({ type: "assistant.message", data: { content: answer } });
  }
  events.push({ type: "assistant.turn_end", data: {} });
  const sessionId = `fake-${process.pid}-${Date.now()}`;
  const sessionDir = join(copilotHome, "session-state", sessionId);
  mkdirSync(sessionDir, { recursive: true });
  const sessionEvents = [...events.slice(0, 2), ...toolEvents, ...events.slice(2), { type: "subagent.started", data: { agentName: "fake-subagent", note: `session log${leak}` } }];
  writeFileSync(join(sessionDir, "events.jsonl"), sessionEvents.map((e) => JSON.stringify(e)).join("\n") + "\n");
  events.push({ type: "result", sessionId, exitCode });
  for (const event of events) process.stdout.write(`${JSON.stringify(event)}\n`);
  if (prompt.includes("FAKE:CAP")) process.stderr.write("Session limit reached: max-ai-credits exhausted.\n");

  const usageFile = option("--usage-output-file");
  if (usageFile && !prompt.includes("FAKE:NO_USAGE")) writeFileSync(usageFile, `${JSON.stringify({ totalNanoAiu: prompt.includes("FAKE:CAP") ? 999e9 : 1.5e9, tokenDetails: { input: { tokenCount: 40 }, output: { tokenCount: 2 } } })}\n`);
  const share = option("--share");
  if (share) writeFileSync(share, `# Fake transcript\n\n${prompt}${leak}\n`);
  const logDir = option("--log-dir");
  if (logDir) {
    mkdirSync(logDir, { recursive: true });
    writeFileSync(join(logDir, "fake.log"), `fake run${leak}\n`);
  }
  writeFileSync(join(process.cwd(), "fake-output.txt"), `changed by fake copilot${leak}\n`);
  process.exit(exitCode);
};

const infraFail = Number(/FAKE:INFRA_FAIL=(\d+)/.exec(prompt)?.[1] ?? 0);
const flood = Number(/FAKE:FLOOD=(\d+)/.exec(prompt)?.[1] ?? 0);

// The CLI's failure when its session host stops acknowledging event delivery, as seen in rb-qual-1.
function infrastructureFailure() {
  const counter = join(dirname(option("--log-dir") ?? copilotHome), "fake-infra-attempts");
  const attempt = (existsSync(counter) ? Number(readFileSync(counter, "utf8")) : 0) + 1;
  writeFileSync(counter, String(attempt));
  if (attempt > infraFail) return false;
  if (prompt.includes("FAKE:INFRA_DIRTY")) writeFileSync(join(process.cwd(), "half-done.txt"), "partial edit\n");
  for (const event of [
    { type: "session.start", data: { fake: true } },
    { type: "user.message", data: { content: prompt } },
    { type: "session.error", data: { errorType: "query", message: "Session host did not complete the assistant.message event within 120s" } },
  ]) process.stdout.write(`${JSON.stringify(event)}\n`);
  process.stderr.write("Error: session event delivery failed: Session host did not acknowledge 'permission.requested' delivery within 5 seconds\n");
  const usageFile = option("--usage-output-file");
  if (usageFile) writeFileSync(usageFile, `${JSON.stringify({ totalNanoAiu: 2e9 })}\n`);
  process.exit(1);
}

// Streams deltas the way the CLI streams a long answer, measuring how long the reader makes this process wait.
function floodThen(next) {
  writeFileSync(join(copilotHome, "fake-flood-started"), "");
  const chunk = `${JSON.stringify({ type: "assistant.message_delta", data: { deltaContent: "x".repeat(16_000) } })}\n`;
  const end = Date.now() + flood;
  const stats = { bytes: 0, maxWriteMs: 0, maxStallMs: 0 };
  let last = Date.now();
  const tick = () => {
    const now = Date.now();
    stats.maxStallMs = Math.max(stats.maxStallMs, now - last);
    last = now;
    if (now >= end) {
      process.stdout.write("", () => {
        writeFileSync(join(copilotHome, "fake-flood.json"), `${JSON.stringify(stats)}\n`);
        next();
      });
      return;
    }
    const issued = Date.now();
    process.stdout.write(chunk, () => {
      stats.maxWriteMs = Math.max(stats.maxWriteMs, Date.now() - issued);
    });
    stats.bytes += chunk.length;
    setTimeout(tick, 5);
  };
  tick();
}

if (infraFail && infrastructureFailure() !== false) {
  // infrastructureFailure exits.
} else if (flood) floodThen(finish);
else if (sleep) setTimeout(finish, sleep);
else finish();
