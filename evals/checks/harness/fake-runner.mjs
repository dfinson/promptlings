// Offline stand-in for evals/runner/index.js, implementing the shared runner contract.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FAKE_COPILOT = fileURLToPath(new URL('./fake-copilot.mjs', import.meta.url));

export const trialCalls = [];

export function runCopilotOnce({ home, cwd, args, env, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [FAKE_COPILOT, ...args], { cwd, env, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), timeoutMs ?? 60_000);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ exitCode: code ?? 1, stdout, stderr, home }); });
  });
}

// Writes a TrialRecord whose output echoes the prompt, so graders can see per-task content.
export async function runTrial({ trialDir, workspace, prompt, arm, limits, env }) {
  trialCalls.push({ trialDir, workspace, prompt, armId: arm.id, limits, env });
  const outputPath = path.join(trialDir, 'output.txt');
  fs.writeFileSync(outputPath, `answer from ${arm.id}: ${prompt}`);
  const status = process.env.FAKE_TRIAL_STATUS ?? 'completed';
  const record = {
    status,
    exitCode: status === 'completed' ? 0 : 1,
    wallMs: 5,
    cliVersion: '9.9.9-fake',
    flags: ['--model', arm.model],
    installedHashes: {},
    usage: {
      totalNanoAiu: 2000,
      tokenDetails: { input: { tokenCount: 100 }, cache_read: { tokenCount: 50 }, cache_write: { tokenCount: 0 }, output: { tokenCount: 20 } },
    },
    outputPath,
    eventsPath: path.join(trialDir, 'events.jsonl'),
    transcriptPath: path.join(trialDir, 'transcript.jsonl'),
    workspaceDiffPath: path.join(trialDir, 'workspace.diff'),
  };
  fs.writeFileSync(path.join(trialDir, 'trial.json'), JSON.stringify(record, null, 2));
  return record;
}
