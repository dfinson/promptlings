# promptlings installer (Windows PowerShell)
#
# Installs selected agent files into your assistant's agents directory.
#
# This script does NOT modify any global instruction file by default. The session-handoff
# read-side block changes how your assistant behaves in every future session in every
# repository, so it is opt-in only, via -WithReadSide or an explicit interactive
# confirmation. See -Help.
#
# Recommended usage (read the script before running it):
#   irm https://raw.githubusercontent.com/dfinson/promptlings/main/install.ps1 -OutFile install.ps1
#   Get-Content install.ps1 | more
#   .\install.ps1 -Review

[CmdletBinding()]
param(
    [switch]$Review,
    [switch]$All,
    [string]$Agents,
    [switch]$List,
    [switch]$DryRun,
    [switch]$Yes,
    [switch]$WithReadSide,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

$Repo = "dfinson/promptlings"
$Branch = "main"
$BaseUrl = "https://raw.githubusercontent.com/$Repo/$Branch"
$ReadSidePath = "agents/context/session-handoff-read-side.md"
$ReadSideMarker = "session-handoff-read-side-start"

$AllAgents = @(
    "the-nitcracker"
    "pr-walkthrough"
    "session-handoff"
    "technical-demo"
    "bmad-orchestrator"
    "speckit-flow"
)
$ReviewAgents = @("the-nitcracker", "pr-walkthrough")

$AgentPaths = @{
    "pr-walkthrough"    = "agents/code-review/pr-walkthrough.agent.md"
    "the-nitcracker"    = "agents/code-review/the-nitcracker.agent.md"
    "session-handoff"   = "agents/context/session-handoff.agent.md"
    "technical-demo"    = "agents/media/technical-demo.agent.md"
    "bmad-orchestrator" = "agents/orchestration/bmad-orchestrator.agent.md"
    "speckit-flow"      = "agents/orchestration/speckit-flow.agent.md"
}

function Show-Usage {
    Write-Host @'
promptlings installer

Usage: .\install.ps1 [options]

Selection (pick at most one):
  -Review               Install the two code-review agents (the-nitcracker, pr-walkthrough)
  -All                  Install all six agents
  -Agents a,b,c         Install agents by name (comma separated)
  -List                 Print available agent names and exit

Behavior:
  -DryRun               Print every path that would be written, write nothing
  -Yes                  Skip the confirmation prompt
  -WithReadSide         Also append the session-handoff read-side block to your GLOBAL
                        instruction file. Requires the session-handoff agent. This changes
                        assistant behavior in every future session in every repository.
  -Help                 Print this message and exit

With no selection flag, an interactive run asks which set you want. A non-interactive run
(a piped one-liner) installs the two code-review agents and prints how to ask for more.

Files written by default: one .agent.md per selected agent, under %USERPROFILE%\.copilot\agents\
and/or %USERPROFILE%\.claude\agents\. Nothing outside those directories is touched unless
-WithReadSide is given or you confirm the read-side prompt.
'@
}

function Write-Fail {
    # Mirrors the bash script: message on stderr, exit code 2.
    param([string]$Message)
    [Console]::Error.WriteLine("Error: $Message")
}

if ($Help) { Show-Usage; return }
if ($List) { $AllAgents | ForEach-Object { Write-Host $_ }; return }

# ----- resolve the selection flags -----

$selection = @()
$selectionSource = $null

if ($Review) {
    $selectionSource = "-Review"
    $selection = $ReviewAgents
}
if ($All) {
    if ($selectionSource) {
        Write-Fail "-All conflicts with $selectionSource. Pick one selection flag."
        exit 2
    }
    $selectionSource = "-All"
    $selection = $AllAgents
}
if ($Agents) {
    if ($selectionSource) {
        Write-Fail "-Agents conflicts with $selectionSource. Pick one selection flag."
        exit 2
    }
    $selectionSource = "-Agents"
    $selection = @($Agents -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })
}

# ----- interactivity -----
#
# Interactive means the script was invoked as a file on disk AND stdin is a real console.
# `irm ... | iex` leaves $PSCommandPath empty, so it can never prompt and never silently
# opts in to anything.

$scriptIsFile = -not [string]::IsNullOrEmpty($PSCommandPath)
$interactive = $scriptIsFile -and [Environment]::UserInteractive -and (-not [Console]::IsInputRedirected)

# ----- resolve the selection -----

