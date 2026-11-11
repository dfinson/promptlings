import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runTrial } from "../../runner/index.js";
import { runSuite } from "../../runner/run.js";
import { fakeCopilot, makeFixtureSuite, makeRealHome, stockArm, tempDir, testToken, withParentEnv } from "./helpers.mjs";

const limits = { timeoutMs: 60_000, maxAiCredits: 30 };
const deliveryFailure = /session event delivery failed/;

function startTrial(label, prompt) {
  const root = tempDir(label);
  const trialDir = join(root, "trial");
  const workspace = join(root, "workspace");
  mkdirSync(workspace, { recursive: true });
  const pending = withParentEnv({ EVALS_COPILOT_BIN: fakeCopilot }, () =>
    runTrial({ trialDir, workspace, prompt, arm: stockArm, limits, env: { COPILOT_GITHUB_TOKEN: testToken } }));
  return { trialDir, pending };
}

async function trial(label, prompt) {
  const { trialDir, pending } = startTrial(label, prompt);
  const record = await pending;
  return { trialDir, record, stored: JSON.parse(readFileSync(join(trialDir, "trial.json"), "utf8")) };
}

function fixtureRun(root, suitesRoot, runId) {
  const realHome = makeRealHome(root);
  return withParentEnv(
    { HOME: realHome, USERPROFILE: realHome, COPILOT_HOME: join(realHome, ".copilot"), EVALS_COPILOT_BIN: fakeCopilot },
    () => runSuite({ suite: "fixture", stage: "smoke", artifactRoot: join(root, "artifacts"), suitesRoot, runId, env: { COPILOT_GITHUB_TOKEN: testToken } }),
  );
}

test("drain: Copilot output goes straight to files, so a runner busy with synchronous work never stalls the CLI", async () => {
  const { trialDir, pending } = startTrial("drain", "FAKE:FLOOD=3000");
  const started = join(trialDir, "home", ".copilot", "fake-flood-started");
  const deadline = Date.now() + 30_000;
  while (!existsSync(started) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
  assert.ok(existsSync(started), "the fake CLI never started streaming");
  // Synchronous work in the runner process, such as scrubbing a finished trial's evidence.
  const blockedUntil = Date.now() + 2500;
  while (Date.now() < blockedUntil);
  const record = await pending;
  assert.equal(record.status, "completed", record.reason);
  const stats = JSON.parse(readFileSync(join(record.copilotHome, "fake-flood.json"), "utf8"));
  assert.ok(stats.maxStallMs < 1000, `the CLI stalled ${stats.maxStallMs} ms while the runner was busy`);
  assert.ok(stats.maxWriteMs < 1000, `a CLI write waited ${stats.maxWriteMs} ms while the runner was busy`);
  assert.ok(statSync(join(trialDir, "stdout.txt")).size >= stats.bytes);
});

test("retry: a session event delivery failure is retried in a fresh home and every attempt is recorded", async () => {
  const { trialDir, stored } = await trial("retry-infra", "FAKE:INFRA_FAIL=2");
  assert.equal(stored.status, "completed", stored.reason);
  assert.equal(stored.attempts.length, 3);
  for (const [i, attempt] of stored.attempts.slice(0, 2).entries()) {
    assert.equal(attempt.attempt, i + 1);
    assert.equal(attempt.status, "errored");
    assert.equal(attempt.infrastructure, true);
    assert.match(attempt.reason, deliveryFailure);
    assert.equal(attempt.aiCredits, 2);
    assert.equal(attempt.dir, join(trialDir, "attempts", String(i + 1)));
    assert.ok(existsSync(join(attempt.dir, "home")));
    assert.match(readFileSync(join(attempt.dir, "stderr.txt"), "utf8"), deliveryFailure);
  }
  assert.equal(stored.attempts[2].status, "completed");
  assert.equal(stored.attempts[2].infrastructure, false);
  const finalHome = JSON.parse(readFileSync(join(stored.copilotHome, "fake-copilot-record.json"), "utf8"));
  assert.equal(finalHome.priorMarker, false, "the retry reused an earlier attempt's home");
});

test("retry: infrastructure failures stop after two retries", async () => {
  const { stored } = await trial("retry-exhausted", "FAKE:INFRA_FAIL=5");
  assert.equal(stored.status, "errored");
  assert.equal(stored.infrastructure, true);
  assert.equal(stored.attempts.length, 3);
  assert.ok(stored.attempts.every((a) => a.infrastructure && deliveryFailure.test(a.reason)));
});

test("retry: an agent-caused failure is not retried", async () => {
  const { stored } = await trial("retry-agent", "FAKE:EXIT=1");
  assert.equal(stored.status, "errored");
  assert.equal(stored.infrastructure, false);
  assert.equal(stored.attempts.length, 1);
});

test("retry: an infrastructure failure that changed the workspace is not retried", async () => {
  const { stored } = await trial("retry-dirty", "FAKE:INFRA_FAIL=1 FAKE:INFRA_DIRTY");
  assert.equal(stored.status, "errored");
  assert.ok(Array.isArray(stored.attempts), "trial.json lists its attempts");
  assert.equal(stored.attempts.length, 1);
  assert.match(stored.retryStopped, /changed the workspace/);
});

test("retry: every attempt's credits are charged to the stage budget", async () => {
  const root = tempDir("retry-budget");
  const suitesRoot = makeFixtureSuite(root, { repeats: 1, ceiling: 100, prompt: "FAKE:INFRA_FAIL=1" });
  const run = await fixtureRun(root, suitesRoot, "retry-budget");
  const [summary] = run.trials;
  assert.equal(summary.status, "completed", summary.reason);
  assert.equal(summary.attempts, 2);
  assert.equal(summary.creditsCharged, 3.5);
  assert.equal(run.budget.spent, 3.5);
  const stored = JSON.parse(readFileSync(join(summary.trialDir, "trial.json"), "utf8"));
  assert.equal(stored.attempts[0].creditsCharged, 2);
});

test("retry: a retry that could exceed the stage ceiling is not started", async () => {
  const root = tempDir("retry-ceiling");
  const suitesRoot = makeFixtureSuite(root, { repeats: 1, ceiling: 31, prompt: "FAKE:INFRA_FAIL=1" });
  const run = await fixtureRun(root, suitesRoot, "retry-ceiling");
  const [summary] = run.trials;
  assert.equal(summary.status, "errored");
  assert.equal(summary.attempts, 1);
  assert.equal(run.budget.spent, 2);
  const stored = JSON.parse(readFileSync(join(summary.trialDir, "trial.json"), "utf8"));
  assert.match(stored.retryStopped, /credit ceiling/);
});

test("concurrency: a stage's concurrency overrides the suite's, and the caller's overrides both", async () => {
  const root = tempDir("concurrency");
  const suitesRoot = makeFixtureSuite(root, { concurrency: 4, extraYaml: ["stages:", "  pilot: { split: smoke, concurrency: 2 }"] });
  const plan = (stage, concurrency) =>
    runSuite({ suite: "fixture", stage, artifactRoot: join(root, "artifacts"), suitesRoot, dryRun: true, concurrency });
  assert.equal((await plan("smoke")).concurrency, 4);
  assert.equal((await plan("pilot")).concurrency, 2);
  assert.equal((await plan("pilot", 1)).concurrency, 1);
});
