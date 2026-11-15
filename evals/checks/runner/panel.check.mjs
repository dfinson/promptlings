import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { fakeCopilot, makeFixtureSuite, makeRealHome, stockArm, tempDir, testToken } from "./helpers.mjs";

const evalCli = fileURLToPath(new URL("../../bin/eval.js", import.meta.url));

// A stand-in for the harness panel module: it logs each call's inputs and fails on request.
const fakePanel = `
import { appendFileSync } from "node:fs";
export async function runPanelAnalysis(options) {
  appendFileSync(process.env.FAKE_PANEL_LOG, JSON.stringify({
    ...options,
    diffFilesFor: typeof options.diffFilesFor === "function" ? options.diffFilesFor("task-1") : options.diffFilesFor,
    contextFor: typeof options.contextFor === "function" ? options.contextFor({ task: "task-1" }) : options.contextFor,
  }) + "\\n");
  if (process.env.FAKE_PANEL_FAIL) throw new Error("panelist quota exhausted");
  return { outDir: options.runDir + "/panel" };
}
`;

const panelYaml = [
  "analysis:",
  "  comparisons:",
  "    - [treated, stock]",
  "panel:",
  "  requireFrozen: false",
];

// The #101 panelInputs shape: requireFrozen is a function of the stage, and diffFilesFor throws for an unmaterialized task.
const panelInputs = [
  "export async function panelInputs(runDir, suite, { artifactRoot }) {",
  "  return {",
  '    goldenDir: join(runDir, "golden-" + suite.name),',
  '    diffFilesFor: (task) => { if (process.env.FAKE_DIFF_MISSING) throw new Error("no materialized diff for " + task); return [task + ".js"]; },',
  "    taxonomy: { defect_class: ['logic'] },",
  '    taxonomyPath: join(artifactRoot, "taxonomy.yaml"),',
  "    namedInAdvance: ['defect_class:logic'],",
  '    requireFrozen: (stage) => stage === "smoke",',
  '    contextFor: (item) => "hunk for " + item.task,',
  '    judgeRoot: join(runDir, "judge"),',
  "  };",
  "}",
];

function runCli(root, { declared, fail = false, diffMissing = false }) {
  const panelFile = join(root, "fake-panel.mjs");
  writeFileSync(panelFile, fakePanel);
  const log = join(root, "panel-calls.jsonl");
  const suitesRoot = makeFixtureSuite(root, {
    repeats: 1,
    arms: [stockArm, { ...stockArm, id: "treated" }],
    extraYaml: declared ? panelYaml : [],
    extraAdapter: panelInputs,
  });
  const realHome = makeRealHome(root);
  const artifacts = join(root, "artifacts");
  const result = spawnSync(process.execPath, [evalCli, "fixture", "--stage", "smoke", "--engine", "native", "--artifact-root", artifacts, "--run-id", "panel"], {
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: realHome,
      USERPROFILE: realHome,
      COPILOT_HOME: join(realHome, ".copilot"),
      EVALS_SUITES_ROOT: suitesRoot,
      EVALS_COPILOT_BIN: fakeCopilot,
      COPILOT_GITHUB_TOKEN: testToken,
      EVALS_PANEL_MODULE: panelFile,
      FAKE_PANEL_LOG: log,
      ...(fail ? { FAKE_PANEL_FAIL: "1" } : {}),
      ...(diffMissing ? { FAKE_DIFF_MISSING: "1" } : {}),
    },
  });
  const runDir = join(artifacts, "panel");
  const calls = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : [];
  const run = existsSync(join(runDir, "run.json")) ? JSON.parse(readFileSync(join(runDir, "run.json"), "utf8")) : null;
  return { result, runDir, artifacts, calls, run };
}

