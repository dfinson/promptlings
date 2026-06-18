# promptlings installer (Windows PowerShell)
# Usage: irm https://raw.githubusercontent.com/dfinson/promptlings/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$Repo = "dfinson/promptlings"
$Branch = "main"
$BaseUrl = "https://raw.githubusercontent.com/$Repo/$Branch"

$Agents = @(
    "agents/code-review/pr-walkthrough.agent.md"
    "agents/code-review/the-nitcracker.agent.md"
    "agents/context/session-handoff.agent.md"
)

function Install-Agents {
    param(
        [string]$Target,
        [string]$Tool
    )
    Write-Host "Installing promptlings for $Tool -> $Target"
    New-Item -ItemType Directory -Force -Path $Target | Out-Null
    foreach ($agent in $Agents) {
        $filename = Split-Path $agent -Leaf
        Write-Host "  Downloading $filename..."
        Invoke-WebRequest -Uri "$BaseUrl/$agent" -OutFile "$Target\$filename" -UseBasicParsing
    }
    Write-Host "  Done. Installed $($Agents.Count) agents."
}

$installed = $false

# GitHub Copilot CLI: directory already exists or gh copilot extension is available
$ghCopilot = $false
if (Test-Path "$env:USERPROFILE\.copilot\agents") {
    $ghCopilot = $true
} elseif (Get-Command gh -ErrorAction SilentlyContinue) {
    $ghCopilot = (& gh copilot --version 2>$null) -ne $null
}
if ($ghCopilot) {
    Install-Agents -Target "$env:USERPROFILE\.copilot\agents" -Tool "GitHub Copilot CLI"
    $installed = $true
}

# Claude Code: ~/.claude directory exists or claude command is available
# Agents live in ~/.claude/agents/, not ~/.claude/commands/
$claudeDetected = (Test-Path "$env:USERPROFILE\.claude") -or ($null -ne (Get-Command claude -ErrorAction SilentlyContinue))
if ($claudeDetected) {
    Install-Agents -Target "$env:USERPROFILE\.claude\agents" -Tool "Claude Code"
    $installed = $true
}

# Default fallback when neither tool is detected
if (-not $installed) {
    Write-Host "No supported coding assistant detected. Installing to default GitHub Copilot CLI location."
    Install-Agents -Target "$env:USERPROFILE\.copilot\agents" -Tool "GitHub Copilot CLI (default)"
}

Write-Host ""
Write-Host "Restart your coding assistant to pick up the new agents."
