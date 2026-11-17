// An arm with seedFrom starts from another arm's finished trial on the same task and repeat.
// Both engines dispatch the source arm's trial before the seeded one, so waiting cannot deadlock.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const DONE_MARKERS = ["collected.json", "harness-error.txt"];

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Waits until the source trial has been collected and returns { trialDir, collected, record }.
 * Throws when the source did not complete, so the seeded trial is recorded as errored with that reason.
 */
export async function awaitSeed({ sourceTrialDir, sourceArm, timeoutMs = 4 * 60 * 60 * 1000, pollMs = 5000 }) {
  const started = Date.now();
  while (!DONE_MARKERS.some((f) => existsSync(join(sourceTrialDir, f)))) {
    if (Date.now() - started > timeoutMs) throw new Error(`seed: timed out waiting for ${sourceArm} trial at ${sourceTrialDir}`);
    await delay(pollMs);
  }
  const collected = readJson(join(sourceTrialDir, "collected.json"));
  const record = readJson(join(sourceTrialDir, "trial.json"));
  const status = collected?.status ?? record?.status ?? "errored";
  if (status !== "completed") {
    const reason = collected?.reason ?? record?.reason ?? "no collected result";
    throw new Error(`seed: ${sourceArm} trial did not complete (${status}: ${reason})`);
  }
  return { trialDir: sourceTrialDir, sourceArm, collected, record };
}
