import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import test from "node:test";
import { psLiteral, windowsServerScript, windowsStopScript, windowsTaskName, windowsTaskScript } from "../lib/services.js";

// Explicit opt-in: this needs an installed Basic Memory environment and creates only isolated resources.
const artifactRoot = process.env.PROMPTLINGS_MEMORY_ACCEPTANCE_DIR;
const installedPythonw = process.env.PROMPTLINGS_TEST_PYTHONW;
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
function powershell(script) {
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-OutputFormat", "Text",
    "-EncodedCommand", Buffer.from(`$ErrorActionPreference = 'Stop'\n$ProgressPreference = 'SilentlyContinue'\n${script}`, "utf16le").toString("base64")],
  { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout.trim();
}

test("isolated Windows task recovers real MCP, replaces safely and exhausts its retry budget", {
  skip: process.platform !== "win32" || !artifactRoot,
  timeout: 900_000,
}, async () => {
  assert.ok(installedPythonw && existsSync(installedPythonw), "Set PROMPTLINGS_TEST_PYTHONW to the installed Basic Memory environment's pythonw.exe.");
  assert.ok(isAbsolute(artifactRoot), "Use an absolute artifact directory outside the repository.");
  mkdirSync(artifactRoot, { recursive: true });
  const root = mkdtempSync(join(artifactRoot, "memory-lifecycle-"));
  const name = `Promptlings Memory Test ${randomUUID()}`;
  const environment = join(root, "tools", "basic-memory");
  const pythonw = join(environment, "Scripts", "pythonw.exe");
  const sitePackages = join(dirname(dirname(installedPythonw)), "Lib", "site-packages");
  const audit = join(root, "audit");
  const home = join(root, "home");
  const config = join(homedir(), ".basic-memory", "config.json");
  const configBefore = existsSync(config) ? readFileSync(config) : null;
  const sharedSnapshot = () => JSON.parse(powershell(`
$task = Get-ScheduledTask -TaskName ${psLiteral(windowsTaskName)} -ErrorAction SilentlyContinue
@{
  xml = $(if ($task) { Export-ScheduledTask -TaskName ${psLiteral(windowsTaskName)} } else { $null })
  listeners = @(Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess)
} | ConvertTo-Json -Compress`));
  const sharedBefore = sharedSnapshot();
  const replaceName = (script) => script.replaceAll(psLiteral(windowsTaskName), psLiteral(name));
  const listenerPids = (port) => JSON.parse(powershell(
    `ConvertTo-Json -Compress -InputObject @(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess)`));
  const stop = () => powershell(replaceName(windowsStopScript(join(root, "basic-memory.exe"), environment)));
  const initialize = {
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "promptlings-acceptance", version: "1" } },
  };
  const socket = createServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const ready = async () => {
    const deadline = Date.now() + 180_000;
    do {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
          method: "POST", body: JSON.stringify(initialize), signal: AbortSignal.timeout(3000),
          headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
        });
        if (response.ok && /basic[ _-]?memory/i.test(await response.text())) {
          const session = response.headers.get("mcp-session-id");
          if (session) await fetch(`http://127.0.0.1:${port}/mcp`, {
            method: "DELETE", headers: { "mcp-session-id": session }, signal: AbortSignal.timeout(3000),
          });
          return;
        }
      } catch (error) {
        if (!["TypeError", "TimeoutError"].includes(error.name)) throw error;
      }
      await pause(1000);
    } while (Date.now() < deadline);
    throw new Error("Isolated MCP readiness timed out.");
  };
  function registration(targetHome, pythonPath) {
    const source = windowsServerScript(pythonw, port);
    const isolated = `import os, ctypes, json
from pathlib import Path
os.environ.update(${JSON.stringify({
  USERPROFILE: targetHome, BASIC_MEMORY_CONFIG_DIR: join(targetHome, ".basic-memory"),
  BASIC_MEMORY_HOME: join(targetHome, "notes"), PYTHONPATH: pythonPath,
  PROMPTLINGS_CONSOLE_AUDIT: audit,
  PYTHONDONTWRITEBYTECODE: "1",
})})
Path(${JSON.stringify(audit)}, f"wrapper-{os.getpid()}.json").write_text(json.dumps({"pid": os.getpid(), "console": ctypes.windll.kernel32.GetConsoleWindow()}))
assert ctypes.windll.kernel32.GetConsoleWindow() == 0
${source}`;
    return replaceName(windowsTaskScript(pythonw, port)).replace(
      Buffer.from(source).toString("base64"), Buffer.from(isolated).toString("base64"));
  }
  try {
    mkdirSync(audit);
    mkdirSync(home);
    writeFileSync(join(audit, "sitecustomize.py"), `import ctypes, json, os, site
from pathlib import Path
site.addsitedir(${JSON.stringify(sitePackages)})
console = ctypes.windll.kernel32.GetConsoleWindow()
Path(os.environ["PROMPTLINGS_CONSOLE_AUDIT"], f"child-{os.getpid()}.json").write_text(json.dumps({"pid": os.getpid(), "console": console}))
if console:
    os._exit(99)
`);
    const venv = spawnSync(installedPythonw, ["-m", "venv", "--without-pip", environment], {
      encoding: "utf8", windowsHide: true, env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    });
    assert.equal(venv.status, 0, venv.stdout + venv.stderr);
    // Reuse installed packages read-only. The interpreter, configuration, database and projects are isolated.
    const register = registration(home, `${audit};${sitePackages}`);
    const legacy = register.replace("-RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) ", "")
      .replace(`Start-ScheduledTask -TaskName ${psLiteral(name)}`, "");
    powershell(legacy);
    powershell(register);
    await ready();
    const initial = listenerPids(port);
    assert.equal(initial.length, 1);
    const sentinel = join(home, "notes", "preserve.txt");
    mkdirSync(dirname(sentinel), { recursive: true });
    writeFileSync(sentinel, "preserve project data\n");
    stop();
    assert.deepEqual(listenerPids(port), []);
    powershell(register);
    await ready();
    const replacement = listenerPids(port);
    assert.equal(replacement.length, 1);
    assert.notEqual(replacement[0], initial[0]);
    assert.equal(readFileSync(sentinel, "utf8"), "preserve project data\n");
    const settings = JSON.parse(powershell(`$task = Get-ScheduledTask -TaskName ${psLiteral(name)}
@{count=$task.Settings.RestartCount; interval=$task.Settings.RestartInterval; priority=$task.Settings.Priority;
instances=[string]$task.Settings.MultipleInstances; limit=$task.Settings.ExecutionTimeLimit; action=$task.Actions[0].Execute} | ConvertTo-Json -Compress`));
    assert.deepEqual(settings, {
      count: 3, interval: "PT1M", priority: 4, instances: "IgnoreNew", limit: "PT0S", action: pythonw,
    });
    // This PID was obtained from the isolated listener and is checked again before termination.
    const killedAt = Date.now();
    powershell(`$process = Get-CimInstance Win32_Process -Filter "ProcessId=${replacement[0]}"
if ($process.Name -ne 'pythonw.exe' -or $process.CommandLine -notlike '*--port ${port}*') { throw 'Unexpected failure-injection target' }
Stop-Process -Id ${replacement[0]} -Force`);
    await ready();
    const recovered = listenerPids(port);
    assert.equal(recovered.length, 1);
    assert.notEqual(recovered[0], replacement[0]);
    assert.ok(Date.now() - killedAt >= 60_000, "Recovery must honor the one-minute delay.");
    console.log(`Real MCP recovered with a new PID after ${Math.round((Date.now() - killedAt) / 1000)} seconds.`);
    const log = readFileSync(join(home, ".basic-memory", "mcp.log"), "utf8");
    assert.match(log, /exited with code -?[1-9]/);
    assert.match(log, /Retrying Basic Memory in 60 seconds/);
    stop();
    assert.deepEqual(listenerPids(port), []);
    powershell(`Unregister-ScheduledTask -TaskName ${psLiteral(name)} -Confirm:$false`);

    const fixture = join(root, "fixture");
    const failureHome = join(root, "failure-home");
    mkdirSync(join(fixture, "basic_memory-0.0.dist-info"), { recursive: true });
    writeFileSync(join(fixture, "basic_memory-0.0.dist-info", "METADATA"), "Metadata-Version: 2.1\nName: basic-memory\nVersion: 0.0\n");
    writeFileSync(join(fixture, "basic_memory-0.0.dist-info", "entry_points.txt"), "[console_scripts]\nbasic-memory = fixture:main\n");
    writeFileSync(join(fixture, "fixture.py"), "def main():\n    return 37\n");
    powershell(registration(failureHome, `${audit};${fixture}`));
    const failureLog = join(failureHome, ".basic-memory", "mcp.log");
    const deadline = Date.now() + 240_000;
    while ((!existsSync(failureLog) || !readFileSync(failureLog, "utf8").includes("restart budget exhausted")) && Date.now() < deadline) {
      await pause(1000);
    }
    assert.match(readFileSync(failureLog, "utf8"), /restart budget exhausted/);
    await pause(70_000);
    const failures = readFileSync(failureLog, "utf8");
    assert.equal(failures.match(/Starting Basic Memory/g).length, 4);
    assert.equal(failures.match(/Retrying Basic Memory in 60 seconds/g).length, 3);
    assert.equal(Number(powershell(`(Get-ScheduledTaskInfo -TaskName ${psLiteral(name)}).LastTaskResult`)), 37);
    for (const file of readdirSync(audit).filter((file) => file.endsWith(".json"))) {
      assert.equal(JSON.parse(readFileSync(join(audit, file), "utf8")).console, 0, file);
    }
    console.log("Verified four attempts, three real one-minute waits, exit 37, no fifth attempt, and zero console handles.");
  } finally {
    stop();
    powershell(`if (Get-ScheduledTask -TaskName ${psLiteral(name)} -ErrorAction SilentlyContinue) {
Unregister-ScheduledTask -TaskName ${psLiteral(name)} -Confirm:$false
}`);
    assert.deepEqual(listenerPids(port), []);
    assert.deepEqual(sharedSnapshot(), sharedBefore, "Shared task and listener must remain unchanged.");
    if (configBefore) assert.deepEqual(readFileSync(config), configBefore);
    // root was created by mkdtempSync above and contains only this test's resources.
    rmSync(root, { recursive: true, force: true });
    assert.ok(!existsSync(root));
    console.log("Removed isolated task, processes and data. Shared task, listener and configuration unchanged.");
  }
});
