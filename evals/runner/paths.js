import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const evalsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = resolve(evalsRoot, "..");
// Suites are discovered under evals/suites. EVALS_SUITES_ROOT points elsewhere, for offline checks.
export const suitesRoot = process.env.EVALS_SUITES_ROOT ? resolve(process.env.EVALS_SUITES_ROOT) : join(evalsRoot, "suites");

// Run outputs and caches stay outside Git. EVALS_ARTIFACT_ROOT overrides the per-platform default.
export function artifactRoot(env = process.env) {
  if (env.EVALS_ARTIFACT_ROOT) return resolve(env.EVALS_ARTIFACT_ROOT);
  return process.platform === "win32"
    ? "C:\\agent-artifacts\\promptlings-evals"
    : join(homedir(), "agent-artifacts", "promptlings-evals");
}
