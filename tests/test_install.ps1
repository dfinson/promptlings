# Run with powershell or pwsh -File tests/test_install.ps1. Downloads use local copies.
$ErrorActionPreference = "Stop"
$sourceRoot = Split-Path $PSScriptRoot -Parent
$fixtureRoot = Join-Path $PSScriptRoot (".install-fixture-" + [guid]::NewGuid())
$previousProfile = $env:USERPROFILE
$previousCopilotHome = $env:COPILOT_HOME
$failBootstrapDownload = $false
$installer = Join-Path $sourceRoot "install.ps1"
$assets = @(
    @("agents\orchestration\bmad-orchestrator.agent.md", "agents\bmad-orchestrator.agent.md"),
    @("agents\orchestration\bmad\setup.md", "promptlings\bmad\setup.md"),
    @("agents\orchestration\bmad\bootstrap.md", "promptlings\bmad\bootstrap.md")
)

function Assert-Plan {
    param([string]$Plan, [string[]]$HostRoots)
    foreach ($hostRoot in $HostRoots) {
        foreach ($pair in $assets) {
            $path = Join-Path $hostRoot $pair[1]
            if (-not $Plan.Contains($path)) { throw "Plan omitted $path" }
        }
    }
    if ($Plan -match 'skills[\\/]promptlings-bmad') { throw "Plan exposes a global BMAD skill" }
}

function Assert-Assets {
    param([string[]]$HostRoots)
    foreach ($hostRoot in $HostRoots) {
        foreach ($pair in $assets) {
            $source = Join-Path $sourceRoot $pair[0]
            $installed = Join-Path $hostRoot $pair[1]
            if ((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $installed).Hash) {
                throw "Installed content differs: $installed"
            }
        }
        if (Test-Path (Join-Path $hostRoot "skills")) { throw "Installer created global skills" }
    }
}

function Invoke-WebRequest {
    param([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing)
    $relative = $Uri -replace '^https://raw\.githubusercontent\.com/dfinson/promptlings/main/', ''
    if ($relative -eq $Uri) { throw "Unexpected download: $Uri" }
    if ($failBootstrapDownload -and $relative -eq "agents/orchestration/bmad/bootstrap.md") {
        Set-Content -LiteralPath $OutFile -Value "partial download"
        throw "Simulated bootstrap download failure"
    }
    if ($OutFile) {
        Copy-Item -LiteralPath (Join-Path $sourceRoot $relative) -Destination $OutFile
    }
    else {
        [pscustomobject]@{ Content = [IO.File]::ReadAllText((Join-Path $sourceRoot $relative)) }
    }
}

try {
    $env:USERPROFILE = $fixtureRoot
    $env:COPILOT_HOME = $null
    $hostRoots = @((Join-Path $fixtureRoot ".copilot"), (Join-Path $fixtureRoot ".claude"))
    foreach ($hostRoot in $hostRoots) {
        New-Item -ItemType Directory -Path $hostRoot -Force | Out-Null
    }
    $plan = (& $installer -Agents bmad-orchestrator -DryRun 6>&1 |
        ForEach-Object { $_.ToString() }) -join "`n"
    Assert-Plan $plan $hostRoots
    if (-not $plan.Contains("Global instruction files modified: none.")) {
        throw "Default plan did not report no global writes"
    }
    if (Get-ChildItem -LiteralPath $fixtureRoot -File -Recurse) { throw "Dry run wrote files" }

    & $installer -Agents the-nitcracker -Yes
    if (Get-ChildItem -LiteralPath $fixtureRoot -Directory -Filter promptlings -Recurse) {
        throw "Unrelated agent selection installed BMAD resources"
    }
    & $installer -Agents bmad-orchestrator -Yes
    Assert-Assets $hostRoots
    foreach ($hostRoot in $hostRoots) {
        if ((Test-Path (Join-Path $hostRoot "copilot-instructions.md")) -or
            (Test-Path (Join-Path $hostRoot "CLAUDE.md"))) { throw "Installer wrote global instructions" }
    }

    $env:COPILOT_HOME = Join-Path $fixtureRoot "alternate host"
    $customRoots = @($env:COPILOT_HOME, $hostRoots[1])
    $plan = (& $installer -Agents bmad-orchestrator -DryRun 6>&1 |
        ForEach-Object { $_.ToString() }) -join "`n"
    Assert-Plan $plan $customRoots
    if (Test-Path -LiteralPath $env:COPILOT_HOME) { throw "Custom-root dry run wrote files" }
    & $installer -Agents bmad-orchestrator -Yes
    Assert-Assets $customRoots

    $instructionFiles = @(
        (Join-Path $env:COPILOT_HOME "copilot-instructions.md"),
        (Join-Path $hostRoots[1] "CLAUDE.md")
    )
    $existing = "Existing user instructions`r`nKeep this text."
    foreach ($file in $instructionFiles) {
        [IO.File]::WriteAllText($file, $existing, [Text.UTF8Encoding]::new($true))
    }
    $hashes = @{}
    foreach ($file in $instructionFiles) { $hashes[$file] = (Get-FileHash -LiteralPath $file).Hash }
    $bootstrap = Join-Path $env:COPILOT_HOME "promptlings\bmad\bootstrap.md"
    $beforeBootstrap = (Get-FileHash -LiteralPath $bootstrap).Hash
    $failBootstrapDownload = $true
    $failed = $false
    try { & $installer -Agents bmad-orchestrator -Yes }
    catch { $failed = $_.ToString().Contains("Failed to download agents/orchestration/bmad/bootstrap.md") }
    if (-not $failed) { throw "Bootstrap download failure was not visible" }
    if ((Get-FileHash -LiteralPath $bootstrap).Hash -ne $beforeBootstrap) {
        throw "Failed download truncated existing procedure"
    }
    $failBootstrapDownload = $false
    & $installer -Agents bmad-orchestrator -Yes
    foreach ($file in $instructionFiles) {
        if ((Get-FileHash -LiteralPath $file).Hash -ne $hashes[$file]) {
            throw "Installer changed unrelated global instructions"
        }
    }
    & $installer -Agents 'bmad-orchestrator,memory-manager' -WithReadSide -Yes
    foreach ($file in $instructionFiles) {
        $text = [IO.File]::ReadAllText($file)
        if (-not $text.StartsWith($existing) -or
            ([regex]::Matches($text, '<!-- memory-manager-read-side-start -->')).Count -ne 1) {
            throw "Memory read-side opt-in did not preserve unrelated instructions"
        }
    }
    Write-Host "Installer private-resource, custom-root, preservation and download-failure checks passed."
}
finally {
    $env:USERPROFILE = $previousProfile
    $env:COPILOT_HOME = $previousCopilotHome
    if (Test-Path -LiteralPath $fixtureRoot) {
        Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
    }
}
