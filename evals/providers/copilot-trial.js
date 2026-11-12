// Promptfoo provider that runs one native Copilot trial per call through the shared runner.
// Each arm is one provider instance, so Promptfoo's matrix yields task x arm x repeat.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadRunner } from './runner.js';
import { trialStatus } from '../scoring/scores.js';

export function safeSegment(value) {
  const text = String(value ?? '').replace(/[^A-Za-z0-9._-]/g, '_');
  return text && text !== '.' && text !== '..' ? text : '_';
}

export function usageToTokens(usage) {
  const details = usage?.tokenDetails;
  if (!details) return undefined;
  const input = details.input?.tokenCount ?? 0;
  const cached = details.cache_read?.tokenCount ?? 0;
  const written = details.cache_write?.tokenCount ?? 0;
  const completion = details.output?.tokenCount ?? 0;
  const prompt = input + cached + written;
  return { prompt, completion, cached, total: prompt + completion, numRequests: 1 };
}

function normalizeCollected(value) {
  if (value == null) return {};
  if (typeof value === 'string') return { output: value };
  return value;
}

async function importAdapter(adapterModule) {
  if (!adapterModule) return null;
  const url = adapterModule.startsWith('file:') ? adapterModule : pathToFileURL(path.resolve(adapterModule)).href;
  return import(url);
}

export default class CopilotTrialProvider {
  constructor(options = {}) {
    this.config = { ...(options.config ?? {}) };
    const { arm, runDir } = this.config;
    if (!arm?.id) throw new Error('copilot-trial provider needs config.arm with an id');
    if (!runDir) throw new Error('copilot-trial provider needs config.runDir');
    this.label = options.label ?? arm.id;
    this.isCopilotTrial = true;
  }

  id() {
    return `copilot-trial:${this.config.arm.id}`;
  }

  toString() {
    return `[Copilot trial ${this.config.arm.id}]`;
  }

  async callApi(prompt, context = {}) {
    const { arm, runDir, adapterModule, runnerModule, suite } = this.config;
    const artifactRoot = this.config.artifactRoot ?? process.env.EVALS_ARTIFACT_ROOT;
    const vars = context.vars ?? {};
    const task = vars.task && typeof vars.task === 'object' ? vars.task : { id: vars.taskId };
    const taskId = String(task.id ?? vars.taskId ?? '');
    if (!taskId) return { error: 'Trial test case has no taskId' };
    const repeat = Number.isInteger(context.repeatIndex) ? context.repeatIndex : 0;
    const trialDir = path.join(path.resolve(runDir), 'trials', safeSegment(taskId), safeSegment(arm.id), String(repeat));
    fs.mkdirSync(path.dirname(trialDir), { recursive: true });
    try {
      fs.mkdirSync(trialDir);
    } catch (err) {
      if (err.code === 'EEXIST') return { error: `Trial directory already exists, refusing to overwrite evidence: ${trialDir}` };
      throw err;
    }
    const meta = { taskId, armId: arm.id, repeat, trialDir, startedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(trialDir, 'harness.json'), JSON.stringify(meta, null, 2));
    const metadata = { trialDir, taskId, arm: arm.id, repeat };

    try {
      const workspace = path.join(trialDir, 'workspace');
      fs.mkdirSync(workspace);
      const adapter = await importAdapter(adapterModule);
      const ctx = { workspace, trialDir, arm, artifactRoot, runDir: path.resolve(runDir), suite };
      if (adapter?.materialize) await adapter.materialize(task, workspace, ctx);
      // An adapter that words the request per arm (ReviewBench's reviewRequests) owns the prompt;
      // otherwise the suite's prompt is used verbatim, and Promptfoo's rendered prompt only without a suite prompt.
      const trialPrompt = adapter?.buildPrompt
        ? await adapter.buildPrompt(task, arm, suite)
        : typeof suite?.prompt === 'string' ? suite.prompt
        : typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
      fs.writeFileSync(path.join(trialDir, 'prompt.txt'), trialPrompt);
      const runner = await loadRunner(runnerModule);
      const record = await runner.runTrial({
        trialDir,
        workspace,
        prompt: trialPrompt,
        arm,
        limits: this.config.limits ?? arm.limits ?? {},
        env: this.config.env ?? {},
      });
      const collected = normalizeCollected(adapter?.collect ? await adapter.collect(record, task, ctx) : null);
      fs.writeFileSync(path.join(trialDir, 'collected.json'), JSON.stringify(collected, null, 2));

      let output = collected.output;
      if (output == null && record?.outputPath && fs.existsSync(record.outputPath)) output = fs.readFileSync(record.outputPath, 'utf8');
      const status = trialStatus(record, collected);
      const response = {
        output: output ?? '',
        cached: false,
        tokenUsage: usageToTokens(record?.usage),
        metadata: { ...metadata, status, nanoAiu: record?.usage?.totalNanoAiu ?? null, reason: collected.reason ?? record?.reason ?? null },
      };
      if (status !== 'completed') response.error = `Trial ${status}${response.metadata.reason ? `: ${response.metadata.reason}` : ''} (${trialDir})`;
      return response;
    } catch (err) {
      fs.writeFileSync(path.join(trialDir, 'harness-error.txt'), String(err?.stack ?? err));
      return { error: `Trial harness failed: ${err?.message ?? err} (${trialDir})`, cached: false, metadata: { ...metadata, status: 'errored' } };
    }
  }
}
