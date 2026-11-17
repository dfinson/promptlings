// Builds and validates the Promptfoo configuration for one suite run.
// Every model-graded assertion must resolve to the Copilot grader; anything that could
// reach Promptfoo's default grader or another model service fails validation.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateGraderConfig } from './copilot-grader.js';

export const TRIAL_PROVIDER_PATH = fileURLToPath(new URL('./copilot-trial.js', import.meta.url));
export const GRADER_PROVIDER_PATH = fileURLToPath(new URL('./copilot-grader.js', import.meta.url));

export const MODEL_GRADED_TYPES = new Set([
  'llm-rubric',
  'g-eval',
  'factuality',
  'model-graded-closedqa',
  'model-graded-factuality',
  'select-best',
]);

export const DETERMINISTIC_TYPES = new Set([
  'equals', 'contains', 'icontains', 'contains-all', 'contains-any', 'icontains-all', 'icontains-any',
  'starts-with', 'regex', 'is-json', 'contains-json', 'is-xml', 'contains-xml', 'is-sql', 'contains-sql',
  'is-html', 'contains-html', 'javascript', 'python', 'levenshtein', 'rouge-n', 'bleu', 'gleu',
  'latency', 'cost', 'word-count', 'finish-reason',
]);

const FORBIDDEN_ENV = /^(OPENAI|ANTHROPIC|AZURE_OPENAI|COPILOT_PROVIDER)_/i;

export function providerRef(filePath) {
  return `file://${filePath.replace(/\\/g, '/')}`;
}

function samePath(a, b) {
  const norm = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
  return norm(a) === norm(b);
}

function refersTo(ref, modulePath, basePath) {
  if (typeof ref !== 'string') return false;
  const raw = ref.startsWith('file://') ? ref.slice('file://'.length) : ref;
  if (!/\.(c|m)?js$/i.test(raw)) return false;
  return samePath(path.resolve(basePath, raw), modulePath);
}

export function graderProvider(grader, { runDir, runnerModule } = {}) {
  const config = {
    model: grader?.model,
    maxAiCredits: grader?.maxAiCredits ?? 30,
    evidenceDir: grader?.evidenceDir ?? (runDir ? path.join(runDir, 'graders') : undefined),
  };
  if (grader?.reasoningEffort) config.reasoningEffort = grader.reasoningEffort;
  if (grader?.timeoutMs) config.timeoutMs = grader.timeoutMs;
  if (runnerModule) config.runnerModule = runnerModule;
  return { id: providerRef(GRADER_PROVIDER_PATH), label: `copilot-grader:${grader?.model}`, config };
}

export function assertionsFromScorers(scorers = [], context = {}) {
  const out = [];
  for (const scorer of scorers) {
    if (scorer.kind === 'llm-rubric') {
      if (!scorer.rubric) throw new Error(`Scorer ${scorer.id} is llm-rubric but has no rubric`);
      out.push({
        type: 'llm-rubric',
        value: scorer.rubric,
        metric: scorer.id,
        provider: graderProvider({ model: scorer.model, reasoningEffort: scorer.reasoningEffort, maxAiCredits: scorer.maxAiCredits }, context),
      });
    } else if (scorer.kind === 'javascript') {
      out.push({ type: 'javascript', value: scorer.value, metric: scorer.id });
    }
  }
  return out;
}

export function buildPromptfooConfig({
  suiteName,
  suite,
  prompt,
  arms,
  tasks,
  scorers = [],
  assertions = [],
  grader,
  runDir,
  artifactRoot,
  adapterModule,
  runnerModule,
  limits,
  repeats = 1,
  concurrency = 1,
  env,
}) {
  prompt = prompt ?? suite?.prompt;
  if (!prompt) throw new Error('Suite prompt is required');
  if (!arms?.length) throw new Error('At least one arm is required');
  if (!tasks?.length) throw new Error('At least one task is required');
  const context = { runDir, runnerModule };
  const defaultGrader = grader ? graderProvider(grader, context) : undefined;
  const allAssertions = [...assertionsFromScorers(scorers, context), ...assertions].map((a) =>
    MODEL_GRADED_TYPES.has(String(a.type).replace(/^not-/, '')) && !a.provider && defaultGrader ? { ...a, provider: defaultGrader } : a,
  );
  const providerConfig = (arm) => {
    const config = { arm, runDir: path.resolve(runDir) };
    if (artifactRoot) config.artifactRoot = artifactRoot;
    if (adapterModule) config.adapterModule = path.resolve(adapterModule);
    if (suite !== undefined) config.suite = suite;
    if (runnerModule) config.runnerModule = runnerModule;
    if (limits) config.limits = limits;
    if (env) config.env = env;
    return config;
  };
  return {
    description: suiteName ?? 'evals',
    prompts: [{ raw: prompt, label: `${suiteName ?? 'suite'}-prompt` }],
    providers: arms.map((arm) => ({ id: providerRef(TRIAL_PROVIDER_PATH), label: arm.id, config: providerConfig(arm) })),
    tests: tasks.map((task) => ({ description: String(task.id), vars: { taskId: String(task.id), task } })),
    defaultTest: {
      assert: allAssertions,
      ...(defaultGrader ? { options: { provider: defaultGrader } } : {}),
    },
    evaluateOptions: { cache: false, repeat: repeats, maxConcurrency: concurrency },
  };
}

