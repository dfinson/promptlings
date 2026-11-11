import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runSuite } from "../../runner/run.js";
import { fakeCopilot, makeFixtureSuite, makeRealHome, stockArm, tempDir, testToken, withParentEnv } from "./helpers.mjs";

const evalCli = fileURLToPath(new URL("../../bin/eval.js", import.meta.url));

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

// A plugin repository served from disk at <base>/acme/review-kit.git, with the pinned commit behind the tip.
function pluginSource(root) {
  const base = join(root, "plugin-src");
  const repo = join(base, "acme", "review-kit.git");
  mkdirSync(repo, { recursive: true });
  git(repo, "init", "-q");
  git(repo, "config", "user.email", "fixture@example.com");
  git(repo, "config", "user.name", "fixture");
  writeFileSync(join(repo, "plugin.json"), JSON.stringify({ name: "review-kit", version: "1.2.3", extensions: ".github/extensions/review-kit" }));
  git(repo, "add", "plugin.json");
  git(repo, "commit", "-q", "-m", "pinned");
  const pinned = git(repo, "rev-parse", "HEAD");
  writeFileSync(join(repo, "plugin.json"), JSON.stringify({ name: "review-kit", version: "2.0.0" }));
  git(repo, "commit", "-q", "-am", "newer");
  return { base: `${base}/`, pinned };
}

function fixtureRun(root, suitesRoot, options, extraEnv = {}) {
  const realHome = makeRealHome(root);
  return withParentEnv(
    { HOME: realHome, USERPROFILE: realHome, COPILOT_HOME: join(realHome, ".copilot"), EVALS_COPILOT_BIN: fakeCopilot, ...extraEnv },
    () => runSuite({ suite: "fixture", artifactRoot: join(root, "artifacts"), suitesRoot, env: { COPILOT_GITHUB_TOKEN: testToken }, ...options }),
  );
}

const outside = (path, root) => relative(root, path).startsWith("..");

test("plugin: an arm pinned to an external plugin commit runs with --plugin-dir on a verified checkout outside the trial", async () => {
  const root = tempDir("plugin");
  const { base, pinned } = pluginSource(root);
  const plugin = { repo: "acme/review-kit", commit: pinned };
  const extra = { external: true, promptPreamble: "Review as hve-core.", qualificationChecks: ["agent-ran"] };
  const suitesRoot = makeFixtureSuite(root, { repeats: 1, arms: [{ ...stockArm, id: "hve", plugin, agent: "Code Review", extra }] });
  const run = await fixtureRun(root, suitesRoot, { stage: "smoke", runId: "plugin-run" }, { EVALS_PLUGIN_GIT_BASE: base });
  assert.deepEqual(run.trials.map((t) => t.status), ["completed"]);
  const record = JSON.parse(readFileSync(join(run.trials[0].trialDir, "trial.json"), "utf8"));
  assert.equal(record.plugin?.version, "1.2.3");
  assert.deepEqual(record.plugin, { repo: "acme/review-kit", commit: pinned, name: "review-kit", version: "1.2.3", extensions: [".github/extensions/review-kit"], path: record.plugin.path });
  assert.equal(git(record.plugin.path, "rev-parse", "HEAD"), pinned);
  assert.equal(record.flags[record.flags.indexOf("--plugin-dir") + 1], record.plugin.path);
  assert.equal(record.flags[record.flags.indexOf("--agent") + 1], "Code Review", "trial.json flags name the agent");
  for (const [key, value] of Object.entries(extra)) assert.deepEqual(record.arm[key], value, `arm.${key} passes through`);
  assert.ok(outside(record.plugin.path, record.workspacePath), "the checkout is outside the trial workspace");
  assert.ok(outside(record.plugin.path, record.homePath), "the checkout is outside the trial home");
  assert.deepEqual(run.plugins, { hve: record.plugin });
  const settings = JSON.parse(readFileSync(join(record.copilotHome, "settings.json"), "utf8"));
  assert.deepEqual(settings.sandbox.userPolicy.filesystem.readonlyPaths, [record.plugin.path], "the sandbox may read the checkout");
  assert.deepEqual(record.sandboxReadonlyPaths, [record.plugin.path]);
});

