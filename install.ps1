[CmdletBinding()]
param(
    [switch]$All, [switch]$Review, [string]$Agents, [switch]$List,
    [switch]$DryRun, [switch]$Yes, [switch]$Help,
    [switch]$NoDependencies, [switch]$NoSystemPackages, [switch]$NoSkills,
    [switch]$NoMemory, [switch]$NoStartup, [switch]$NoBmad,
    [switch]$NoSpeckit, [switch]$NoPlaywright,
    [switch]$NoHyperframes, [switch]$NoDemo, [switch]$NoReadSide,
    [string]$Project, [switch]$ProjectOnly, [switch]$SharedFrameworks,
    [ValidateSet("copilot", "claude")][string]$Integration = "copilot",
    [ValidateRange(1, 65535)][int]$MemoryPort = 8000
)
$ErrorActionPreference = "Stop"
# Pinned upstream tools. Keep these values identical in install.sh.
$pins = @{
    BMAD_PACKAGE = "bmad-method@6.12.4"
    SPECKIT_PACKAGE = "git+https://github.com/github/spec-kit.git@v1.2.5"
    MEMORY_PACKAGE = "basic-memory==0.24.1"
    SKILLS_PACKAGE = "skills@1.7.4"
    RULESYNC_PACKAGE = "rulesync@42.0.0"
    RULESYNC_RULE_TARGETS = "antigravity-cli,antigravity-ide,augmentcode,bob,claudecode,cline,codebuddy,copilot,copilotcli,devin,firebender,grokcli,kilo,kiro-cli,kiro-ide,mimocode,omp,opencode,qoder,qwencode,tabnine,zoocode"
    ADD_MCP_PACKAGE = "add-mcp@2.6.0"
    MCP_REMOTE_PACKAGE = "mcp-remote@0.15.2"
    PLAYWRIGHT_PACKAGE = "@playwright/cli@0.1.22"
    HYPERFRAMES_PACKAGE = "hyperframes@0.8.202"
    DIFF2HTML_PACKAGE = "diff2html-cli@5.2.15"
    MEMORY_SKILLS = "https://github.com/basicmachines-co/basic-memory/tree/ac064607a688720cf44037e27ea55552bc5edede/skills"
    PLAYWRIGHT_SKILLS = "https://github.com/microsoft/playwright-cli/tree/b85c7a736bb473bf55b584e54a09ffa698d6d871/skills/playwright-cli"
    DEMOTIME_EXTENSION = "eliostruyf.vscode-demo-time@2.4.0"
    DEMOTIME_SKILLS = "https://github.com/estruyf/vscode-demo-time/tree/96175a9b64a4f6e066720315e8119f8a7ea6cf5e/skills"
    VSCODE_PLAYWRIGHT_SKILL = "https://github.com/microsoft/hve-core/tree/c0726875613fed25bcd7d6d42cc720b96bfe1dda/.github/skills/experimental/vscode-playwright"
    HYPERFRAMES_SKILLS = "https://github.com/heygen-com/hyperframes/tree/618c486734b3cbb697bd432bace7e9642e48b6be/skills"
    FRONTEND_DESIGN_SKILL = "https://github.com/anthropics/skills/tree/41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f/skills/frontend-design"
}

