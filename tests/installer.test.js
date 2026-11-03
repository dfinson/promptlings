import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { discoverAgents, packageRoot, readSideRule, skillFiles, stageRulesync, withTargets } from "../lib/content.js";
import { parseArgs, phases, reviewAgents } from "../lib/options.js";
import { pins, versionOf } from "../lib/pins.js";
import { packageBin } from "../lib/run.js";
import { launchAgentPlist, systemdUnit, windowsTaskSettings } from "../lib/services.js";

const cli = join(packageRoot, "bin", "promptlings.js");
const temporary = (t) => {
  const directory = mkdtempSync(join(tmpdir(), "promptlings-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
};
const promptlings = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });

test("Windows task keeps Normal priority without an execution limit", { skip: process.platform !== "win32" }, () => {
  const script = `$ErrorActionPreference = 'Stop'; $settings = ${windowsTaskSettings}; ` +
    "if ($settings.Priority -ne 4) { throw 'Expected task priority 4' }; " +
    "if ($settings.MultipleInstances -ne 'IgnoreNew') { throw 'Expected IgnoreNew' }; " +
    "if ($settings.ExecutionTimeLimit -ne 'PT0S') { throw 'Expected no execution limit' }";
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("macOS launch agent runs the HTTP server interactively", (t) => {
  const plist = launchAgentPlist("/Users/me/memory bin/basic-memory", 8123, "/Users/me");
  assert.match(plist, /<key>Label<\/key><string>com\.promptlings\.basic-memory<\/string>/);
  assert.match(plist, /<key>ProcessType<\/key><string>Interactive<\/string>/);
  assert.match(plist, /<array><string>\/Users\/me\/memory bin\/basic-memory<\/string><string>mcp<\/string><string>--transport<\/string><string>streamable-http<\/string><string>--host<\/string><string>127\.0\.0\.1<\/string><string>--port<\/string><string>8123<\/string><\/array>/);
  assert.match(plist, /<key>KeepAlive<\/key><dict><key>SuccessfulExit<\/key><false\/><\/dict>/);
  assert.match(plist, /<key>StandardErrorPath<\/key><string>\/Users\/me\/\.basic-memory\/mcp\.log<\/string>/);
  if (process.platform === "darwin") {
    const path = join(temporary(t), "agent.plist");
    writeFileSync(path, plist);
    const result = spawnSync("plutil", ["-lint", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
});

test("Linux user service keeps normal scheduling", (t) => {
  const unit = systemdUnit("/home/me/memory bin/basic-memory", 8123);
  for (const line of ["Nice=0", "CPUSchedulingPolicy=other", "IOSchedulingClass=best-effort", "IOSchedulingPriority=4",
    "Restart=on-failure", "WantedBy=default.target",
    'ExecStart="/home/me/memory bin/basic-memory" mcp --transport streamable-http --host 127.0.0.1 --port 8123']) {
    assert.ok(unit.split("\n").includes(line), line);
  }
  if (process.platform === "linux") {
    const directory = temporary(t);
    const executable = join(directory, "memory bin", "basic-memory");
    mkdirSync(join(directory, "memory bin"));
    writeFileSync(executable, "#!/bin/sh\nexit 0\n");
    chmodSync(executable, 0o755);
    const path = join(directory, "promptlings-memory.service");
    writeFileSync(path, systemdUnit(executable, 8123));
    const result = spawnSync("systemd-analyze", ["--user", "verify", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
});

test("repository initialization pins match the installer", () => {
  const shell = readFileSync(join(packageRoot, "skills", "promptlings-repo-init", "scripts", "init.sh"), "utf8");
  const powershell = readFileSync(join(packageRoot, "skills", "promptlings-repo-init", "scripts", "init.ps1"), "utf8");
  assert.equal(shell.match(/^BMAD_VERSION=(\S+)/m)?.[1], versionOf(pins.bmad));
  assert.equal(shell.match(/^SPECKIT_VERSION=(\S+)/m)?.[1], versionOf(pins.speckit));
  assert.equal(powershell.match(/^\$bmadVersion = "([^"]+)"/m)?.[1], versionOf(pins.bmad));
  assert.equal(powershell.match(/^\$speckitVersion = "([^"]+)"/m)?.[1], versionOf(pins.speckit));
});

test("agents and skills are discovered from the package", () => {
  const agents = discoverAgents();
  for (const name of [...reviewAgents, "memory-manager"]) assert.ok(agents.has(name), name);
  const withMemory = skillFiles({ includeMemory: true });
  const withoutMemory = skillFiles({ includeMemory: false });
  assert.ok(withMemory.includes("promptlings-memory-capture/SKILL.md"));
  assert.ok(!withoutMemory.some((path) => path.startsWith("promptlings-memory-capture/")));
  assert.ok(withoutMemory.includes("promptlings-repo-init/workflows/promptlings-delivery.yml"));
  assert.ok(!withMemory.some((path) => /__pycache__|\.pyc$/.test(path)));
});

test("frontmatter gains rulesync targets", () => {
  assert.equal(withTargets("---\r\nname: x\r\n---\r\nbody\r\n", "x"), '---\ntargets: ["*"]\nname: x\n---\nbody\n');
  assert.throws(() => withTargets("name: x", "x"), /No frontmatter/);
  assert.match(readSideRule(), /^---\ntargets: \["\*"\]\nglobs: \["\*\*\/\*"\]\n---\n<!-- memory-manager-read-side-start -->/);
});

test("options select agents and phases", () => {
  const all = [...discoverAgents().keys()];
  assert.deepEqual(parseArgs(["--review"], all).agents, reviewAgents);
  assert.deepEqual(phases(parseArgs([], all)), { tools: true, publish: true, memory: true });
  assert.deepEqual(phases(parseArgs(["publish"], all)), { tools: false, publish: true, memory: false });
  assert.deepEqual(phases(parseArgs(["--no-memory"], all)), { tools: true, publish: true, memory: false });
  assert.equal(parseArgs(["--memory-port", "8123"], all).memoryPort, 8123);
  assert.throws(() => parseArgs(["--review", "--all"], all), /only one/);
  assert.throws(() => parseArgs(["--agents", "nope"], all), /Unknown agent/);
  assert.throws(() => parseArgs(["--memory-port", "70000"], all), /port/);
  assert.throws(() => parseArgs(["--project", "x"], all), /Unknown option/);
  assert.throws(() => parseArgs(["memory", "--no-memory"], all), /cannot be combined/);
});

test("CLI lists agents and prints a dry-run plan", () => {
  const list = promptlings("--list");
  assert.equal(list.status, 0, list.stderr);
  assert.deepEqual(list.stdout.trim().split(/\r?\n/).sort(), [...discoverAgents().keys()].sort());
  const plan = promptlings("publish", "--review", "--dry-run");
  assert.equal(plan.status, 0, plan.stderr);
  assert.match(plan.stdout, /Agents: the-nitcracker, pr-walkthrough, sparring-partner/);
  assert.match(plan.stdout, /Dry run\. Nothing was downloaded or written\./);
  assert.doesNotMatch(plan.stdout, /Basic Memory:/);
  const invalid = promptlings("--bogus");
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /^Installation incomplete: Unknown option: --bogus/);
});

test("pinned publishers resolve to runnable entry points", async () => {
  for (const name of ["rulesync", "skills", "add-mcp"]) assert.ok(existsSync(packageBin(name)), name);
  const { agents, detectGlobalAgents } = await import("add-mcp");
  assert.equal(typeof detectGlobalAgents, "function");
  assert.ok(Object.values(agents).every((agent) => Array.isArray(agent.supportedTransports)));
});

test("rulesync publishes staged agents and skills into an isolated home", (t) => {
  const home = temporary(t);
  const source = join(home, "stage");
  stageRulesync(source, { agents: reviewAgents, includeMemory: false, readSide: false });
  const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: join(home, ".config"),
    APPDATA: join(home, "AppData", "Roaming"), LOCALAPPDATA: join(home, "AppData", "Local") };
  const result = spawnSync(process.execPath,
    [packageBin("rulesync"), "generate", "-g", "--input-roots", ".", "-t", "claudecode", "-f", "subagents,skills"],
    { cwd: source, env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(existsSync(join(home, ".claude", "agents", "sparring-partner.md")));
  assert.ok(existsSync(join(home, ".claude", "skills", "review-ensemble", "SKILL.md")));
  assert.ok(!existsSync(join(home, ".claude", "skills", "promptlings-memory-capture")));
});
