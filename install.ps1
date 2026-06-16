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

# Detect target directory
if (Test-Path "$env:USERPROFILE\.copilot\agents") {
    $Target = "$env:USERPROFILE\.copilot\agents"
    $Tool = "GitHub Copilot CLI"
} elseif (Test-Path "$env:USERPROFILE\.claude\commands") {
    $Target = "$env:USERPROFILE\.claude\commands"
    $Tool = "Claude Code"
} else {
    $Target = "$env:USERPROFILE\.copilot\agents"
    $Tool = "GitHub Copilot CLI (default)"
}

Write-Host "Installing promptlings to: $Target ($Tool)"
New-Item -ItemType Directory -Force -Path $Target | Out-Null

foreach ($agent in $Agents) {
    $filename = Split-Path $agent -Leaf
    Write-Host "  Downloading $filename..."
    Invoke-WebRequest -Uri "$BaseUrl/$agent" -OutFile "$Target\$filename" -UseBasicParsing
}

Write-Host ""
Write-Host "Done. Installed $($Agents.Count) agents to $Target"
Write-Host "Restart your coding assistant to pick them up."
