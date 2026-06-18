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
        $ReadSideBlock = @"

<!-- session-handoff-read-side-start -->
# Session Handoff: Mandatory Context Protocol

These rules apply to EVERY session in every repository. No exceptions.

## FIRST ACTION: Read environment context

On your FIRST tool-calling turn of every session, before doing anything else, run:

    `$d = git rev-parse --git-common-dir; if (Test-Path "`$d/session-handoff/environment.md") { Get-Content "`$d/session-handoff/environment.md" }

If this file exists, read it completely. It contains environment facts (auth methods, tool paths, encoding quirks, resource identifiers) that directly affect your ability to work correctly. If you skip this and get something wrong that the file would have told you, that failure is on you.

Do NOT grep, search the codebase, search the filesystem, or answer any question until you have read this file or confirmed it does not exist.

## DURING SESSION: Search decisions before fresh searches

Before performing any fresh search of the codebase, filesystem, or web, grep the decisions file first:

    `$d = git rev-parse --git-common-dir; `$f = "`$d/session-handoff/decisions.md"; if (Test-Path `$f) { Select-String -Path `$f -Pattern "KEYWORD" -CaseSensitive:`$false }

Replace KEYWORD with terms relevant to your current subtask. If the decisions file has relevant entries, consult them before initiating any fresh search.
<!-- session-handoff-read-side-end -->
"@
        Add-Content -Path $ClaudeMd -Value $ReadSideBlock -Encoding UTF8
        Write-Host "Done."
    }
}
