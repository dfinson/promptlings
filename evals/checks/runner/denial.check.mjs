import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runTrial } from "../../runner/index.js";
import { fakeCopilot, stockArm, tempDir, testToken, withParentEnv } from "./helpers.mjs";

const limits = { timeoutMs: 60_000, maxAiCredits: 30 };
const arm = { ...stockArm, tools: { allow: ["shell(git:*)"], deny: ["shell(curl:*)"], allowUrl: [], denyUrl: [] } };

async function trial(label, prompt, trialArm = arm) {
  const root = tempDir(label);
  const trialDir = join(root, "trial");
  const workspace = join(root, "workspace");
  mkdirSync(workspace, { recursive: true });
  const record = await withParentEnv({ EVALS_COPILOT_BIN: fakeCopilot }, () =>
    runTrial({ trialDir, workspace, prompt, arm: trialArm, limits, env: { COPILOT_GITHUB_TOKEN: testToken } }));
  return { trialDir, record, stored: JSON.parse(readFileSync(join(trialDir, "trial.json"), "utf8")) };
}

test("denial: a sandboxed arm skips CLI approval but keeps its deny rules, and its sandbox blocks network and bypass", async () => {
  const { stored } = await trial("denial-sandboxed", "hello", { ...arm, sandbox: true });
  assert.equal(stored.status, "completed", stored.reason);
  for (const flag of ["--sandbox", "--allow-all-tools", "--allow-all-paths", "--deny-tool=shell(curl:*)"]) assert.ok(stored.flags.includes(flag), flag);
  const settings = JSON.parse(readFileSync(join(stored.copilotHome, "settings.json"), "utf8"));
  assert.equal(settings.sandbox.allowBypass, false);
  assert.equal(settings.sandbox.userPolicy.network.allowOutbound, false);
  assert.deepEqual(stored.sandboxPolicy, { allowBypass: false, network: { allowOutbound: false } });
});

test("denial: an unsandboxed arm keeps CLI approval", async () => {
  const { stored } = await trial("denial-unsandboxed", "hello");
  assert.ok(!stored.flags.includes("--allow-all-tools"));
  assert.equal(stored.sandboxPolicy, null);
});

test("denial: a sandbox denial on an allowed tool in the session log invalidates the trial with its reason", async () => {
  const { record, stored } = await trial("denial-session", "FAKE:SANDBOX_DENIAL");
  assert.equal(record.status, "invalidated");
  assert.equal(stored.status, "invalidated");
  assert.equal(stored.invalidated, true);
  assert.match(stored.reason, /environment denial/i);
  assert.match(stored.reason, /gitconfig': Permission denied/);
  assert.equal(stored.environmentDenials.length, 1);
  assert.equal(stored.environmentDenials[0].source, "session");
  assert.equal(stored.environmentDenials[0].toolCallId, "call_git");
});

test("denial: a final answer that reports a sandbox denial invalidates the trial", async () => {
  const { stored } = await trial("denial-message", "FAKE:BLOCKED_MESSAGE");
  assert.equal(stored.status, "invalidated");
  assert.ok(stored.environmentDenials.some((d) => d.source === "output"));
  assert.match(stored.reason, /sandbox denied Git access/);
});

test("denial: a --deny-tool refusal is scored as agent behaviour", async () => {
  const { stored } = await trial("denial-policy", "FAKE:POLICY_DENIAL");
  assert.equal(stored.status, "completed", stored.reason);
  assert.deepEqual(stored.environmentDenials, []);
});

test("denial: a tool call denied only because nobody could approve it invalidates the trial", async () => {
  const { stored } = await trial("denial-approval", "FAKE:APPROVAL_DENIAL");
  assert.equal(stored.status, "invalidated");
  assert.equal(stored.environmentDenials.length, 1);
  assert.equal(stored.environmentDenials[0].source, "approval");
  assert.equal(stored.environmentDenials[0].toolCallId, "call_log");
  assert.match(stored.reason, /approval call_log\): git --no-pager log --format=oneline/);
});

test("denial: an unapproved URL fetch is a warning", async () => {
  const { stored } = await trial("denial-url-approval", "FAKE:URL_APPROVAL_DENIAL");
  assert.equal(stored.status, "completed", stored.reason);
  assert.deepEqual(stored.environmentDenials, []);
  assert.ok(stored.environmentWarnings.some((w) => w.source === "approval" && w.tool === "web_fetch" && w.target === "https://docs.python.org/3/"));
});

test("denial: sandbox refusals of ancestor paths outside the workspace and home are warnings, even when the answer reports them", async () => {
  const { stored } = await trial("denial-ancestor", "FAKE:ANCESTOR_DENIAL");
  assert.equal(stored.status, "completed", stored.reason);
  assert.deepEqual(stored.environmentDenials, []);
  assert.ok(Array.isArray(stored.environmentWarnings), "trial.json lists environment warnings");
  const views = stored.environmentWarnings.filter((w) => w.tool === "view");
  assert.deepEqual(views.map((w) => w.toolCallId).sort(), ["call_view_parent", "call_view_root"]);
  assert.ok(views.every((w) => /AGENTS\.md$/.test(w.target)));
  assert.ok(stored.environmentWarnings.some((w) => w.source === "output"), "the answer's report of the denial is a warning");
  assert.ok(stored.environmentWarnings.some((w) => w.source === "session" && w.toolCallId === "call_task"), "the subagent's report of the denial is a warning");
});

test("denial: a sandbox refusal of a workspace file invalidates the trial", async () => {
  const { stored } = await trial("denial-workspace", "FAKE:WORKSPACE_DENIAL");
  assert.equal(stored.status, "invalidated");
  assert.equal(stored.environmentDenials.length, 1);
  assert.equal(stored.environmentDenials[0].toolCallId, "call_view_ws");
  assert.match(stored.environmentDenials[0].target, /README\.md$/);
  assert.match(stored.reason, /readable paths/);
});
