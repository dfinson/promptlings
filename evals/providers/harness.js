// Runs one suite through Promptfoo and writes the run's config, raw results and scores.json.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPromptfooConfig } from './config.js';
import { runPromptfooEvaluation } from './evaluate.js';
import { buildScores, mergeScoreEntries, metricsFromScorers, writeScores } from '../scoring/scores.js';

/**
 * suite is the loaded suite document (object) handed to adapters as ctx.suite and to
 * adapter.buildPrompt; suiteName defaults to suite.name. When scoreRun is true and the adapter
 * exports scoreRun, or scoreRun is a function, its { entries, rejected } are merged into scores.json.
 */
export async function runHarness({
  suiteName,
  suite,
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
  metrics,
  plannedN,
  scoreRun,
  scoreRunOptions = {},
  context = {},
}) {
  if (!runDir) throw new Error('runHarness needs runDir');
  const root = path.resolve(runDir);
  fs.mkdirSync(root, { recursive: true });
  const name = suiteName ?? (suite && typeof suite === 'object' ? suite.name : undefined);
  const ctx = { artifactRoot, runDir: root, suite };
  const adapter = adapterModule ? await import(pathToFileURL(path.resolve(adapterModule)).href) : null;
  let taskList = tasks;
  if (!taskList) {
    if (!adapter?.listTasks) throw new Error('runHarness needs tasks or an adapterModule with listTasks');
    taskList = await adapter.listTasks(split, ctx);
  }

  const config = buildPromptfooConfig({
    suiteName: name, suite, prompt, arms, tasks: taskList, scorers, assertions, grader, runDir: root,
    artifactRoot, adapterModule, runnerModule, limits, repeats, concurrency, env,
  });
  fs.writeFileSync(path.join(root, 'promptfooconfig.json'), JSON.stringify(config, null, 2));
  const summary = await runPromptfooEvaluation(config, { runDir: root });
  fs.writeFileSync(path.join(root, 'promptfoo-results.json'), JSON.stringify(summary, null, 2));

  const graders = [
    ...scorers.filter((s) => s.kind === 'llm-rubric').map((s) => ({ id: s.id, model: s.model ?? grader?.model ?? null })),
    ...(grader ? [{ id: 'default-grader', model: grader.model }] : []),
  ];
  const plannedTasks = taskList.map((t) => String(t.id));
  let scores = buildScores({
    runDir: root,
    runId,
    promptfooResults: summary.results,
    context: { suite: name, prompt: config.prompts[0].raw, repeats, graders, plannedTasks, plannedN: plannedN ?? plannedTasks.length, ...context },
    arms,
    metrics: { ...metricsFromScorers(scorers), ...metrics },
  });
  const scorer = typeof scoreRun === 'function' ? scoreRun : scoreRun ? adapter?.scoreRun : null;
  if (scoreRun && !scorer) throw new Error('scoreRun requested but the adapter does not export scoreRun');
  if (scorer) {
    writeScores(scores, root);
    scores = mergeScoreEntries(scores, await scorer({ runDir: root, ...ctx, ...scoreRunOptions }));
  }
  writeScores(scores, root);
  return { config, summary, scores };
}