$BaseUrl = if ($env:PROMPTLINGS_SOURCE) { $env:PROMPTLINGS_SOURCE.TrimEnd("/") } else {
    "https://raw.githubusercontent.com/dfinson/promptlings/main"
}
$agentPaths = [ordered]@{
    "the-nitcracker" = "agents/code-review/the-nitcracker.agent.md"
    "pr-walkthrough" = "agents/code-review/pr-walkthrough.agent.md"
    "sparring-partner" = "agents/reasoning/sparring-partner.agent.md"
    "memory-manager" = "agents/context/memory-manager.agent.md"
    "artifact-inspector" = "agents/maintenance/artifact-inspector.agent.md"
    "technical-demo" = "agents/media/technical-demo.agent.md"
    "interactive-presentation" = "agents/media/interactive-presentation.agent.md"
    "bmad-orchestrator" = "agents/orchestration/bmad-orchestrator.agent.md"
    "speckit-flow" = "agents/orchestration/speckit-flow.agent.md"
}
$skillFiles = @(
    "skills/artifact-inspection/SKILL.md"
    "skills/artifact-inspection/scripts/check_artifacts.py"
    "skills/cue-synced-demo/SKILL.md"
    "skills/design-analysis/SKILL.md"
    "skills/design-writing/SKILL.md"
    "skills/design-writing/references/adr.md"
    "skills/design-writing/references/design-document.md"
    "skills/design-writing/references/sources.md"
    "skills/design-writing/references/specification.md"
    "skills/design-writing/references/tickets.md"
    "skills/evidence-verification/SKILL.md"
    "skills/interactive-deck/SKILL.md"
    "skills/interactive-deck/references/craft.md"
    "skills/interactive-deck/references/interaction-patterns.md"
    "skills/interactive-deck/references/runtime.md"
    "skills/interactive-deck/references/sources.md"
    "skills/interactive-deck/references/visual-directions.md"
    "skills/narrative-transitions/SKILL.md"
    "skills/pr-video/SKILL.md"
    "skills/presenter-script/SKILL.md"
    "skills/reasoning-first-narration/SKILL.md"
    "skills/reasoning-first-writing/SKILL.md"
    "skills/reasoning-first-writing/references/sources.md"
    "skills/review-ensemble/SKILL.md"
    "skills/technical-investigation/SKILL.md"
    "skills/test-analysis/SKILL.md"
    "skills/tts-setup/SKILL.md"
)
$allAgents = $agentPaths.Keys -join ","
if ($List) { $allAgents.Split(","); return }
if ($Help) {
    Write-Host "Install all agents and tools: .\install.ps1 -Yes"
    Write-Host "Initialize a repository: .\install.ps1 -Project PATH -ProjectOnly -Yes"
    Write-Host "Frameworks and generated documents are locally ignored. Opt into tracking with -SharedFrameworks."
    Write-Host "Opt-outs: -NoDependencies, -NoSystemPackages, -NoSkills, -NoReadSide,"
    Write-Host "-NoMemory, -NoStartup, -NoBmad, -NoSpeckit, -NoPlaywright, -NoHyperframes, -NoDemo."
    return
}
if (@("All", "Review", "Agents" | Where-Object { $PSBoundParameters.ContainsKey($_) }).Count -gt 1) {
    throw "Choose only one of -All, -Review or -Agents."
}
if ($Review) { $Agents = "the-nitcracker,pr-walkthrough,sparring-partner" }
elseif (-not $PSBoundParameters.ContainsKey("Agents")) { $Agents = $allAgents }
if (-not $Agents -or @($Agents.Split(",") | Where-Object { $_ -notin $allAgents.Split(",") }).Count) {
    throw "Unknown or empty agent selection. Use -List."
}
if ($ProjectOnly -and -not $Project) { throw "-ProjectOnly requires -Project." }
if ($SharedFrameworks -and -not $Project) { throw "-SharedFrameworks requires -Project." }
if ($Project -and $NoDependencies) { throw "-Project cannot be combined with -NoDependencies." }
Write-Host "Agents: $Agents"
Write-Host "Promptlings skills: all bundled skills, published with the agents."
Write-Host "Default: WinGet prerequisites, uv applications, global npm applications and published global skills."
Write-Host "Opt-outs: memory=$NoMemory bmad=$NoBmad speckit=$NoSpeckit playwright=$NoPlaywright hyperframes=$NoHyperframes demo=$NoDemo"
Write-Host "Basic Memory: native user-login startup=$(-not $NoStartup), loopback port=$MemoryPort."
$frameworkPolicy = if ($SharedFrameworks) { "shared, eligible for tracking" } else { "local, ignored including generated documents" }
Write-Host "Repository: $Project. Framework policy: $frameworkPolicy."
Write-Host "Project-only=$ProjectOnly. NoDependencies=$NoDependencies. NoSystemPackages=$NoSystemPackages. NoSkills=$NoSkills."
Write-Host "Package installation can request elevation. No private runtimes, global Git exclusions, staging or commits."
if ($DryRun) { Write-Host "Dry run. Nothing was downloaded or written."; return }
if (-not $Yes) {
    if ([Console]::IsInputRedirected) { throw "Review -DryRun, then pass -Yes for noninteractive installation." }
    if ((Read-Host "Install the displayed components? [y/N]") -notmatch '^(?i:y|yes)$') { return }
}

