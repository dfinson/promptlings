#!/usr/bin/env node
// Evals entry point: npm --prefix evals run eval -- <suite> --stage <stage> [options]
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { hasComparisons, reportOptions, stageAnalysis } from "../runner/analysis.js";
import { RunBudget } from "../runner/budget.js";
import { tokenVariable } from "../runner/env.js";
import { creditDerivation } from "../runner/index.js";
import { loadManifest } from "../runner/manifest.js";
import { artifactRoot as defaultArtifactRoot, evalsRoot, suitesRoot } from "../runner/paths.js";
import { finishRun, prepareStage, runSuite } from "../runner/run.js";
import { discoverSuites, loadSuite } from "../runner/suites.js";

const usage = `Usage: npm --prefix evals run eval -- <suite> --stage <stage> [options]

Options:
  --stage <name>          Stage (or split) to run. Required unless --list.
  --artifact-root <dir>   Run output root. Default: EVALS_ARTIFACT_ROOT, else
                          C:\\agent-artifacts\\promptlings-evals on Windows and
                          ~/agent-artifacts/promptlings-evals elsewhere.
  --run-id <id>           Run identifier. Default: <suite>-<stage>-<timestamp>.
  --candidate-ref <ref>   Git ref installed for arms with ref "candidate". Default: HEAD.
  --previous-ref <ref>    Git ref installed for arms with ref "previous". Required when used.
  --engine <name>         harness (Promptfoo, default when installed) or native.
  --diagnostic            Ask the suite's scoreRun for its diagnostic variants as well.
  --dry-run               Plan the trials without running Copilot.
  --list                  List suites and their stages.

Environment:
  COPILOT_GITHUB_TOKEN    Copilot credential. Falls back to \`gh auth token\`.
  EVALS_COPILOT_BIN       Copilot CLI binary. Default: copilot.
  EVALS_ARTIFACT_ROOT     Default artifact root.`;

const harnessPath = join(evalsRoot, "providers", "harness.js");
const budgetedUrl = pathToFileURL(join(evalsRoot, "runner", "budgeted.js")).href;

function listSuites() {
  for (const name of discoverSuites(suitesRoot)) {
    const manifest = loadManifest(join(suitesRoot, name, "suite.yaml"), { suiteName: name });
    const stages = manifest.stages ? Object.keys(manifest.stages) : Object.keys(manifest.splits);
    console.log(`${name}: ${stages.join(", ")}`);
  }
}

function resolveToken() {
  if (process.env[tokenVariable]) return process.env[tokenVariable];
  try {
    const token = execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (token) return token;
  } catch {
    // gh is missing or signed out; reported below.
  }
  throw new Error(`No Copilot credential. Set ${tokenVariable} or sign in with \`gh auth login\`.`);
}

function trialSummary(record, runDir) {
  const parts = relative(join(runDir, "trials"), record.trialDir).split(sep);
  return {
    task: parts[0],
    arm: record.armId ?? record.arm?.id ?? parts[1],
    repeat: parts[2] === undefined || parts[2] === "" ? null : Number(parts[2]),
    trialDir: record.trialDir,
    status: record.status,
    reason: record.reason ?? null,
    aiCredits: record.aiCredits ?? null,
    cliVersion: record.cliVersion ?? null,
  };
}

async function runWithHarness(options, token) {
  const prepared = await prepareStage(options);
  const { manifest, plan, refs, runId, runDir, artifactRoot, tasks, loaded } = prepared;
  const run = {
    runId,
    suite: options.suite,
    stage: options.stage,
    split: plan.split,
    engine: "harness",
    runDir,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    arms: plan.arms.map((a) => a.id),
    refs,
    repeats: plan.repeats,
    taskCount: tasks.length,
    scheduled: tasks.length * plan.arms.length * plan.repeats,
    stoppedByCeiling: false,
    budget: null,
    creditDerivation,
    cliVersions: [],
    comparable: true,
    trials: [],
  };
  if (options.dryRun) return { run: { ...run, dryRun: true }, adapter: prepared.adapter, manifest };

  const budget = new RunBudget({ plan, suite: options.suite, artifactRoot, runId });
  const budgeted = await import(budgetedUrl);
  budgeted.configureRun({
    budget,
    env: { [tokenVariable]: token },
    onTrial: (record) => run.trials.push(trialSummary(record, runDir)),
  });
  const { runHarness } = await import(pathToFileURL(harnessPath).href);
  try {
    await runHarness({
      suiteName: options.suite,
      suite: manifest,
      prompt: manifest.prompt,
      arms: plan.arms,
      tasks,
      split: plan.split,
      adapterModule: join(loaded.dir, "adapter.js"),
      runnerModule: budgetedUrl,
      runDir,
      runId,
      artifactRoot,
      scorers: manifest.scorers,
      grader: manifest.grader,
      limits: manifest.limits,
      repeats: plan.repeats,
      concurrency: manifest.concurrency,
      analysis: stageAnalysis(manifest, options.stage),
      context: { stage: options.stage, refs },
    });
  } finally {
    run.stoppedByCeiling = budgeted.budgetState()?.stoppedByCeiling ?? false;
    budgeted.resetRun();
  }
  finishRun(run, budget, manifest);
  return { run, adapter: prepared.adapter, manifest };
}