test("plugin: a plugin commit that is not 40 hexadecimal characters is rejected before any trial", async () => {
  const root = tempDir("plugin-short");
  const suitesRoot = makeFixtureSuite(root, { repeats: 1, arms: [{ ...stockArm, id: "hve", plugin: { repo: "microsoft/hve-core", commit: "299c0b6" } }] });
  await assert.rejects(fixtureRun(root, suitesRoot, { stage: "smoke", runId: "short" }), /plugin\.commit: must be a 40-character/);
  assert.equal(existsSync(join(root, "artifacts", "short", "trials")), false);
});

test("plugin: a pinned commit the source does not have fails before any trial", async () => {
  const root = tempDir("plugin-missing");
  const { base } = pluginSource(root);
  const suitesRoot = makeFixtureSuite(root, { repeats: 1, arms: [{ ...stockArm, id: "hve", plugin: { repo: "acme/review-kit", commit: "0".repeat(40) } }] });
  await assert.rejects(fixtureRun(root, suitesRoot, { stage: "smoke", runId: "missing" }, { EVALS_PLUGIN_GIT_BASE: base }), /Fetching plugin acme\/review-kit@0{40} failed/);
  assert.equal(existsSync(join(root, "artifacts", "missing", "trials")), false);
});

function cli(root, suitesRoot, runId) {
  const realHome = makeRealHome(root);
  const artifacts = join(root, "artifacts");
  const result = spawnSync(process.execPath, [evalCli, "fixture", "--stage", "smoke", "--engine", "native", "--artifact-root", artifacts, "--run-id", runId], {
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: realHome,
      USERPROFILE: realHome,
      COPILOT_HOME: join(realHome, ".copilot"),
      EVALS_SUITES_ROOT: suitesRoot,
      EVALS_COPILOT_BIN: fakeCopilot,
      COPILOT_GITHUB_TOKEN: testToken,
    },
  });
  return { result, runDir: join(artifacts, runId) };
}

test("preflight: a rejecting suite preflight aborts the stage before any trial starts", () => {
  const root = tempDir("preflight-reject");
  const suitesRoot = makeFixtureSuite(root, {
    repeats: 1,
    extraAdapter: [
      "export async function preflight(suite, ctx) {",
      '  throw new Error(`judge unreachable for ${suite.name} (runDir ${Boolean(ctx.runDir)}, token ${Boolean(ctx.env?.COPILOT_GITHUB_TOKEN)})`);',
      "}",
    ],
  });
  const { result, runDir } = cli(root, suitesRoot, "rejected");
  assert.notEqual(result.status, 0, "the stage is aborted");
  assert.match(result.stderr, /preflight rejected the stage: judge unreachable for fixture \(runDir true, token true\)/);
  assert.equal(existsSync(join(runDir, "trials")), false, "no trial ran");
  assert.deepEqual(JSON.parse(readFileSync(join(runDir, "preflight.json"), "utf8")).ok, false);
});

test("preflight: a passing preflight runs before the trials and a suite without one runs unchanged", () => {
  const root = tempDir("preflight-pass");
  const suitesRoot = makeFixtureSuite(root, {
    repeats: 1,
    extraAdapter: [
      "export async function preflight(suite, ctx) {",
      '  writeFileSync(join(ctx.runDir, "preflight-called.txt"), String(Date.now()));',
      "}",
    ],
  });
  const passed = cli(root, suitesRoot, "passed");
  assert.equal(passed.result.status, 0, passed.result.stderr);
  assert.ok(existsSync(join(passed.runDir, "preflight-called.txt")), "preflight was called");
  assert.equal(JSON.parse(readFileSync(join(passed.runDir, "preflight.json"), "utf8")).ok, true);
  const trial = JSON.parse(readFileSync(join(passed.runDir, "run.json"), "utf8")).trials[0];
  assert.equal(trial.status, "completed");

  const plainRoot = tempDir("preflight-none");
  const plain = cli(plainRoot, makeFixtureSuite(plainRoot, { repeats: 1 }), "plain");
  assert.equal(plain.result.status, 0, plain.result.stderr);
  assert.equal(existsSync(join(plain.runDir, "preflight.json")), false);
  assert.deepEqual(JSON.parse(readFileSync(join(plain.runDir, "run.json"), "utf8")).trials.map((t) => t.status), ["completed"]);
});
