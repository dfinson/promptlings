// Runs one suite through Promptfoo and writes the run's config, raw results and scores.json.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPromptfooConfig } from './config.js';
import { runPromptfooEvaluation } from './evaluate.js';
import { buildScores, metricsFromScorers, writeScores } from '../scoring/scores.js';

export async function runHarness({
  suiteName,
  prompt,
  arms,
  tasks,
  split,
  adapterModule,
  runnerModule,
  runDir,
  runId,
  artifactRoot = process.env.EVALS_ARTIFACT_ROOT,
  scorers = [],
  assertions = [],
  grader,
  limits,
  repeats = 1,
  concurrency = 1,
  env,
  context = {},
}) {
  if (!runDir) throw new Error('runHarness needs runDir');
  const root = path.resolve(runDir);
  fs.mkdirSync(root, { recursive: true });
  let taskList = tasks;
  if (!taskList) {
    if (!adapterModule) throw new Error('runHarness needs tasks or an adapterModule with listTasks');
    const adapter = await import(pathToFileURL(path.resolve(adapterModule)).href);
    taskList = await adapter.listTasks(split);
  }

  const config = buildPromptfooConfig({
    suiteName, prompt, arms, tasks: taskList, scorers, assertions, grader, runDir: root,
    artifactRoot, adapterModule, runnerModule, limits, repeats, concurrency, env,
  });
  fs.writeFileSync(path.join(root, 'promptfooconfig.json'), JSON.stringify(config, null, 2));
  const summary = await runPromptfooEvaluation(config, { runDir: root });
  fs.writeFileSync(path.join(root, 'promptfoo-results.json'), JSON.stringify(summary, null, 2));

  const graders = [
    ...scorers.filter((s) => s.kind === 'llm-rubric').map((s) => ({ id: s.id, model: s.model ?? grader?.model ?? null })),
    ...(grader ? [{ id: 'default-grader', model: grader.model }] : []),
  ];
  const scores = buildScores({
    runDir: root,
    runId,
    promptfooResults: summary.results,
    context: { suite: suiteName, prompt, repeats, graders, ...context },
    arms,
    metrics: metricsFromScorers(scorers),
  });
  writeScores(scores, root);
  return { config, summary, scores };
}
