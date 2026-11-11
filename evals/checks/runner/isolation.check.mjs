import assert from "node:assert/strict";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runSuite } from "../../runner/run.js";
import { fakeCopilot, makeFixtureSuite, makeRealHome, tempDir, testToken, treeDigest, withParentEnv } from "./helpers.mjs";

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
