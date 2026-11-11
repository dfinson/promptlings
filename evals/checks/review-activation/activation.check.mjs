import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildPrompt, collect, ENSEMBLE_PROMPT, listTasks, materialize } from '../../suites/review-activation/adapter.js';
import { evaluateTrial, extractTimeline, loadTrialEvents } from '../../suites/review-activation/checks.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');
const scratch = mkdtempSync(join(tmpdir(), 'review-activation-'));
after(() => rmSync(scratch, { recursive: true, force: true }));

const SUITE = {
  prompt: 'Review the changes on this branch against main.',
  splits: { live: ['r1-authorization', 'r3-reachability'], heldout: ['r2-cache-window'] },
  arms: [
    { id: 'nitcracker', agent: 'the-nitcracker' },
    { id: 'sparring-partner', agent: 'sparring-partner' },
    { id: 'ensemble', agent: null },
  ],
};
const ARM = Object.fromEntries(SUITE.arms.map((a) => [a.id, a]));
const R1 = listTasks('live', { suite: SUITE })[0];

// Copies a recorded fixture into a trial directory laid out like the runner's.
function trial(name, overrides = {}) {
  const trialDir = join(scratch, `${name}-${Math.random().toString(36).slice(2)}`);
  cpSync(join(FIXTURES, name), trialDir, { recursive: true });
  return { status: 'completed', exitCode: 0, eventsPath: join(trialDir, 'events.jsonl'), trialDir, ...overrides };
}

function score(name, armId, mutate = (e) => e, task = R1, record = trial(name)) {
  const { events } = loadTrialEvents(record);
  return evaluateTrial({ trialRecord: record, arm: ARM[armId], task, events: mutate(events), outputText: '' });
}

const failed = (result) => result.checks.filter((c) => !c.pass).map((c) => c.id);

