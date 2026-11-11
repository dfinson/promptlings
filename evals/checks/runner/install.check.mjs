import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runTrial } from "../../runner/index.js";
import { fakeCopilot, stockArm, tempDir, testToken, treeDigest, withParentEnv } from "./helpers.mjs";
import { mkdirSync } from "node:fs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const limits = { timeoutMs: 120_000, maxAiCredits: 30 };

function promptlingsNames() {
  const agents = readdirSync(join(repoRoot, "agents"), { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".agent.md"))
    .map((f) => basename(f, ".agent.md"));
  const skills = readdirSync(join(repoRoot, "skills"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  return [...agents, ...skills];
}

async function trial(label, arm) {
  const root = tempDir(label);
  const trialDir = join(root, "trial");
  const workspace = join(root, "workspace");
  mkdirSync(workspace, { recursive: true });
  const record = await withParentEnv({ EVALS_COPILOT_BIN: fakeCopilot }, () =>
    runTrial({ trialDir, workspace, prompt: "Answer briefly.", arm, limits, env: { COPILOT_GITHUB_TOKEN: testToken, EVALS_ARTIFACT_ROOT: join(root, "artifacts") } }));
  return { trialDir, record, home: join(trialDir, "home") };
}

const fakeFiles = new Set([".copilot/fake-copilot-marker", ".copilot/fake-copilot-record.json"]);
const isFake = (file) => fakeFiles.has(file) || file.startsWith(".copilot/session-state/");

test("install: a stock arm home contains no Promptlings agent or skill files", async () => {
  const { home, record } = await trial("install-stock", stockArm);
  assert.equal(record.status, "completed", record.reason);
  assert.deepEqual(record.installedHashes, {});
  const names = promptlingsNames();
  const files = Object.keys(treeDigest(home));
  assert.deepEqual(files.filter((f) => !isFake(f)), []);
  assert.deepEqual(files.filter((f) => names.some((n) => f.includes(n))), []);
});

test("install: a Promptlings arm home records hashes of exactly the installed selection", async () => {
  const arm = { ...stockArm, id: "promptlings", ref: "HEAD", selection: ["--agents", "sparring-partner"] };
  const { home, record } = await trial("install-ref", arm);
  assert.equal(record.status, "completed", record.reason);
  assert.match(record.sourceSha, /^[0-9a-f]{40}$/);

  const actual = treeDigest(home);
  for (const file of Object.keys(actual)) if (isFake(file)) delete actual[file];
  assert.deepEqual(record.installedHashes, actual, "recorded hashes must cover exactly the files in the trial home");

  const files = Object.keys(record.installedHashes);
  assert.ok(files.includes(".copilot/agents/sparring-partner.md") || files.some((f) => /^\.copilot\/agents\/sparring-partner\./.test(f)), "the selected agent is installed for Copilot");
  const otherAgents = promptlingsNames().filter((n) => n !== "sparring-partner" && readdirSync(join(repoRoot, "agents"), { recursive: true }).map(String).some((f) => f.endsWith(`${n}.agent.md`)));
  assert.deepEqual(files.filter((f) => otherAgents.some((n) => f.includes(`/agents/${n}.`))), [], "unselected agents are not installed");
  const seen = JSON.parse(readFileSync(join(home, ".copilot", "fake-copilot-record.json"), "utf8"));
  assert.ok(seen.agents.some((a) => a.startsWith("sparring-partner")));
});
