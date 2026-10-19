# Run with pwsh -File tests/test_install.ps1. Downloads are replaced with local copies.
$ErrorActionPreference = "Stop"
$sourceRoot = Split-Path $PSScriptRoot -Parent
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ("promptlings-install-" + [guid]::NewGuid())
$previousProfile = $env:USERPROFILE

function Invoke-WebRequest {
    param([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing)
    $relative = $Uri -replace '^https://raw\.githubusercontent\.com/dfinson/promptlings/main/', ''
    if ($relative -eq $Uri) { throw "Unexpected download: $Uri" }
    Copy-Item -LiteralPath (Join-Path $sourceRoot $relative) -Destination $OutFile
}

try {
    $env:USERPROFILE = $fixtureRoot
    foreach ($hostName in @(".copilot", ".claude")) {
        New-Item -ItemType Directory -Path (Join-Path $fixtureRoot $hostName) -Force | Out-Null
    }
    & (Join-Path $sourceRoot "install.ps1") -Agents bmad-orchestrator -DryRun
    if (Get-ChildItem -LiteralPath $fixtureRoot -File -Recurse) {
        throw "Dry run wrote files"
    }
    & (Join-Path $sourceRoot "install.ps1") -Agents the-nitcracker -Yes
    if (Get-ChildItem -LiteralPath $fixtureRoot -Filter SKILL.md -Recurse) {
        throw "Unrelated agent selection installed a skill"
    }
    & (Join-Path $sourceRoot "install.ps1") -Agents bmad-orchestrator -Yes
    foreach ($hostName in @(".copilot", ".claude")) {
        $hostRoot = Join-Path $fixtureRoot $hostName
        foreach ($pair in @(
            @("agents/orchestration/bmad-orchestrator.agent.md", "agents/bmad-orchestrator.agent.md"),
            @("skills/promptlings-bmad-setup/SKILL.md", "skills/promptlings-bmad-setup/SKILL.md")
        )) {
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
    Write-Host "Installer dry-run, selection, paired installation, and content checks passed."
}
finally {
    $env:USERPROFILE = $previousProfile
    if (Test-Path -LiteralPath $fixtureRoot) {
        Remove-Item -LiteralPath $fixtureRoot -Recurse -Force
    }
}
