import { spawn } from "node:child_process";
import { createMemoryProxy } from "./memory-proxy.mjs";

const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1];
const command = value("--memory-command");
const port = Number(value("--port"));
const proxyPort = Number(value("--proxy-port"));
const configDirectory = args.includes("--config-dir") ? value("--config-dir") : null;
if (!args.includes("--memory-command") || !command || !Number.isInteger(port) ||
  !Number.isInteger(proxyPort) || port < 1 || port > 65535 || proxyPort < 1 || proxyPort > 65535 || port === proxyPort) {
  throw new Error("Expected --memory-command PATH --port PORT --proxy-port PORT with distinct valid ports.");
}
const proxy = createMemoryProxy({ backendPort: port });
let child;
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  proxy.close();
  proxy.closeAllConnections();
  process.exitCode = code;
  if (!child?.pid) return;
  if (process.platform !== "win32") { child.kill(); return; }
  // Windows command launchers have interpreter children. Stop only this captured tree.
  const script = `$ErrorActionPreference = 'Stop'
$snapshot = @(Get-CimInstance Win32_Process)
$owned = @($snapshot | Where-Object { $_.ProcessId -eq ${child.pid} })
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
  const stopper = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand",
    Buffer.from(script, "utf16le").toString("base64")], { stdio: "inherit", windowsHide: true });
  stopper.on("error", (cause) => { console.error(`Basic Memory child stop failed: ${cause.message}`); process.exitCode = 1; });
  stopper.on("exit", (result) => {
    if (result !== 0) { console.error(`Basic Memory child stop failed with code ${result}`); process.exitCode = 1; }
  });
}
proxy.on("error", (cause) => { console.error(`Basic Memory proxy failed: ${cause.message}`); stop(1); });
proxy.listen(proxyPort, "127.0.0.1", () => {
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
