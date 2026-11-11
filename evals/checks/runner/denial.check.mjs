import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runTrial } from "../../runner/index.js";
import { fakeCopilot, stockArm, tempDir, testToken, withParentEnv } from "./helpers.mjs";

const limits = { timeoutMs: 60_000, maxAiCredits: 30 };
const arm = { ...stockArm, tools: { allow: ["shell(git:*)"], deny: ["shell(curl:*)"], allowUrl: [], denyUrl: [] } };

async function trial(label, prompt) {
  const root = tempDir(label);
  const trialDir = join(root, "trial");
  const workspace = join(root, "workspace");
  mkdirSync(workspace, { recursive: true });
  const record = await withParentEnv({ EVALS_COPILOT_BIN: fakeCopilot }, () =>
    runTrial({ trialDir, workspace, prompt, arm, limits, env: { COPILOT_GITHUB_TOKEN: testToken } }));
  return { trialDir, record, stored: JSON.parse(readFileSync(join(trialDir, "trial.json"), "utf8")) };
}

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

test("denial: a policy refusal of a command outside the arm's allowance is scored as agent behaviour", async () => {
  const { stored } = await trial("denial-policy", "FAKE:POLICY_DENIAL");
  assert.equal(stored.status, "completed", stored.reason);
  assert.deepEqual(stored.environmentDenials, []);
});
