[CmdletBinding()]
param(
    [string]$Project,
    [ValidateSet("bmad", "speckit")][string[]]$Method,
    [switch]$SharedFrameworks,
    [ValidateSet("copilot", "claude")][string]$Integration = "copilot",
    [switch]$CheckOnly
)
$ErrorActionPreference = "Stop"
# Keep these versions identical to the pins in lib/pins.js. The installer tests enforce it.
$bmadVersion = "6.12.4"
$speckitVersion = "1.2.5"
$windows = $env:OS -eq "Windows_NT"
$bmadCommand = if ($windows) { "bmad-method.cmd" } else { "bmad-method" }

function Invoke-Native {
    $Command, $Arguments = $args
    $Arguments = @($Arguments)
    Write-Host "+ $Command $($Arguments -join ' ')"
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $Command $($Arguments -join ' ')" }
}

if (-not $Project) {
    $Project = (& git rev-parse --show-toplevel) -join ""
    if ($LASTEXITCODE -ne 0) { throw "Run inside a Git working copy or pass -Project." }
}
$Project = (Resolve-Path -LiteralPath $Project).Path
$methods = @($Method)
if (-not $Method) {
    $bound = (& git -C $Project config --get promptlings.method) -join ""
    $global:LASTEXITCODE = 0
    if (-not $bound) { throw "Repository is not bound to a method. Set promptlings.method with the user's agreement, or pass -Method." }
    if ($bound -notin @("bmad", "speckit")) { throw "Unknown promptlings.method: $bound." }
    $methods = @($bound)
}
$bmad = "bmad" -in $methods
$speckit = "speckit" -in $methods
$framework = @()

# Git resolves short names, links and case, so ask it rather than comparing path strings.
$state = @(Invoke-Native git -C $Project rev-parse --is-inside-work-tree --show-prefix)
if ($state[0] -ne "true" -or ($state.Count -gt 1 -and $state[1])) {
    throw "-Project must name the Git repository or linked worktree root."
}
# Linked worktrees resolve to the common Git directory, so these rules cover every working copy.
$exclude = (Invoke-Native git -C $Project rev-parse --path-format=absolute --git-path info/exclude) -join ""
if (Test-Path -LiteralPath $exclude) {
    $lines = @(Get-Content -LiteralPath $exclude)
    foreach ($name in @("personal", "bmad", "speckit")) {
        $starts = @(); $ends = @()
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -ceq "# promptlings $name start") { $starts += $i }
            if ($lines[$i] -ceq "# promptlings $name end") { $ends += $i }
        }
        if (($starts.Count + $ends.Count) -and ($starts.Count -ne 1 -or $ends.Count -ne 1 -or $starts[0] -ge $ends[0])) {
            throw "Malformed promptlings $name exclusion block in $exclude. Existing rules were not changed."
        }
    }
}
# Installation is skipped for an existing directory, so a directory without its marker cannot self-repair.
foreach ($partial in @(@($bmad, "_bmad", "config.toml"), @($speckit, ".specify", "integration.json"))) {
    $directory = Join-Path $Project $partial[1]
    if ($partial[0] -and (Test-Path -LiteralPath $directory) -and -not (Test-Path -LiteralPath (Join-Path $directory $partial[2]) -PathType Leaf)) {
        throw "Partial framework installation: $($partial[1]) exists without $($partial[1])/$($partial[2]) in $Project. Ask the user to remove $($partial[1]), then rerun."
    }
}
if ($CheckOnly) { return }

# Initialization uses installed tools only. The machine installer owns installing them.
if ($bmad) {
    $version = Invoke-Native $bmadCommand --version
    if (($version -join "`n") -notmatch [regex]::Escape($bmadVersion)) {
        throw "BMAD $bmadVersion is required. Run the promptlings machine installer."
    }
}
if ($speckit) {
    $version = Invoke-Native specify version
    if (($version -join "`n") -notmatch [regex]::Escape($speckitVersion)) {
        throw "Spec Kit $speckitVersion is required. Run the promptlings machine installer."
    }
    $workflow = Join-Path (Split-Path $PSScriptRoot) "workflows\promptlings-delivery.yml"
    if (-not (Test-Path -LiteralPath $workflow -PathType Leaf)) { throw "Missing bundled workflow: $workflow." }
}

function Set-ExclusionBlock([string]$Name, [string[]]$Rules) {
    $lines = if (Test-Path -LiteralPath $exclude) { @(Get-Content -LiteralPath $exclude) } else { @() }
    $kept = @()
    $skip = $false
    foreach ($line in $lines) {
        if ($line -ceq "# promptlings $Name start") { $skip = $true }
        if (-not $skip) { $kept += $line }
        if ($line -ceq "# promptlings $Name end") { $skip = $false }
    }
    $kept += @("# promptlings $Name start") + $Rules + @("# promptlings $Name end")
    [IO.File]::WriteAllText($exclude, ($kept -join "`n") + "`n")
}

