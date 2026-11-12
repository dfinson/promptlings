import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { hasComparisons, reportOptions } from "../../runner/analysis.js";
import { validateManifest } from "../../runner/manifest.js";
import { runSuite } from "../../runner/run.js";
import { fakeCopilot, filesContaining, makeFixtureSuite, makeRealHome, stockArm, tempDir, testToken, withParentEnv } from "./helpers.mjs";

const evalCli = fileURLToPath(new URL("../../bin/eval.js", import.meta.url));

function fixtureRun(root, suitesRoot, options) {
  const realHome = makeRealHome(root);
  return withParentEnv(
    { HOME: realHome, USERPROFILE: realHome, COPILOT_HOME: join(realHome, ".copilot"), EVALS_COPILOT_BIN: fakeCopilot },
    () => runSuite({ suite: "fixture", artifactRoot: join(root, "artifacts"), suitesRoot, env: { COPILOT_GITHUB_TOKEN: testToken }, ...options }),
  );
}

test("ceiling: a trial whose cap no longer fits under the stage ceiling is not started", async () => {
  const root = tempDir("ceiling");
  const suitesRoot = makeFixtureSuite(root, { repeats: 3, concurrency: 2, ceiling: 70, maxAiCredits: 40 });
  const run = await fixtureRun(root, suitesRoot, { stage: "smoke", runId: "ceiling-run" });
  assert.equal(run.trials.length, 1);
  assert.equal(run.stoppedByCeiling, true);
  assert.equal(run.budget.ceiling, 70);
  assert.equal(run.creditDerivation, "usage.totalNanoAiu / 1e9");
  const stored = JSON.parse(readFileSync(join(root, "artifacts", "ceiling-run", "run.json"), "utf8"));
  assert.equal(stored.stoppedByCeiling, true);
});

test("ceiling: stages sharing a ceilingGroup count spend from earlier runs in the group ledger", async () => {
  const root = tempDir("ceiling-group");
  const suitesRoot = makeFixtureSuite(root, {
    repeats: 1,
    extraYaml: [
      "stages:",
      "  pilot-a: { split: smoke, ceilingGroup: pilot, maxAiCredits: 100 }",
      "  pilot-b: { split: smoke, ceilingGroup: pilot, maxAiCredits: 100 }",
    ],
  });
  const first = await fixtureRun(root, suitesRoot, { stage: "pilot-a", runId: "group-a" });
  assert.equal(first.trials.length, 1);
  const ledgerFile = join(root, "artifacts", "ceilings", "fixture", "pilot.json");
  const ledger = JSON.parse(readFileSync(ledgerFile, "utf8"));
  assert.equal(ledger.runs["group-a"].spent, 1.5);

  ledger.runs["earlier-run"] = { stage: "pilot-a", spent: 80 };
  mkdirSync(join(root, "artifacts", "ceilings", "fixture"), { recursive: true });
  writeFileSync(ledgerFile, JSON.stringify(ledger));
  const second = await fixtureRun(root, suitesRoot, { stage: "pilot-b", runId: "group-b" });
  assert.equal(second.trials.length, 0);
  assert.equal(second.stoppedByCeiling, true);
  assert.equal(second.budget.group.priorSpent, 81.5);
});

test("ceiling: trials that never launch Copilot charge nothing and release their reservation", async () => {
  const root = tempDir("ceiling-unlaunched");
  const suitesRoot = makeFixtureSuite(root, { repeats: 3, ceiling: 100, maxAiCredits: 40 });
  const run = await withParentEnv({ EVALS_COPILOT_BIN: join(root, "missing-copilot.mjs") }, () =>
    runSuite({ suite: "fixture", stage: "smoke", artifactRoot: join(root, "artifacts"), suitesRoot, runId: "unlaunched", env: { COPILOT_GITHUB_TOKEN: testToken } }));
  assert.equal(run.trials.length, 3, "a reservation held by an unlaunched trial must not block later trials");
  assert.equal(run.stoppedByCeiling, false);
  assert.ok(run.trials.every((t) => t.status === "errored" && t.creditsCharged === 0 && t.creditsEstimated === false));
  assert.equal(run.budget.spent, 0);
  assert.equal(run.budget.estimatedTrials, 0);
});