describe('review-activation suite', () => {
  test('activation tasks: live and heldout splits load the seeded fixtures', () => {
    assert.deepEqual(listTasks('live', { suite: SUITE }).map((t) => t.id), ['r1-authorization', 'r3-reachability']);
    assert.deepEqual(listTasks('heldout').map((t) => t.id), ['r2-cache-window']);
    assert.throws(() => listTasks('missing'), /no split missing/);
  });

  test('activation prompt: ensemble arm uses the README request, agent arms the suite prompt', () => {
    assert.equal(buildPrompt(R1, ARM.ensemble, SUITE), ENSEMBLE_PROMPT);
    assert.match(ENSEMBLE_PROMPT, /^Run the review ensemble/);
    assert.equal(buildPrompt(R1, ARM.nitcracker, SUITE), SUITE.prompt);
  });

  test('activation materialize: builds a deterministic main..review repository', () => {
    const first = materialize(R1, join(scratch, 'ws-a'));
    const second = materialize(R1, join(scratch, 'ws-b'));
    assert.equal(first.headSha, second.headSha);
    const run = (args) => execFileSync('git', args, { cwd: first.workspace, encoding: 'utf8' }).trim();
    assert.equal(run(['branch', '--show-current']), 'review');
    assert.equal(run(['diff', '--name-only', 'main...review']), 'permissions.py');
    assert.match(run(['diff', 'main...review']), /\+    return actor_id == owner_id and is_admin/);
    assert.match(readFileSync(join(first.workspace, 'REQUIREMENTS.md'), 'utf8'), /owner or an administrator/);
    assert.throws(() => materialize(R1, first.workspace), /not empty/);
  });

  test('activation collect: each arm passes on its recorded transcript, session log found by sessionId', () => {
    for (const armId of ['nitcracker', 'sparring-partner', 'ensemble']) {
      const record = trial(armId, { arm: armId });
      const result = collect(record, R1, { suite: SUITE });
      assert.deepEqual(failed(result), [], armId);
      assert.equal(result.metrics.activation, 1);
      assert.match(result.evidence.sessionEventsPath, /session-state[\\/][0-9a-f-]{36}[\\/]events\.jsonl$/);
    }
  });

  test('activation agent: missing session log fails top-agent because stdout lacks subagent.selected', () => {
    const lonely = mkdtempSync(join(scratch, 'stream-only-'));
    cpSync(join(FIXTURES, 'nitcracker', 'events.jsonl'), join(lonely, 'events.jsonl'));
    const result = score('nitcracker', 'nitcracker', undefined, R1, { status: 'completed', trialDir: lonely, eventsPath: join(lonely, 'events.jsonl') });
    assert.deepEqual(failed(result), ['top-agent']);
    assert.equal(result.metrics.activation, 0);
  });

  test('activation agent: a different selected agent fails the nitcracker arm', () => {
    const result = score('sparring-partner', 'nitcracker');
    assert.ok(failed(result).includes('top-agent'));
    assert.ok(failed(result).includes('narrative-title'));
  });

  test('activation nitcracker: missing anchor or em dash fails', () => {
    const task = { ...R1, expect: { ...R1.expect, nitcrackerAnchors: [{ path: 'permissions.py', line: 5 }] } };
    assert.deepEqual(failed(score('nitcracker', 'nitcracker', undefined, task)), ['anchors']);
    const dashed = (events) => events.map((e) => (e.type === 'assistant.message' ? { ...e, data: { ...e.data, content: `${e.data.content} \u2014 done` } } : e));
    assert.deepEqual(failed(score('nitcracker', 'nitcracker', dashed)), ['no-em-dash']);
  });

  test('activation sparring: an unloaded review method fails', () => {
    const drop = (events) => events
      .filter((e) => !(e.type === 'skill.invoked' && e.data.name === 'test-analysis'))
      .map((e) => (e.data?.toolCallId === 's-call-test-analysis' && e.type === 'tool.execution_complete' ? { ...e, data: { ...e.data, success: false } } : e));
    const result = score('sparring-partner', 'sparring-partner', drop);
    assert.deepEqual(failed(result), ['review-methods']);
    assert.match(result.checks.find((c) => c.id === 'review-methods').detail, /test-analysis/);
  });

  test('activation sparring: a skill reported as not found does not count as loaded', () => {
    const notFound = (events) => events
      .filter((e) => !(e.type === 'skill.invoked' && e.data.name === 'design-analysis'))
      .map((e) => (e.data?.toolCallId === 's-call-design-analysis' && e.type === 'tool.execution_complete'
        ? { ...e, data: { ...e.data, toolTelemetry: { properties: { found: 'false' }, restrictedProperties: { skillName: 'design-analysis' } } } }
        : e));
    assert.deepEqual(failed(score('sparring-partner', 'sparring-partner', notFound)), ['review-methods']);
  });

  test('activation rubber-duck: dispatching the built-in reviewer fails every arm', () => {
    const duck = (events) => [...events, { type: 'tool.execution_start', data: { toolCallId: 'duck', toolName: 'task', arguments: { agent_type: 'rubber-duck' } }, id: 'duck-1' }];
    for (const armId of ['nitcracker', 'sparring-partner', 'ensemble']) {
      assert.deepEqual(failed(score(armId, armId, duck)), ['no-rubber-duck'], armId);
    }
  });

  test('activation ensemble: sequential workers fail the parallel check', () => {
    const sequential = (events) => events.map((e) => (e.id === 'e-sc-the-nitcracker' ? { ...e, timestamp: '2026-11-11T10:00:04.500Z' } : e));
    const { events } = loadTrialEvents(trial('ensemble'));
    const result = evaluateTrial({ trialRecord: { status: 'completed' }, arm: ARM.ensemble, task: R1, events: sequential(events).sort((a, b) => Date.parse(a.timestamp ?? 0) - Date.parse(b.timestamp ?? 0)), outputText: '' });
    assert.deepEqual(failed(result), ['workers-parallel']);
  });

  test('activation ensemble: methods loaded by the top agent instead of the sparring worker fail', () => {
    const hoist = (events) => events.map((e) => (e.type === 'skill.invoked_ref' ? { ...e, agentId: undefined } : e));
    assert.deepEqual(failed(score('ensemble', 'ensemble', hoist)), ['sparring-methods']);
  });

  test('activation ensemble: a missing worker or skill load fails', () => {
    const noWalkthrough = (events) => events.filter((e) => e.agentId !== 'e-task-pr-walkthrough');
    assert.deepEqual(failed(score('ensemble', 'ensemble', noWalkthrough)), ['workers-started', 'workers-completed', 'workers-parallel']);
    const noSkill = (events) => events.filter((e) => e.id !== 'e-inv' && e.data?.toolCallId !== 'e-call-skill');
    assert.deepEqual(failed(score('ensemble', 'ensemble', noSkill)), ['ensemble-skill']);
    const selected = (events) => [{ type: 'subagent.selected', data: { agentName: 'sparring-partner' }, id: 'x' }, ...events];
    assert.deepEqual(failed(score('ensemble', 'ensemble', selected)), ['top-agent']);
  });

  test('activation status: a non-completed trial never scores', () => {
    const record = trial('ensemble', { status: 'capped', reason: 'maxAiCredits' });
    const result = score('ensemble', 'ensemble', undefined, R1, record);
    assert.deepEqual(failed(result), ['trial-completed']);
    assert.equal(result.metrics.activation, 0);
  });

  test('activation timeline: final text is the last top-level message, not a worker message', () => {
    const { events } = loadTrialEvents(trial('ensemble'));
    const timeline = extractTimeline(events);
    assert.match(timeline.finalText, /^Verified finding/);
    assert.equal(events.filter((e) => e.id === 'e-fin').length, 1);
  });
});