# Exclusions land before any framework file is written.
$null = New-Item -ItemType Directory -Force -Path (Split-Path $exclude)
$original = if (Test-Path -LiteralPath $exclude) { @(Get-Content -LiteralPath $exclude) } else { @() }
Set-ExclusionBlock personal @("/.claude/settings.local.json", "/CLAUDE.local.md")
if ($bmad) {
    $rules = @("/_bmad/config.user.toml", "/_bmad/custom/*.user.toml", "/_bmad/render/", "/_bmad/**/__pycache__/", ".memlog.md")
    $machinery = @("/_bmad/", "/_bmad-output/", "/.agents/skills/bmad-*/", "/.claude/skills/bmad-*/",
        "/.github/skills/bmad-*/", "/.github/agents/bmad-*.agent.md")
    $framework += $machinery
    if (-not $SharedFrameworks) { $rules += $machinery }
    Set-ExclusionBlock bmad $rules
}
if ($speckit) {
    $rules = @("/.specify/feature.json", "/.specify/extensions/.cache/", "/.specify/extensions/.backup/",
        "/.specify/extensions/*/local-config.yml", "/.specify/extensions/*/*-config.local.yml")
    $machinery = @("/.specify/", "/specs/", "/.github/skills/speckit-*/", "/.claude/skills/speckit-*/",
        "/.agents/skills/speckit-*/", "/.github/agents/speckit.*.agent.md",
        "/.github/prompts/speckit.*.prompt.md", "/.claude/commands/speckit.*.md")
    $framework += $machinery
    if (-not $SharedFrameworks) {
        $rules += $machinery
        $context = if ($Integration -eq "copilot") { ".github/copilot-instructions.md" } else { "CLAUDE.md" }
        # Only reserve a generic instruction file when the framework creates it.
        foreach ($candidate in @(".github/copilot-instructions.md", "CLAUDE.md")) {
            if ($original -ccontains "/$candidate" -or ($candidate -eq $context -and -not (Test-Path -LiteralPath (Join-Path $Project $candidate)))) {
                $rules += "/$candidate"
                $framework += "/$candidate"
            }
        }
    }
    Set-ExclusionBlock speckit $rules
}

# Existing framework directories are not upgraded or regenerated.
if ($bmad -and -not (Test-Path (Join-Path $Project "_bmad"))) {
    Invoke-Native $bmadCommand install --directory $Project --modules bmm --tools "github-copilot,claude-code" --yes
}
if ($speckit) {
    Push-Location $Project
    try {
        if (-not (Test-Path .specify)) {
            $options = @()
            if ($Integration -eq "copilot") { $options += "--integration-options=--skills" }
            "" | & specify init --here --force --non-interactive --integration $Integration --ignore-agent-tools @options
            if ($LASTEXITCODE -ne 0) { throw "Spec Kit initialization failed ($LASTEXITCODE)." }
        }
        Invoke-Native specify integration list
        Invoke-Native specify workflow add $workflow
        $null = Invoke-Native specify workflow info promptlings-delivery
    }
    finally { Pop-Location }
}

$required = @()
if ($bmad) {
    $required += @("_bmad/scripts/render_skill.py", "_bmad/_config/manifest.yaml", "_bmad/config.toml",
        ".agents/skills/bmad-build/SKILL.md", ".claude/skills/bmad-build/SKILL.md")
}
if ($speckit) {
    $directory = if ($Integration -eq "copilot") { ".github/skills" } else { ".claude/skills" }
    $required += @(".specify/integration.json", "$directory/speckit-specify/SKILL.md", "$directory/speckit-converge/SKILL.md",
        ".specify/workflows/promptlings-delivery/workflow.yml")
}
foreach ($relative in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $Project $relative) -PathType Leaf)) {
        throw "Framework installation is incomplete in ${Project}: $relative."
    }
}
if ($SharedFrameworks) {
    $samples = @()
    if ($bmad) { $samples += "_bmad/config.toml" }
    if ($speckit) { $samples += @(".specify/memory/constitution.md", "specs/001-example/spec.md") }
    foreach ($relative in $samples) {
        & git -C $Project check-ignore --no-index -q $relative
        if ($LASTEXITCODE -eq 0) { throw "Shared framework path is ignored: $relative. Review existing Git exclusions." }
    }
    $global:LASTEXITCODE = 0
    Write-Host "Initialized $($methods -join ', ') in $Project. Shared framework files are eligible for tracking. Nothing was staged or committed."
    return
}
# Existing files expose rules, such as negations, that sample paths cannot.
$pathspecs = @($framework | ForEach-Object {
    $rule = $_.TrimStart("/")
    if ($rule.EndsWith("/")) { $rule += "**" }
    ":(glob)$rule"
})
$leaks = @(Invoke-Native git -C $Project ls-files --others --exclude-standard -- @pathspecs)
if ($leaks.Count) {
    throw "Local framework files are not ignored: $(($leaks | Select-Object -First 5) -join ', '). Review existing Git exclusions, including negations."
}
Write-Host "Initialized $($methods -join ', ') in $Project. Framework files are locally ignored. Nothing was staged or committed."
