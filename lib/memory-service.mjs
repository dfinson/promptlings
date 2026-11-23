import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1];
const command = value("--memory-command");
const port = Number(value("--port"));
const proxyPort = Number(value("--proxy-port"));
const python = args.includes("--proxy-python") ? value("--proxy-python") : null;
const fastmcpVersion = args.includes("--fastmcp-version") ? value("--fastmcp-version") : null;
const configDirectory = args.includes("--config-dir") ? value("--config-dir") : null;
if (!args.includes("--memory-command") || !command || !Number.isInteger(port) ||
  !Number.isInteger(proxyPort) || port < 1 || port > 65535 || proxyPort < 1 || proxyPort > 65535 || port === proxyPort ||
  !python || !fastmcpVersion) {
  throw new Error("Expected --memory-command PATH --proxy-python PATH --fastmcp-version VERSION --port PORT --proxy-port PORT.");
}
let child;
let proxy;
let startupTimer;
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  clearTimeout(startupTimer);
  process.exitCode = code;
  const ownedChildren = [child, proxy].filter((process) =>
    process?.pid && process.exitCode === null && process.signalCode === null);
  if (!ownedChildren.length) return;
  if (process.platform !== "win32") { for (const process of ownedChildren) process.kill(); return; }
  // Windows command launchers have interpreter children. Stop only this captured tree.
  const script = `$ErrorActionPreference = 'Stop'
$snapshot = @(Get-CimInstance Win32_Process)
$owned = @($snapshot | Where-Object { $_.ProcessId -in @(${ownedChildren.map((process) => process.pid).join(",")}) })
for ($index = 0; $index -lt $owned.Count; $index++) {
  $parentId = $owned[$index].ProcessId
  $owned += @($snapshot | Where-Object { $_.ParentProcessId -eq $parentId -and $_.ProcessId -notin $owned.ProcessId })
}
foreach ($original in $owned) {
  $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($original.ProcessId)"
  if ($current -and $current.CreationDate -eq $original.CreationDate) {
    try { Stop-Process -Id $current.ProcessId -Force -ErrorAction Stop }
    catch { if (Get-Process -Id $current.ProcessId -ErrorAction SilentlyContinue) { throw } }
  }
}`;
  const stopper = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-OutputFormat", "Text", "-Command",
    script], { stdio: "inherit", windowsHide: true });
  stopper.on("error", (cause) => { console.error(`Basic Memory child stop failed: ${cause.message}`); process.exitCode = 1; });
  stopper.on("exit", (result) => {
    if (result !== 0) { console.error(`Basic Memory child stop failed with code ${result}`); process.exitCode = 1; }
  });
}
proxy = spawn(python, ["-B", "-u", join(dirname(fileURLToPath(import.meta.url)), "memory-proxy.py"),
  "--port", String(port), "--proxy-port", String(proxyPort), "--fastmcp-version", fastmcpVersion], {
  stdio: ["ignore", "pipe", "inherit"], windowsHide: true,
});
proxy.on("error", (cause) => { console.error(`FastMCP proxy launch failed: ${cause.message}`); stop(1); });
proxy.on("exit", (code, signal) => {
  if (stopping) return;
  console.error(`FastMCP proxy exited: code=${code} signal=${signal}`);
  stop(code || 1);
});
proxy.stdout.on("data", (chunk) => process.stdout.write(chunk));
const lines = createInterface({ input: proxy.stdout });
startupTimer = setTimeout(() => { console.error("FastMCP proxy did not bind within 120 seconds."); stop(1); }, 120_000);
lines.on("line", (line) => {
  if (line !== "PROMPTLINGS_MEMORY_PROXY_READY" || stopping || child) return;
  clearTimeout(startupTimer);
  console.log(`Basic Memory proxy http://127.0.0.1:${proxyPort}/mcp -> 127.0.0.1:${port}`);
  child = spawn(command, ["mcp", "--transport", "streamable-http", "--host", "127.0.0.1", "--port", String(port)], {
    stdio: ["ignore", "inherit", "inherit"], windowsHide: true,
    env: configDirectory ? { ...process.env, BASIC_MEMORY_CONFIG_DIR: configDirectory } : process.env,
  });
  child.on("error", (cause) => { console.error(`Basic Memory launch failed: ${cause.message}`); stop(1); });
  child.on("exit", (code, signal) => {
    console.error(`Basic Memory exited: code=${code} signal=${signal}`);
    stop(code ?? 1);
  });
});
process.on("SIGTERM", () => stop(0));
process.on("SIGINT", () => stop(0));
