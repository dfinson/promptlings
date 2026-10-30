# promptlings installer (Windows PowerShell)
#
# Installs selected agents and skills into your assistant's agents and skills directories.
#
# This script does NOT modify any global instruction file by default. The memory-manager
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
    [string[]]$Skills,
    [switch]$List,
    [switch]$DryRun,
    [switch]$Yes,
    [switch]$WithReadSide,
    [switch]$WithBmadBootstrap,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

$Repo = "dfinson/promptlings"
$Branch = "main"
$BaseUrl = "https://raw.githubusercontent.com/$Repo/$Branch"
$ReadSidePath = "agents/context/memory-manager-read-side.md"
$BmadBootstrapMarker = "promptlings-bmad-bootstrap-start"

$AllAgents = @(
    "the-nitcracker"
    "pr-walkthrough"
    "memory-manager"
    "technical-demo"
    "bmad-orchestrator"
    "speckit-flow"
)
$ReviewAgents = @("the-nitcracker", "pr-walkthrough")
$AllSkills = @("reasoning-first-narration", "tts-setup", "cue-synced-demo",
    "promptlings-bmad-setup", "promptlings-bmad-bootstrap")
$AgentSkills = @{
    "technical-demo" = @("reasoning-first-narration", "tts-setup", "cue-synced-demo")
    "bmad-orchestrator" = @("promptlings-bmad-setup", "promptlings-bmad-bootstrap")
}

$AgentPaths = @{
    "pr-walkthrough"    = "agents/code-review/pr-walkthrough.agent.md"
    "the-nitcracker"    = "agents/code-review/the-nitcracker.agent.md"
    "memory-manager"    = "agents/context/memory-manager.agent.md"
    "technical-demo"    = "agents/media/technical-demo.agent.md"
    "bmad-orchestrator" = "agents/orchestration/bmad-orchestrator.agent.md"
    "speckit-flow"      = "agents/orchestration/speckit-flow.agent.md"
}

$SkillPaths = @{
    "reasoning-first-narration" = "skills/reasoning-first-narration/SKILL.md"
    "tts-setup" = "skills/tts-setup/SKILL.md"
    "cue-synced-demo" = "skills/cue-synced-demo/SKILL.md"
    "promptlings-bmad-setup" = "skills/promptlings-bmad-setup/SKILL.md"
    "promptlings-bmad-bootstrap" = "skills/promptlings-bmad-bootstrap/SKILL.md"
}

$SkillFiles = @{
    "reasoning-first-narration" = @("SKILL.md")
    "tts-setup" = @("SKILL.md")
    "cue-synced-demo" = @("SKILL.md")
    "promptlings-bmad-setup" = @("SKILL.md")
    "promptlings-bmad-bootstrap" = @("SKILL.md", "startup.md")
}

function Show-Usage {
    Write-Host @'
promptlings installer

Usage: .\install.ps1 [options]

Selection (pick at most one):
  -Review               Install the two code-review agents (the-nitcracker, pr-walkthrough)
  -All                  Install all agents and skills
  -Agents a,b,c         Install agents by name (comma separated)
  -Skills a,b           Install skills by name (comma separated)
  -List                 Print available agent and skill names and exit

Behavior:
  -DryRun               Print every path that would be written, write nothing
  -Yes                  Skip the confirmation prompt
  -WithReadSide         Install or replace the managed memory read-side block in your GLOBAL
                        instruction file. Requires memory-manager. This changes
                        assistant behavior in every future session in every repository.
                        Migrate legacy handoff data before replacing its read-side block.
  -WithBmadBootstrap    Append the BMAD startup block to selected hosts' GLOBAL instruction
                        files, once. Requires bmad-orchestrator. No additional opt-in prompt.
  -Help                 Print this message and exit

With no selection flag, an interactive run asks which set you want. A non-interactive run
(a piped one-liner) installs the two code-review agents and prints how to ask for more.

Files written by default: one .agent.md per selected agent, under %USERPROFILE%\.copilot\agents\
and/or %USERPROFILE%\.claude\agents\, and one <name>\SKILL.md per selected skill, under
%USERPROFILE%\.copilot\skills\ and/or %USERPROFILE%\.claude\skills\, including companion Markdown.
technical-demo also selects its three companions. bmad-orchestrator selects
promptlings-bmad-setup and promptlings-bmad-bootstrap. No global instruction file is changed
unless -WithBmadBootstrap or -WithReadSide is given or you confirm the read-side prompt.
COPILOT_HOME overrides the Copilot root for agent, skill, and opted-in instruction paths.

session-handoff is a deprecated selection alias for memory-manager. Existing agent files
and legacy handoff data are never deleted. Basic Memory setup is performed by the agent.
'@
}

