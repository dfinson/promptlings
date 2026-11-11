// Runs a validated Promptfoo configuration with caching, sharing and telemetry off.
import fs from 'node:fs';
import path from 'node:path';
import { validatePromptfooConfig } from './config.js';

export async function runPromptfooEvaluation(config, { runDir, basePath } = {}) {
  if (!runDir) throw new Error('runPromptfooEvaluation needs runDir');
  validatePromptfooConfig(config, { basePath });
  const promptfooDir = path.join(path.resolve(runDir), 'promptfoo');
  fs.mkdirSync(promptfooDir, { recursive: true });
  process.env.PROMPTFOO_DISABLE_TELEMETRY = '1';
  process.env.PROMPTFOO_DISABLE_UPDATE = '1';
  process.env.PROMPTFOO_DISABLE_SHARING = '1';
  process.env.PROMPTFOO_CACHE_ENABLED = 'false';
  process.env.PROMPTFOO_CONFIG_DIR ||= promptfooDir;

  const promptfoo = (await import('promptfoo')).default;
  const { evaluateOptions, ...suite } = config;
  const record = await promptfoo.evaluate(
    { ...suite, writeLatestResults: false, sharing: false },
    { ...evaluateOptions, cache: false, showProgressBar: false },
  );
  const summary = await record.toEvaluateSummary();
  const cached = (summary.results ?? []).filter((r) => r?.response?.cached);
  if (cached.length) throw new Error(`${cached.length} Promptfoo result(s) came from cache; cached results are not trials`);
  return summary;
}