test("panel: a suite that declares panel: runs the analysis panel once with its inputs", () => {
  const root = tempDir("panel-declared");
  const { result, runDir, artifacts, calls, run } = runCli(root, { declared: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(calls.length, 1, "called once");
  assert.deepEqual(calls[0], {
    runDir,
    arms: ["stock", "treated"],
    comparisons: [["stock", "treated"]],
    taxonomy: { defect_class: ["logic"] },
    taxonomyPath: join(artifacts, "taxonomy.yaml"),
    namedInAdvance: ["defect_class:logic"],
    requireFrozen: true,
    goldenDir: join(runDir, "golden-fixture"),
    diffFilesFor: ["task-1.js"],
    contextFor: "hunk for task-1",
    judgeRoot: join(runDir, "judge"),
  });
  assert.equal(run.panel.ok, true);
});

test("panel: verified metrics join the primary score entry of the same task, arm and repeat", async () => {
  const { mergePanelMetrics } = await import("../../runner/analysis.js");
  const scoreResult = { entries: [
    { task: "t1", arm: "stock", repeat: 0, variant: "primary", metrics: { precision: 0.5 } },
    { task: "t1", arm: "stock", repeat: 0, variant: "strict", metrics: { precision: 0.4 } },
    { task: "t1", arm: "hve full", repeat: 1, metrics: { precision: 1 } },
    { task: "t2", arm: "stock", repeat: 0, variant: "primary", metrics: { precision: 0 } },
  ] };
  const verified = { verified: 3, verified_precision: 0.75, wrong: 1 };
  const merged = mergePanelMetrics(scoreResult, [
    { task: "t1", arm: "stock", repeat: 0, metrics: verified },
    { task: "t1", arm: "hve_full", repeat: 1, metrics: { verified: 1, verified_precision: 1, wrong: 0 } },
  ]);
  assert.equal(merged, 2);
  assert.deepEqual(scoreResult.entries[0].metrics, { precision: 0.5, ...verified });
  assert.deepEqual(scoreResult.entries[1].metrics, { precision: 0.4 }, "other variants are untouched");
  assert.equal(scoreResult.entries[2].metrics.verified, 1, "arms match by trial directory segment");
  assert.deepEqual(scoreResult.entries[3].metrics, { precision: 0 }, "a trial the panel did not see keeps its metrics");
});

test("panel: a suite without panel: never calls the analysis panel", () => {
  const root = tempDir("panel-absent");
  const { result, calls, run } = runCli(root, { declared: false });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(calls.length, 0);
  assert.equal(run.panel, undefined);
});

test("panel: a panel failure is recorded in run.json and does not fail the stage", () => {
  const root = tempDir("panel-failure");
  const { result, calls, run } = runCli(root, { declared: true, fail: true });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(calls.length, 1);
  assert.deepEqual(run.panel, { ok: false, error: "panelist quota exhausted" });
  assert.deepEqual(run.trials.map((t) => t.status), ["completed", "completed"]);
});

test("panel: a task without a materialized diff is recorded as a panel failure and does not fail the stage", () => {
  const root = tempDir("panel-no-diff");
  const { result, run } = runCli(root, { declared: true, diffMissing: true });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(run.panel, { ok: false, error: "no materialized diff for task-1" });
});

test("panel: a panel failure is written into the stage report", async () => {
  const { notePanelInReport } = await import("../../runner/analysis.js");
  assert.equal(typeof notePanelInReport, "function", "analysis.js exports notePanelInReport");
  const root = tempDir("panel-report");
  const json = join(root, "report.json");
  const markdown = join(root, "report.md");
  writeFileSync(json, JSON.stringify({ verdicts: [] }));
  writeFileSync(markdown, "# Report\n");
  notePanelInReport({ panel: { ok: false, error: "panelist quota exhausted" }, report: { json, markdown } });
  assert.deepEqual(JSON.parse(readFileSync(json, "utf8")), { verdicts: [], panel: { ok: false, error: "panelist quota exhausted" } });
  assert.match(readFileSync(markdown, "utf8"), /## Analysis panel\n\nThe analysis panel failed: panelist quota exhausted/);
});