test("ceiling: a launched trial without usage data charges its full cap and is flagged as estimated", async () => {
  const root = tempDir("ceiling-no-usage");
  const suitesRoot = makeFixtureSuite(root, { repeats: 1, ceiling: 100, maxAiCredits: 40, prompt: "FAKE:NO_USAGE {{title}}" });
  const run = await fixtureRun(root, suitesRoot, { stage: "smoke", runId: "no-usage" });
  assert.equal(run.trials.length, 1);
  assert.equal(run.trials[0].aiCredits, null);
  assert.equal(run.trials[0].creditsCharged, 40);
  assert.equal(run.trials[0].creditsEstimated, true);
  assert.equal(run.budget.spent, 40);
  assert.equal(run.budget.estimatedTrials, 1);
});

test("ceiling: a launched trial with usage charges its derived credits, not its cap", async () => {
  const root = tempDir("ceiling-usage");
  const suitesRoot = makeFixtureSuite(root, { repeats: 2, ceiling: 100, maxAiCredits: 40 });
  const run = await fixtureRun(root, suitesRoot, { stage: "smoke", runId: "usage" });
  assert.deepEqual(run.trials.map((t) => [t.status, t.creditsCharged, t.creditsEstimated]), [["completed", 1.5, false], ["completed", 1.5, false]]);
  assert.equal(run.budget.spent, 3);
});

test("refs: an arm on the previous ref is refused without --previous-ref", async () => {
  const root = tempDir("refs");
  const suitesRoot = makeFixtureSuite(root, { arms: [stockArm, { ...stockArm, id: "previous", ref: "previous", selection: { agents: [], skills: [] } }] });
  await assert.rejects(fixtureRun(root, suitesRoot, { stage: "smoke", runId: "refs-run" }), /previous-ref/);
});

test("manifest: an llm-rubric scorer without a rubric is rejected", () => {
  const manifest = {
    name: "fixture",
    taskSource: { type: "fixtures" },
    splits: { smoke: {} },
    arms: [{ id: "stock", ref: null, model: "m", reasoningEffort: "medium" }],
    prompt: "p",
    limits: { timeoutMs: 1000, maxAiCredits: 30 },
    repeats: 1,
    concurrency: 1,
    scorers: [{ id: "judge", kind: "llm-rubric", primary: true }],
    license: "fixture",
  };
  const { errors } = validateManifest(manifest, { suiteName: "fixture" });
  assert.deepEqual(errors, ["scorers[0].rubric: is required for llm-rubric scorers"]);
});

