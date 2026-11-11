// Resolves the module implementing the shared runner contract (runTrial, runCopilotOnce).
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_RUNNER_MODULE = new URL('../runner/index.js', import.meta.url).href;

export function runnerModuleUrl(explicit) {
  const spec = explicit || process.env.EVALS_RUNNER_MODULE;
  if (!spec) return DEFAULT_RUNNER_MODULE;
  if (spec.startsWith('file:')) return spec;
  return pathToFileURL(path.resolve(spec)).href;
}

export async function loadRunner(explicit) {
  const url = runnerModuleUrl(explicit);
  const mod = await import(url);
  for (const name of ['runTrial', 'runCopilotOnce']) {
    if (typeof mod[name] !== 'function') throw new Error(`Runner module ${url} does not export ${name}`);
  }
  return mod;
}