function Invoke-Native {
    $Command, $Arguments = $args
    $Arguments = @($Arguments)
    Write-Host "+ $Command $($Arguments -join ' ')"
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Command failed ($LASTEXITCODE): $Command $($Arguments -join ' ')" }
}
function Get-Asset {
    param([string]$Relative, [string]$Destination)
    $local = Join-Path $PSScriptRoot ($Relative.Replace("/", [IO.Path]::DirectorySeparatorChar))
    if ($BaseUrl -eq "https://raw.githubusercontent.com/dfinson/promptlings/main" -and (Test-Path -LiteralPath $local)) {
        Copy-Item -LiteralPath $local -Destination $Destination
    }
    else { Invoke-WebRequest "$BaseUrl/$Relative" -OutFile $Destination -UseBasicParsing }
}
# Validates the repository root and promptlings-managed blocks before anything is installed.
function Get-ProjectExclude {
    # Git resolves short names, links and case, so ask it rather than comparing path strings.
    $state = @(Invoke-Native git -C $Project rev-parse --is-inside-work-tree --show-prefix)
    if ($state[0] -ne "true" -or ($state.Count -gt 1 -and $state[1])) {
        throw "-Project must name the Git repository or linked worktree root."
    }
    $path = (Invoke-Native git -C $Project rev-parse --path-format=absolute --git-path info/exclude) -join ""
    if (Test-Path -LiteralPath $path) {
        $lines = @(Get-Content -LiteralPath $path)
        foreach ($name in @("personal", "bmad", "speckit")) {
            $starts = @(); $ends = @()
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i] -ceq "# promptlings $name start") { $starts += $i }
                if ($lines[$i] -ceq "# promptlings $name end") { $ends += $i }
            }
            if (($starts.Count + $ends.Count) -and ($starts.Count -ne 1 -or $ends.Count -ne 1 -or $starts[0] -ge $ends[0])) {
                throw "Malformed promptlings $name exclusion block in $path. Existing rules were not changed."
            }
        }
    }
    $path
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
function Set-Exclusions {
    $null = New-Item -ItemType Directory -Force -Path (Split-Path $exclude)
    $original = if (Test-Path -LiteralPath $exclude) { @(Get-Content -LiteralPath $exclude) } else { @() }
    Set-ExclusionBlock personal @("/.claude/settings.local.json", "/CLAUDE.local.md")
    if (-not $NoBmad) {
        $rules = @("/_bmad/config.user.toml", "/_bmad/custom/*.user.toml", "/_bmad/render/", "/_bmad/**/__pycache__/", ".memlog.md")
        $machinery = @("/_bmad/", "/_bmad-output/", "/.agents/skills/bmad-*/", "/.claude/skills/bmad-*/",
            "/.github/skills/bmad-*/", "/.github/agents/bmad-*.agent.md")
        $script:framework += $machinery
        if (-not $SharedFrameworks) { $rules += $machinery }
        Set-ExclusionBlock bmad $rules
    }
    if (-not $NoSpeckit) {
        $rules = @("/.specify/feature.json", "/.specify/extensions/.cache/", "/.specify/extensions/.backup/",
            "/.specify/extensions/*/local-config.yml", "/.specify/extensions/*/*-config.local.yml")
        $machinery = @("/.specify/", "/specs/", "/.github/skills/speckit-*/", "/.claude/skills/speckit-*/",
            "/.agents/skills/speckit-*/", "/.github/agents/speckit.*.agent.md",
            "/.github/prompts/speckit.*.prompt.md", "/.claude/commands/speckit.*.md")
        $script:framework += $machinery
        if (-not $SharedFrameworks) {
            $rules += $machinery
            $context = if ($Integration -eq "copilot") { ".github/copilot-instructions.md" } else { "CLAUDE.md" }
            # Only reserve a generic instruction file when the framework creates it.
            foreach ($candidate in @(".github/copilot-instructions.md", "CLAUDE.md")) {
                if ($original -ccontains "/$candidate" -or ($candidate -eq $context -and -not (Test-Path -LiteralPath (Join-Path $Project $candidate)))) {
                    $rules += "/$candidate"
                    $script:framework += "/$candidate"
                }
            }
        }
        Set-ExclusionBlock speckit $rules
    }
}
function Test-Project {
    $required = @()
    if (-not $NoBmad) {
        $required += @("_bmad/scripts/render_skill.py", "_bmad/_config/manifest.yaml", "_bmad/config.toml",
            ".agents/skills/bmad-build/SKILL.md", ".claude/skills/bmad-build/SKILL.md")
    }
    if (-not $NoSpeckit) {
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
        if (-not $NoBmad) { $samples += "_bmad/config.toml" }
        if (-not $NoSpeckit) { $samples += @(".specify/memory/constitution.md", "specs/001-example/spec.md") }
        foreach ($relative in $samples) {
            & git -C $Project check-ignore --no-index -q $relative
            if ($LASTEXITCODE -eq 0) { throw "Shared framework path is ignored: $relative. Review existing Git exclusions." }
        }
        $global:LASTEXITCODE = 0
        Write-Host "Shared framework files and artifacts are eligible for tracking. Nothing was staged or committed."
        return
    }
    # Existing files expose rules, such as negations, that sample paths cannot.
    $pathspecs = @($script:framework | ForEach-Object {
        $rule = $_.TrimStart("/")
        if ($rule.EndsWith("/")) { $rule += "**" }
        ":(glob)$rule"
    })
    if ($pathspecs.Count) {
        $leaks = @(Invoke-Native git -C $Project ls-files --others --exclude-standard -- @pathspecs)
        if ($leaks.Count) {
            throw "Local framework files are not ignored: $(($leaks | Select-Object -First 5) -join ', '). Review existing Git exclusions, including negations."
        }
    }
    Write-Host "Framework machinery and generated artifacts are locally ignored. Nothing was staged or committed."
}
function Refresh-Path {
    $paths = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
        [Environment]::GetEnvironmentVariable("Path", "User") + ";" + $env:PATH
    $env:PATH = (($paths -split ";" | Where-Object { $_ } | Select-Object -Unique) -join ";")
}
# Document rendering needs either Microsoft Word or LibreOffice.
function Get-WordPath {
    foreach ($hive in @("HKLM:", "HKCU:")) {
        $key = "$hive\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\Winword.exe"
        $path = (Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue).'(default)'
        if ($path -and (Test-Path -LiteralPath $path)) { return $path }
    }
}
function Test-LibreOffice {
    [bool](Get-Command soffice.com -ErrorAction SilentlyContinue) -or
        (Test-Path (Join-Path $env:ProgramFiles "LibreOffice\program\soffice.com"))
}