function checkGrader(provider, where, basePath) {
  if (provider == null) return `${where} has no grading provider, so Promptfoo would fall back to its default grader`;
  if (typeof provider === 'object' && provider.isCopilotGrader === true) {
    const errors = validateGraderConfig(provider.config);
    return errors.length ? `${where}: ${errors.join('; ')}` : null;
  }
  if (typeof provider === 'string') {
    return refersTo(provider, GRADER_PROVIDER_PATH, basePath)
      ? `${where}: Copilot grader reference has no config, so it has no model`
      : `${where} is graded by ${provider}, not the Copilot grader`;
  }
  if (typeof provider === 'object' && !Array.isArray(provider)) {
    if (typeof provider.id !== 'string') {
      if ('text' in provider) return checkGrader(provider.text, `${where}.text`, basePath);
      return `${where} names no grading provider id, so Promptfoo would fall back to its default grader`;
    }
    if (!refersTo(provider.id, GRADER_PROVIDER_PATH, basePath)) return `${where} is graded by ${provider.id}, not the Copilot grader`;
    const errors = validateGraderConfig(provider.config ?? {});
    return errors.length ? `${where}: ${errors.join('; ')}` : null;
  }
  return `${where} has an unsupported grading provider definition`;
}

function isTrialProvider(provider, basePath) {
  if (provider && typeof provider === 'object' && provider.isCopilotTrial === true) return true;
  const ref = typeof provider === 'string' ? provider : provider?.id;
  return refersTo(ref, TRIAL_PROVIDER_PATH, basePath);
}

export function validatePromptfooConfig(config, { basePath = process.cwd() } = {}) {
  const errors = [];
  if (!config || typeof config !== 'object') throw new Error('Invalid Promptfoo config: not an object');
  if (config.evaluateOptions?.cache !== false) errors.push('evaluateOptions.cache must be false: a cached result is not a trial');
  for (const key of Object.keys(config.env ?? {})) {
    if (FORBIDDEN_ENV.test(key)) errors.push(`env sets ${key}; no OpenAI, Anthropic or Copilot provider override is allowed`);
  }
  if (!Array.isArray(config.providers) || !config.providers.length) errors.push('providers must list the trial arms');
  for (const [i, provider] of (config.providers ?? []).entries()) {
    if (!isTrialProvider(provider, basePath)) errors.push(`providers[${i}] is not the Copilot trial provider`);
  }
  const defaultTest = config.defaultTest ?? {};
  if (typeof defaultTest !== 'object') errors.push('defaultTest must be inline, not a file reference');
  if (!Array.isArray(config.tests)) errors.push('tests must be an inline array');
  if (defaultTest.provider != null) {
    const problem = checkGrader(defaultTest.provider, 'defaultTest.provider', basePath);
    if (problem) errors.push(problem);
  }
  if (defaultTest.options?.provider != null) {
    const problem = checkGrader(defaultTest.options.provider, 'defaultTest.options.provider', basePath);
    if (problem) errors.push(problem);
  }

  const visit = (assertion, where, test) => {
    if (!assertion || typeof assertion !== 'object') {
      errors.push(`${where} is not an assertion object`);
      return;
    }
    const type = String(assertion.type ?? '');
    if (type === 'assert-set') {
      (assertion.assert ?? []).forEach((child, j) => visit(child, `${where}.assert[${j}]`, test));
      return;
    }
    const base = type.replace(/^not-/, '');
    if (MODEL_GRADED_TYPES.has(base)) {
      const effective = assertion.provider ?? test?.options?.provider ?? defaultTest.provider ?? defaultTest.options?.provider;
      const problem = checkGrader(effective, `${where} (${type})`, basePath);
      if (problem) errors.push(problem);
    } else if (!DETERMINISTIC_TYPES.has(base)) {
      errors.push(`${where} uses assertion type "${type}", which is not allowed: only deterministic checks and Copilot-graded rubrics are`);
    }
  };

  (defaultTest.assert ?? []).forEach((a, j) => visit(a, `defaultTest.assert[${j}]`, null));
  for (const [i, test] of (Array.isArray(config.tests) ? config.tests : []).entries()) {
    if (test?.provider != null) errors.push(`tests[${i}].provider overrides the trial arm`);
    if (test?.options?.provider != null) {
      const problem = checkGrader(test.options.provider, `tests[${i}].options.provider`, basePath);
      if (problem) errors.push(problem);
    }
    (test?.assert ?? []).forEach((a, j) => visit(a, `tests[${i}].assert[${j}]`, test));
  }
  if (errors.length) throw new Error(`Invalid Promptfoo config:\n- ${errors.join('\n- ')}`);
  return config;
}
