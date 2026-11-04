import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runCommand, verifyDelivery } from "./verify-delivery.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
if (!process.env.SPEC_DELIVERY_ARTIFACTS) throw new Error("Set SPEC_DELIVERY_ARTIFACTS to an external artifact directory");
const artifacts = resolve(process.env.SPEC_DELIVERY_ARTIFACTS);
const fromRoot = relative(root, artifacts);
if (!fromRoot || (!isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`))) {
  throw new Error("Runtime test artifacts must be outside the repository");
}
mkdirSync(artifacts, { recursive: true });

test("asynchronous execution leaves the five-second permission deadline responsive", async () => {
  const argv = [process.execPath, "-e", "setTimeout(() => process.stdout.write('finished'), 6000)"];
  let blockingDelay;
  let start = performance.now();
  const blockedTimer = new Promise((done) => setTimeout(() => {
    blockingDelay = performance.now() - start;
    done();
  }, 50));
  const blocking = spawnSync(argv[0], argv.slice(1), { encoding: "utf8", timeout: 120000 });
  await blockedTimer;
  assert.equal(blocking.status, 0, blocking.stderr);
  assert.equal(blocking.stdout, "finished");
  assert.ok(blockingDelay >= 5000, `Synchronous callback delay: ${blockingDelay} ms`);
  start = performance.now();
  const pending = runCommand(root, argv);
  await new Promise((done) => setTimeout(done, 50));
  const responsiveDelay = performance.now() - start;
  const result = await pending;
  assert.equal(result.exit, 0, result.error);
  assert.equal(result.stdout, "finished");
  assert.ok(responsiveDelay < 5000, `Asynchronous callback delay: ${responsiveDelay} ms`);
});

test("execution preserves nonzero exits, both streams and failed spawn errors", async () => {
  const result = await runCommand(root, [process.execPath, "-e",
    "process.stdout.write('output'); process.stderr.write('diagnostic'); process.exitCode = 2"]);
  assert.equal(result.exit, 2);
  assert.equal(result.stdout, "output");
  assert.equal(result.stderr, "diagnostic");
  const missing = await runCommand(root, ["spec-benchmark-command-that-does-not-exist"]);
  assert.notEqual(missing.exit, 0);
  assert.match(missing.error, /ENOENT/);
});

test("verification observes the actual worktree and refuses changed or external acceptance", async () => {
  const directory = mkdtempSync(join(artifacts, "runtime-test-"));
  const repo = join(directory, "repo");
  mkdirSync(repo);
  const git = async (cwd, ...args) => {
    const result = await runCommand(cwd, ["git", ...args]);
    assert.equal(result.exit, 0, JSON.stringify(result));
    return result.stdout.trim();
  };
  try {
    await git(repo, "init", "-b", "main");
    await git(repo, "config", "user.name", "Benchmark");
    await git(repo, "config", "user.email", "benchmark@example.invalid");
    writeFileSync(join(repo, ".gitignore"), ".gate-worktrees/\n");
    writeFileSync(join(repo, "product.txt"), "pending");
    writeFileSync(join(repo, "acceptance.py"),
      "from pathlib import Path\nassert Path('product.txt').read_text() == 'delivered'\n");
    await git(repo, "add", ".");
    await git(repo, "commit", "-qm", "approved fixture");
    const approved = await git(repo, "rev-parse", "HEAD");
    const integration = join(repo, ".gate-worktrees", "integration");
    await git(repo, "worktree", "add", "-b", "delivery", integration, approved);
    writeFileSync(join(integration, "product.txt"), "delivered");
    await git(integration, "commit", "-qam", "delivered fixture");
    const head = await git(integration, "rev-parse", "HEAD");
    const record = (cwd) => writeFileSync(join(directory, "audit.jsonl"), JSON.stringify({
      argv: ["python", "gate.py", "merge"],
      stdout: JSON.stringify({ integration_head: head, evidence: [{ cwd }] }),
    }) + "\n");
    record(integration);
    const wrongRoot = await runCommand(repo, ["python", "acceptance.py"]);
    assert.notEqual(wrongRoot.exit, 0);
    const verified = await verifyDelivery(directory, { approved, mainAtStart: approved });
    assert.equal(verified.integration, integration);
    assert.equal(verified.final.head, head);
    assert.equal(verified.final.branch, "delivery");
    assert.equal(verified.mainUnchanged, true);
    assert.equal(verified.acceptanceUnchanged, true);
    assert.equal(verified.acceptance.exit, 0, JSON.stringify(verified.acceptance));
    writeFileSync(join(directory, "audit.jsonl"), JSON.stringify({
      argv: ["python", "gate.py", "apply"],
      stdout: JSON.stringify({ status: "verified", tests_head: head,
        applied_at: "2026-11-04T00:00:00Z", evidence: [{ cwd: integration }] }),
    }) + "\n");
    const applied = await verifyDelivery(directory, { approved, mainAtStart: approved });
    assert.equal(applied.integration, integration);
    assert.equal(applied.acceptance.exit, 0);
    const fullRecord = JSON.stringify({ status: "verified", integration_head: head, evidence: [{ cwd: integration }] });
    const recordPath = join(directory, "record.json");
    writeFileSync(recordPath, fullRecord);
    writeFileSync(join(directory, "audit.jsonl"), JSON.stringify({
      argv: ["python", "gate.py", "merge"],
      stdout: JSON.stringify({ status: "verified", record: recordPath,
        record_sha256: createHash("sha256").update(fullRecord).digest("hex"), evidence: [] }),
    }) + "\n");
    const recorded = await verifyDelivery(directory, { approved, mainAtStart: approved });
    assert.equal(recorded.integration, integration);
    assert.equal(recorded.acceptance.exit, 0);
    writeFileSync(recordPath, "{}");
    await assert.rejects(verifyDelivery(directory, { approved }), /content hash/);
    record(integration);
    writeFileSync(join(integration, "acceptance.py"),
      "from pathlib import Path\nPath('unexpected-execution').touch()\n");
    const changed = await verifyDelivery(directory, { approved, mainAtStart: approved });
    assert.equal(changed.acceptanceUnchanged, false);
    assert.equal(changed.acceptance.exit, null);
    assert.match(changed.acceptance.error, /Refusing/);
    assert.equal(existsSync(join(integration, "unexpected-execution")), false);
    record(directory);
    await assert.rejects(verifyDelivery(directory, { approved }), /outside this fixture/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("token-weighted scoring preserves unknown billing instead of inventing zero cost", async () => {
  const directory = mkdtempSync(join(artifacts, "runtime-scoring-"));
  const trial = join(directory, "plan-1-candidate");
  mkdirSync(trial);
  mkdirSync(join(trial, "repo"));
  writeFileSync(join(trial, "repo", "human-spec.md"), "# Human specification\n");
  const result = {
    arm: "candidate", kind: "plan", repeat: 1, seconds: 1, base: "base", approved: "base",
    final: { main: "base", head: "base", branch: "delivery", status: "", diff: "" },
    usage: [5, 7].map((units) => ({ model: "fixture-model", cost: 1, aiCreditsStatus: "complete",
      copilotUsage: { totalNanoAiu: units * 1000000000 } })),
  };
  const score = async () => {
    writeFileSync(join(trial, "result.json"), JSON.stringify(result));
    const execution = await runCommand(root, [process.execPath, join(root, "tests", "spec-delivery", "score.mjs"), directory]);
    assert.equal(execution.exit, 0, JSON.stringify(execution));
    return JSON.parse(readFileSync(join(directory, "summary.json"), "utf8")).rows[0];
  };
  try {
    writeFileSync(join(trial, "audit.jsonl"), [
      { tool: "fixture_write", owner: "master", path: "human-spec.md" },
      { tool: "fixture_write", owner: "master", path: "..\\..\\outside.md" },
    ].map(JSON.stringify).join("\n") + "\n");
    const complete = await score();
    assert.equal(complete.nanoAiu, 12000000000);
    assert.equal(complete.billingComplete, true);
    assert.equal(complete.billingUnits, 2);
    assert.deepEqual(complete.specFiles.map((document) => document.file), ["human-spec.md"]);
    delete result.usage[1].copilotUsage;
    const incomplete = await score();
    assert.equal(incomplete.nanoAiu, null);
    assert.equal(incomplete.billingComplete, false);
    assert.equal(incomplete.billingUnits, 2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
