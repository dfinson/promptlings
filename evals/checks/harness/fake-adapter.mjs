// Offline suite adapter implementing listTasks, materialize and collect.
import fs from 'node:fs';
import path from 'node:path';

export const materialized = [];

export async function listTasks() {
  return [
    { id: 'task-a', text: 'FAKE_PASS alpha', score: 1 },
    { id: 'task-b', text: 'beta', score: 0 },
  ];
}

export async function materialize(task, workspace, ctx = {}) {
  materialized.push({ taskId: task.id, workspace, artifactRoot: ctx.artifactRoot ?? null });
  fs.writeFileSync(path.join(workspace, 'TASK.md'), task.text);
}

export async function collect(trialRecord, task) {
  const output = fs.readFileSync(trialRecord.outputPath, 'utf8');
  return { output, metrics: { quality: task.score } };
}
