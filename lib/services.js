// Login startup definitions for the Basic Memory MCP server. Kept pure so tests can render and validate them.

export const launchAgentLabel = "com.promptlings.basic-memory";
export const systemdUnitName = "promptlings-memory.service";
export const windowsTaskName = "Promptlings Basic Memory";

export const serverArgs = (port) => ["mcp", "--transport", "streamable-http", "--host", "127.0.0.1", "--port", String(port)];
const xml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function launchAgentPlist(memoryCommand, port, home) {
  const program = [memoryCommand, ...serverArgs(port)].map((arg) => `<string>${xml(arg)}</string>`).join("");
  const log = xml(`${home}/.basic-memory/mcp.log`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${launchAgentLabel}</string>
  <key>ProgramArguments</key>
  <array>${program}</array>
  <!-- HTTP requests cannot trigger the XPC activity boost used by Adaptive jobs. -->
  <key>ProcessType</key><string>Interactive</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>${log}</string>
  <key>StandardErrorPath</key><string>${log}</string>
</dict>
</plist>
`;
}

export function systemdUnit(memoryCommand, port) {
  return [
    "[Unit]",
    "Description=Promptlings Basic Memory MCP",
    "[Service]",
    `ExecStart="${memoryCommand}" ${serverArgs(port).join(" ")}`,
    "Nice=0",
    "CPUSchedulingPolicy=other",
    "IOSchedulingClass=best-effort",
    "IOSchedulingPriority=4",
    "Restart=on-failure",
    "[Install]",
    "WantedBy=default.target",
    "",
  ].join("\n");
}

// Priority 4 keeps CPU, memory and I/O at Normal. Priority 5 still lowers memory priority.
export const windowsTaskSettings =
  "New-ScheduledTaskSettingsSet -Priority 4 -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) " +
  "-RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) " +
  "-StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries";

export const psLiteral = (text) => `'${text.replace(/'/g, "''")}'`;

export function windowsStopScript(memoryCommand, environmentDirectory) {
  return `$ErrorActionPreference = "Stop"
$processes = @(Get-CimInstance Win32_Process)
$exe = ${psLiteral(memoryCommand)}
$environment = ${psLiteral(`${environmentDirectory}\\`)}
$owned = @($processes | Where-Object {
  $_.ExecutablePath -and ($_.ExecutablePath -ieq $exe -or $_.ExecutablePath.StartsWith($environment, [StringComparison]::OrdinalIgnoreCase))
})
# Capture descendants before stopping the task: its interpreter redirector can exit before its children.
for ($index = 0; $index -lt $owned.Count; $index++) {
  $parentId = $owned[$index].ProcessId
  $owned += @($processes | Where-Object { $_.ParentProcessId -eq $parentId -and $_.ProcessId -notin $owned.ProcessId })
}
if (Get-ScheduledTask -TaskName ${psLiteral(windowsTaskName)} -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName ${psLiteral(windowsTaskName)}
}
foreach ($original in $owned) {
  $current = Get-CimInstance Win32_Process -Filter "ProcessId=$($original.ProcessId)"
  if ($current -and $current.CreationDate -eq $original.CreationDate) {
    try { Stop-Process -Id $current.ProcessId -Force -ErrorAction Stop }
    catch {
      if (Get-Process -Id $current.ProcessId -ErrorAction SilentlyContinue) { throw }
    }
  }
}
`;
}

export function windowsServerScript(pythonwCommand, port) {
  const entryPoint = "import sys;from importlib.metadata import distribution;" +
    "sys.exit(next(ep for ep in distribution('basic-memory').entry_points " +
    "if ep.group == 'console_scripts' and ep.name == 'basic-memory').load()())";
  return `from datetime import datetime
from pathlib import Path
import subprocess
import sys
import time
import traceback

log = Path.home() / ".basic-memory" / "mcp.log"
log.parent.mkdir(parents=True, exist_ok=True)
code = 1
with log.open("a", encoding="utf-8", buffering=1) as output:
    for attempt in range(4):
        print(f"{datetime.now().astimezone().isoformat()} Starting Basic Memory on 127.0.0.1:${port} (attempt {attempt + 1}/4)", file=output)
        try:
            code = subprocess.run(
                ${JSON.stringify([pythonwCommand, "-c", entryPoint, ...serverArgs(port)])},
                stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NO_WINDOW,
            ).returncode
        except OSError:
            code = 1
            traceback.print_exc(file=output)
        print(f"{datetime.now().astimezone().isoformat()} Basic Memory exited with code {code}", file=output)
        if code == 0:
            break
        if attempt == 3:
            print("Basic Memory restart budget exhausted", file=output)
            break
        # Task Scheduler can complete an action with a nonzero result without retrying it.
        print("Retrying Basic Memory in 60 seconds", file=output)
        time.sleep(60)
sys.exit(code)
`;
}

export function windowsTaskScript(pythonwCommand, port) {
  const encoded = Buffer.from(windowsServerScript(pythonwCommand, port), "utf8").toString("base64");
  const argument = `-c "import base64;exec(base64.b64decode('${encoded}'))"`;
  return `$ErrorActionPreference = "Stop"
# pythonw has no console. Its child uses CREATE_NO_WINDOW, never a briefly hidden terminal.
if (-not (Test-Path -LiteralPath ${psLiteral(pythonwCommand)} -PathType Leaf)) { throw "Basic Memory's pythonw.exe is missing." }
$action = New-ScheduledTaskAction -Execute ${psLiteral(pythonwCommand)} -Argument ${psLiteral(argument)}
$user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$settings = ${windowsTaskSettings}
Register-ScheduledTask -TaskName ${psLiteral(windowsTaskName)} -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName ${psLiteral(windowsTaskName)}
`;
}
