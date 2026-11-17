// Stand-in for evals/runner/budgeted.js: a wrapper exposing only runTrial.
import { runTrial as inner } from './fake-runner.mjs';

export const budgetedCalls = [];

export async function runTrial(options) {
  budgetedCalls.push(options.arm.id);
  return inner(options);
}
