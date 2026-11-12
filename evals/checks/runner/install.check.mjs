import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, delimiter, dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { runTrial } from "../../runner/index.js";
import * as install from "../../runner/install.js";
import { fakeCopilot, stockArm, tempDir, testToken, treeDigest, withParentEnv } from "./helpers.mjs";


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

test("install: a source whose shrinkwrap matches the checkout reuses its node_modules without running npm", async () => {
  const root = tempDir("install-lock");
  const bin = join(root, "bin");
  const calls = join(root, "npm-calls.txt");
  mkdirSync(bin);
  // A recording npm first on PATH: the real one would hit the network and take minutes.
  writeFileSync(join(bin, "npm.cmd"), `@echo npm %*>>"${calls}"\r\n@exit /b 0\r\n`);
  writeFileSync(join(bin, "npm"), `#!/bin/sh\necho "npm $*" >> "${calls}"\n`, { mode: 0o755 });
  const source = await withParentEnv({ PATH: `${bin}${delimiter}${process.env.PATH}` }, () =>
    install.prepareSource("HEAD", { root: join(root, "artifacts") }));
  assert.equal(existsSync(calls), false, `npm ran: ${existsSync(calls) ? readFileSync(calls, "utf8") : ""}`);
  assert.ok(lstatSync(join(source.dir, "node_modules")).isSymbolicLink(), "node_modules links to the checkout's");
});

// Every selection form the runner accepts, plus every installing arm declared by a shipped suite.
function selectionCases() {
  const cases = [
    ["absent", undefined],
    ["null", null],
    ["all", "all"],
    ["review", "review"],
    ["raw --review", "--review"],
    ["raw --agents list", "--agents sparring-partner,the-nitcracker"],
    ["agent list", "sparring-partner,the-nitcracker"],
    ["array", ["--agents", "sparring-partner"]],
  ].map(([label, selection]) => ({ label, arm: { id: label, ref: "HEAD", selection } }));
  const suitesDir = join(repoRoot, "evals", "suites");
  if (!existsSync(suitesDir)) return cases;
  for (const entry of readdirSync(suitesDir, { withFileTypes: true })) {
    const file = join(suitesDir, entry.name, "suite.yaml");
    if (!entry.isDirectory() || !existsSync(file)) continue;
    for (const arm of parse(readFileSync(file, "utf8")).arms ?? []) {
      if (!install.isStockArm(arm)) cases.push({ label: `suite ${entry.name} arm ${arm.id}`, arm });
    }
  }
  return cases;
}

test("install: every selection form and every shipped suite arm passes the installer's publish --dry-run", () => {
  assert.deepEqual(install.selectionArgs("--review"), ["--review"]);
  assert.deepEqual(install.selectionArgs("all"), [], "publish rejects --all because it includes an agent that needs dependencies");
  for (const { label, arm } of selectionCases()) {
    const { args, plan } = install.preflightInstall(arm);
    assert.ok(!args.includes("--dry-run"), label);
    assert.match(plan, /^Agents: .+$/m, `${label}: the installer printed an agent plan`);
  }
});

test("install: a selection the installer rejects fails preflight with the arm and the installer's message", () => {
  assert.throws(() => install.preflightInstall({ id: "bad", ref: "HEAD", selection: "--agents" }), /Arm bad selection "--agents" is rejected by the installer.*--agents requires a value/s);
  assert.throws(() => install.preflightInstall({ id: "unknown", ref: "HEAD", selection: "no-such-agent" }), /Unknown agent: no-such-agent/);
});
