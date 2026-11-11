// Runner module for the Promptfoo harness path. It implements the shared runner contract (runTrial,
// runCopilotOnce) and enforces the stage and ceiling-group budget that bin/eval.js configures before
// the harness starts. Promptfoo imports this module in the same process, so the configuration is shared.
// Secrets such as COPILOT_GITHUB_TOKEN are configured here, in memory, so they never enter the
// Promptfoo configuration the harness writes to disk.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runTrial as baseRunTrial } from "./index.js";

export { copilotVersion, runCopilotOnce } from "./index.js";

let active = null;

/**
 * `budget` is a RunBudget; `env` holds trial env additions merged under each call's own env;
 * `onTrial(record)` observes every record, including ceiling stops.
 */
export function configureRun({ budget, env = {}, onTrial = () => {} } = {}) {
  active = { budget, env, onTrial, stopped: false };
}

export function resetRun() {
  active = null;
}

export function budgetState() {
  return active ? { stoppedByCeiling: active.stopped, budget: active.budget.summary() } : null;
}

export async function runTrial(options) {
  if (!active) return baseRunTrial(options);
  const { trialDir, arm, limits = {} } = options;
  const reservation = Math.max(30, arm.maxAiCredits ?? limits.maxAiCredits ?? 30);
  if (active.stopped || !active.budget.tryReserve(reservation)) {
    active.stopped = true;
    const record = {
      status: "stopped_by_ceiling",
      reason: `Starting this trial could exceed the stage credit ceiling (${JSON.stringify(active.budget.summary())}).`,
      trialDir,
      armId: arm.id,
      arm,
      aiCredits: null,
      usage: {},
    };
    mkdirSync(trialDir, { recursive: true });
    writeFileSync(join(trialDir, "trial.json"), `${JSON.stringify(record, null, 2)}\n`);
    active.onTrial(record);
    return record;
  }
  let record;
  let failure;
  try {
    record = await baseRunTrial({
      ...options,
      env: { ...active.env, ...(options.env ?? {}) },
      retryGate: (attempt) => active.budget.retryAttempt(reservation, attempt),
    });
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    active.budget.settleTrial(reservation, record ?? { launched: failure?.launched === true });
  }
  active.onTrial(record);
  return record;
}
