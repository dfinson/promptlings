import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { packageRoot, readSideRule, skillFiles, stageRulesync, withTargets } from "../lib/content.js";

const read = (...parts) => readFileSync(join(packageRoot, ...parts), "utf8").replace(/\r\n/g, "\n");
const skillPath = ["skills", "promptlings-memory-capture", "SKILL.md"];
const managerPath = ["agents", "context", "memory-manager.agent.md"];

test("memory source retention and qualified recall survive publication staging", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "promptlings-memory-contracts-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  stageRulesync(directory, { agents: ["memory-manager"], includeMemory: true, readSide: true });

  assert.equal(readFileSync(join(directory, "subagents", "memory-manager.md"), "utf8"),
    withTargets(read(...managerPath), "memory-manager"));
  assert.equal(readFileSync(join(directory, ...skillPath), "utf8"),
    withTargets(read(...skillPath), "promptlings-memory-capture"));
  assert.equal(readFileSync(join(directory, "rules", "promptlings-memory.md"), "utf8"), readSideRule());
});

test("capture contract requires retained evidence before derived publication", () => {
  const capture = read(...skillPath);
  assert.match(capture, /complete available user\/assistant conversation and authorized supplied evidence/);
  assert.match(capture, /ordinary notes tagged `source-record`/);
  assert.match(capture, /Write source-record notes first[\s\S]*read them back and compare/);
  assert.match(capture, /Each derived claim must identify its supporting source note/);
  assert.match(capture, /Each standalone summary or observation must retain[\s\S]*conditions, exceptions, explicit allowances/);
  assert.match(capture, /redaction's source location and reason without repeating its contents/);
  assert.match(capture, /Never reconstruct unavailable wording/);
  assert.match(capture, /timeout or uncertain acknowledgment[\s\S]*exact target before retrying/);
  assert.match(capture, /Never report a complete capture while source retention or required readback is incomplete/);
  assert.doesNotMatch(capture, /Write the checkpoint first/);
});

test("manager and generated read-side contract retain source navigation and qualifications", () => {
  const manager = read(...managerPath);
  assert.match(manager, /Load `promptlings-memory-capture`/);
  assert.match(manager, /\*\*Source record:\*\*/);
  assert.match(manager, /source-first write order/);
  assert.match(manager, /Each independently retrieved summary or observation must preserve/);
  assert.doesNotMatch(manager, /Omit routine tool activity, copied repository content/);
  assert.doesNotMatch(manager, /Do not apply ingestion's verbatim-source procedure to an ordinary session save/);
  for (const contract of [manager, readSideRule()]) {
    assert.match(contract, /Before relying on a consequential claim/);
    assert.match(contract, /supporting memory links/);
    assert.match(contract, /source range/);
    assert.match(contract, /correction history/);
  }
});

test("memory fidelity fixtures expose source IDs and keep the oracle separate", () => {
  const lines = read("tests", "memory-fixtures", "source.txt").trimEnd().split("\n");
  const ids = lines.map((line) => line.match(/^(T\d{2}) \| /)?.[1]);
  assert.equal(ids.length, 22);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(Boolean));
  const oracle = JSON.parse(read("tests", "memory-fixtures", "questions.json"));
  assert.equal(oracle.questions.length, 9);
  assert.equal(new Set(oracle.questions.map(({ id }) => id)).size, oracle.questions.length);
  for (const question of oracle.questions) {
    assert.ok(question.question.length > 0);
    assert.ok(question.expected.length > 0);
    assert.ok(question.source.every((id) => ids.includes(id)));
  }
  assert.ok(!skillFiles({ includeMemory: true }).some((path) => path.includes("memory-fixtures")));
});
