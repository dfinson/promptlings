import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { RunBudget } from "./budget.js";
import { creditDerivation, runTrial } from "./index.js";
import { preflightArms, resolveArmRefs } from "./install.js";
import { resolveStage } from "./manifest.js";
import { artifactRoot as defaultArtifactRoot, suitesRoot as defaultSuitesRoot } from "./paths.js";
import { loadSuite } from "./suites.js";

function safeSegment(value) {
  return String(value).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "_";
}

function lookup(scope, path) {
  let value = scope;
  for (const part of path.split(".")) {
    if (value === null || typeof value !== "object" || !(part in value)) return undefined;
    value = value[part];
  }
  return value;
}

// Fills {{name}} placeholders from task.vars, then task fields, then `workspace`. Unknown names are errors.
export function renderPrompt(template, task, workspace) {
  const scope = { ...task, ...(task.vars ?? {}), workspace };
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, name) => {
    const value = lookup(scope, name);
    if (value === undefined || value === null) throw new Error(`Prompt placeholder {{${name}}} has no value for task ${task.id}.`);
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  });
}

export function newRunId(suite, stage) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return `${stamp}-${safeSegment(suite)}-${safeSegment(stage)}`;
}

export function trialLimits(arm, manifest) {
  return {
    timeoutMs: arm.timeoutMs ?? manifest.limits.timeoutMs,
    maxAiCredits: Math.max(30, arm.maxAiCredits ?? manifest.limits.maxAiCredits),
  };
}

/**
 * Loads a suite, resolves the stage, its arms' refs and its tasks. Shared by the native loop and the
 * Promptfoo harness path in bin/eval.js.
 */
export async function prepareStage({
  suite,
  stage,
  artifactRoot = defaultArtifactRoot(),
  runId,
  suitesRoot = defaultSuitesRoot,
  candidateRef,
  previousRef,
}) {
  artifactRoot = resolve(artifactRoot);
  const loaded = await loadSuite(suite, suitesRoot);
  const { manifest, adapter } = loaded;
  const stagePlan = resolveStage(manifest, stage);
  const { refs, arms } = resolveArmRefs(stagePlan.arms, { candidateRef, previousRef });
  const plan = { ...stagePlan, arms };
  // Every installing arm's selection is checked against its source's installer before any trial runs.
  const installArgs = preflightArms(arms, { root: artifactRoot });
  runId = runId ?? newRunId(suite, stage);
  const runDir = join(artifactRoot, runId);
  const ctx = { artifactRoot, runDir, suite: manifest, suiteDir: loaded.dir, stage, split: plan.split, stagePlan: plan };
  const tasks = await adapter.listTasks(plan.split, ctx);
  if (!Array.isArray(tasks)) throw new Error(`Suite ${suite} listTasks must return an array.`);
  for (const task of tasks) {
    if (task?.id === undefined || task?.id === null) throw new Error(`Suite ${suite} returned a task without an id.`);
  }
  return { loaded, manifest, adapter, plan, refs, installArgs, runId, runDir, artifactRoot, ctx, tasks };
}

/**
 * Runs every task x arm x repeat of a suite stage with the native runner.
 * Results go to <artifactRoot>/<runId>/run.json and trials/<task>/<arm>/<repeat>/.
 */
