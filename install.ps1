# promptlings installer (Windows PowerShell)
# Usage: irm https://raw.githubusercontent.com/dfinson/promptlings/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$Repo = "dfinson/promptlings"
$Branch = "main"
$BaseUrl = "https://raw.githubusercontent.com/$Repo/$Branch"
$ReadSidePath = "agents/context/session-handoff-read-side.md"

$Agents = @(
    "agents/code-review/pr-walkthrough.agent.md"
    "agents/code-review/the-nitcracker.agent.md"
    "agents/code-review/pr-rescue.agent.md"
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

$installedTargets = @()
$copilotInstalled = $false
$claudeInstalled = $false

# GitHub Copilot CLI: directory already exists or gh copilot extension is available
$ghCopilot = $false
if (Test-Path "$env:USERPROFILE\.copilot\agents") {
    $ghCopilot = $true
} elseif (Get-Command gh -ErrorAction SilentlyContinue) {
    $ghCopilot = (& gh copilot --version 2>$null) -ne $null
}
if ($ghCopilot) {
    Install-Agents -Target "$env:USERPROFILE\.copilot\agents" -Tool "GitHub Copilot CLI"
    $installedTargets += "$env:USERPROFILE\.copilot\agents"
    $copilotInstalled = $true
}

# Claude Code: ~/.claude directory exists or claude command is available
# Agents live in ~/.claude/agents/, not ~/.claude/commands/
$claudeDetected = (Test-Path "$env:USERPROFILE\.claude") -or ($null -ne (Get-Command claude -ErrorAction SilentlyContinue))
if ($claudeDetected) {
    Install-Agents -Target "$env:USERPROFILE\.claude\agents" -Tool "Claude Code"
    $installedTargets += "$env:USERPROFILE\.claude\agents"
    $claudeInstalled = $true
}

# Default fallback when neither tool is detected
if ($installedTargets.Count -eq 0) {
    Write-Host "No supported coding assistant detected. Installing to default GitHub Copilot CLI location."
    Install-Agents -Target "$env:USERPROFILE\.copilot\agents" -Tool "GitHub Copilot CLI (default)"
    $installedTargets += "$env:USERPROFILE\.copilot\agents"
    $copilotInstalled = $true
}

Write-Host ""
Write-Host "Done. Installed $($Agents.Count) agents to: $($installedTargets -join ', ')"
Write-Host "Restart your coding assistant to pick them up."
Write-Host ""
Write-Host "NOTE: session-handoff needs a companion read-side instruction so future sessions read the"
Write-Host "environment handoff file. Wiring it into your tool's user instructions now:"

# Wire the read-side protocol into the user instruction file of each installed tool (non-destructive).
# Copilot CLI reads $HOME\.copilot\copilot-instructions.md; Claude Code reads $HOME\.claude\CLAUDE.md.
$Marker = "session-handoff-read-side-start"
$CopilotInstructions = Join-Path $env:USERPROFILE ".copilot\copilot-instructions.md"
$ClaudeMd = Join-Path $env:USERPROFILE ".claude\CLAUDE.md"

$ReadSideBlock = $null
if ($copilotInstalled -or $claudeInstalled) {
    try {
        $ReadSideBlock = (Invoke-WebRequest -Uri "$BaseUrl/$ReadSidePath" -UseBasicParsing).Content
    } catch {
        $ReadSideBlock = $null
    }
}

function Add-ReadSide {
    param([string]$InstructionFile)
    if (-not $ReadSideBlock) {
        Write-Host ""
        Write-Warning "Failed to fetch $ReadSidePath. Add the read-side block from agents/context/session-handoff.agent.md to $InstructionFile manually."
        return
    }
    if ((Test-Path $InstructionFile) -and ((Get-Content $InstructionFile -Raw) -match [regex]::Escape($Marker))) {
        Write-Host ""
        Write-Host "Read-side protocol already present in $InstructionFile. Skipping."
        return
    }
    Write-Host ""
    Write-Host "Appending read-side protocol to $InstructionFile ..."
    $dir = Split-Path $InstructionFile -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Add-Content -Path $InstructionFile -Value "`n$ReadSideBlock" -Encoding UTF8
    Write-Host "Done."
}

if ($copilotInstalled) { Add-ReadSide -InstructionFile $CopilotInstructions }
if ($claudeInstalled) { Add-ReadSide -InstructionFile $ClaudeMd }
