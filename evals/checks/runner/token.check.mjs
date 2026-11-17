import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runTrial } from "../../runner/index.js";
import { fakeCopilot, filesContaining, stockArm, tempDir, testToken, withParentEnv } from "./helpers.mjs";

const limits = { timeoutMs: 60_000, maxAiCredits: 30 };

async function trial(label, prompt, env = { COPILOT_GITHUB_TOKEN: testToken }, parent = {}) {
  const root = tempDir(label);
  const trialDir = join(root, "trial");
  const workspace = join(root, "workspace");
  mkdirSync(workspace, { recursive: true });
  const record = await withParentEnv({ EVALS_COPILOT_BIN: fakeCopilot, ...parent }, () =>
    runTrial({ trialDir, workspace, prompt, arm: stockArm, limits, env }));
  const seen = JSON.parse(readFileSync(join(trialDir, "home", ".copilot", "fake-copilot-record.json"), "utf8"));
  return { root, trialDir, workspace, record, seen };
}

test("token: a normal trial passes the token to the CLI, redacts it by name, and stores it nowhere", async () => {
  const { root, record, seen } = await trial("token-normal", "Answer briefly.");
  assert.equal(record.status, "completed", record.reason);
  assert.equal(seen.tokenPresent, true);
  assert.equal(seen.tokenSha256, createHash("sha256").update(testToken).digest("hex"));
  assert.ok(record.flags.includes("--secret-env-vars=COPILOT_GITHUB_TOKEN"));
  assert.deepEqual(filesContaining([root], testToken), []);
});

test("token: a planted token in evidence marks the trial errored and is scrubbed from every stored file", async () => {
  const { root, trialDir, record } = await trial("token-planted", "FAKE:LEAK_TOKEN");
  assert.equal(record.status, "errored");
  assert.equal(record.tokenLeak, true);
  assert.match(record.reason, /COPILOT_GITHUB_TOKEN/);
  assert.deepEqual(filesContaining([root], testToken), []);
  assert.match(readFileSync(join(trialDir, "transcript.md"), "utf8"), /\[REDACTED:COPILOT_GITHUB_TOKEN\]/);
  assert.match(readFileSync(record.sessionEventsPath, "utf8"), /\[REDACTED:COPILOT_GITHUB_TOKEN\]/);
  assert.equal(JSON.parse(readFileSync(join(trialDir, "trial.json"), "utf8")).status, "errored");
});

test("token: parent GitHub credentials are never inherited by the trial", async () => {
  const { seen } = await trial("token-parent", "Answer briefly.", {}, {
    GITHUB_TOKEN: "parent-github-token",
    GH_TOKEN: "parent-gh-token",
    COPILOT_GITHUB_TOKEN: "parent-copilot-token",
  });
  assert.equal(seen.githubTokenPresent, false);
  assert.equal(seen.tokenPresent, false);
});

test("token: COPILOT_PROVIDER variables are refused so model calls stay on Copilot", async () => {
  await assert.rejects(
    trial("token-provider", "Answer briefly.", { COPILOT_GITHUB_TOKEN: testToken, COPILOT_PROVIDER_BASE_URL: "http://localhost" }),
    /COPILOT_PROVIDER_BASE_URL/,
  );
});
