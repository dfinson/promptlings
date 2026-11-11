import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyLeakage, classifyCall, scanTrial } from '../../scoring/leakage.js';
import { collect, PR_DIR } from '../../suites/reviewbench/adapter.js';

const TASK = { repo: 'acme/widgets', prNumber: 1, base: 'a'.repeat(40), head: 'b'.repeat(40) };

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), 'rb-leakage-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function writeEvents(dir, calls) {
  const lines = [];
  calls.forEach(({ toolName, args, success = true }, i) => {
    const toolCallId = `call-${i}`;
    lines.push({ type: 'tool.execution_start', data: { toolCallId, toolName, arguments: args } });
    lines.push({ type: 'tool.execution_complete', data: { toolCallId, success } });
  });
  const path = join(dir, 'events.jsonl');
  writeFileSync(path, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`);
  return path;
}

function trial(t, calls, { findings } = {}) {
  const trialDir = join(scratch(t), 'trials', 'acme_widgets_1-bbbbbbbb', 'stock', '1');
  mkdirSync(join(trialDir, 'workspace', PR_DIR), { recursive: true });
  const eventsPath = writeEvents(trialDir, calls);
  if (findings) writeFileSync(join(trialDir, 'workspace', PR_DIR, 'findings.json'), JSON.stringify(findings));
  return { trialDir, record: { status: 'completed', arm: 'stock', trialDir, eventsPath, wallMs: 1200 } };
}

const BENIGN = [
  { toolName: 'powershell', args: { command: 'git --no-pager diff review-base...pr-head -- src/app.js' } },
  { toolName: 'view', args: { path: 'C:\\w\\src\\app.js' } },
  { toolName: 'grep', args: { pattern: 'handleRequest', paths: 'src' } },
];

test('leakage: fetching the PR page with a web tool invalidates the trial', (t) => {
  const dir = scratch(t);
  const scan = scanTrial({ eventsPath: writeEvents(dir, [...BENIGN, { toolName: 'web_fetch', args: { url: 'https://github.com/acme/widgets/pull/1' } }]) });
  assert.equal(scan.invalidated, true);
  assert.equal(scan.source, 'events');
  assert.ok(scan.reasons.some((r) => r.includes('PR, issue, commit or compare page')));
  assert.ok(scan.reasons.some((r) => r.includes('web_fetch web tool')));
});

test('leakage: reading PR comments through gh or the API invalidates the trial', (t) => {
  for (const command of ['gh api repos/acme/widgets/pulls/1/comments', 'gh pr view 1 --comments', 'curl -s https://api.github.com/repos/acme/widgets/pulls/1/comments', 'Invoke-RestMethod https://api.github.com/repos/acme/widgets/issues/1/comments']) {
    const scan = scanTrial({ eventsPath: writeEvents(scratch(t), [{ toolName: 'powershell', args: { command } }]) });
    assert.equal(scan.invalidated, true, command);
  }
});

test('leakage: fetching ReviewBench golden data or contacting a Git remote invalidates the trial', () => {
  assert.ok(classifyCall('web_fetch', { url: 'https://raw.githubusercontent.com/review-bench/ReviewBench/main/golden/x.json' }).some((h) => h.rule === 'benchmark-data'));
  assert.ok(classifyCall('powershell', { command: 'git fetch https://github.com/acme/widgets refs/pull/1/head' }).some((h) => h.rule === 'git-remote'));
  assert.ok(classifyCall('github-mcp-server-pull_request_read', { owner: 'acme', repo: 'widgets', pullNumber: 1 }).some((h) => h.rule === 'github-mcp'));
});

test('leakage: local review work does not invalidate the trial', (t) => {
  const scan = scanTrial({ eventsPath: writeEvents(scratch(t), BENIGN) });
  assert.equal(scan.invalidated, false);
  assert.deepEqual(scan.reasons, []);
  for (const { toolName, args } of BENIGN) assert.deepEqual(classifyCall(toolName, args), [], toolName);
});

test('leakage: a call the permission layer denied is a warning, not an invalidation', (t) => {
  const scan = scanTrial({ eventsPath: writeEvents(scratch(t), [...BENIGN, { toolName: 'web_fetch', args: { url: 'https://github.com/acme/widgets/pull/1' }, success: false }]) });
  assert.equal(scan.invalidated, false);
  assert.equal(scan.warnings.length, 2);
  assert.ok(scan.warnings.every((w) => w.startsWith('denied: ')));
});

test('leakage: a call with no recorded outcome counts as executed', (t) => {
  const dir = scratch(t);
  const path = join(dir, 'events.jsonl');
  writeFileSync(path, `${JSON.stringify({ type: 'tool.execution_start', data: { toolCallId: 'x', toolName: 'powershell', arguments: { command: 'gh pr diff 1' } } })}\n{"type":"tool.execution_comp`);
  assert.equal(scanTrial({ eventsPath: path }).invalidated, true);
});

test('leakage: a transcript-only trial that names a PR URL in a request is invalidated', (t) => {
  const dir = scratch(t);
  const transcriptPath = join(dir, 'transcript.md');
  writeFileSync(transcriptPath, 'Reviewing the diff.\n> curl https://api.github.com/repos/acme/widgets/pulls/1/reviews\n');
  const scan = scanTrial({ transcriptPath });
  assert.equal(scan.invalidated, true);
  assert.equal(scan.source, 'transcript');
});

test('leakage: a trial with nothing to audit is invalidated', () => {
  const scan = scanTrial({ eventsPath: join(tmpdir(), 'rb-no-such-events.jsonl') });
  assert.equal(scan.invalidated, true);
  assert.equal(scan.source, 'none');
});

test('leakage: applyLeakage marks the record invalidated with the first reason', () => {
  const scan = { invalidated: true, reasons: ['r1', 'r2'], warnings: [], source: 'events' };
  const out = applyLeakage({ status: 'completed' }, scan);
  assert.equal(out.status, 'invalidated');
  assert.equal(out.reason, 'leakage: r1 (+1 more)');
  assert.equal(applyLeakage({ status: 'completed' }, { ...scan, invalidated: false, reasons: [] }).status, 'completed');
});

test('leakage: collect invalidates a leaking trial and does not produce a candidate', (t) => {
  const findings = { findings: [{ file: 'src/app.js', start_line: 3, message: 'null check missing' }] };
  const { trialDir, record } = trial(t, [...BENIGN, { toolName: 'powershell', args: { command: 'gh api repos/acme/widgets/pulls/1/comments' } }], { findings });
  const out = collect(record, TASK);
  assert.equal(out.status, 'invalidated');
  assert.equal(out.invalidated, true);
  assert.match(out.reason, /^leakage: /);
  assert.equal(existsSync(join(trialDir, 'candidate.json')), false);
});

test('leakage: collect on an audited trial writes the judge candidate', (t) => {
  const findings = { findings: [{ file: './src/app.js', start_line: 3, message: 'null check missing' }] };
  const { trialDir, record } = trial(t, BENIGN, { findings });
  const out = collect(record, TASK);
  assert.equal(out.status, 'completed');
  assert.equal(out.invalidated, false);
  const candidate = JSON.parse(readFileSync(join(trialDir, 'candidate.json'), 'utf8'));
  assert.deepEqual(candidate.pr, { repo: TASK.repo, pr_number: 1, base: TASK.base, head: TASK.head });
  assert.deepEqual(candidate.findings, [{ producer: 'stock', file: 'src/app.js', start_line: 3, end_line: 3, message: 'null check missing' }]);
});