if ($selection.Count -eq 0) {
    if ($interactive) {
        Write-Host "Which agents do you want?"
        Write-Host "  1) The two code-review agents: the-nitcracker, pr-walkthrough (default)"
        Write-Host "  2) All six agents"
        Write-Host "  3) Cancel"
        $choice = Read-Host "Choice [1]"
        switch (("$choice").Trim()) {
            "" { $selection = $ReviewAgents }
            "1" { $selection = $ReviewAgents }
            "2" { $selection = $AllAgents }
            default { Write-Host "Cancelled. Nothing was written."; return }
        }
    }
    else {
        $selection = $ReviewAgents
        Write-Host "No selection flag and no console to ask on, so defaulting to the two code-review agents."
        Write-Host "For everything else, download the script and pass a flag:"
        Write-Host "  irm $BaseUrl/install.ps1 -OutFile install.ps1"
        Write-Host "  .\install.ps1 -All            # all six agents"
        Write-Host "  .\install.ps1 -List           # available agent names"
        Write-Host ""
    }
}

# validate and de-duplicate
$resolved = @()
foreach ($a in $selection) {
    if (-not $AgentPaths.ContainsKey($a)) {
        Write-Fail "Unknown agent '$a'. Run with -List to see valid names."
        exit 2
    }
    if ($resolved -notcontains $a) { $resolved += $a }
}
$selection = $resolved

if ($selection.Count -eq 0) {
    Write-Fail "No agents selected."
    exit 2
}

$selectionHasSessionHandoff = $selection -contains "session-handoff"

if ($WithReadSide -and (-not $selectionHasSessionHandoff)) {
    Write-Fail "-WithReadSide only makes sense alongside the session-handoff agent."
    [Console]::Error.WriteLine("Try: .\install.ps1 -Agents session-handoff -WithReadSide")
    exit 2
}

# ----- detect targets -----

$targets = @()
$copilotDir = Join-Path $env:USERPROFILE ".copilot\agents"
$claudeDir = Join-Path $env:USERPROFILE ".claude\agents"
$copilotSelected = $false
$claudeSelected = $false

$copilotDetected = (Test-Path (Join-Path $env:USERPROFILE ".copilot")) -or
                   ($null -ne (Get-Command copilot -ErrorAction SilentlyContinue))
if ((-not $copilotDetected) -and ($null -ne (Get-Command gh -ErrorAction SilentlyContinue))) {
    $copilotDetected = $null -ne (& gh copilot --version 2>$null)
}
if ($copilotDetected) {
    $targets += $copilotDir
    $copilotSelected = $true
}

$claudeDetected = (Test-Path (Join-Path $env:USERPROFILE ".claude")) -or
                  ($null -ne (Get-Command claude -ErrorAction SilentlyContinue))
if ($claudeDetected) {
    $targets += $claudeDir
    $claudeSelected = $true
}

if ($targets.Count -eq 0) {
    Write-Host "No supported assistant detected. Defaulting to the GitHub Copilot CLI location."
    Write-Host ""
    $targets = @($copilotDir)
    $copilotSelected = $true
}

$readSideFiles = @()
if ($WithReadSide -or ($selectionHasSessionHandoff -and $interactive)) {
    if ($copilotSelected) { $readSideFiles += Join-Path $env:USERPROFILE ".copilot\copilot-instructions.md" }
    if ($claudeSelected) { $readSideFiles += Join-Path $env:USERPROFILE ".claude\CLAUDE.md" }
}

# ----- print the plan before writing anything -----

Write-Host "Plan"
Write-Host "===="
Write-Host "Source: $BaseUrl"
Write-Host ""
Write-Host "Directories created if missing:"
foreach ($t in $targets) { Write-Host "  $t" }
Write-Host ""
Write-Host "Files written ($($selection.Count) agent(s) per directory, overwritten if present):"
foreach ($t in $targets) {
    foreach ($a in $selection) { Write-Host "  $t\$a.agent.md" }
}
Write-Host ""

if ($WithReadSide) {
    Write-Host "Global instruction files appended to (opt-in via -WithReadSide):"
    foreach ($f in $readSideFiles) { Write-Host "  $f" }
    Write-Host ""
    Write-Host "  The appended block instructs EVERY future session in EVERY repository to read your"
    Write-Host "  session-handoff files before doing anything else, including before answering a"
    Write-Host "  question or searching the codebase. It is added once, marked with"
    Write-Host "  '$ReadSideMarker', and nothing existing is removed."
    Write-Host ""
}
else {
    Write-Host "Global instruction files modified: none."
    Write-Host ""
}

