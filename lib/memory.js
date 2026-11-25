import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { createConnection } from "node:net";
import { homedir, userInfo } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pins } from "./pins.js";
import { capture, fail, powershell, run, succeeds, which, windows } from "./run.js";
import {
  launchAgentLabel, launchAgentPlist, systemdUnit, systemdUnitName, windowsTaskName, windowsTaskScript, windowsStopScript,
} from "./services.js";
import { skillsAdd, uvToolInstall, uvToolPath } from "./tools.js";
import { packageRoot, readSideEnd, readSideStart } from "./content.js";
import { installMemorySkillContracts } from "./memory-skills.js";

const endpoint = (port) => `http://127.0.0.1:${port}/mcp`;
const launchAgentTarget = () => `gui/${userInfo().uid}/${launchAgentLabel}`;

// A previous server holds the port and, on Windows, a lock on the basic-memory executable.
function stopPreviousServer() {
  if (windows) {
    const bin = deps.capture("uv", ["tool", "dir", "--bin"], { quiet: true });
    const tools = deps.capture("uv", ["tool", "dir"], { quiet: true });
    deps.powershell(windowsStopScript(join(bin, "basic-memory.exe"), join(tools, "basic-memory")));
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

async function waitUntilStopped(ports) {
  // The supervisor may still be stopping its second child after the OS task exits.
  const deadline = Date.now() + 15_000;
  for (const port of ports) {
    while (await deps.portOpen(port)) {
      if (Date.now() >= deadline) fail(`Memory port ${port} is in use. Stop that listener or pass another port.`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

// add-mcp aborts if any detected client lacks the transport. Stdio-only clients reach the HTTP server through mcp-remote.
async function register(options, memoryCommand, runAddMcp) {
  const { agents, detectGlobalAgents } = await import("add-mcp");
  const transport = "http";
  const direct = [];
  const bridge = [];
  for (const agent of await detectGlobalAgents()) {
    const supported = agents[agent].supportedTransports;
    if (supported.includes(transport)) direct.push("-a", agent);
    else if (transport === "http" && supported.includes("stdio")) bridge.push("-a", agent);
    else console.warn(`Skipping ${agents[agent].displayName}: no ${transport} MCP support.`);
  }
  const server = [endpoint(options.memoryProxyPort)];
  if (direct.length) runAddMcp([...server, "-g", "-y", "-n", "basic-memory", ...direct]);
  if (bridge.length) runAddMcp([pins.mcpRemote, "--args", endpoint(options.memoryProxyPort), "-g", "-y", "-n", "basic-memory", ...bridge]);
  if (!direct.length && !bridge.length) console.warn("Warning: no supported MCP client was detected. basic-memory was not registered.");
}

export function installMemoryRuntime() {
  const target = join(homedir(), ".promptlings", "memory");
  mkdirSync(target, { recursive: true });
  for (const name of ["memory-proxy.py", "memory-service.mjs"]) {
    copyFileSync(join(packageRoot, "lib", name), join(target, name));
  }
  return join(target, "memory-service.mjs");
}

export function memoryConfigDirectory(home = homedir(), env = process.env) {
  const directory = env.BASIC_MEMORY_CONFIG_DIR ||
    (env.XDG_CONFIG_HOME ? join(env.XDG_CONFIG_HOME, "basic-memory") : join(home, ".basic-memory"));
  return resolve(directory);
}

function writePrivateJson(path, value, exclusive = false) {
  if (exclusive || !existsSync(path)) writeFileSync(path, "", { mode: 0o600, flag: "wx" });
  if (windows) {
    const literal = path.replaceAll("'", "''");
    deps.powershell(`$ErrorActionPreference = 'Stop'; $sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User; ` +
      `$acl = New-Object System.Security.AccessControl.FileSecurity; $acl.SetOwner($sid); ` +
      `$acl.SetAccessRuleProtection($true, $false); ` +
      `$acl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'Allow'))); ` +
      `[System.IO.File]::SetAccessControl('${literal}', $acl)`);
  } else chmodSync(path, 0o600);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function configureMemory(home = homedir(), { backend, databaseUrl } = {}) {
  const directory = memoryConfigDirectory(home);
  mkdirSync(directory, { recursive: true });
  const path = join(directory, "config.json");
  let config = {};
  if (existsSync(path)) {
    try { config = JSON.parse(readFileSync(path, "utf8")); }
    catch { fail("Basic Memory config.json is invalid. Repair it before reinstalling; its contents were not logged."); }
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) fail("Basic Memory config.json must contain an object.");
  config.database_backend = backend || config.database_backend || "sqlite";
  if (backend === "sqlite") delete config.database_url;
  if (backend === "postgres") {
    if (!databaseUrl) fail("Postgres configuration requires a provisioned database URL.");
    config.database_url = databaseUrl;
    config.semantic_vector_index = "pgvector";
  }
  config.auto_update = false;
  config.materialization_workers = pins.memoryWorkers;
  if (config.database_url) writePrivateJson(path, config);
  else writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  return config;
}

// Labels bind resources to this config directory, not just a reusable Docker name.
export async function provisionMemoryPostgres(options, home = homedir()) {
  const port = options.memoryPostgresPort ?? 5433;
  if (!Number.isInteger(port) || port < 1 || port > 65535 ||
      [5432, options.memoryPort, options.memoryProxyPort ?? options.memoryPort + 1].includes(port)) {
    fail("Choose a dedicated Postgres port distinct from 5432 and the memory ports.");
  }
  if (!deps.which("docker")) fail("Postgres memory requires Docker. Install and start Docker, then rerun.");
  deps.run("docker", ["info", "--format", "{{.ServerVersion}}"]);
  const directory = memoryConfigDirectory(home);
  const owner = createHash("sha256").update(directory).digest("hex").slice(0, 16);
  const name = `promptlings-memory-postgres-${owner}`;
  const volume = `${name}-data`;
  const label = "io.promptlings.memory.postgres";
  const path = join(directory, "promptlings-postgres.json");
  let state;
  if (existsSync(path)) {
    try { state = JSON.parse(readFileSync(path, "utf8")); }
    catch { fail("Postgres credential state is invalid. Preserve it and recover the original credentials before retrying."); }
    if (!state || typeof state !== "object") fail("Postgres credential state is invalid.");
  }
  if (state && (state.owner !== owner || state.port !== port || !/^[a-f0-9]{64}$/.test(state.password))) {
    fail("Postgres state does not match this config directory and port. Preserve its credentials and use the original port.");
  }
  const containerExists = deps.capture("docker", ["container", "ls", "--all", "--filter", `name=^/${name}$`, "--format", "{{.Names}}"]) === name;
  const volumeExists = deps.capture("docker", ["volume", "ls", "--filter", `name=^${volume}$`, "--format", "{{.Name}}"]) === volume;
  if ((containerExists || volumeExists) && !state) fail("Existing Postgres resources have no saved credentials. Refusing to adopt them.");
  if (volumeExists) {
    const labels = JSON.parse(deps.capture("docker", ["volume", "inspect", volume, "--format", "{{json .Labels}}"]));
    if (labels?.[label] !== owner) fail("Postgres volume is not owned by this Promptlings config. Refusing to reuse it.");
  }
  if (containerExists) {
    const container = JSON.parse(deps.capture("docker", ["container", "inspect", name, "--format",
      '{"labels":{{json .Config.Labels}},"image":{{json .Config.Image}},"ports":{{json .HostConfig.PortBindings}},"mounts":{{json .Mounts}}}']));
    const bindings = container.ports?.["5432/tcp"];
    if (container.labels?.[label] !== owner || container.image !== pins.memoryPostgres ||
        Object.keys(container.ports || {}).length !== 1 || bindings?.length !== 1 ||
        bindings[0].HostIp !== "127.0.0.1" || bindings[0].HostPort !== String(port) ||
        !volumeExists || !container.mounts?.some((mount) => mount.Type === "volume" &&
          mount.Name === volume && mount.Destination === "/var/lib/postgresql/data" && mount.RW)) {
      fail("Postgres container ownership, image, port or volume differs. Refusing to reuse it.");
    }
    deps.run("docker", ["container", "start", name]);
  } else {
    if (await deps.portOpen(port)) fail(`Postgres port ${port} is already in use. Choose another dedicated port.`);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (!state) {
      state = { owner, port, password: randomBytes(32).toString("hex") };
      writePrivateJson(path, state, true);
    }
    if (!volumeExists) deps.run("docker", ["volume", "create", "--label", `${label}=${owner}`, volume]);
    // Pass the password through the child environment, never command arguments or logs.
    deps.run("docker", ["run", "--detach", "--name", name, "--label", `${label}=${owner}`,
      "--restart", "unless-stopped", "--publish", `127.0.0.1:${port}:5432`,
      "--mount", `type=volume,source=${volume},target=/var/lib/postgresql/data`,
      "--env", "POSTGRES_USER=promptlings", "--env", "POSTGRES_DB=basic_memory",
      "--env", "POSTGRES_PASSWORD", pins.memoryPostgres],
    { env: { ...process.env, POSTGRES_PASSWORD: state.password } });
  }
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = deps.run("docker", ["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "promptlings", "-d", "basic_memory"],
      { allow: [0, 1, 2] });
    if (result.status === 0) {
      deps.run("docker", ["exec", "--env", "PGPASSWORD", name, "psql", "--host", "127.0.0.1",
        "--username", "promptlings", "--dbname", "basic_memory", "--command", "SELECT 1"],
      { env: { ...process.env, PGPASSWORD: state.password } });
      return `postgresql+asyncpg://promptlings:${state.password}@127.0.0.1:${port}/basic_memory`;
    }
    await deps.delay(1000);
  }
  fail("Dedicated Postgres did not become ready. Resources and credentials were preserved; inspect Docker before retrying.");
}

export function refreshMemoryReadSide(home = homedir()) {
  const block = readFileSync(join(packageRoot, "agents", "context", "memory-manager-read-side.md"), "utf8").trimEnd();
  for (const path of [
    join(home, ".copilot", "copilot-instructions.md"),
    join(home, ".copilot", "instructions", "promptlings-memory.instructions.md"),
    join(home, ".claude", "CLAUDE.md"),
    join(home, ".claude", "rules", "promptlings-memory.md"),
  ]) {
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    const start = text.indexOf(readSideStart);
    const end = text.indexOf(readSideEnd);
    if (start < 0 && end < 0) continue;
    if (start < 0 || end < start || text.indexOf(readSideStart, start + 1) >= 0) fail(`Invalid managed memory block in ${path}.`);
    writeFileSync(path, text.slice(0, start) + block + text.slice(end + readSideEnd.length));
    console.log(`+ MCP-only managed memory block: ${path}`);
  }
}

export function retargetMemoryAliases(options, copilotHome = process.env.COPILOT_HOME || join(homedir(), ".copilot")) {
  const path = join(copilotHome, "mcp-config.json");
  if (!existsSync(path)) return;
  const config = JSON.parse(readFileSync(path, "utf8"));
  const oldUrls = [endpoint(options.memoryPort), `http://localhost:${options.memoryPort}/mcp`]
    .flatMap((url) => [url, `${url}/`]);
  let changed = false;
  for (const [name, server] of Object.entries(config.mcpServers || {})) {
    if (!server || typeof server.url !== "string") continue;
    if (!oldUrls.includes(server.url)) continue;
    server.url = endpoint(options.memoryProxyPort);
    changed = true;
    console.log(`+ MCP proxy URL for existing registration: ${name}`);
  }
  if (changed) writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
}

function startService(memoryCommand, port, proxyPort, runtime) {
  const tools = deps.capture("uv", ["tool", "dir"]);
  const pythonCommand = join(tools, "basic-memory", ...(windows ? ["Scripts", "python.exe"] : ["bin", "python"]));
  const managedCommand = [process.execPath, runtime, "--memory-command", memoryCommand,
    "--port", String(port), "--proxy-port", String(proxyPort), "--config-dir", memoryConfigDirectory(),
    "--proxy-python", pythonCommand, "--fastmcp-version", pins.memoryProxy.split("==")[1]];
  if (process.platform === "darwin") {
    const plist = join(homedir(), "Library", "LaunchAgents", `${launchAgentLabel}.plist`);
    mkdirSync(dirname(plist), { recursive: true });
    mkdirSync(join(homedir(), ".basic-memory"), { recursive: true });
    writeFileSync(plist, launchAgentPlist(memoryCommand, port, homedir(), managedCommand));
    deps.run("launchctl", ["bootstrap", `gui/${userInfo().uid}`, plist]);
  } else if (process.platform === "linux") {
    const unit = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "systemd", "user", systemdUnitName);
    mkdirSync(dirname(unit), { recursive: true });
    writeFileSync(unit, systemdUnit(memoryCommand, port, managedCommand));
    deps.run("systemctl", ["--user", "daemon-reload"]);
    deps.run("systemctl", ["--user", "enable", systemdUnitName]);
    deps.run("systemctl", ["--user", "restart", systemdUnitName]);
    deps.run("systemctl", ["--user", "is-active", systemdUnitName]);
  } else {
    const pythonwCommand = join(tools, "basic-memory", "Scripts", "pythonw.exe");
    console.log(`+ register scheduled task "${windowsTaskName}"`);
    deps.powershell(windowsTaskScript(pythonwCommand, port, managedCommand));
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
    let sessionHeaders;
    let directBackend = false;
    try {
      const response = await deps.fetch(endpoint(port), {
        method: "POST", body: initialize, signal: AbortSignal.timeout(2000),
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      });
      if (!response.ok || !/"name": ?"basic[ _-]?memory"/i.test(await response.text())) continue;
      sessionHeaders = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
      const session = response.headers.get("mcp-session-id");
      if (!session) continue;
      sessionHeaders["mcp-session-id"] = session;
      sessionHeaders["MCP-Protocol-Version"] = "2025-03-26";
      const initialized = await deps.fetch(endpoint(port), {
        method: "POST", headers: sessionHeaders, signal: AbortSignal.timeout(2000),
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      });
      if (!initialized.ok) continue;
      const tools = await deps.fetch(endpoint(port), {
        method: "POST", headers: sessionHeaders, signal: AbortSignal.timeout(5000),
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
      });
      const listed = await tools.text();
      const hasToolList = /"tools"\s*:\s*\[/.test(listed);
      const hasReadWriteTools = /"name"\s*:\s*"write_note"/.test(listed) &&
        /"name"\s*:\s*"read_note"/.test(listed);
      const hasQueueTool = /"name"\s*:\s*"memory_queue_status"/.test(listed);
      if (tools.ok && hasToolList && hasReadWriteTools && hasQueueTool) return;
      directBackend = tools.ok && hasToolList && hasReadWriteTools && !hasQueueTool;
    } catch { /* not listening yet */ }
    finally {
      if (sessionHeaders) {
        try {
          await deps.fetch(endpoint(port), { method: "DELETE", headers: sessionHeaders, signal: AbortSignal.timeout(2000) });
        } catch { /* startup may have ended the probe session */ }
      }
      if (!directBackend) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (directBackend) fail(`Basic Memory answered at 127.0.0.1:${port} without memory_queue_status. The installer requires the queue proxy before registering clients.`);
  }
  fail(`Basic Memory queue proxy did not become ready at 127.0.0.1:${port}. Inspect its login startup service.`);
}

// Basic Memory, its upstream skills, MCP client registration and optional login startup.
// Clients are registered only after the server answers, so a failed start leaves no dangling registration.
export async function installMemory(options, { runSkills, runAddMcp }) {
  if (!options.startup) fail("--no-startup cannot provide the shared write queue. Use login startup for memory, or --no-memory to skip it.");
  options = { ...options, memoryProxyPort: options.memoryProxyPort ?? options.memoryPort + 1 };
  if (!deps.which("uv")) fail("Missing prerequisite: uv. Run the install or tools command first.");
  if (options.memoryBackend && Object.keys(process.env).some((key) =>
    /^BASIC_MEMORY_(DATABASE_BACKEND|DATABASE_URL|SEMANTIC_VECTOR_INDEX)$/i.test(key))) {
    fail("Basic Memory database environment overrides are set. Remove them before choosing an installer backend.");
  }
  const databaseUrl = options.memoryBackend === "postgres" ? await deps.provisionMemoryPostgres(options) : undefined;
  deps.stopPreviousServer();
  await deps.waitUntilStopped([options.memoryPort, options.memoryProxyPort]);
  const config = deps.configureMemory(undefined, { backend: options.memoryBackend, databaseUrl });
  deps.uvToolInstall(pins.memory, [pins.memoryProxy]);
  deps.uvToolPath();
  const memoryCommand = deps.which("basic-memory") || fail("basic-memory is not on PATH after installation.");
  deps.run("basic-memory", ["--version"]);
  if (options.memoryBackend === "postgres") {
    const projects = Object.entries(config.projects || {})
      .filter(([, entry]) => typeof entry === "string" ||
        (entry && (entry.mode !== "cloud" || entry.local_sync_path)))
      .map(([name]) => name);
    if (projects.length) {
      for (const name of projects) deps.run(memoryCommand, ["reindex", "--full", "--project", name]);
    } else deps.run(memoryCommand, ["reindex", "--full"]);
  }
  if (options.skills) deps.skillsAdd(runSkills, [pins.memorySkills]);
  deps.installMemorySkillContracts();
  if (options.readside !== false) deps.refreshMemoryReadSide();
  for (const port of [options.memoryPort, options.memoryProxyPort]) {
    if (await deps.portOpen(port)) fail(`Memory port ${port} is in use. Stop that listener or pass another port.`);
  }
  const runtime = deps.installMemoryRuntime();
  deps.startService(memoryCommand, options.memoryPort, options.memoryProxyPort, runtime);
  await deps.waitUntilReady(options.memoryProxyPort);
  await deps.register(options, memoryCommand, runAddMcp);
  deps.retargetMemoryAliases(options);
}

// Replaceable in tests so the command sequence can be checked without touching the system.
export const deps = {
  run, capture, succeeds, which, powershell, fetch: (...args) => fetch(...args),
  portOpen, register, startService, waitUntilReady, waitUntilStopped, stopPreviousServer, uvToolInstall, uvToolPath, skillsAdd,
  configureMemory, installMemoryRuntime, provisionMemoryPostgres,
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  installMemorySkillContracts, refreshMemoryReadSide,
  retargetMemoryAliases,
};
