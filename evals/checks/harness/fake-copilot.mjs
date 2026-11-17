#!/usr/bin/env node
// Offline stand-in for the Copilot CLI used by the harness, grader and report checks.
// FAKE_COPILOT_MODE: pass (default), tool-call, exit1.
// FAKE_COPILOT_LOG: file that receives one JSON line per invocation.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);

if (argv.includes('--version')) {
  process.stdout.write('GitHub Copilot CLI 9.9.9-fake\n');
  process.exit(0);
}

const home = process.env.COPILOT_HOME ?? '';
const valueOf = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};
const prompt = valueOf('-p') ?? '';
const mode = process.env.FAKE_COPILOT_MODE ?? 'pass';

if (process.env.FAKE_COPILOT_LOG) {
  const entry = {
    argv,
    cwd: process.cwd(),
    cwdEntries: fs.readdirSync(process.cwd()),
    homeEntries: home && fs.existsSync(home) ? fs.readdirSync(home) : null,
    env: {
      COPILOT_HOME: process.env.COPILOT_HOME ?? null,
      HOME: process.env.HOME ?? null,
      USERPROFILE: process.env.USERPROFILE ?? null,
      hasToken: Boolean(process.env.COPILOT_GITHUB_TOKEN),
      forbidden: Object.keys(process.env).filter((k) => /^(OPENAI|ANTHROPIC|COPILOT_PROVIDER)_/i.test(k)),
    },
  };
  fs.appendFileSync(process.env.FAKE_COPILOT_LOG, JSON.stringify(entry) + '\n');
}

const events = [];
const emit = (type, data = {}) => events.push(JSON.stringify({ type, data, id: String(events.length) }));
emit('session.info', { infoType: 'configuration', message: 'Disabled tools: create, edit, view' });
emit('user.message', { content: prompt });

if (mode === 'tool-call') {
  emit('assistant.message', { content: '', toolRequests: [{ toolCallId: 't1', name: 'view' }] });
  emit('tool.execution_start', { toolCallId: 't1', toolName: 'view' });
  emit('tool.execution_complete', { toolCallId: 't1', success: true });
}

const pass = prompt.includes('FAKE_PASS');
const grade = { reason: pass ? 'fake grader saw the marker' : 'fake grader saw no marker', pass, score: pass ? 1 : 0 };
emit('assistant.message', { content: JSON.stringify(grade), toolRequests: [] });
events.push(JSON.stringify({ type: 'result', exitCode: mode === 'exit1' ? 1 : 0, usage: { premiumRequests: 1 } }));

const usageFile = valueOf('--usage-output-file');
if (usageFile) {
  fs.mkdirSync(path.dirname(usageFile), { recursive: true });
  fs.writeFileSync(usageFile, JSON.stringify({
    totalNanoAiu: 1000,
    tokenDetails: { input: { tokenCount: 10 }, cache_read: { tokenCount: 0 }, cache_write: { tokenCount: 0 }, output: { tokenCount: 5 } },
  }));
}

process.stdout.write(events.join('\n') + '\n');
process.exit(mode === 'exit1' ? 1 : 0);