function Write-Fail {
    # Mirrors the bash script: message on stderr, exit code 2.
    param([string]$Message)
    [Console]::Error.WriteLine("Error: $Message")
}

if ($Help) { Show-Usage; return }
if ($List) {
    Write-Host "Agents:"
    $AllAgents | ForEach-Object { Write-Host $_ }
    Write-Host ""
    Write-Host "Skills:"
    $AllSkills | ForEach-Object { Write-Host $_ }
    return
}

# ----- resolve the selection flags -----

$selection = @()
$skillSelection = @()
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
    $skillSelection = $AllSkills
}
if ($PSBoundParameters.ContainsKey("Agents")) {
    if ($selectionSource) {
        Write-Fail "-Agents conflicts with $selectionSource. Pick one selection flag."
        exit 2
    }
    $selectionSource = "-Agents"
    $selection = @($Agents -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })
}
if ($PSBoundParameters.ContainsKey("Skills")) {
    if ($selectionSource) {
        Write-Fail "-Skills conflicts with $selectionSource. Pick one selection flag."
        exit 2
    }
    $selectionSource = "-Skills"
    $skillSelection = @($Skills -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" })
}

# ----- interactivity -----
#
# Interactive means the script was invoked as a file on disk AND stdin is a real console.
# `irm ... | iex` leaves $PSCommandPath empty, so it can never prompt and never silently
# opts in to anything.

$scriptIsFile = -not [string]::IsNullOrEmpty($PSCommandPath)
$interactive = $scriptIsFile -and [Environment]::UserInteractive -and (-not [Console]::IsInputRedirected)

# ----- resolve the selection -----

if (-not $selectionSource) {
    if ($interactive) {
        Write-Host "Which agents and skills do you want?"
        Write-Host "  1) The two code-review agents: the-nitcracker, pr-walkthrough (default)"
        Write-Host "  2) All agents and skills"
        Write-Host "  3) Cancel"
        $choice = Read-Host "Choice [1]"
        switch (("$choice").Trim()) {
            "" { $selection = $ReviewAgents }
            "1" { $selection = $ReviewAgents }
            "2" { $selection = $AllAgents; $skillSelection = $AllSkills }
            default { Write-Host "Cancelled. Nothing was written."; return }
        }
    }
    else {
        $selection = $ReviewAgents
        Write-Host "No selection flag and no console to ask on, so defaulting to the two code-review agents."
        Write-Host "For everything else, download the script and pass a flag:"
        Write-Host "  irm $BaseUrl/install.ps1 -OutFile install.ps1"
        Write-Host "  .\install.ps1 -All            # all agents and skills"
        Write-Host "  .\install.ps1 -List           # available agent and skill names"
        Write-Host ""
    }
}

# validate and de-duplicate
$resolved = @()
foreach ($a in $selection) {
    if ($a -eq "session-handoff") {
        Write-Host "session-handoff is now memory-manager. Installing the canonical agent only."
        $a = "memory-manager"
    }
    if (-not $AgentPaths.ContainsKey($a)) {
        Write-Fail "Unknown agent '$a'. Run with -List to see valid names."
        exit 2
    }
    if ($resolved -notcontains $a) { $resolved += $a }
}
$selection = $resolved

foreach ($a in $selection) {
    if ($AgentSkills.ContainsKey($a)) { $skillSelection += $AgentSkills[$a] }
}

$resolved = @()
foreach ($s in $skillSelection) {
    $s = $s.ToLowerInvariant()
    if (-not $SkillPaths.ContainsKey($s)) {
        Write-Fail "Unknown skill '$s'. Run with -List to see valid names."
        exit 2
    }
    if ($resolved -notcontains $s) { $resolved += $s }
}
$skillSelection = $resolved

if (($selection.Count -eq 0) -and ($skillSelection.Count -eq 0)) {
    Write-Fail "Nothing selected."
    exit 2
}

$selectionHasBmad = $selection -contains "bmad-orchestrator"
$selectionHasMemoryManager = $selection -contains "memory-manager"

if ($WithReadSide -and (-not $selectionHasMemoryManager)) {
    Write-Fail "-WithReadSide only makes sense alongside the memory-manager agent."
    [Console]::Error.WriteLine("Try: .\install.ps1 -Agents memory-manager -WithReadSide")
    exit 2
}
if ($WithBmadBootstrap -and (-not $selectionHasBmad)) {
    Write-Fail "-WithBmadBootstrap requires the bmad-orchestrator agent."
    exit 2
}

# ----- detect targets -----

$targets = @()
$copilotRoot = if ([string]::IsNullOrWhiteSpace($env:COPILOT_HOME)) {
    Join-Path $env:USERPROFILE ".copilot"
} else {
    [IO.Path]::GetFullPath($env:COPILOT_HOME)
}
$copilotDir = Join-Path $copilotRoot "agents"
$claudeDir = Join-Path $env:USERPROFILE ".claude\agents"
$copilotSkillsDir = Join-Path $copilotRoot "skills"
$claudeSkillsDir = Join-Path $env:USERPROFILE ".claude\skills"
$copilotSelected = $false
$claudeSelected = $false

$copilotDetected = (-not [string]::IsNullOrWhiteSpace($env:COPILOT_HOME)) -or
                   (Test-Path $copilotRoot) -or
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
$bmadBootstrapFiles = @()
if ($WithBmadBootstrap) {
    if ($copilotSelected) { $bmadBootstrapFiles += Join-Path $copilotRoot "copilot-instructions.md" }
    if ($claudeSelected) { $bmadBootstrapFiles += Join-Path $env:USERPROFILE ".claude\CLAUDE.md" }
}
if ($WithReadSide -or ($selectionHasMemoryManager -and $interactive)) {
    if ($copilotSelected) { $readSideFiles += Join-Path $copilotRoot "copilot-instructions.md" }
    if ($claudeSelected) { $readSideFiles += Join-Path $env:USERPROFILE ".claude\CLAUDE.md" }
}

# ----- print the plan before writing anything -----

$skillTargets = @()
if ($copilotSelected) { $skillTargets += $copilotSkillsDir }
if ($claudeSelected) { $skillTargets += $claudeSkillsDir }
$skillFileCount = 0
foreach ($s in $skillSelection) { $skillFileCount += $SkillFiles[$s].Count }

Write-Host "Plan"
Write-Host "===="
Write-Host "Source: $BaseUrl"
Write-Host ""
Write-Host "Agent directories created if missing ($($selection.Count) agent(s) per directory):"
if ($selection.Count -gt 0) {
    foreach ($t in $targets) { Write-Host "  $t" }
}
Write-Host ""
Write-Host "Agent files written ($($selection.Count) agent(s) per directory, overwritten if present):"
foreach ($t in $targets) {
    foreach ($a in $selection) { Write-Host "  $(Join-Path $t "$a.agent.md")" }
}
Write-Host ""
Write-Host "Skill directories created if missing ($($skillSelection.Count) skill(s) per tool):"
if ($skillSelection.Count -gt 0) {
    foreach ($t in $skillTargets) {
        Write-Host "  $t"
        foreach ($s in $skillSelection) {
            Write-Host "  $(Join-Path $t $s)"
        }
    }
}
Write-Host ""
Write-Host "Skill files written ($($skillSelection.Count) skill(s), $skillFileCount file(s) per tool, overwritten if present):"
foreach ($t in $skillTargets) {
    foreach ($s in $skillSelection) {
        foreach ($file in $SkillFiles[$s]) { Write-Host "  $(Join-Path (Join-Path $t $s) $file)" }
    }
}
Write-Host ""

if ($WithReadSide) {
    Write-Host "Global instruction files updated (opt-in via -WithReadSide):"
    foreach ($f in $readSideFiles) { Write-Host "  $f" }
    Write-Host ""
    Write-Host "  The block enables scoped Basic Memory recall and session capture in future sessions."
    Write-Host "  Existing memory-manager or legacy session-handoff marked blocks are replaced."
    Write-Host "  Unrelated instructions and handoff data are preserved. Migrate legacy data first."
    Write-Host ""
}
elseif ($selectionHasMemoryManager -and $interactive) {
    Write-Host "After installation you will be asked whether to update the memory read-side block in:"
    foreach ($f in $readSideFiles) { Write-Host "  $f" }
    Write-Host "Answering no leaves those files untouched."
    Write-Host ""
}
elseif (-not $WithBmadBootstrap) {
    Write-Host "Global instruction files modified: none."
    Write-Host ""
}
if ($WithBmadBootstrap) {
    Write-Host "Global instruction files appended to (opt-in via -WithBmadBootstrap):"
    foreach ($f in $bmadBootstrapFiles) { Write-Host "  $f" }
    Write-Host "  Appends startup.md once, marked with '$BmadBootstrapMarker'; preserves existing contents."
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
    if ($selection.Count -eq 0) { continue }
    Write-Host "Installing to $t"
    New-Item -ItemType Directory -Force -Path $t | Out-Null
    foreach ($a in $selection) {
        Write-Host "  $a.agent.md"
        Get-Remote -Remote $AgentPaths[$a] -Dest (Join-Path $t "$a.agent.md")
    }
}
foreach ($t in $skillTargets) {
    foreach ($s in $skillSelection) {
        $skillDir = Join-Path $t $s
        Write-Host "Installing skill to $skillDir"
        foreach ($file in $SkillFiles[$s]) {
            $dest = Join-Path $skillDir $file
            New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
            Get-Remote -Remote "skills/$s/$file" -Dest $dest
        }
    }
}

if ($WithBmadBootstrap) {
    foreach ($f in $bmadBootstrapFiles) {
        if (Test-Path -LiteralPath $f) {
            $stream = [IO.File]::OpenRead($f)
            try {
                $prefix = New-Object byte[] 4
                $count = $stream.Read($prefix, 0, $prefix.Length)
                $signature = [BitConverter]::ToString($prefix, 0, $count)
            }
            finally { $stream.Dispose() }
            if ($signature -match '^(FF-FE|FE-FF|00-00-FE-FF)') {
                throw "UTF-16 or UTF-32 instruction file: $f. Convert it to UTF-8 before enabling BMAD bootstrap. Nothing was appended."
            }
        }
        if ((Test-Path -LiteralPath $f) -and
            [IO.File]::ReadAllText($f).Contains($BmadBootstrapMarker)) {
            Write-Host "  Already present in $f. Skipping."
            continue
        }
        $startup = Join-Path (Split-Path $f -Parent) "skills\promptlings-bmad-bootstrap\startup.md"
        $block = [IO.File]::ReadAllText($startup)
        if ([string]::IsNullOrWhiteSpace($block) -or -not $block.Contains($BmadBootstrapMarker)) {
            throw "Invalid BMAD startup block: $startup. Nothing was appended to $f."
        }
        [IO.File]::AppendAllText($f, "`n$block`n", [Text.UTF8Encoding]::new($false))
        Write-Host "  Appended to $f"
    }
}
Write-Host ""
Write-Host "Installed $($selection.Count) agent(s) and $($skillSelection.Count) skill(s) per tool. Restart your assistant to pick them up."

# ----- read-side block, opt-in only -----

function Set-ReadSide {
    param([string]$InstructionFile, [string]$Block)

    $start = '<!-- memory-manager-read-side-start -->'
    $end = '<!-- memory-manager-read-side-end -->'
    $blockText = $Block.Replace("`r`n", "`n").TrimEnd("`r", "`n")
    $blockLines = $blockText -split '\r?\n'
    $markerPattern = '(?m)^<!-- (session-handoff|memory-manager)-read-side-(start|end) -->\r?$'
    $blockMarkers = [regex]::Matches($blockText, $markerPattern)
    if ($blockLines[0] -ne $start -or $blockLines[-1] -ne $end -or $blockMarkers.Count -ne 2) {
        throw "Invalid downloaded memory read-side block. $InstructionFile was not changed."
    }

    $original = ""
    if (Test-Path -LiteralPath $InstructionFile) {
        $original = [System.IO.File]::ReadAllText($InstructionFile)
    }
    $markers = [regex]::Matches($original, $markerPattern)
    $openFamily = $null
    foreach ($marker in $markers) {
        $family = $marker.Groups[1].Value
        if ($marker.Groups[2].Value -eq "start") {
            if ($null -ne $openFamily) { throw "Nested memory markers in $InstructionFile. Repair them manually." }
            $openFamily = $family
        }
        else {
            if ($openFamily -ne $family) { throw "Unmatched memory markers in $InstructionFile. Repair them manually." }
            $openFamily = $null
        }
    }
    if ($null -ne $openFamily) { throw "Unclosed memory marker in $InstructionFile. Repair it manually." }

    $regions = [regex]::Matches($original, '(?ms)^<!-- (session-handoff|memory-manager)-read-side-start -->\r?\n.*?^<!-- \1-read-side-end -->\r?$(?:\n)?')
    $result = New-Object System.Text.StringBuilder
    $cursor = 0
    $inserted = $false
    foreach ($region in $regions) {
        [void]$result.Append($original.Substring($cursor, $region.Index - $cursor))
        if (-not $inserted) {
            [void]$result.Append($blockText + "`n")
            $inserted = $true
        }
        $cursor = $region.Index + $region.Length
    }
    [void]$result.Append($original.Substring($cursor))
    if ($regions.Count -eq 0) {
        if ($result.Length -gt 0 -and -not $original.EndsWith("`n")) { [void]$result.Append("`n") }
        [void]$result.Append($blockText + "`n")
    }
    $updated = $result.ToString()
    if ($updated -ceq $original) {
        Write-Host "  Already current in $InstructionFile."
        return
    }
    $dir = Split-Path $InstructionFile -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $tmp = "$InstructionFile.$([System.IO.Path]::GetRandomFileName())"
    try {
        [System.IO.File]::WriteAllText($tmp, $updated, (New-Object System.Text.UTF8Encoding($false)))
        Move-Item -LiteralPath $tmp -Destination $InstructionFile -Force
    }
    finally {
        if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
    }
    Write-Host "  Updated managed memory instructions in $InstructionFile."
}

function Show-ReadSideEnableHint {
    Write-Host "To enable it later, run:"
    Write-Host "  irm $BaseUrl/install.ps1 -OutFile install.ps1"
    Write-Host "  .\install.ps1 -Agents memory-manager -WithReadSide"
    Write-Host "Or add it by hand: see Completion and setup instructions in"
    Write-Host "  $BaseUrl/agents/context/memory-manager.agent.md"
}

if ($selectionHasMemoryManager) {
    Write-Host "Legacy Session Handoff, Context Manager, or Memory Maintainer agent files are not removed."
    Write-Host "After migration, review and retire obsolete agents manually. Run Memory Manager setup"
    Write-Host "to configure Basic Memory projects and routing. The installer does not create them."
    Write-Host ""
    $proceedReadSide = $false

    if ($WithReadSide) {
        $proceedReadSide = $true
    }
    elseif ($interactive) {
        Write-Host "Memory Manager has a companion read-side instruction for future sessions."
        Write-Host "Enabling it installs or replaces managed memory blocks in:"
        foreach ($f in $readSideFiles) { Write-Host "  $f" }
        Write-Host ""
        Write-Host "That block applies to EVERY future session in EVERY repository, not just this one. It"
        Write-Host "replaces legacy handoff instructions, not the data. Migrate that data first."
        Write-Host ""
        $reply = Read-Host "Update it now? [y/N]"
        $proceedReadSide = ("$reply").Trim() -match '^(y|Y|yes|Yes|YES)$'
    }
    else {
        Write-Host "Skipping the memory-manager read-side block: it modifies a global instruction file"
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
        catch { throw "Failed to fetch $ReadSidePath. Global instructions were not changed. $($_.Exception.Message)" }
        if ([string]::IsNullOrWhiteSpace($readSideBlock)) {
            throw "Empty download for $ReadSidePath. Global instructions were not changed."
        }
        else {
            foreach ($f in $readSideFiles) { Set-ReadSide -InstructionFile $f -Block $readSideBlock }
        }
    }
    elseif ($interactive -and (-not $WithReadSide)) {
        Write-Host ""
        Write-Host "Left your global instruction files untouched."
        Show-ReadSideEnableHint
    }
}
