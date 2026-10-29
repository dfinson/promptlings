# Run with powershell or pwsh -File tests/test_install.ps1. Downloads use local copies.
$ErrorActionPreference = "Stop"
$sourceRoot = Split-Path $PSScriptRoot -Parent
$fixtureRoot = Join-Path $PSScriptRoot (".install-fixture-" + [guid]::NewGuid())
$previousProfile = $env:USERPROFILE
$previousCopilotHome = $env:COPILOT_HOME
$failStartupDownload = $false
$installer = Join-Path $sourceRoot "install.ps1"
$assets = @(
    @("agents\orchestration\bmad-orchestrator.agent.md", "agents\bmad-orchestrator.agent.md"),
    @("skills\promptlings-bmad-setup\SKILL.md", "skills\promptlings-bmad-setup\SKILL.md"),
    @("skills\promptlings-bmad-bootstrap\SKILL.md", "skills\promptlings-bmad-bootstrap\SKILL.md"),
    @("skills\promptlings-bmad-bootstrap\startup.md", "skills\promptlings-bmad-bootstrap\startup.md")
)

function Assert-Plan {
    param([string]$Plan, [string[]]$HostRoots)
    foreach ($hostRoot in $HostRoots) {
        foreach ($pair in $assets) {
            $path = Join-Path $hostRoot $pair[1]
            if (-not $Plan.Contains($path)) { throw "Plan omitted $path" }
        }
    }
}

