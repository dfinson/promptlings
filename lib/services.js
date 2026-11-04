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
  "-StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries";

export const psLiteral = (text) => `'${text.replace(/'/g, "''")}'`;

export function windowsTaskScript(memoryCommand, port) {
  const argument = `--headless "${memoryCommand}" ${serverArgs(port).join(" ")}`;
  return `$ErrorActionPreference = "Stop"
# An interactive task gives a console program a visible window; headless conhost hosts it without one.
$action = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot "System32\\conhost.exe") -Argument ${psLiteral(argument)}
$user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$settings = ${windowsTaskSettings}
Register-ScheduledTask -TaskName ${psLiteral(windowsTaskName)} -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName ${psLiteral(windowsTaskName)}
`;
}
