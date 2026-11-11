import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runTrial } from "../../runner/index.js";
import { runSuite } from "../../runner/run.js";
import { fakeCopilot, makeFixtureSuite, makeRealHome, stockArm, tempDir, testToken, treeDigest, withParentEnv } from "./helpers.mjs";

const inside = (child, parent) => realpathSync(child).startsWith(realpathSync(parent));

test("isolation: two trials of the same input get distinct homes and workspaces and leave the real Copilot home untouched", async () => {
  const root = tempDir("isolation");
  const realHome = makeRealHome(root);
  const before = treeDigest(realHome);
  const suitesRoot = makeFixtureSuite(root, { repeats: 2 });

  const run = await withParentEnv(
    {
      HOME: realHome,
      USERPROFILE: realHome,
      COPILOT_HOME: join(realHome, ".copilot"),
      XDG_CONFIG_HOME: join(realHome, ".config"),
      APPDATA: join(realHome, "AppData", "Roaming"),
      LOCALAPPDATA: join(realHome, "AppData", "Local"),
      EVALS_COPILOT_BIN: fakeCopilot,
    },
    () => runSuite({
      suite: "fixture",
      stage: "smoke",
      artifactRoot: join(root, "artifacts"),
      runId: "isolation-run",
      suitesRoot,
      env: { COPILOT_GITHUB_TOKEN: testToken },
    }),
  );

  assert.equal(run.trials.length, 2);
  const records = run.trials.map((t) => JSON.parse(readFileSync(join(t.trialDir, "trial.json"), "utf8")));
  for (const record of records) assert.equal(record.status, "completed", record.reason);

  const [a, b] = records;
  assert.notEqual(a.trialDir, b.trialDir);
  assert.notEqual(a.homePath, b.homePath);
  assert.notEqual(a.workspacePath, b.workspacePath);
  assert.ok(!inside(a.homePath, b.homePath) && !inside(b.homePath, a.homePath));
  assert.ok(!inside(a.workspacePath, b.workspacePath) && !inside(b.workspacePath, a.workspacePath));

  for (const record of records) {
    const seen = JSON.parse(readFileSync(join(record.homePath, ".copilot", "fake-copilot-record.json"), "utf8"));
    assert.equal(realpathSync(seen.HOME), realpathSync(record.homePath));
    assert.equal(realpathSync(seen.USERPROFILE), realpathSync(record.homePath));
    assert.ok(inside(seen.COPILOT_HOME, record.homePath), "COPILOT_HOME must be inside the trial home");
    assert.ok(inside(seen.APPDATA, record.homePath), "APPDATA must be inside the trial home");
    assert.ok(inside(seen.XDG_CONFIG_HOME, record.homePath), "XDG_CONFIG_HOME must be inside the trial home");
    assert.equal(realpathSync(seen.cwd), realpathSync(record.workspacePath));
    assert.equal(seen.priorMarker, false, "each trial must start from a fresh Copilot home");
    assert.deepEqual(seen.agents, []);
    assert.ok(existsSync(join(record.workspacePath, "fake-output.txt")));
    assert.ok(inside(record.copilotHome, record.homePath), "copilotHome must be inside the trial home");
    assert.ok(record.sessionEventsPath && inside(record.sessionEventsPath, record.copilotHome), "session log must be retained in the trial home");
  }

  assert.deepEqual(treeDigest(realHome), before, "the real Copilot home must be byte-identical after the run");
  assert.ok(!existsSync(join(realHome, ".copilot", "fake-copilot-marker")));
});

test("isolation: sandboxed git skips the unreadable system config and the container temp under the real Packages folder stays reachable", async () => {
  const root = tempDir("isolation-sandbox");
  const realHome = makeRealHome(root);
  const realPackages = join(realHome, "AppData", "Local", "Packages");
  mkdirSync(join(realPackages, "sandbox.existing", "AC", "Temp"), { recursive: true });
  writeFileSync(join(realPackages, "sandbox.existing", "AC", "Temp", "keep.txt"), "keep\n");
  const before = treeDigest(realHome);
  const trialDir = join(root, "trial");
  const workspace = join(root, "workspace");
  mkdirSync(workspace, { recursive: true });

  const record = await withParentEnv(
    { LOCALAPPDATA: join(realHome, "AppData", "Local"), EVALS_COPILOT_BIN: fakeCopilot },
    () => runTrial({ trialDir, workspace, prompt: "Answer briefly.", arm: stockArm, limits: { timeoutMs: 60_000, maxAiCredits: 30 }, env: { COPILOT_GITHUB_TOKEN: testToken } }),
  );
  assert.equal(record.status, "completed", record.reason);
  const seen = JSON.parse(readFileSync(join(record.homePath, ".copilot", "fake-copilot-record.json"), "utf8"));
  assert.equal(seen.GIT_CONFIG_NOSYSTEM, "1");
  assert.ok(inside(seen.LOCALAPPDATA, record.homePath), "LOCALAPPDATA must stay inside the trial home");

  // The Windows sandbox puts its AppContainer temp under %LOCALAPPDATA%\Packages, which only the real profile has.
  const link = join(seen.LOCALAPPDATA, "Packages");
  if (process.platform === "win32") {
    assert.ok(lstatSync(link).isSymbolicLink(), "Packages must be a junction to the real folder");
    assert.equal(realpathSync(link), realpathSync(realPackages));
  } else {
    assert.equal(existsSync(link), false);
  }
  rmSync(trialDir, { recursive: true, force: true });
  assert.deepEqual(treeDigest(realHome), before, "removing the trial must leave the real Packages folder intact");
});
