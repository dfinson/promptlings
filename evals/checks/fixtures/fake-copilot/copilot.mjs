#!/usr/bin/env node
// Offline stand-in for the Copilot CLI used by the evals checks. It never contacts a service.
// Prompt directives: FAKE:LEAK_TOKEN, FAKE:SLEEP=<ms>, FAKE:EXIT=<code>, FAKE:NO_OUTPUT, FAKE:CAP, FAKE:NO_USAGE,
// FAKE:SANDBOX_DENIAL (an allowed git call fails on a sandbox denial), FAKE:BLOCKED_MESSAGE (the final answer
// reports a sandbox denial), FAKE:POLICY_DENIAL (a command outside the allow list is refused by policy).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

if (sleep) setTimeout(finish, sleep);
else finish();