if ($DryRun) {
    Write-Host "Dry run. Nothing was written."
    return
}

if ($interactive -and (-not $Yes)) {
    $reply = Read-Host "Proceed? [y/N]"
    if (("$reply").Trim() -notmatch '^(y|Y|yes|Yes|YES)$') {
        Write-Host "Cancelled. Nothing was written."
        return
    }
    Write-Host ""
}

# ----- install -----

function Get-Remote {
    # Get-Remote REMOTE DEST: download to a temp file first so a failed fetch cannot
    # truncate a file that is already installed.
    param([string]$Remote, [string]$Dest)
    $tmp = "$Dest.$([System.IO.Path]::GetRandomFileName())"
    try {
        Invoke-WebRequest -Uri "$BaseUrl/$Remote" -OutFile $tmp -UseBasicParsing
        Move-Item -Path $tmp -Destination $Dest -Force
    }
    catch {
        if (Test-Path $tmp) { Remove-Item $tmp -Force }
        throw "Failed to download $Remote"
    }
}

foreach ($t in $targets) {
    Write-Host "Installing to $t"
    New-Item -ItemType Directory -Force -Path $t | Out-Null
    foreach ($a in $selection) {
        Write-Host "  $a.agent.md"
        Get-Remote -Remote $AgentPaths[$a] -Dest (Join-Path $t "$a.agent.md")
    }
}

Write-Host ""
Write-Host "Installed $($selection.Count) agent(s). Restart your assistant to pick them up."

# ----- read-side block, opt-in only -----

function Add-ReadSide {
    param([string]$InstructionFile, [string]$Block)
    if ((Test-Path $InstructionFile) -and
        ((Get-Content $InstructionFile -Raw) -match [regex]::Escape($ReadSideMarker))) {
        Write-Host "  Already present in $InstructionFile. Skipping."
        return
    }
    $dir = Split-Path $InstructionFile -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    Add-Content -Path $InstructionFile -Value "`n$Block" -Encoding UTF8
    Write-Host "  Appended to $InstructionFile"
}

function Show-ReadSideEnableHint {
    Write-Host "To enable it later, run:"
    Write-Host "  irm $BaseUrl/install.ps1 -OutFile install.ps1"
    Write-Host "  .\install.ps1 -Agents session-handoff -WithReadSide"
    Write-Host "Or add it by hand: see the Read-Side Setup section of"
    Write-Host "  $BaseUrl/agents/context/session-handoff.agent.md"
}

if ($selectionHasSessionHandoff) {
    Write-Host ""
    $proceedReadSide = $false

    if ($WithReadSide) {
        $proceedReadSide = $true
    }
    elseif ($interactive) {
        Write-Host "session-handoff needs a companion read-side instruction so that future sessions load"
        Write-Host "the context it persisted. Enabling it appends a block to:"
        foreach ($f in $readSideFiles) { Write-Host "  $f" }
        Write-Host ""
        Write-Host "That block applies to EVERY future session in EVERY repository, not just this one. It"
        Write-Host "instructs your assistant to read the session-handoff files before doing anything else,"
        Write-Host "including before answering a question or searching the codebase."
        Write-Host ""
        $reply = Read-Host "Append it now? [y/N]"
        $proceedReadSide = ("$reply").Trim() -match '^(y|Y|yes|Yes|YES)$'
    }
    else {
        Write-Host "Skipping the session-handoff read-side block: it modifies a global instruction file"
        Write-Host "that affects every future session in every repository, and there is no console here"
        Write-Host "to confirm on."
        Show-ReadSideEnableHint
        $proceedReadSide = $false
    }

    if ($proceedReadSide) {
        Write-Host ""
        Write-Host "Fetching $ReadSidePath ..."
        $readSideBlock = $null
        try {
            $readSideBlock = (Invoke-WebRequest -Uri "$BaseUrl/$ReadSidePath" -UseBasicParsing).Content
        }
        catch {
            $readSideBlock = $null
        }
        if ([string]::IsNullOrWhiteSpace($readSideBlock)) {
            Write-Warning "Failed to fetch $ReadSidePath. Nothing was appended."
            Show-ReadSideEnableHint
        }
        else {
            foreach ($f in $readSideFiles) { Add-ReadSide -InstructionFile $f -Block $readSideBlock }
        }
    }
    elseif ($interactive -and (-not $WithReadSide)) {
        Write-Host ""
        Write-Host "Left your global instruction files untouched."
        Show-ReadSideEnableHint
    }
}
