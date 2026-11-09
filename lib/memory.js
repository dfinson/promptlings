import { mkdirSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { homedir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { pins } from "./pins.js";
import { capture, fail, powershell, run, succeeds, which, windows } from "./run.js";
import {
  launchAgentLabel, launchAgentPlist, psLiteral, systemdUnit, systemdUnitName, windowsTaskName, windowsTaskScript,
} from "./services.js";
import { skillsAdd, uvToolInstall, uvToolPath } from "./tools.js";

const endpoint = (port) => `http://127.0.0.1:${port}/mcp`;
const launchAgentTarget = () => `gui/${userInfo().uid}/${launchAgentLabel}`;

// A previous server holds the port and, on Windows, a lock on the basic-memory executable.
function stopPreviousServer() {
  if (windows) {
    const bin = deps.capture("uv", ["tool", "dir", "--bin"], { quiet: true });
    const tools = deps.capture("uv", ["tool", "dir"], { quiet: true });
    deps.powershell(`if (Get-ScheduledTask -TaskName ${psLiteral(windowsTaskName)} -ErrorAction SilentlyContinue) { Stop-ScheduledTask -TaskName ${psLiteral(windowsTaskName)} }
$exe = ${psLiteral(join(bin, "basic-memory.exe"))}
$env = ${psLiteral(join(tools, "basic-memory", "*"))}
# Stopping the task leaves its children running. A tree kill can already have ended later matches.
Get-Process | Where-Object { $_.Path -eq $exe -or $_.Path -like $env } | ForEach-Object { & cmd.exe /d /c "taskkill /PID $($_.Id) /T /F >nul 2>&1" }`);
  } else if (process.platform === "darwin") {
    if (deps.succeeds("launchctl", ["print", launchAgentTarget()])) deps.run("launchctl", ["bootout", launchAgentTarget()]);
  } else if (process.platform === "linux" && deps.which("systemctl")) {
    if (deps.succeeds("systemctl", ["--user", "cat", systemdUnitName])) deps.run("systemctl", ["--user", "stop", systemdUnitName]);
  }
}

const portOpen = (port) => new Promise((resolve) => {
  const socket = createConnection({ host: "127.0.0.1", port, timeout: 1000 });
  const done = (open) => { socket.destroy(); resolve(open); };
  socket.once("connect", () => done(true));
  socket.once("timeout", () => done(false));
  socket.once("error", () => done(false));
});

// add-mcp aborts if any detected client lacks the transport. Stdio-only clients reach the HTTP server through mcp-remote.
async function register(options, memoryCommand, runAddMcp) {
  const { agents, detectGlobalAgents } = await import("add-mcp");
  const transport = options.startup ? "http" : "stdio";
  const direct = [];
  const bridge = [];
  for (const agent of await detectGlobalAgents()) {
    const supported = agents[agent].supportedTransports;
    if (supported.includes(transport)) direct.push("-a", agent);
    else if (transport === "http" && supported.includes("stdio")) bridge.push("-a", agent);
    else console.warn(`Skipping ${agents[agent].displayName}: no ${transport} MCP support.`);
  }
  const server = options.startup ? [endpoint(options.memoryPort)] : [memoryCommand, "--args", "mcp"];
  if (direct.length) runAddMcp([...server, "-g", "-y", "-n", "basic-memory", ...direct]);
  if (bridge.length) runAddMcp([pins.mcpRemote, "--args", endpoint(options.memoryPort), "-g", "-y", "-n", "basic-memory", ...bridge]);
  if (!direct.length && !bridge.length) console.warn("Warning: no supported MCP client was detected. basic-memory was not registered.");
}

function startService(memoryCommand, port) {
  if (process.platform === "darwin") {
    const plist = join(homedir(), "Library", "LaunchAgents", `${launchAgentLabel}.plist`);
    mkdirSync(dirname(plist), { recursive: true });
    mkdirSync(join(homedir(), ".basic-memory"), { recursive: true });
    writeFileSync(plist, launchAgentPlist(memoryCommand, port, homedir()));
    deps.run("launchctl", ["bootstrap", `gui/${userInfo().uid}`, plist]);
  } else if (process.platform === "linux") {
    const unit = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "systemd", "user", systemdUnitName);
    mkdirSync(dirname(unit), { recursive: true });
    writeFileSync(unit, systemdUnit(memoryCommand, port));
    deps.run("systemctl", ["--user", "daemon-reload"]);
    deps.run("systemctl", ["--user", "enable", systemdUnitName]);
    deps.run("systemctl", ["--user", "restart", systemdUnitName]);
    deps.run("systemctl", ["--user", "is-active", "--quiet", systemdUnitName]);
  } else {
    const tools = deps.capture("uv", ["tool", "dir"], { quiet: true });
    const pythonwCommand = join(tools, "basic-memory", "Scripts", "pythonw.exe");
    console.log(`+ register scheduled task "${windowsTaskName}"`);
    deps.powershell(windowsTaskScript(memoryCommand, port, pythonwCommand));
  }
}

const initialize = JSON.stringify({
  jsonrpc: "2.0", id: 1, method: "initialize",
  params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "promptlings-installer", version: "1" } },
});

async function waitUntilReady(port) {
  // A cold start after reinstalling can take several minutes.
  const deadline = Date.now() + 600_000;
  while (Date.now() < deadline) {
    try {
      const response = await deps.fetch(endpoint(port), {
        method: "POST", body: initialize, signal: AbortSignal.timeout(2000),
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      });
      if (/"name": ?"basic[ _-]?memory"/i.test(await response.text())) return;
    } catch { /* not listening yet */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  fail(`Basic Memory did not become ready at 127.0.0.1:${port}. Inspect its login startup service.`);
}

// Basic Memory, its upstream skills, MCP client registration and optional login startup.
// Clients are registered only after the server answers, so a failed start leaves no dangling registration.
export async function installMemory(options, { runSkills, runAddMcp }) {
  if (!deps.which("uv")) fail("Missing prerequisite: uv. Run the install or tools command first.");
  deps.stopPreviousServer();
  deps.uvToolInstall(pins.memory);
  deps.uvToolPath();
  const memoryCommand = deps.which("basic-memory") || fail("basic-memory is not on PATH after installation.");
  deps.run("basic-memory", ["--version"]);
  if (options.skills) deps.skillsAdd(runSkills, [pins.memorySkills]);
  if (options.startup && await deps.portOpen(options.memoryPort)) {
    fail(`Memory port ${options.memoryPort} is in use. Stop that listener or pass another port.`);
  }
  if (options.startup) {
    deps.startService(memoryCommand, options.memoryPort);
    await deps.waitUntilReady(options.memoryPort);
  }
  await deps.register(options, memoryCommand, runAddMcp);
}

// Replaceable in tests so the command sequence can be checked without touching the system.
export const deps = {
  run, capture, succeeds, which, powershell, fetch: (...args) => fetch(...args),
  portOpen, register, startService, waitUntilReady, stopPreviousServer, uvToolInstall, uvToolPath, skillsAdd,
};