test("cli: a native run records refs and the credit derivation, and a scoreRun rejection fails the run", () => {
  const root = tempDir("cli");
  const realHome = makeRealHome(root);
  const suitesRoot = makeFixtureSuite(root, {
    repeats: 1,
    extraAdapter: [
      'export async function scoreRun({ runDir, suite }) {',
      '  writeFileSync(join(runDir, "scored.txt"), suite.name);',
      '  return { entries: [], rejected: [{ arm: "stock", reason: "judge aggregate mismatch" }] };',
      '}',
    ],
  });
  const artifacts = join(root, "artifacts");
  const result = spawnSync(process.execPath, [evalCli, "fixture", "--stage", "smoke", "--engine", "native", "--artifact-root", artifacts, "--run-id", "cli-run"], {
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: realHome,
      USERPROFILE: realHome,
      COPILOT_HOME: join(realHome, ".copilot"),
      EVALS_SUITES_ROOT: suitesRoot,
      EVALS_COPILOT_BIN: fakeCopilot,
      COPILOT_GITHUB_TOKEN: testToken,
    },
  });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /judge aggregate mismatch/);
  const run = JSON.parse(readFileSync(join(artifacts, "cli-run", "run.json"), "utf8"));
  assert.equal(run.engine, "native");
  assert.deepEqual(run.refs, { stock: null });
  assert.equal(run.creditDerivation, "usage.totalNanoAiu / 1e9");
  assert.deepEqual(run.trials.map((t) => t.status), ["completed"]);
  assert.equal(run.rejected, true);
  assert.ok(existsSync(join(artifacts, "cli-run", "scored.txt")));
  assert.deepEqual(filesContaining([artifacts], testToken), []);
});
test("report: options put the baseline first, keep only stage arms and pass the stage analysis through", () => {
  const manifest = {
    analysis: { primaryMetric: "recall", guardrail: "precision", familywiseAlpha: 0.05, comparisons: [["a", "stock"], ["b", "stock"]] },
    stages: { pilot: { analysis: { verdict: false, minPairedN: 12 } }, solo: {} },
  };
  const pilot = reportOptions(manifest, "pilot", ["stock", "a"]);
  assert.deepEqual(pilot.comparisons, [["stock", "a"]]);
  assert.deepEqual(pilot.primary, ["recall"]);
  assert.deepEqual(pilot.guardrail, ["precision"]);
  assert.equal(pilot.alpha, 0.05);
  assert.equal(pilot.plannedN, undefined);
  assert.deepEqual(pilot.analysis, { verdict: false, minPairedN: 12 });
  const solo = reportOptions(manifest, "solo", ["previous"]);
  assert.equal(hasComparisons(solo), false);
  assert.equal(solo.analysis, undefined);
});
const reportDefaults = ["id", "label", "ref", "selection", "agent"];
const declaredManifest = {
  analysis: { comparisons: [["hve", "stock"], ["odd", "stock"]], declaredDifferences: ["plugin", "external", "promptPreamble", "qualificationChecks"] },
  stages: { full: {}, narrow: { analysis: { declaredDifferences: ["external"] } } },
};
test("declared differences: the report gets its defaults plus the suite list, and a stage list replaces the suite's", () => {
  const full = reportOptions(declaredManifest, "full", ["stock", "hve"], reportDefaults);
  assert.deepEqual(full.declaredDifferences, [...reportDefaults, "plugin", "external", "promptPreamble", "qualificationChecks"]);
  const narrow = reportOptions(declaredManifest, "narrow", ["stock", "hve"], reportDefaults);
  assert.deepEqual(narrow.declaredDifferences, [...reportDefaults, "external"]);
  const plain = reportOptions({ analysis: {} }, "full", ["stock"], reportDefaults);
  assert.deepEqual(plain.declaredDifferences, reportDefaults);
  assert.throws(() => reportOptions({ analysis: { declaredDifferences: "plugin" } }, "full", [], reportDefaults), /declaredDifferences/);
});
const reportModule = fileURLToPath(new URL("../../report/index.js", import.meta.url));
test(
  "declared differences: arms that differ only in a declared extra field are not confounded; an undeclared field still confounds",
  // The report module comes from the harness lane; this runs wherever it is merged in.
  { skip: !existsSync(reportModule) && "evals/report/index.js (harness lane) is not in this checkout" },
  async () => {
    const { buildReport, DEFAULT_DECLARED_DIFFERENCES } = await import(new URL("../../report/index.js", import.meta.url).href);
    const plugin = { repo: "microsoft/hve-core", commit: "299c0b68741d9bc08106b132043724c23166e2a4" };
    const arms = {
      stock: { id: "stock", selection: null, sandbox: "workspace" },
      hve: { id: "hve", selection: null, sandbox: "workspace", plugin, external: true },
      odd: { id: "odd", selection: null, sandbox: "none", plugin },
    };
    const tasks = ["t1", "t2", "t3", "t4"];
    const trials = Object.keys(arms).flatMap((arm, a) =>
      tasks.map((task, i) => ({ task, arm, repeat: 0, status: "completed", invalidated: false, metrics: { recall: 0.3 + i * 0.1 + a * 0.05 } })),
    );
    const scores = { schema: 1, runId: "r", runDir: "/r", context: {}, arms, metrics: { primary: ["recall"] }, trials };
    const options = reportOptions(declaredManifest, "full", Object.keys(arms), DEFAULT_DECLARED_DIFFERENCES);
    const report = buildReport(scores, options);
    const hve = report.comparisons.find((c) => c.b === "hve");
    const odd = report.comparisons.find((c) => c.b === "odd");
    assert.ok(hve && odd, "the stock-vs-hve and stock-vs-odd comparisons are reported");
    assert.equal(hve.a, "stock");
    assert.equal(hve.confounded, false, `hve differs only in declared fields: ${JSON.stringify(hve.confoundedBy)}`);
    assert.equal(odd.confounded, true);
    assert.deepEqual(odd.confoundedBy, ["arm.sandbox"]);
  },
);