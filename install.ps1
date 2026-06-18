# promptlings installer (Windows PowerShell)
# Usage: irm https://raw.githubusercontent.com/dfinson/promptlings/main/install.ps1 | iex

$ErrorActionPreference = "Stop"

$Repo = "dfinson/promptlings"
$Branch = "main"
$BaseUrl = "https://raw.githubusercontent.com/$Repo/$Branch"
$ReadSidePath = "agents/context/session-handoff-read-side-claude.md"

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
Write-Host ""
Write-Host "NOTE: session-handoff requires a companion user instruction to ensure future sessions"
Write-Host "read the environment handoff file. See agents/context/session-handoff.agent.md for the"
Write-Host "block to add to your user instructions."

# For Claude Code installs, append the read-side protocol to ~/.claude/CLAUDE.md (non-destructive).
$ClaudeMd = Join-Path $env:USERPROFILE ".claude\CLAUDE.md"
$Marker = "session-handoff-read-side-start"

if ($Tool -eq "Claude Code" -or (Test-Path (Join-Path $env:USERPROFILE ".claude"))) {
    $alreadyPresent = (Test-Path $ClaudeMd) -and ((Get-Content $ClaudeMd -Raw) -match [regex]::Escape($Marker))
    if ($alreadyPresent) {
        Write-Host ""
        Write-Host "Read-side protocol already present in $ClaudeMd. Skipping."
    } else {
        Write-Host ""
        Write-Host "Appending read-side protocol to $ClaudeMd ..."
        $ClaudeDir = Split-Path $ClaudeMd -Parent
        if (-not (Test-Path $ClaudeDir)) { New-Item -ItemType Directory -Force -Path $ClaudeDir | Out-Null }
        try {
            $ReadSideBlock = (Invoke-WebRequest -Uri "$BaseUrl/$ReadSidePath" -UseBasicParsing).Content
            Add-Content -Path $ClaudeMd -Value $ReadSideBlock -Encoding UTF8
            Write-Host "Done."
        } catch {
            Write-Warning "Failed to fetch $ReadSidePath. Add the read-side block from agents/context/session-handoff.agent.md manually."
        }
    }
}