export async function runSuite({
  suite,
  stage,
  artifactRoot = defaultArtifactRoot(),
  runId,
  suitesRoot = defaultSuitesRoot,
  candidateRef,
  previousRef,
  env = {},
  dryRun = false,
  log = () => {},
}) {
  const prepared = await prepareStage({ suite, stage, artifactRoot, runId, suitesRoot, candidateRef, previousRef });
  const { manifest, adapter, plan, refs, installArgs, runDir, ctx, tasks } = prepared;
  ({ artifactRoot, runId } = prepared);

  const jobs = [];
  for (const task of tasks) {
    for (const arm of plan.arms) {
      // Repeats are numbered from 0, matching Promptfoo's repeatIndex on the harness path.
      for (let repeat = 0; repeat < plan.repeats; repeat += 1) {
        const rel = [safeSegment(task.id), safeSegment(arm.id), String(repeat)];
        jobs.push({ task, arm, repeat, trialDir: join(runDir, "trials", ...rel), workspace: join(runDir, "workspaces", ...rel) });
      }
    }
  }
  const run = {
    runId,
    suite,
    stage,
    split: plan.split,
    engine: "native",
    runDir,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    arms: plan.arms.map((a) => a.id),
    refs,
    installArgs,
    repeats: plan.repeats,
    taskCount: tasks.length,
    scheduled: jobs.length,
    started: 0,
    remaining: jobs.length,
    stoppedByCeiling: false,
    budget: null,
    creditDerivation,
    cliVersions: [],
    comparable: true,
    trials: [],
  };
  const save = () => writeFileSync(join(runDir, "run.json"), `${JSON.stringify(run, null, 2)}\n`);
  if (dryRun) {
    run.dryRun = true;
    run.trials = jobs.map((j) => ({ task: String(j.task.id), arm: j.arm.id, repeat: j.repeat, trialDir: j.trialDir }));
    return run;
  }
  mkdirSync(runDir, { recursive: true });
  save();

  const budget = new RunBudget({ plan, suite, artifactRoot, runId });
  const limitsFor = (arm) => trialLimits(arm, manifest);
  const trialEnv = { ...env, EVALS_ARTIFACT_ROOT: artifactRoot };
  let next = 0;
  let stopped = false;

  const runJob = async (job, reservation) => {
    const { task, arm, repeat, trialDir, workspace } = job;
    const limits = limitsFor(arm);
    let record;
    try {
      mkdirSync(workspace, { recursive: true });
      mkdirSync(trialDir, { recursive: true });
      await adapter.materialize(task, workspace, { ...ctx, arm });
      const prompt = typeof adapter.buildPrompt === "function"
        ? await adapter.buildPrompt(task, arm, manifest)
        : renderPrompt(arm.prompt ?? manifest.prompt, task, workspace);
      record = await runTrial({ trialDir, workspace, prompt, arm, limits, env: trialEnv });
    } catch (error) {
      record = { status: "errored", reason: error.message, launched: error.launched === true, trialDir, workspacePath: workspace, armId: arm.id, arm, aiCredits: null };
      writeFileSync(join(trialDir, "trial.json"), `${JSON.stringify(record, null, 2)}\n`);
    }
    budget.settleTrial(reservation, record);
    let collected = null;
    try {
      collected = (await adapter.collect(record, task, { ...ctx, arm })) ?? null;
      if (collected !== null) writeFileSync(join(trialDir, "collected.json"), `${JSON.stringify(collected, null, 2)}\n`);
    } catch (error) {
      collected = { error: error.message };
    }
    run.trials.push({
      task: String(task.id),
      arm: arm.id,
      repeat,
      trialDir,
      status: record.status,
      reason: record.reason ?? null,
      aiCredits: record.aiCredits ?? null,
      creditsCharged: record.creditsCharged,
      creditsEstimated: record.creditsEstimated,
      cliVersion: record.cliVersion ?? null,
      collectError: collected?.error ?? null,
    });
    run.remaining -= 1;
    log(`${task.id} ${arm.id} #${repeat}: ${record.status}`);
    save();
  };

  const worker = async () => {
    while (!stopped && next < jobs.length) {
      const job = jobs[next];
      const reservation = limitsFor(job.arm).maxAiCredits;
      if (!budget.tryReserve(reservation)) {
        stopped = true;
        run.stoppedByCeiling = true;
        break;
      }
      next += 1;
      run.started += 1;
      await runJob(job, reservation);
    }
  };
  await Promise.all(Array.from({ length: Math.min(manifest.concurrency, jobs.length || 1) }, worker));

  finishRun(run, budget, manifest);
  save();
  return run;
}

/** Sorts trials and records the budget, CLI versions and comparability. Shared with the harness path. */
export function finishRun(run, budget, manifest) {
  run.trials.sort((a, b) => a.trialDir.localeCompare(b.trialDir));
  run.budget = budget.summary();
  run.cliVersions = [...new Set(run.trials.map((t) => t.cliVersion).filter(Boolean))].sort();
  if (run.cliVersions.length > 1 && !manifest.allowMixedCliVersions) {
    run.comparable = false;
    run.comparabilityReason = `Arms ran on different Copilot CLI versions: ${run.cliVersions.join(", ")}.`;
  }
  run.finishedAt = new Date().toISOString();
  return run;
}