function Invoke-WebRequest {
    param([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing)
    $relative = $Uri -replace '^https://raw\.githubusercontent\.com/dfinson/promptlings/main/', ''
    if ($relative -eq $Uri) { throw "Unexpected download: $Uri" }
    if ($failStartupDownload -and $relative -eq "skills/promptlings-bmad-bootstrap/startup.md") {
        Set-Content -LiteralPath $OutFile -Value "partial download"
        throw "Simulated startup download failure"
    }
    Copy-Item -LiteralPath (Join-Path $sourceRoot $relative) -Destination $OutFile
}

try {
    $env:USERPROFILE = $fixtureRoot
    $env:COPILOT_HOME = $null
    foreach ($hostName in @(".copilot", ".claude")) {
        New-Item -ItemType Directory -Path (Join-Path $fixtureRoot $hostName) -Force | Out-Null
    }
    $hostRoots = @((Join-Path $fixtureRoot ".copilot"), (Join-Path $fixtureRoot ".claude"))
    $plan = (& $installer -Agents bmad-orchestrator -DryRun 6>&1 |
        ForEach-Object { $_.ToString() }) -join "`n"
    Assert-Plan $plan $hostRoots
    if (-not $plan.Contains("Global instruction files modified: none.")) {
        throw "Default plan did not report no global writes"
    }
    $plan = (& $installer -Agents bmad-orchestrator -WithBmadBootstrap -DryRun 6>&1 |
        ForEach-Object { $_.ToString() }) -join "`n"
    Assert-Plan $plan $hostRoots
    foreach ($file in @(
        (Join-Path $hostRoots[0] "copilot-instructions.md"),
        (Join-Path $hostRoots[1] "CLAUDE.md")
    )) {
        if (-not $plan.Contains($file)) { throw "Opt-in plan omitted $file" }
    }
    if ($plan.Contains("Global instruction files modified: none.")) { throw "Incorrect opt-in plan" }
    if (Get-ChildItem -LiteralPath $fixtureRoot -File -Recurse) {
        throw "Dry run wrote files"
    }
    & (Join-Path $sourceRoot "install.ps1") -Agents the-nitcracker -Yes
    if (Get-ChildItem -LiteralPath $fixtureRoot -Filter SKILL.md -Recurse) {
        throw "Unrelated agent selection installed a skill"
    }
    if (Get-ChildItem -LiteralPath $fixtureRoot -Directory -Filter skills -Recurse) {
        throw "Unrelated agent selection created a skills directory"
    }
    $processInfo = New-Object Diagnostics.ProcessStartInfo
    $processInfo.FileName = [Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
    $processInfo.Arguments = '-NoProfile -File "{0}" -Agents the-nitcracker -WithBmadBootstrap -Yes' -f $installer
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $process = [Diagnostics.Process]::Start($processInfo)
    $invalidOutput = $process.StandardOutput.ReadToEnd() + $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    $invalidExitCode = $process.ExitCode
    $process.Dispose()
    if ($invalidExitCode -ne 2 -or -not $invalidOutput.Contains("requires the bmad-orchestrator agent")) {
        throw "Invalid selection did not fail with exit 2: $invalidOutput"
    }
    & (Join-Path $sourceRoot "install.ps1") -Agents bmad-orchestrator -Yes
    foreach ($hostName in @(".copilot", ".claude")) {
        $hostRoot = Join-Path $fixtureRoot $hostName
        foreach ($pair in $assets) {
            $source = Join-Path $sourceRoot $pair[0]
            $installed = Join-Path $hostRoot $pair[1]
            if ((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $installed).Hash) {
                throw "Installed content differs: $installed"
            }
        }
        if (Test-Path (Join-Path $hostRoot "copilot-instructions.md")) {
            throw "Installer wrote global instructions"
        }
        if (Test-Path (Join-Path $hostRoot "CLAUDE.md")) {
            throw "Installer wrote global instructions"
        }
    }
    $env:COPILOT_HOME = Join-Path $fixtureRoot "alternate host"
    $plan = (& $installer -Agents bmad-orchestrator -DryRun 6>&1 |
        ForEach-Object { $_.ToString() }) -join "`n"
    Assert-Plan $plan @($env:COPILOT_HOME, $hostRoots[1])
    if (Test-Path -LiteralPath $env:COPILOT_HOME) { throw "Custom-root dry run wrote files" }
    & (Join-Path $sourceRoot "install.ps1") -Agents bmad-orchestrator -Yes
    foreach ($pair in $assets) {
        $installed = Join-Path $env:COPILOT_HOME $pair[1]
        if ((Get-FileHash -LiteralPath (Join-Path $sourceRoot $pair[0])).Hash -ne
            (Get-FileHash -LiteralPath $installed).Hash) {
            throw "Custom-root content differs: $installed"
        }
    }
    if (Test-Path (Join-Path $env:COPILOT_HOME "copilot-instructions.md")) {
        throw "Custom-root installation wrote global instructions"
    }
    $instructionFiles = @(
        (Join-Path $env:COPILOT_HOME "copilot-instructions.md"),
        (Join-Path $hostRoots[1] "CLAUDE.md")
    )
    $existing = "Existing user instructions: caf$([char]0xe9)`r`nKeep this text."
    foreach ($file in $instructionFiles) {
        [IO.File]::WriteAllText($file, $existing, [Text.UTF8Encoding]::new($false))
    }
    $failStartupDownload = $true
    $failed = $false
    try { & $installer -Agents bmad-orchestrator -WithBmadBootstrap -Yes }
    catch {
        $failed = $_.ToString().Contains("Failed to download skills/promptlings-bmad-bootstrap/startup.md")
    }
    if (-not $failed) { throw "Startup download failure was not visible" }
    foreach ($file in $instructionFiles) {
        if ([IO.File]::ReadAllText($file) -cne $existing) { throw "Failed download modified $file" }
    }
    $failStartupDownload = $false
    & $installer -Agents bmad-orchestrator -WithBmadBootstrap -Yes
    $hashes = @{}
    $startup = [IO.File]::ReadAllText((Join-Path $sourceRoot "skills\promptlings-bmad-bootstrap\startup.md"))
    foreach ($file in $instructionFiles) {
        if ([IO.File]::ReadAllText($file) -cne "$existing`n$startup`n") {
            throw "Startup append did not preserve contents: $file"
        }
        $hashes[$file] = (Get-FileHash -LiteralPath $file).Hash
    }
    & $installer -Agents bmad-orchestrator -WithBmadBootstrap -Yes
    foreach ($file in $instructionFiles) {
        if ((Get-FileHash -LiteralPath $file).Hash -ne $hashes[$file]) { throw "Duplicate startup: $file" }
    }
    if (Test-Path (Join-Path $hostRoots[0] "copilot-instructions.md")) {
        throw "Opt-in ignored COPILOT_HOME"
    }
    Remove-Item -LiteralPath $instructionFiles
    & $installer -Agents bmad-orchestrator -WithBmadBootstrap -Yes
    foreach ($file in $instructionFiles) {
        if ([IO.File]::ReadAllText($file) -cne "`n$startup`n") { throw "Missing startup: $file" }
    }
    Write-Host "Installer asset, plan, selection, custom-root, opt-in, idempotence, and failure checks passed."
}
finally {
    $env:USERPROFILE = $previousProfile
    $env:COPILOT_HOME = $previousCopilotHome
    if (Test-Path -LiteralPath $fixtureRoot) {
        Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
    }
}