$temporary = Join-Path ([IO.Path]::GetTempPath()) ("promptlings-" + [guid]::NewGuid())
$taskName = "Promptlings Basic Memory"
$null = New-Item -ItemType Directory -Path $temporary
$framework = @()
try {
    $windows = $env:OS -eq "Windows_NT"
    if (-not $NoDependencies -and -not $ProjectOnly -and -not $NoSystemPackages) {
        if (-not $windows) { throw "Use install.sh on macOS and Ubuntu/Debian." }
        if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
            throw "Install Microsoft's App Installer (WinGet): https://aka.ms/getwinget . Then rerun."
        }
        $systemPackages = @("Python.Python.3.12", "OpenJS.NodeJS.LTS", "Git.Git", "GitHub.cli", "astral-sh.uv")
        if (-not $NoHyperframes -or -not $NoDemo) { $systemPackages += "Gyan.FFmpeg" }
        if (-not $NoDemo) {
            $systemPackages += "oschwartz10612.Poppler"
            if (-not (Get-Command code -ErrorAction SilentlyContinue)) { $systemPackages += "Microsoft.VisualStudioCode" }
            if (-not (Get-WordPath) -and -not (Test-LibreOffice)) { $systemPackages += "TheDocumentFoundation.LibreOffice" }
        }
        foreach ($package in $systemPackages) {
            & winget.exe install --id $package --exact --source winget --accept-package-agreements --accept-source-agreements --disable-interactivity
            # WinGet reports an already-current installation as no applicable update.
            if ($LASTEXITCODE -notin @(0, -1978335189)) { throw "WinGet failed ($LASTEXITCODE): $package" }
        }
        Refresh-Path
    }
    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if (-not $python) { $python = Get-Command python3 -ErrorAction SilentlyContinue }
    if ($Project) { $exclude = Get-ProjectExclude }
    if (-not $NoDependencies -and -not $ProjectOnly) {
        foreach ($command in @("uv", "node", "npm.cmd", "git", "gh")) {
            if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "Missing prerequisite: $command" }
        }
        if (-not $python) { throw "Python 3.11+ is required. Rerun without -NoSystemPackages to install it." }
        Invoke-Native $python.Source -c "import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)"
        Invoke-Native node -e "const [a,b]=process.versions.node.split('.').map(Number);if(a<22||(a===22&&b<20))throw Error('Node.js 22.20+ required')"
        Invoke-Native git --version
        Invoke-Native gh --version
        $packages = @()
        if (-not $NoSkills) { $packages += $pins.SKILLS_PACKAGE }
        if (-not $NoBmad) { $packages += $pins.BMAD_PACKAGE }
        if (-not $NoPlaywright) { $packages += $pins.PLAYWRIGHT_PACKAGE }
        if (-not $NoHyperframes) { $packages += $pins.HYPERFRAMES_PACKAGE }
        if (-not $NoDemo) { $packages += $pins.DIFF2HTML_PACKAGE }
        if ($packages.Count) { Invoke-Native npm.cmd install --global @packages }
        if (-not $NoMemory) {
            if ($windows) {
                # Windows cannot replace basic-memory while a previous server holds it, and stopping the task leaves its children running.
                if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { Stop-ScheduledTask -TaskName $taskName }
                $memoryExe = Join-Path (Invoke-Native uv tool dir --bin) "basic-memory.exe"
                $memoryEnv = Join-Path (Invoke-Native uv tool dir) "basic-memory\*"
                Get-Process | Where-Object { $_.Path -eq $memoryExe -or $_.Path -like $memoryEnv } |
                    # A tree kill can already have ended later matches; cmd keeps their errors from becoming terminating PowerShell errors.
                    ForEach-Object { & cmd.exe /d /c "taskkill /PID $($_.Id) /T /F >nul 2>&1" }
            }
            Invoke-Native uv tool install --force --python 3.12 $pins.MEMORY_PACKAGE
        }
        if (-not $NoSpeckit) { Invoke-Native uv tool install --force --python 3.12 $pins.SPECKIT_PACKAGE }
        Invoke-Native uv tool update-shell
        if ($windows) { Refresh-Path }
        $toolBin = Invoke-Native uv tool dir --bin
        $env:PATH = "$toolBin;$env:PATH"
        if (-not $NoMemory) { Invoke-Native basic-memory --version }
        if (-not $NoSpeckit) { Invoke-Native specify version }
        if (-not $NoBmad) { Invoke-Native bmad-method.cmd --version }
        if (-not $NoSkills) {
            $env:DISABLE_TELEMETRY = "1"
            $sources = @($pins.FRONTEND_DESIGN_SKILL)
            if (-not $NoMemory) { $sources += $pins.MEMORY_SKILLS }
            if (-not $NoPlaywright) { $sources += $pins.PLAYWRIGHT_SKILLS }
            if (-not $NoHyperframes) { $sources += $pins.HYPERFRAMES_SKILLS }
            if (-not $NoDemo) { $sources += $pins.DEMOTIME_SKILLS, $pins.VSCODE_PLAYWRIGHT_SKILL }
            foreach ($source in $sources) {
                Invoke-Native skills.cmd add $source --global --skill "*" --yes --copy
            }
        }
        if (-not $NoPlaywright) {
            Invoke-Native playwright-cli.cmd install-browser chrome
            Push-Location $temporary
            try {
                $session = "promptlings-install-$PID"
                Invoke-Native playwright-cli.cmd "-s=$session" open about:blank
                $title = Invoke-Native playwright-cli.cmd "-s=$session" eval "() => { document.title = 'promptlings'; return document.title; }" --raw
                if (($title -join "`n").Trim().Trim('"') -ne "promptlings") { throw "Playwright CLI browser smoke check failed: $title" }
            }
            finally {
                Invoke-Native playwright-cli.cmd "-s=$session" close
                Pop-Location
            }
        }
        if (-not $NoHyperframes) {
            Invoke-Native ffmpeg -version
            Invoke-Native ffprobe -version
            Invoke-Native hyperframes.cmd browser ensure
            $report = (Invoke-Native hyperframes.cmd doctor --json) | ConvertFrom-Json
            foreach ($name in @("FFmpeg", "FFprobe", "Chrome")) {
                if (-not @($report.checks | Where-Object { $_.name -eq $name -and $_.ok }).Count) {
                    throw "HyperFrames prerequisite failed: $name"
                }
            }
            Invoke-Native npx.cmd --no-install hyperframes --version
        }
        if (-not $NoDemo) {
            $office = Join-Path $env:ProgramFiles "LibreOffice\program"
            if (-not (Get-Command soffice.com -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $office "soffice.com"))) {
                # LibreOffice does not add its program directory to PATH.
                $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
                [Environment]::SetEnvironmentVariable("Path", (@($userPath, $office) | Where-Object { $_ }) -join ";", "User")
                $env:PATH = "$env:PATH;$office"
            }
            Invoke-Native code.cmd --version
            Invoke-Native code.cmd --install-extension $pins.DEMOTIME_EXTENSION
            if (Get-Command soffice.com -ErrorAction SilentlyContinue) { Invoke-Native soffice.com --version }
            elseif ($word = Get-WordPath) { Write-Host "Document rendering: Microsoft Word at $word." }
            else { throw "Document rendering needs Microsoft Word or LibreOffice." }
            Invoke-Native pdftoppm -v
            Invoke-Native ffmpeg -version
            Invoke-Native diff2html.cmd --version
        }
    }
    if ($Project) {
        $Project = (Resolve-Path -LiteralPath $Project).Path
        if (-not $NoBmad) {
            $version = Invoke-Native bmad-method.cmd --version
            if (($version -join "`n") -notmatch [regex]::Escape(($pins.BMAD_PACKAGE -split "@")[-1])) {
                throw "BMAD version does not match the installer pin. Run the machine installer first."
            }
        }
        if (-not $NoSpeckit) {
            $version = Invoke-Native specify version
            if (($version -join "`n") -notmatch [regex]::Escape(($pins.SPECKIT_PACKAGE -split "@v")[-1])) {
                throw "Specify version does not match the installer pin. Run the machine installer first."
            }
        }
        Set-Exclusions
        if (-not $NoBmad -and -not (Test-Path (Join-Path $Project "_bmad"))) {
            Invoke-Native bmad-method.cmd install --directory $Project --modules bmm --tools "github-copilot,claude-code" --yes
        }
        if (-not $NoSpeckit) {
            $workflow = Join-Path $temporary "promptlings-delivery.yml"
            Get-Asset workflows/speckit/promptlings-delivery/workflow.yml $workflow
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
        Test-Project
    }
    if (-not $ProjectOnly) {
        if (-not (Get-Command npx.cmd -ErrorAction SilentlyContinue)) {
            throw "Node.js npx is required to publish agents and register MCP servers."
        }
        $memoryCommand = $null
        if (-not $NoMemory -and -not $NoDependencies) {
            $memoryCommand = (Get-Command basic-memory -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source
            if (-not $memoryCommand) { throw "basic-memory is not on PATH after installation." }
            if (-not $NoStartup) {
                # A previous run of this service would hold the memory port.
                if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { Stop-ScheduledTask -TaskName $taskName }
                $probe = [Net.Sockets.TcpClient]::new()
                try { $open = $probe.ConnectAsync("127.0.0.1", $MemoryPort).Wait(1000) } catch { $open = $false } finally { $probe.Dispose() }
                if ($open) { throw "Memory port $MemoryPort is in use. Stop that listener or pass another port." }
            }
        }
        $source = Join-Path $temporary "rulesync"
        $null = New-Item -ItemType Directory -Force -Path (Join-Path $source "subagents")
        $utf8 = [Text.UTF8Encoding]::new($false)
        $download = Join-Path $temporary "asset.md"
        foreach ($name in $Agents.Split(",")) {
            Get-Asset $agentPaths[$name] $download
            $text = [IO.File]::ReadAllText($download).Replace("`r`n", "`n")
            if (-not $text.StartsWith("---`n")) { throw "Agent has no frontmatter: $($agentPaths[$name])" }
            # rulesync skips sources without targets.
            [IO.File]::WriteAllText((Join-Path $source "subagents\$name.md"), "---`ntargets: [`"*`"]`n" + $text.Substring(4), $utf8)
        }
        $memoryRule = "memory-manager" -in $Agents.Split(",") -and -not $NoReadSide -and -not $NoMemory
        if ($memoryRule) {
            Get-Asset agents/context/memory-manager-read-side.md $download
            $block = [IO.File]::ReadAllText($download).Replace("`r`n", "`n")
            if (-not $block.StartsWith("<!-- memory-manager-read-side-start -->`n") -or
                -not $block.TrimEnd().EndsWith("<!-- memory-manager-read-side-end -->")) {
                throw "Invalid downloaded memory read-side rule."
            }
            $null = New-Item -ItemType Directory -Force -Path (Join-Path $source "rules")
            [IO.File]::WriteAllText((Join-Path $source "rules\promptlings-memory.md"),
                "---`ntargets: [`"*`"]`nglobs: [`"**/*`"]`n---`n" + $block, $utf8)
        }
        $skillSources = $skillFiles
        if ("memory-manager" -in $Agents.Split(",") -and -not $NoMemory) {
            $skillSources += "skills/promptlings-memory-capture/SKILL.md"
        }
        foreach ($path in $skillSources) {
            $target = Join-Path $source $path
            $null = New-Item -ItemType Directory -Force -Path (Split-Path $target)
            if ((Split-Path $path -Leaf) -ne "SKILL.md") { Get-Asset $path $target; continue }
            Get-Asset $path $download
            $text = [IO.File]::ReadAllText($download).Replace("`r`n", "`n")
            if (-not $text.StartsWith("---`n")) { throw "Skill has no frontmatter: $path" }
            [IO.File]::WriteAllText($target, "---`ntargets: [`"*`"]`n" + $text.Substring(4), $utf8)
        }
        Push-Location $source
        try {
            Invoke-Native npx.cmd --yes $pins.RULESYNC_PACKAGE generate -g --input-roots . -t "*" -f "subagents,skills"
            # Only targets with a dedicated global rule file. Others share a root file rulesync would replace.
            if ($memoryRule) {
                Invoke-Native npx.cmd --yes $pins.RULESYNC_PACKAGE generate -g --input-roots . -t $pins.RULESYNC_RULE_TARGETS -f rules
            }
        }
        finally { Pop-Location }
        if ($memoryCommand) {
            $server = @(if ($NoStartup) { $memoryCommand, "--args", "mcp" } else { "http://127.0.0.1:$MemoryPort/mcp" })
            $transport = if ($NoStartup) { "stdio" } else { "http" }
            # add-mcp aborts if any detected client lacks the transport. Stdio-only clients reach the HTTP server through mcp-remote.
            $addMcp = Join-Path $temporary "add-mcp"
            Invoke-Native npm.cmd install --prefix $addMcp --no-save --no-fund --no-audit $pins.ADD_MCP_PACKAGE
            $detect = Join-Path $temporary "detect-mcp-clients.mjs"
            [IO.File]::WriteAllText($detect, @'
const [library, transport] = process.argv.slice(2);
const { pathToFileURL } = await import("node:url");
const { agents, detectGlobalAgents } = await import(pathToFileURL(library).href);
for (const agent of await detectGlobalAgents()) {
  const supported = agents[agent].supportedTransports;
  if (supported.includes(transport)) console.log(`direct ${agent}`);
  else if (transport === "http" && supported.includes("stdio")) console.log(`bridge ${agent}`);
  else console.error(`Skipping ${agents[agent].displayName}: no ${transport} MCP support.`);
}
'@, [Text.UTF8Encoding]::new($false))
            $clients = @(Invoke-Native node $detect (Join-Path $addMcp "node_modules\add-mcp\dist\lib.js") $transport)
            $addMcpCli = Join-Path $addMcp "node_modules\add-mcp\dist\index.js"
            $direct = @($clients | Where-Object { $_ -like "direct *" } | ForEach-Object { "-a"; $_.Substring(7) })
            $bridge = @($clients | Where-Object { $_ -like "bridge *" } | ForEach-Object { "-a"; $_.Substring(7) })
            if ($direct.Count) { Invoke-Native node $addMcpCli @server -g -y -n basic-memory @direct }
            if ($bridge.Count) {
                Invoke-Native node $addMcpCli $pins.MCP_REMOTE_PACKAGE --args "http://127.0.0.1:$MemoryPort/mcp" -g -y -n basic-memory @bridge
            }
            if (-not $clients.Count) { Write-Warning "No supported MCP client was detected. basic-memory was not registered." }
        }
        if ($memoryCommand -and -not $NoStartup) {
            # An interactive task gives a console program a visible window; headless conhost hosts it without one.
            $action = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot "System32\conhost.exe") `
                -Argument "--headless `"$memoryCommand`" mcp --transport streamable-http --host 127.0.0.1 --port $MemoryPort"
            $user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
            $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
            $trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
            $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
            Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
            Start-ScheduledTask -TaskName $taskName
            $request = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"promptlings-installer","version":"1"}}}'
            $ready = $false
            # A cold start after reinstalling can take several minutes.
            $deadline = (Get-Date).AddSeconds(600)
            while (-not $ready -and (Get-Date) -lt $deadline) {
                try {
                    $response = Invoke-WebRequest "http://127.0.0.1:$MemoryPort/mcp" -Method Post -Body $request -UseBasicParsing -TimeoutSec 2 `
                        -ContentType "application/json" -Headers @{ Accept = "application/json, text/event-stream" }
                    $ready = [Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray()) -match '"name": ?"basic[ _-]?memory"'
                }
                catch { $ready = $false }
                if (-not $ready) { Start-Sleep -Seconds 1 }
            }
            if (-not $ready) { throw "Basic Memory did not become ready at 127.0.0.1:$MemoryPort. Inspect its scheduled task." }
        }
    }
    Write-Host "Installed selected components. Restart your terminal and assistant. Repository changes remain unstaged."
}
finally {
    # Browser diagnostics can contain nested files and belong only to this invocation.
    Remove-Item -LiteralPath $temporary -Recurse
}