async function importEvals(...segments) {
  return import(pathToFileURL(join(evalsRoot, ...segments)).href);
}

// Calls the suite's scoreRun when exported. Returns its result, or null; a failure rejects the run.
async function scoreStage(adapter, run, manifest, diagnostic, token, artifactRoot) {
  if (typeof adapter.scoreRun !== "function") return null;
  try {
    const result = await adapter.scoreRun({
      runDir: run.runDir,
      suite: manifest,
      diagnostic,
      artifactRoot,
      env: { [tokenVariable]: token },
    });
    writeFileSync(join(run.runDir, "score-run.json"), `${JSON.stringify(result ?? null, null, 2)}\n`);
    const rejected = Array.isArray(result?.rejected) ? result.rejected : [];
    if (rejected.length) {
      run.rejected = true;
      run.rejectionReasons = rejected.map((r) => (typeof r === "string" ? r : r.reason ?? JSON.stringify(r)));
    }
    return result ?? null;
  } catch (error) {
    run.rejected = true;
    run.rejectionReasons = [`scoreRun failed: ${error.message}`];
    return null;
  }
}

// Merges scoreRun into scores.json and writes the report. Harness runs only: they produce scores.json.
async function reportStage(run, manifest, scoreResult, usable) {
  const scoresFile = join(run.runDir, "scores.json");
  if (run.engine !== "harness" || !existsSync(scoresFile)) return;
  if (scoreResult) {
    try {
      const { applyScoreRun } = await importEvals("scoring", "scores.js");
      applyScoreRun(run.runDir, scoreResult);
    } catch (error) {
      run.rejected = true;
      run.rejectionReasons = [...(run.rejectionReasons ?? []), `merging scoreRun into scores.json failed: ${error.message}`];
      return;
    }
  }
  if (!usable()) {
    run.report = { skipped: "the run is not usable for a verdict" };
    return;
  }
  const options = reportOptions(manifest, run.stage, run.arms);
  if (!hasComparisons(options)) {
    run.report = { skipped: "no declared comparison has both arms in this stage" };
    return;
  }
  const { writeReport } = await importEvals("report", "index.js");
  const { jsonPath, mdPath } = writeReport(run.runDir, join(run.runDir, "report"), options);
  run.report = { json: jsonPath, markdown: mdPath };
}
async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      stage: { type: "string" },
      "artifact-root": { type: "string" },
      "run-id": { type: "string" },
      "candidate-ref": { type: "string" },
      "previous-ref": { type: "string" },
      engine: { type: "string" },
      diagnostic: { type: "boolean", default: false },
      "dry-run": { type: "boolean", default: false },
      list: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (values.help) return console.log(usage);
  if (values.list) return listSuites();
  const [suite] = positionals;
  if (!suite || !values.stage || positionals.length > 1) throw new Error(usage);

  const engine = values.engine ?? (existsSync(harnessPath) ? "harness" : "native");
  if (!["harness", "native"].includes(engine)) throw new Error(`Unknown engine ${engine}. Use harness or native.`);
  if (engine === "harness" && !existsSync(harnessPath)) throw new Error(`The harness engine needs ${harnessPath}.`);

  const dryRun = values["dry-run"];
  const token = dryRun ? null : resolveToken();
  const artifactRoot = resolve(values["artifact-root"] ?? defaultArtifactRoot());
  const options = {
    suite,
    stage: values.stage,
    artifactRoot,
    runId: values["run-id"],
    candidateRef: values["candidate-ref"],
    previousRef: values["previous-ref"],
    dryRun,
  };

  let run;
  let adapter;
  let manifest;
  if (engine === "harness") {
    ({ run, adapter, manifest } = await runWithHarness(options, token));
  } else {
    ({ adapter, manifest } = await loadSuite(suite, suitesRoot));
    run = await runSuite({ ...options, env: token ? { [tokenVariable]: token } : {}, log: (line) => console.log(line) });
  }

  if (dryRun) {
    console.log(JSON.stringify(run, null, 2));
    return;
  }
  const scoreResult = await scoreStage(adapter, run, manifest, values.diagnostic, token, artifactRoot);
  const problemsOf = () => [
    run.stoppedByCeiling && "the stage credit ceiling stopped the run before every trial started",
    run.comparable === false && run.comparabilityReason,
    run.rejected && `the suite rejected the run: ${run.rejectionReasons.join("; ")}`,
  ].filter(Boolean);
  await reportStage(run, manifest, scoreResult, () => problemsOf().length === 0);
  writeFileSync(join(run.runDir, "run.json"), `${JSON.stringify(run, null, 2)}\n`);

  const counts = run.trials.reduce((acc, t) => ({ ...acc, [t.status]: (acc[t.status] ?? 0) + 1 }), {});
  console.log(`Run ${run.runId}: ${JSON.stringify(counts)}; credits ${JSON.stringify(run.budget)}`);
  console.log(`Results: ${join(run.runDir, "run.json")}`);
  if (run.report?.markdown) console.log(`Report: ${run.report.markdown}`);
  const problems = problemsOf();
  if (problems.length) {
    console.error(`Run ${run.runId} is not usable for a verdict: ${problems.join("; ")}.`);
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
