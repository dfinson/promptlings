import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { discoverAgents, packageRoot, readSideRule, skillFiles, stageRulesync, withTargets } from "../lib/content.js";
import { experienceAgent, parseArgs, phases, reviewAgents } from "../lib/options.js";
import { dpkgInstalled, listedNames, mergeSkillLocks, npmMissing, pendingSkillSources, regString, skillSourceInstalled, skillsAddConcurrent, verifyExperience, windowsPackageIds } from "../lib/tools.js";
import { pins } from "../lib/pins.js";
import { deps, installMemory } from "../lib/memory.js";
import { capture, packageBin, quoteForCmd, runBuffered, which } from "../lib/run.js";
import { launchAgentPlist, systemdUnit, windowsServerScript, windowsStopScript, windowsTaskName, windowsTaskScript, windowsTaskSettings } from "../lib/services.js";

const cli = join(packageRoot, "bin", "promptlings.js");
const temporary = (t) => {
  const directory = mkdtempSync(join(tmpdir(), "promptlings-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
};
const promptlings = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });

test("Windows task keeps Normal priority and bounded failure recovery without an execution limit", { skip: process.platform !== "win32" }, () => {
  const script = `$ErrorActionPreference = 'Stop'; $settings = ${windowsTaskSettings}; ` +
    "if ($settings.Priority -ne 4) { throw 'Expected task priority 4' }; " +
    "if ($settings.MultipleInstances -ne 'IgnoreNew') { throw 'Expected IgnoreNew' }; " +
    "if ($settings.RestartCount -ne 3) { throw 'Expected three retries' }; " +
    "if ($settings.RestartInterval -ne 'PT1M') { throw 'Expected one minute between retries' }; " +
    "if ($settings.ExecutionTimeLimit -ne 'PT0S') { throw 'Expected no execution limit' }";
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("Windows registration replaces the same task and launches the exit-reporting wrapper", () => {
  const pythonw = "C:\\Memory tools\\O'Brien\\Scripts\\pythonw.exe";
  const script = windowsTaskScript(pythonw, 8123);
  assert.ok(script.includes("-Execute 'C:\\Memory tools\\O''Brien\\Scripts\\pythonw.exe'"));
  assert.doesNotMatch(script, /-Execute.*(?:powershell|cmd|conhost)\.exe/i);
  assert.match(script, /-LogonType Interactive -RunLevel Limited/);
  assert.ok(script.includes(`Register-ScheduledTask -TaskName '${windowsTaskName}'`));
  assert.match(script, /-Principal \$principal -Force/);
  assert.ok(script.includes(`Start-ScheduledTask -TaskName '${windowsTaskName}'`));
  const encoded = script.match(/b64decode\(''([A-Za-z0-9+/=]+)''\)/)[1];
  assert.equal(Buffer.from(encoded, "base64").toString("utf8"), windowsServerScript(pythonw, 8123));
  assert.match(windowsServerScript(pythonw, 8123), /creationflags=subprocess\.CREATE_NO_WINDOW/);
});

test("Windows task stop captures descendants before stopping and does not launch a console", () => {
  const script = windowsStopScript("C:\\Tools\\basic-memory.exe", "C:\\Tools\\basic-memory");
  assert.ok(script.indexOf("$owned +=") < script.indexOf("Stop-ScheduledTask"));
  assert.match(script, /\$current\.CreationDate -eq \$original\.CreationDate/);
  assert.match(script, /Stop-Process -Id \$current\.ProcessId -Force/);
  assert.doesNotMatch(script, /cmd\.exe|taskkill|Start-Process/i);
});

test("Windows service resolves pythonw from the installed uv environment", { skip: process.platform !== "win32" }, (t) => {
  t.mock.method(deps, "capture", (command, args) => {
    assert.equal(command, "uv");
    assert.deepEqual(args, ["tool", "dir"]);
    return "C:\\Tools\\uv";
  });
  let script;
  t.mock.method(deps, "powershell", (value) => { script = value; });
  deps.startService("C:\\Tools\\basic-memory.exe", 8123);
  assert.equal(script, windowsTaskScript("C:\\Tools\\uv\\basic-memory\\Scripts\\pythonw.exe", 8123));
});

const pythonw = process.env.PROMPTLINGS_TEST_PYTHONW || which("pythonw");
test("Windows command helpers suppress child consoles at process creation", {
  skip: process.platform !== "win32",
}, async () => {
  assert.ok(pythonw, "Windows tests require pythonw on PATH or PROMPTLINGS_TEST_PYTHONW.");
  const python = join(dirname(pythonw), "python.exe");
  const args = ["-c", "import ctypes;print(ctypes.windll.kernel32.GetConsoleWindow())"];
  assert.equal(capture(python, args, { quiet: true }), "0");
  const buffered = await runBuffered(python, args);
  assert.equal(buffered.status, 0, buffered.output);
  assert.equal(buffered.output.trim(), "0");
});

test("Windows server wrapper retries failures within its bound and never allocates a console", {
  skip: process.platform !== "win32",
}, (t) => {
  assert.ok(pythonw, "Windows tests require pythonw on PATH or PROMPTLINGS_TEST_PYTHONW.");
  for (const [failures, attempts, code, missing] of [[0, 1, 0, false], [1, 2, 0, false], [9, 4, 37, false], [9, 4, 1, true]]) {
    const directory = temporary(t);
    const metadata = join(directory, "basic_memory-0.0.dist-info");
    mkdirSync(metadata);
    writeFileSync(join(metadata, "METADATA"), "Metadata-Version: 2.1\nName: basic-memory\nVersion: 0.0\n");
    writeFileSync(join(metadata, "entry_points.txt"), "[console_scripts]\nbasic-memory = fixture:main\n");
    writeFileSync(join(directory, "fixture.py"), `import ctypes, os, sys
from pathlib import Path
def main():
    assert ctypes.windll.kernel32.GetConsoleWindow() == 0
    assert sys.argv[1:] == ["mcp", "--transport", "streamable-http", "--host", "127.0.0.1", "--port", "8123"]
    count = Path.home() / "attempts.txt"
    attempt = int(count.read_text()) + 1 if count.exists() else 1
    count.write_text(str(attempt))
    print("fixture stdout")
    print("fixture stderr", file=sys.stderr)
    return 37 if attempt <= int(os.environ["FAILURES"]) else 0
`);
    const env = { ...process.env, USERPROFILE: directory, PYTHONPATH: directory, FAILURES: String(failures) };
    // Keep unit tests fast while asserting the production delay. The scheduled acceptance uses the real clock.
    const clock = `import ctypes, time
from pathlib import Path
assert ctypes.windll.kernel32.GetConsoleWindow() == 0
def delay(seconds):
    assert seconds == 60
    with (Path.home() / "delays.txt").open("a") as output:
        output.write("60\\n")
time.sleep = delay
`;
    const child = missing ? join(directory, "missing-pythonw.exe") : pythonw;
    const result = spawnSync(pythonw, ["-c", clock + windowsServerScript(child, 8123)],
      { cwd: directory, env, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, code, result.stdout + result.stderr);
    const log = readFileSync(join(directory, ".basic-memory", "mcp.log"), "utf8");
    assert.equal(log.match(/Starting Basic Memory on 127\.0\.0\.1:8123/g).length, attempts);
    assert.ok(log.includes(`Basic Memory exited with code ${code}`));
    assert.equal(log.includes("restart budget exhausted"), code !== 0);
    if (!missing) {
      assert.equal(Number(readFileSync(join(directory, "attempts.txt"), "utf8")), attempts);
      assert.match(log, /fixture stdout/);
      assert.match(log, /fixture stderr/);
    } else assert.match(log, /FileNotFoundError/);
    const delays = join(directory, "delays.txt");
    assert.equal(existsSync(delays) ? readFileSync(delays, "utf8").trim().split(/\r?\n/).length : 0, attempts - 1);
  }
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

test("agents and skills are discovered from the package", () => {
  const agents = discoverAgents();
  for (const name of [...reviewAgents, "memory-manager", "spec-master", "experiment-director"]) assert.ok(agents.has(name), name);
  const withMemory = skillFiles({ includeMemory: true });
  const withoutMemory = skillFiles({ includeMemory: false });
  assert.ok(withMemory.includes("promptlings-memory-capture/SKILL.md"));
  assert.ok(!withoutMemory.some((path) => path.startsWith("promptlings-memory-capture/")));
  assert.ok(withoutMemory.includes("spec-delivery/references/spec-template.md"));
  assert.ok(withoutMemory.includes("intent-alignment/SKILL.md"));
  for (const path of ["ab-testing/SKILL.md", "comparative-evaluation/SKILL.md",
    "comparative-evaluation/references/protocol-template.md", "comparative-evaluation/references/sources.md"]) {
    assert.ok(withoutMemory.includes(path), path);
  }
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
  assert.throws(() => parseArgs(["--no-dependencies"], all), /--no-dependencies was removed/);
  assert.throws(() => parseArgs(["memory", "--no-memory"], all), /--no-memory does not apply to the memory command/);
  assert.throws(() => parseArgs(["publish", "--no-demo"], all), /--no-demo does not apply to the publish command/);
  assert.throws(() => parseArgs(["--agents", "-x"], all), /requires a value/);
});

test("interactive presentation installs its toolkit and publish skips it", () => {
  const all = [...discoverAgents().keys()];
  assert.ok(all.includes(experienceAgent));
  const install = parseArgs(["--agents", experienceAgent, "--no-playwright"], all);
  assert.equal(install.experience, true);
  assert.equal(install.playwright, true);
  assert.equal(install.notices.length, 1);
  const publish = parseArgs(["publish"], all);
  assert.equal(publish.experience, false);
  assert.ok(!publish.agents.includes(experienceAgent));
  assert.match(publish.notices[0], /skipped/);
  assert.throws(() => parseArgs(["publish", "--agents", experienceAgent], all), /requires its dependencies/);
  assert.throws(() => parseArgs(["publish", "--all"], all), /requires its dependencies/);
  assert.equal(parseArgs(["--review"], all).experience, false);
});

test("experience toolkit verification checks installed versions", (t) => {
  const root = temporary(t);
  const write = (name, version) => {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, "package.json"), JSON.stringify({ name, version }));
  };
  write("@scope/pkg", "1.2.3");
  write("plain", "2.0.0");
  verifyExperience(root, ["@scope/pkg@1.2.3", "plain@2.0.0"]);
  assert.throws(() => verifyExperience(root, ["missing@1.0.0"]), /package missing: missing/);
  assert.throws(() => verifyExperience(root, ["plain@2.0.1"]), /expected plain@2\.0\.1, found plain@2\.0\.0/);
  for (const spec of pins.experiencePackages) assert.ok(spec.lastIndexOf("@") > 0, spec);
});

test("global npm installs only missing or differently versioned pins", (t) => {
  const root = temporary(t);
  const write = (name, version) => {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, "package.json"), JSON.stringify({ name, version }));
  };
  write("@scope/pkg", "1.2.3");
  write("plain", "2.0.0");
  mkdirSync(join(root, "broken"));
  writeFileSync(join(root, "broken", "package.json"), "{");
  assert.deepEqual(npmMissing(root, ["@scope/pkg@1.2.3", "plain@2.0.1", "absent@1.0.0", "broken@1.0.0"]),
    ["plain@2.0.1", "absent@1.0.0", "broken@1.0.0"]);
  assert.deepEqual(npmMissing(root, ["@scope/pkg@1.2.3", "plain@2.0.0"]), []);
});

test("native package selection skips commands that are already present", () => {
  const probes = (found) => {
    const called = [];
    const present = Object.fromEntries(["python", "git", "gh", "uv", "ffmpeg", "poppler", "code", "office"]
      .map((name) => [name, () => { called.push(name); return found.includes(name); }]));
    return { present, called };
  };
  const all = { hyperframes: true, demo: true };
  assert.deepEqual(windowsPackageIds(all, probes(["python", "git", "gh", "uv", "ffmpeg", "poppler", "code", "office"]).present), []);
  assert.deepEqual(windowsPackageIds(all, probes(["git", "uv", "code"]).present), ["Python.Python.3.12", "GitHub.cli",
    "Gyan.FFmpeg", "oschwartz10612.Poppler", "TheDocumentFoundation.LibreOffice"]);
  const minimal = probes([]);
  assert.deepEqual(windowsPackageIds({ hyperframes: false, demo: false }, minimal.present),
    ["Python.Python.3.12", "Git.Git", "GitHub.cli", "astral-sh.uv"]);
  assert.deepEqual(minimal.called, ["python", "git", "gh", "uv"]);
  assert.deepEqual([...listedNames("git 2.47.0\npython@3.12 3.12.7 3.12.6\n\n")], ["git", "python@3.12"]);
  assert.deepEqual([...dpkgInstalled("git installed\ngh not-installed\nffmpeg config-files\ncurl installed\n")], ["git", "curl"]);
});

test("skill locks merge and keep the first install time", () => {
  const shared = { version: 3, skills: { a: { source: "old", installedAt: "t0", updatedAt: "t0" } }, dismissed: { x: true } };
  const merged = mergeSkillLocks(shared, [
    { version: 3, skills: { a: { source: "new", installedAt: "t1", updatedAt: "t1" } } },
    null,
    { version: 3, skills: { b: { source: "b", installedAt: "t2", updatedAt: "t2" } } },
  ]);
  assert.deepEqual(merged.skills.a, { source: "new", installedAt: "t0", updatedAt: "t1" });
  assert.equal(merged.skills.b.installedAt, "t2");
  assert.deepEqual(merged.dismissed, { x: true });
  assert.deepEqual(mergeSkillLocks(null, [{ version: 3, skills: { c: { installedAt: "t" } } }]).skills, { c: { installedAt: "t" } });
});

test("registry string values are parsed and expanded", () => {
  const output = "\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    REG_EXPAND_SZ    %HOME%\\bin;C:\\tools\r\n\r\n";
  assert.equal(regString(output, { HOME: "C:\\Users\\me" }), "C:\\Users\\me\\bin;C:\\tools");
  assert.equal(regString("\nHKEY_LOCAL_MACHINE\\x\n    (Default)    REG_SZ    C:\\Word\\WINWORD.EXE\n"), "C:\\Word\\WINWORD.EXE");
  assert.equal(regString("\nHKEY_LOCAL_MACHINE\\x\n    (Default)    REG_SZ    \n"), null);
  assert.equal(regString(""), null);
});

test("pinned skill sources already in the lock are skipped", () => {
  const source = "https://github.com/acme/kit/tree/abc123/skills";
  const single = "https://github.com/acme/kit/tree/abc123/skills/one";
  const entry = (skillPath, ref = "abc123") => ({ source: "acme/kit", sourceType: "github", sourceUrl: "https://github.com/acme/kit.git", ref, skillPath });
  const lock = { version: 3, skills: { one: entry("skills/one/SKILL.md"), two: entry("skills/two/SKILL.md") } };
  const all = () => true;
  assert.equal(skillSourceInstalled(lock, source, all), true);
  assert.equal(skillSourceInstalled(lock, single, all), true);
  assert.equal(skillSourceInstalled(lock, source, (name) => name !== "two"), false);
  assert.equal(skillSourceInstalled({ skills: { one: entry("skills/one/SKILL.md", "old") } }, source, all), false);
  assert.equal(skillSourceInstalled({ skills: { one: entry("other/one/SKILL.md") } }, source, all), false);
  assert.equal(skillSourceInstalled({ skills: { one: { ...entry("skills/one/SKILL.md"), sourceType: "local" } } }, source, all), false);
  assert.equal(skillSourceInstalled(null, source, all), false);
  assert.deepEqual(pendingSkillSources([source, "https://github.com/acme/other/tree/abc123/skills"], lock, all),
    ["https://github.com/acme/other/tree/abc123/skills"]);
});

test("external skills install concurrently with ordered output and a merged lock", async (t) => {
  const state = temporary(t);
  const saved = process.env.XDG_STATE_HOME;
  t.after(() => { if (saved === undefined) delete process.env.XDG_STATE_HOME; else process.env.XDG_STATE_HOME = saved; });
  process.env.XDG_STATE_HOME = state;
  const printed = [];
  t.mock.method(console, "log", (line) => printed.push(line));
  let running = 0;
  let peak = 0;
  const runner = async (args, options) => {
    running += 1;
    peak = Math.max(peak, running);
    const source = args[1];
    assert.notEqual(options.env.XDG_STATE_HOME, state);
    await new Promise((resolve) => setTimeout(resolve, source === "first" ? 30 : 5));
    const lock = join(options.env.XDG_STATE_HOME, "skills", ".skill-lock.json");
    mkdirSync(join(options.env.XDG_STATE_HOME, "skills"), { recursive: true });
    writeFileSync(lock, JSON.stringify({ version: 3, skills: { [source]: { source, installedAt: "now" } } }));
    running -= 1;
    return { status: source === "bad" ? 1 : 0, output: `installed ${source}\n` };
  };
  await skillsAddConcurrent(["first", "second"], runner);
  assert.equal(peak, 2);
  assert.deepEqual(printed.slice(1), ["+ skills add first\ninstalled first", "+ skills add second\ninstalled second"]);
  const lock = JSON.parse(readFileSync(join(state, "skills", ".skill-lock.json"), "utf8"));
  assert.deepEqual(Object.keys(lock.skills).sort(), ["first", "second"]);
  await assert.rejects(skillsAddConcurrent(["second", "bad"], runner), /External skill installation failed: bad \(1\)/);
});

test("memory installs, starts, waits, then registers clients", async (t) => {
  const log = [];
  const saved = { ...deps };
  t.after(() => Object.assign(deps, saved));
  Object.assign(deps, {
    which: (name) => (name === "basic-memory" ? "/bin/basic-memory" : `/bin/${name}`),
    run: (command) => log.push(`run ${command}`),
    stopPreviousServer: () => log.push("stop"),
    uvToolInstall: () => log.push("install"),
    uvToolPath: () => {},
    skillsAdd: () => log.push("skills"),
    portOpen: async () => false,
    startService: () => log.push("start"),
    waitUntilReady: async () => log.push("ready"),
    register: async () => log.push("register"),
  });
  await installMemory({ skills: false, startup: true, memoryPort: 8123 }, {});
  assert.deepEqual(log, ["stop", "install", "run basic-memory", "start", "ready", "register"]);

  log.length = 0;
  await installMemory({ skills: false, startup: true, memoryPort: 8123 }, {});
  assert.deepEqual(log, ["stop", "install", "run basic-memory", "start", "ready", "register"]);

  log.length = 0;
  deps.waitUntilReady = async () => { throw new Error("not ready"); };
  await assert.rejects(installMemory({ skills: false, startup: true, memoryPort: 8123 }, {}), /not ready/);
  assert.ok(!log.includes("register"));
});

test("cmd quoting rejects unsafe characters and quotes spaces", () => {
  assert.equal(quoteForCmd("plain-arg"), "plain-arg");
  assert.equal(quoteForCmd("has space"), '"has space"');
  assert.throws(() => quoteForCmd('a"b'));
  assert.throws(() => quoteForCmd("%PATH%"));
});

test("which honors PATHEXT on Windows", { skip: process.platform !== "win32" }, (t) => {
  const directory = temporary(t);
  writeFileSync(join(directory, "fake-tool.CMD"), "@echo off\n");
  const saved = { PATH: process.env.PATH, PATHEXT: process.env.PATHEXT };
  t.after(() => Object.assign(process.env, saved));
  process.env.PATH = directory;
  process.env.PATHEXT = ".COM;.EXE;.CMD";
  assert.equal(which("fake-tool")?.toLowerCase(), join(directory, "fake-tool.CMD").toLowerCase());
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
  stageRulesync(source, { agents: [...reviewAgents, "experiment-director"], includeMemory: false, readSide: false });
  const env = { ...process.env, HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: join(home, ".config"),
    APPDATA: join(home, "AppData", "Roaming"), LOCALAPPDATA: join(home, "AppData", "Local") };
  const result = spawnSync(process.execPath,
    [packageBin("rulesync"), "generate", "-g", "--input-roots", ".", "-t", "claudecode", "-f", "subagents,skills"],
    { cwd: source, env, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.ok(existsSync(join(home, ".claude", "agents", "sparring-partner.md")));
  assert.ok(existsSync(join(home, ".claude", "skills", "review-ensemble", "SKILL.md")));
  const alignment = join(home, ".claude", "skills", "intent-alignment", "SKILL.md");
  const instructionBody = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n")
    .replace(/^---\n[\s\S]*?\n---\n/, "").trimStart();
  assert.match(readFileSync(alignment, "utf8"), /^name: intent-alignment\r?$/m);
  assert.equal(instructionBody(alignment), instructionBody(join(packageRoot, "skills", "intent-alignment", "SKILL.md")));
  assert.equal(instructionBody(join(home, ".claude", "skills", "review-ensemble", "SKILL.md")),
    instructionBody(join(packageRoot, "skills", "review-ensemble", "SKILL.md")));
  assert.equal(instructionBody(join(home, ".claude", "agents", "sparring-partner.md")),
    instructionBody(join(packageRoot, "agents", "reasoning", "sparring-partner.agent.md")));
  assert.ok(existsSync(join(home, ".claude", "agents", "experiment-director.md")));
  assert.ok(existsSync(join(home, ".claude", "skills", "ab-testing", "SKILL.md")));
  assert.ok(existsSync(join(home, ".claude", "skills", "comparative-evaluation", "references", "protocol-template.md")));
  assert.ok(existsSync(join(home, ".claude", "skills", "comparative-evaluation", "references", "sources.md")));
  assert.ok(!existsSync(join(home, ".claude", "skills", "promptlings-memory-capture")));
});
