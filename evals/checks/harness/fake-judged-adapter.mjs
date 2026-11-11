// ReviewBench-shaped adapter: ctx on every hook, per-arm buildPrompt and a judge-style scoreRun.
import fs from 'node:fs';
import path from 'node:path';

export const calls = { listTasks: [], materialize: [], collect: [], scoreRun: [] };

export async function listTasks(split, ctx) {
  calls.listTasks.push({ split, ctx });
  return [{ id: 'owner_repo_1-aaaaaaaa' }, { id: 'owner_repo_2-bbbbbbbb' }];
}

export async function materialize(task, workspace, ctx) {
  calls.materialize.push({ task: task.id, ctx });
  fs.writeFileSync(path.join(workspace, 'PR.md'), task.id);
}

export function buildPrompt(task, arm, suite) {
  return `${suite.reviewRequests[arm.id] ?? suite.reviewRequests.default} ${task.id}`;
}

export async function collect(record, task, ctx) {
  calls.collect.push({ task: task.id, ctx });
  return { status: 'completed', output: fs.readFileSync(record.outputPath, 'utf8') };
}

// The judge produces no entry for task 2 under stock repeat 0.
export async function scoreRun(ctx) {
  calls.scoreRun.push(ctx);
  const entries = [];
  for (const arm of ['stock', 'promptlings']) {
    for (const repeat of ['0', '1']) {
      for (const task of ['owner_repo_1-aaaaaaaa', 'owner_repo_2-bbbbbbbb']) {
        if (arm === 'stock' && repeat === '0' && task === 'owner_repo_2-bbbbbbbb') continue;
        for (const variant of ['primary', 'exclude-producers']) {
          entries.push({
            task, arm, repeat, variant,
            metrics: { grounded_recall: arm === 'stock' ? 0.4 : 0.6, grounded_precision: null, candidate_count: 3, by_severity: { high: { recall: 0.5 } } },
          });
        }
      }
    }
  }
  return { entries, rejected: [] };
}
