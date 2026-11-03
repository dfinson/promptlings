#!/usr/bin/env bash
set -euo pipefail

# Pinned upstream tools. Keep these values identical in install.ps1.
BMAD_PACKAGE=bmad-method@6.12.4
SPECKIT_PACKAGE=git+https://github.com/github/spec-kit.git@v1.2.5
MEMORY_PACKAGE=basic-memory==0.24.1
SKILLS_PACKAGE=skills@1.7.4
RULESYNC_PACKAGE=rulesync@42.0.0
RULESYNC_RULE_TARGETS=antigravity-cli,antigravity-ide,augmentcode,bob,claudecode,cline,codebuddy,copilot,copilotcli,devin,firebender,grokcli,kilo,kiro-cli,kiro-ide,mimocode,omp,opencode,qoder,qwencode,tabnine,zoocode
ADD_MCP_PACKAGE=add-mcp@2.6.0
MCP_REMOTE_PACKAGE=mcp-remote@0.15.2
PLAYWRIGHT_PACKAGE=@playwright/cli@0.1.22
HYPERFRAMES_PACKAGE=hyperframes@0.8.202
DIFF2HTML_PACKAGE=diff2html-cli@5.2.15
MEMORY_SKILLS=https://github.com/basicmachines-co/basic-memory/tree/ac064607a688720cf44037e27ea55552bc5edede/skills
PLAYWRIGHT_SKILLS=https://github.com/microsoft/playwright-cli/tree/b85c7a736bb473bf55b584e54a09ffa698d6d871/skills/playwright-cli
DEMOTIME_EXTENSION=eliostruyf.vscode-demo-time@2.4.0
DEMOTIME_SKILLS=https://github.com/estruyf/vscode-demo-time/tree/96175a9b64a4f6e066720315e8119f8a7ea6cf5e/skills
VSCODE_PLAYWRIGHT_SKILL=https://github.com/microsoft/hve-core/tree/c0726875613fed25bcd7d6d42cc720b96bfe1dda/.github/skills/experimental/vscode-playwright
HYPERFRAMES_SKILLS=https://github.com/heygen-com/hyperframes/tree/618c486734b3cbb697bd432bace7e9642e48b6be/skills
FRONTEND_DESIGN_SKILL=https://github.com/anthropics/skills/tree/41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f/skills/frontend-design
EXPERIENCE_PACKAGES="esbuild@0.28.2 shiki@4.5.0 @shikijs/magic-move@4.5.0 flubber@0.4.2 roughjs@4.6.6 d3@7.9.0 @dagrejs/dagre@3.1.3 axe-core@4.14.0 lucide-static@1.62.0 @tabler/icons@3.50.0 @fontsource-variable/inter@5.3.0 @fontsource/ibm-plex-sans@5.3.0 @fontsource/ibm-plex-mono@5.3.0 @fontsource-variable/space-grotesk@5.3.0 @fontsource-variable/jetbrains-mono@5.3.0 @fontsource-variable/fraunces@5.3.0 @fontsource-variable/newsreader@5.3.0 @fontsource/instrument-serif@5.3.0 @fontsource-variable/caveat@5.3.0"

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_url="${PROMPTLINGS_SOURCE:-https://raw.githubusercontent.com/dfinson/promptlings/main}"
all_agents="the-nitcracker,pr-walkthrough,sparring-partner,memory-manager,artifact-inspector,technical-demo,interactive-presentation,bmad-orchestrator,speckit-flow"
agent_path() {
  case "$1" in
    the-nitcracker|pr-walkthrough) echo "agents/code-review/$1.agent.md" ;;
    sparring-partner) echo "agents/reasoning/$1.agent.md" ;;
    memory-manager) echo "agents/context/$1.agent.md" ;;
    artifact-inspector) echo "agents/maintenance/$1.agent.md" ;;
    technical-demo|interactive-presentation) echo "agents/media/$1.agent.md" ;;
    bmad-orchestrator|speckit-flow) echo "agents/orchestration/$1.agent.md" ;;
  esac
}
skill_files=(
  skills/artifact-inspection/SKILL.md
  skills/artifact-inspection/scripts/check_artifacts.py
  skills/cue-synced-demo/SKILL.md
  skills/design-analysis/SKILL.md
  skills/design-writing/SKILL.md
  skills/design-writing/references/adr.md
  skills/design-writing/references/design-document.md
  skills/design-writing/references/sources.md
  skills/design-writing/references/specification.md
  skills/design-writing/references/tickets.md
  skills/evidence-verification/SKILL.md
  skills/interactive-experience/SKILL.md
  skills/interactive-experience/references/craft.md
  skills/interactive-experience/references/mini-apps.md
  skills/interactive-experience/references/runtime.md
  skills/interactive-experience/references/sources.md
  skills/interactive-experience/references/visual-directions.md
  skills/narrative-transitions/SKILL.md
  skills/pr-video/SKILL.md
  skills/presenter-script/SKILL.md
  skills/reasoning-first-narration/SKILL.md
  skills/reasoning-first-writing/SKILL.md
  skills/reasoning-first-writing/references/sources.md
  skills/review-ensemble/SKILL.md
  skills/technical-investigation/SKILL.md
  skills/test-analysis/SKILL.md
  skills/tts-setup/SKILL.md
)
agents="$all_agents"
yes=0 dry_run=0 dependencies=1 system_packages=1 skills=1 readside=1
memory=1 startup=1 bmad=1 speckit=1 playwright=1 hyperframes=1 demo=1
project="" project_only=0 shared_frameworks=0 integration=copilot memory_port=8000
selection=0
fail() { echo "Installation incomplete: $*" >&2; exit 1; }
value() { [ "$#" -ge 2 ] && [ -n "$2" ] && [[ "$2" != --* ]] || fail "$1 requires a value."; }
while [ "$#" -gt 0 ]; do
  case "$1" in
    --all) agents="$all_agents"; selection=$((selection + 1)) ;;
    --review) agents="the-nitcracker,pr-walkthrough,sparring-partner"; selection=$((selection + 1)) ;;
    --agents) value "$@"; agents="$2"; selection=$((selection + 1)); shift ;;
    --yes|-y) yes=1 ;;
    --dry-run) dry_run=1 ;;
    --no-dependencies) dependencies=0 ;;
    --no-system-packages) system_packages=0 ;;
    --no-skills) skills=0 ;;
    --no-readside) readside=0 ;;
    --no-memory) memory=0 ;;
    --no-startup) startup=0 ;;
    --no-bmad) bmad=0 ;;
    --no-speckit) speckit=0 ;;
    --no-playwright) playwright=0 ;;
    --no-hyperframes) hyperframes=0 ;;
    --no-demo) demo=0 ;;
    --project) value "$@"; project="$2"; shift ;;
    --project-only) project_only=1 ;;
    --shared-frameworks) shared_frameworks=1 ;;
    --integration) value "$@"; integration="$2"; shift ;;
    --memory-port) value "$@"; memory_port="$2"; shift ;;
    --list) printf '%s\n' "$all_agents" | tr ',' '\n'; exit 0 ;;
    --help|-h)
      echo "Install all agents and tools: bash install.sh --yes"
      echo "Initialize a repository: bash install.sh --project PATH --project-only --yes"
      echo "Frameworks and generated documents are locally ignored. Opt into tracking with --shared-frameworks."
      echo "Options: --all, --review, --agents NAME,NAME, --dry-run, --integration copilot|claude,"
      echo "--no-dependencies, --no-system-packages, --no-skills, --no-readside,"
      echo "--no-memory, --no-startup, --memory-port PORT, --no-bmad, --no-speckit,"
      echo "--no-playwright, --no-hyperframes, --no-demo"
      exit 0 ;;
    *) fail "Unknown option: $1. Use --help." ;;
  esac
  shift
done
[ "$selection" -le 1 ] || fail "Choose only one of --all, --review or --agents."
[[ "$agents" =~ ^[a-z-]+(,[a-z-]+)*$ ]] || fail "Invalid agent selection. Use --list."
IFS=',' read -r -a names <<< "$agents"
for name in "${names[@]}"; do
  [[ ",$all_agents," == *",$name,"* ]] || fail "Unknown agent: $name. Use --list."
done
[[ "$memory_port" =~ ^[0-9]{1,5}$ ]] || fail "Invalid memory port."
memory_port=$((10#$memory_port))
[ "$memory_port" -ge 1 ] && [ "$memory_port" -le 65535 ] || fail "Invalid memory port."
[[ "$integration" == copilot || "$integration" == claude ]] || fail "Integration must be copilot or claude."
[ "$project_only" -eq 0 ] || [ -n "$project" ] || fail "--project-only requires --project."
[ "$shared_frameworks" -eq 0 ] || [ -n "$project" ] || fail "--shared-frameworks requires --project."
[ -z "$project" ] || [ "$dependencies" -eq 1 ] || fail "--project cannot be combined with --no-dependencies."
# The interactive-presentation agent's flow depends on these tools, so selecting it overrides their opt-outs.
experience=0
[[ ",$agents," != *,interactive-presentation,* ]] || experience=1
[ "$experience" -eq 0 ] || [ "$dependencies" -eq 1 ] || fail "interactive-presentation requires its dependencies. Remove --no-dependencies or deselect the agent."
[ "$experience" -eq 0 ] || playwright=1

echo "Agents: $agents"
[ "$experience" -eq 0 ] || echo "interactive-presentation: installs Playwright CLI, the skills CLI, its design skills and the pinned experience toolkit regardless of opt-outs."
echo "Promptlings skills: all bundled skills, published with the agents."
echo "Tools: memory=$memory bmad=$bmad speckit=$speckit playwright=$playwright hyperframes=$hyperframes demo=$demo"
echo "Default: native prerequisites, uv applications, global npm applications and published global skills."
echo "Basic Memory: native user-login startup=$startup, loopback port=$memory_port."
framework_policy="local, ignored including generated documents"
[ "$shared_frameworks" -eq 0 ] || framework_policy="shared, eligible for tracking"
echo "Repository: ${project:-none}. Framework policy: $framework_policy."
echo "Project-only=$project_only. Dependencies=$dependencies. System packages=$system_packages. Global skills=$skills."
echo "Package installation can request elevation. No private runtimes, global Git exclusions, staging or commits."
[ "$dry_run" -eq 0 ] || { echo "Dry run. Nothing was downloaded or written."; exit 0; }
if [ "$yes" -eq 0 ]; then
  [ -t 0 ] || fail "Review --dry-run, then pass --yes for noninteractive installation."
  read -r -p "Install the displayed components? [y/N]: " reply
  [[ "$reply" == y || "$reply" == Y || "$reply" == yes ]] || { echo "Cancelled."; exit 0; }
fi

temporary="$(mktemp -d)"
trap 'rm -rf -- "$temporary"' EXIT
fetch() {
  if [ "$source_url" = "https://raw.githubusercontent.com/dfinson/promptlings/main" ] && [ -f "$root/$1" ]; then
    cp "$root/$1" "$2"
  else
    curl -fsSL "$source_url/$1" -o "$2"
  fi
}
os="$(uname -s)"
if [ "$dependencies" -eq 1 ] && [ "$project_only" -eq 0 ] && [ "$system_packages" -eq 1 ]; then
  case "$os" in
    Darwin)
      if ! command -v brew >/dev/null 2>&1; then
        curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh -o "$temporary/homebrew.sh"
        /bin/bash "$temporary/homebrew.sh"
      fi
      if [ "$(uname -m)" = arm64 ]; then brew=/opt/homebrew/bin/brew; else brew=/usr/local/bin/brew; fi
      [ -x "$brew" ] || fail "Homebrew was not installed at its standard location."
      eval "$("$brew" shellenv)"
      shellenv="eval \"\$($brew shellenv)\""
      if [ "${SHELL##*/}" = zsh ]; then profile="$HOME/.zprofile"; else profile="$HOME/.bash_profile"; fi
      if ! grep -Fqx "$shellenv" "$profile" 2>/dev/null; then printf '\n%s\n' "$shellenv" >> "$profile"; fi
      system_packages_list=(python@3.12 node@24 git gh uv)
      [ "$hyperframes" -eq 0 ] && [ "$demo" -eq 0 ] || system_packages_list+=(ffmpeg)
      [ "$demo" -eq 0 ] || system_packages_list+=(poppler)
      brew install "${system_packages_list[@]}"
      casks=()
      if [ "$demo" -eq 1 ]; then
        command -v code >/dev/null 2>&1 || [ -d "/Applications/Visual Studio Code.app" ] || casks+=(visual-studio-code)
        # Document rendering needs either Microsoft Word or LibreOffice.
        command -v soffice >/dev/null 2>&1 || [ -d /Applications/LibreOffice.app ] || [ -d "/Applications/Microsoft Word.app" ] || casks+=(libreoffice)
      fi
      [ "${#casks[@]}" -eq 0 ] || brew install --cask "${casks[@]}"
      brew link --force node@24
      ;;
    Linux)
      # shellcheck disable=SC1091
      . /etc/os-release
      [[ "$ID" == ubuntu || "$ID" == debian ]] || fail "Supported Linux distributions: Ubuntu 24.04+ and Debian 12+."
      if [ "$ID" = ubuntu ]; then minimum=24; else minimum=12; fi
      [ "${VERSION_ID%%.*}" -ge "$minimum" ] || fail "Upgrade to Ubuntu 24.04+ or Debian 12+."
      [ "$(uname -m)" = x86_64 ] || fail "The default Chrome-based Playwright recipe requires Linux x86_64."
      [ "$(id -u)" -ne 0 ] || fail "Run as your normal user. The installer uses sudo for system packages."
      sudo apt-get update
      system_packages_list=(ca-certificates curl git gh python3 python3-venv)
      [ "$hyperframes" -eq 0 ] && [ "$demo" -eq 0 ] || system_packages_list+=(ffmpeg)
      [ "$demo" -eq 0 ] || system_packages_list+=(poppler-utils)
      [ "$demo" -eq 0 ] || command -v soffice >/dev/null 2>&1 || system_packages_list+=(libreoffice-writer libreoffice-impress)
      sudo apt-get install -y "${system_packages_list[@]}"
      if [ "$demo" -eq 1 ] && ! command -v code >/dev/null 2>&1; then
        curl -fsSL "https://update.code.visualstudio.com/latest/linux-deb-x64/stable" -o "$temporary/code.deb"
        sudo apt-get install -y "$temporary/code.deb"
      fi
      if [ "$playwright" -eq 1 ] || [ "$hyperframes" -eq 1 ]; then
        curl -fsSL https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb -o "$temporary/chrome.deb"
        sudo apt-get install -y "$temporary/chrome.deb"
      fi
      curl -fsSL https://deb.nodesource.com/setup_24.x -o "$temporary/nodesource.sh"
      sudo -E bash "$temporary/nodesource.sh"
      sudo apt-get install -y nodejs
      curl -fsSL https://astral.sh/uv/install.sh -o "$temporary/uv.sh"
      UV_NO_MODIFY_PATH=1 sh "$temporary/uv.sh"
      ;;
    *) fail "Use install.ps1 on Windows. The Bash system recipe supports macOS and Ubuntu/Debian." ;;
  esac
fi
export PATH="$HOME/.local/bin:$PATH"
python=""
for candidate in python3.12 python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 &&
    "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' 2>/dev/null; then
    python="$candidate"; break
  fi
done

exclude=""
framework=()
# Validates the repository root and promptlings-managed blocks before anything is installed.
project_exclude() {
  local top name start end
  top="$(git -C "$project" rev-parse --show-toplevel)" || fail "--project must name a Git repository."
  [ "$(cd "$top" && pwd -P)" = "$(cd "$project" && pwd -P)" ] ||
    fail "--project must name the Git repository or linked worktree root."
  exclude="$(git -C "$project" rev-parse --path-format=absolute --git-path info/exclude)"
  [ -f "$exclude" ] || return 0
  for name in personal bmad speckit; do
    start="$(grep -nFx -- "# promptlings $name start" "$exclude" | cut -d: -f1 || true)"
    end="$(grep -nFx -- "# promptlings $name end" "$exclude" | cut -d: -f1 || true)"
    if [ -n "$start$end" ] && { [[ "$start" == *$'\n'* || "$end" == *$'\n'* ]] ||
      [ -z "$start" ] || [ -z "$end" ] || [ "$start" -ge "$end" ]; }; then
      fail "Malformed promptlings $name exclusion block in $exclude. Existing rules were not changed."
    fi
  done
}
exclude_block() {
  local start="# promptlings $1 start" end="# promptlings $1 end"
  shift
  touch "$exclude"
  awk -v s="$start" -v e="$end" '{ sub(/\r$/, "") } $0 == s { skip = 1 } !skip { print } $0 == e { skip = 0 }' \
    "$exclude" > "$exclude.promptlings"
  printf '%s\n' "$start" "$@" "$end" >> "$exclude.promptlings"
  mv "$exclude.promptlings" "$exclude"
}
configure_exclusions() {
  local rules machinery candidate context
  mkdir -p "$(dirname "$exclude")"
  exclude_block personal /.claude/settings.local.json /CLAUDE.local.md
  if [ "$bmad" -eq 1 ]; then
    rules=(/_bmad/config.user.toml '/_bmad/custom/*.user.toml' /_bmad/render/ '/_bmad/**/__pycache__/' .memlog.md)
    machinery=(/_bmad/ /_bmad-output/ '/.agents/skills/bmad-*/' '/.claude/skills/bmad-*/'
      '/.github/skills/bmad-*/' '/.github/agents/bmad-*.agent.md')
    framework+=("${machinery[@]}")
    [ "$shared_frameworks" -eq 1 ] || rules+=("${machinery[@]}")
    exclude_block bmad "${rules[@]}"
  fi
  if [ "$speckit" -eq 1 ]; then
    rules=(/.specify/feature.json /.specify/extensions/.cache/ /.specify/extensions/.backup/
      '/.specify/extensions/*/local-config.yml' '/.specify/extensions/*/*-config.local.yml')
    machinery=(/.specify/ /specs/ '/.github/skills/speckit-*/' '/.claude/skills/speckit-*/'
      '/.agents/skills/speckit-*/' '/.github/agents/speckit.*.agent.md'
      '/.github/prompts/speckit.*.prompt.md' '/.claude/commands/speckit.*.md')
    framework+=("${machinery[@]}")
    if [ "$shared_frameworks" -eq 0 ]; then
      rules+=("${machinery[@]}")
      if [ "$integration" = copilot ]; then context=.github/copilot-instructions.md; else context=CLAUDE.md; fi
      # Only reserve a generic instruction file when the framework creates it.
      for candidate in .github/copilot-instructions.md CLAUDE.md; do
        if grep -qFx "/$candidate" "$exclude" || { [ "$candidate" = "$context" ] && [ ! -e "$project/$candidate" ]; }; then
          rules+=("/$candidate"); framework+=("/$candidate")
        fi
      done
    fi
    exclude_block speckit "${rules[@]}"
  fi
}
verify_project() {
  local required=() relative directory rule pathspecs=() leaks
  if [ "$bmad" -eq 1 ]; then
    required+=(_bmad/scripts/render_skill.py _bmad/_config/manifest.yaml _bmad/config.toml
      .agents/skills/bmad-build/SKILL.md .claude/skills/bmad-build/SKILL.md)
  fi
  if [ "$speckit" -eq 1 ]; then
    if [ "$integration" = copilot ]; then directory=.github/skills; else directory=.claude/skills; fi
    required+=(.specify/integration.json "$directory/speckit-specify/SKILL.md" "$directory/speckit-converge/SKILL.md"
      .specify/workflows/promptlings-delivery/workflow.yml)
  fi
  for relative in ${required[@]+"${required[@]}"}; do
    [ -f "$project/$relative" ] || fail "Framework installation is incomplete in $project: $relative."
  done
  if [ "$shared_frameworks" -eq 1 ]; then
    required=()
    [ "$bmad" -eq 0 ] || required+=(_bmad/config.toml)
    [ "$speckit" -eq 0 ] || required+=(.specify/memory/constitution.md specs/001-example/spec.md)
    for relative in ${required[@]+"${required[@]}"}; do
      if git -C "$project" check-ignore --no-index -q "$relative"; then
        fail "Shared framework path is ignored: $relative. Review existing Git exclusions."
      fi
    done
    echo "Shared framework files and artifacts are eligible for tracking. Nothing was staged or committed."
    return
  fi
  # Existing files expose rules, such as negations, that sample paths cannot.
  for rule in ${framework[@]+"${framework[@]}"}; do
    rule="${rule#/}"
    case "$rule" in */) rule="$rule**" ;; esac
    pathspecs+=(":(glob)$rule")
  done
  if [ "${#pathspecs[@]}" -gt 0 ]; then
    leaks="$(git -C "$project" ls-files --others --exclude-standard -- "${pathspecs[@]}")"
    [ -z "$leaks" ] || fail "Local framework files are not ignored: $(printf '%s\n' "$leaks" | head -n 5 | paste -sd, - | sed 's/,/, /g'). Review existing Git exclusions, including negations."
  fi
  echo "Framework machinery and generated artifacts are locally ignored. Nothing was staged or committed."
}
if [ -n "$project" ]; then project_exclude; fi

if [ "$dependencies" -eq 1 ] && [ "$project_only" -eq 0 ]; then
  for command in uv node npm git gh; do command -v "$command" >/dev/null || fail "Missing prerequisite: $command."; done
  [ -n "$python" ] || fail "Python 3.11+ is required. Install it normally or rerun without --no-system-packages."
  node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(a<22||(a===22&&b<20))throw Error("Node.js 22.20+ required")'
  git --version
  gh --version
  packages=()
  [ "$skills" -eq 0 ] && [ "$experience" -eq 0 ] || packages+=("$SKILLS_PACKAGE")
  [ "$bmad" -eq 0 ] || packages+=("$BMAD_PACKAGE")
  [ "$playwright" -eq 0 ] || packages+=("$PLAYWRIGHT_PACKAGE")
  [ "$hyperframes" -eq 0 ] || packages+=("$HYPERFRAMES_PACKAGE")
  [ "$demo" -eq 0 ] || packages+=("$DIFF2HTML_PACKAGE")
  if [ "$experience" -eq 1 ]; then read -r -a experience_packages <<< "$EXPERIENCE_PACKAGES"; packages+=("${experience_packages[@]}"); fi
  if [ "${#packages[@]}" -gt 0 ]; then
    if [ "$os" = Linux ] && [ "$system_packages" -eq 1 ]; then
      sudo --preserve-env=npm_config_registry,NPM_CONFIG_REGISTRY npm install --global "${packages[@]}"
    else
      npm install --global "${packages[@]}"
    fi
  fi
  if [ "$experience" -eq 1 ]; then
    npm_root="$(npm root --global)"
    for package in "${experience_packages[@]}"; do
      name="${package%@*}"
      [ -f "$npm_root/$name/package.json" ] || fail "Experience toolkit package missing: $name"
      installed="$(node -p 'require(process.argv[1]).version' "$npm_root/$name/package.json")"
      [ "$name@$installed" = "$package" ] || fail "Experience toolkit version mismatch: $name@$installed, expected $package"
    done
    echo "Experience toolkit: $npm_root"
  fi
  if [ "$memory" -eq 1 ]; then uv tool install --force --python 3.12 "$MEMORY_PACKAGE"; fi
  if [ "$speckit" -eq 1 ]; then uv tool install --force --python 3.12 "$SPECKIT_PACKAGE"; fi
  uv tool update-shell
  export PATH="$(uv tool dir --bin):$PATH"
  if [ "$memory" -eq 1 ]; then basic-memory --version; fi
  if [ "$speckit" -eq 1 ]; then specify version; fi
  if [ "$bmad" -eq 1 ]; then bmad-method --version; fi
  if [ "$skills" -eq 1 ] || [ "$experience" -eq 1 ]; then
    export DISABLE_TELEMETRY=1
    sources=()
    if [ "$skills" -eq 1 ]; then
      sources+=("$FRONTEND_DESIGN_SKILL")
      [ "$memory" -eq 0 ] || sources+=("$MEMORY_SKILLS")
      [ "$playwright" -eq 0 ] || sources+=("$PLAYWRIGHT_SKILLS")
      [ "$hyperframes" -eq 0 ] || sources+=("$HYPERFRAMES_SKILLS")
      [ "$demo" -eq 0 ] || sources+=("$DEMOTIME_SKILLS" "$VSCODE_PLAYWRIGHT_SKILL")
    fi
    [ "$experience" -eq 0 ] || sources+=("$FRONTEND_DESIGN_SKILL" "$PLAYWRIGHT_SKILLS" "$HYPERFRAMES_SKILLS")
    unique=()
    for source in "${sources[@]}"; do [[ " ${unique[*]-} " == *" $source "* ]] || unique+=("$source"); done
    for source in "${unique[@]}"; do
      skills add "$source" --global --skill '*' --yes --copy
    done
  fi
  if [ "$playwright" -eq 1 ]; then
    playwright-cli install-browser chrome
    session="promptlings-install-$$"
    (
      cd "$temporary"
      trap 'playwright-cli -s="$session" close' EXIT
      playwright-cli -s="$session" open about:blank
      title="$(playwright-cli -s="$session" eval '() => { document.title = "promptlings"; return document.title; }' --raw)"
      [[ "$title" == promptlings || "$title" == '"promptlings"' ]] || fail "Playwright CLI browser smoke check failed: $title"
    )
  fi
  if [ "$hyperframes" -eq 1 ]; then
    ffmpeg -version
    ffprobe -version
    hyperframes browser ensure
    hyperframes doctor --json | "$python" -c 'import json,sys; c={x["name"]:x for x in json.load(sys.stdin)["checks"]}; bad=[n for n in ("FFmpeg","FFprobe","Chrome") if not c.get(n,{}).get("ok")]; sys.exit("HyperFrames prerequisites failed: "+", ".join(bad) if bad else 0)'
    npx --no-install hyperframes --version
  fi
  if [ "$demo" -eq 1 ]; then
    if ! command -v code >/dev/null 2>&1 && [ -x "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" ]; then
      export PATH="/Applications/Visual Studio Code.app/Contents/Resources/app/bin:$PATH"
    fi
    if ! command -v soffice >/dev/null 2>&1 && [ -x /Applications/LibreOffice.app/Contents/MacOS/soffice ]; then
      export PATH="/Applications/LibreOffice.app/Contents/MacOS:$PATH"
    fi
    code --version
    code --install-extension "$DEMOTIME_EXTENSION"
    if command -v soffice >/dev/null 2>&1; then
      soffice --version
    elif [ -d "/Applications/Microsoft Word.app" ]; then
      echo "Document rendering: Microsoft Word."
    else
      fail "Document rendering needs Microsoft Word or LibreOffice."
    fi
    pdftoppm -v
    ffmpeg -version
    diff2html --version
  fi
fi

if [ -n "$project" ]; then
  project="$(cd "$project" && pwd)"
  if [ "$bmad" -eq 1 ]; then
    [[ "$(bmad-method --version)" == *"${BMAD_PACKAGE##*@}"* ]] ||
      fail "BMAD version does not match the installer pin. Run the machine installer first."
  fi
  if [ "$speckit" -eq 1 ]; then
    [[ "$(specify version)" == *"${SPECKIT_PACKAGE##*@v}"* ]] ||
      fail "Specify version does not match the installer pin. Run the machine installer first."
  fi
  configure_exclusions
  if [ "$bmad" -eq 1 ] && [ ! -d "$project/_bmad" ]; then
    bmad-method install --directory "$project" --modules bmm --tools github-copilot,claude-code --yes
  fi
  if [ "$speckit" -eq 1 ]; then
    fetch workflows/speckit/promptlings-delivery/workflow.yml "$temporary/promptlings-delivery.yml"
    (
      cd "$project"
      if [ ! -d .specify ]; then
        options=()
        [ "$integration" != copilot ] || options+=(--integration-options=--skills)
        specify init --here --force --non-interactive --integration "$integration" --ignore-agent-tools "${options[@]}" </dev/null
      fi
      specify integration list
      specify workflow add "$temporary/promptlings-delivery.yml"
      specify workflow info promptlings-delivery >/dev/null
    )
  fi
  verify_project
fi
if [ "$project_only" -eq 0 ]; then
  command -v npx >/dev/null 2>&1 || fail "Node.js npx is required to publish agents and register MCP servers."
  memory_command=""
  if [ "$memory" -eq 1 ] && [ "$dependencies" -eq 1 ]; then
    memory_command="$(command -v basic-memory)" || fail "basic-memory is not on PATH after installation."
  fi
  if [ -n "$memory_command" ] && [ "$startup" -eq 1 ]; then
    # A previous run of this service would hold the memory port.
    case "$os" in
      Darwin)
        label="gui/$(id -u)/com.promptlings.basic-memory"
        if launchctl print "$label" >/dev/null 2>&1; then launchctl bootout "$label"; fi
        ;;
      Linux)
        if command -v systemctl >/dev/null 2>&1 && systemctl --user cat promptlings-memory.service >/dev/null 2>&1; then
          systemctl --user stop promptlings-memory.service
        fi
        ;;
    esac
    if (exec 3<>"/dev/tcp/127.0.0.1/$memory_port") 2>/dev/null; then
      fail "Memory port $memory_port is in use. Stop that listener or pass another port."
    fi
  fi
  rulesync_source="$temporary/rulesync"
  mkdir -p "$rulesync_source/subagents"
  for name in "${names[@]}"; do
    path="$(agent_path "$name")"
    fetch "$path" "$temporary/agent.md"
    [ "$(head -n 1 "$temporary/agent.md" | tr -d '\r')" = --- ] || fail "Agent has no frontmatter: $path"
    # rulesync skips sources without targets.
    { printf -- '---\ntargets: ["*"]\n'; tail -n +2 "$temporary/agent.md" | tr -d '\r'; } > "$rulesync_source/subagents/$name.md"
  done
  memory_rule=0
  if [[ ",$agents," == *,memory-manager,* ]] && [ "$readside" -eq 1 ] && [ "$memory" -eq 1 ]; then
    memory_rule=1
    fetch agents/context/memory-manager-read-side.md "$temporary/read-side.md"
    tr -d '\r' < "$temporary/read-side.md" > "$temporary/read-side.lf"
    [ "$(head -n 1 "$temporary/read-side.lf")" = "<!-- memory-manager-read-side-start -->" ] &&
      [ "$(grep -v '^[[:space:]]*$' "$temporary/read-side.lf" | tail -n 1 | sed 's/[[:space:]]*$//')" = "<!-- memory-manager-read-side-end -->" ] ||
      fail "Invalid downloaded memory read-side rule."
    mkdir -p "$rulesync_source/rules"
    { printf -- '---\ntargets: ["*"]\nglobs: ["**/*"]\n---\n'; cat "$temporary/read-side.lf"; } > "$rulesync_source/rules/promptlings-memory.md"
  fi
  skill_sources=("${skill_files[@]}")
  if [[ ",$agents," == *,memory-manager,* ]] && [ "$memory" -eq 1 ]; then skill_sources+=(skills/promptlings-memory-capture/SKILL.md); fi
  for path in "${skill_sources[@]}"; do
    mkdir -p "$(dirname "$rulesync_source/$path")"
    if [ "$(basename "$path")" != SKILL.md ]; then fetch "$path" "$rulesync_source/$path"; continue; fi
    fetch "$path" "$temporary/skill.md"
    [ "$(head -n 1 "$temporary/skill.md" | tr -d '\r')" = --- ] || fail "Skill has no frontmatter: $path"
    { printf -- '---\ntargets: ["*"]\n'; tail -n +2 "$temporary/skill.md" | tr -d '\r'; } > "$rulesync_source/$path"
  done
  (cd "$rulesync_source" && npx --yes "$RULESYNC_PACKAGE" generate -g --input-roots . -t '*' -f subagents,skills)
  if [ "$memory_rule" -eq 1 ]; then
    # Only targets with a dedicated global rule file. Others share a root file rulesync would replace.
    (cd "$rulesync_source" && npx --yes "$RULESYNC_PACKAGE" generate -g --input-roots . -t "$RULESYNC_RULE_TARGETS" -f rules)
  fi
  if [ -n "$memory_command" ]; then
    if [ "$startup" -eq 1 ]; then
      server=("http://127.0.0.1:$memory_port/mcp")
      transport=http
    else
      server=("$memory_command" --args mcp)
      transport=stdio
    fi
    # add-mcp aborts if any detected client lacks the transport. Stdio-only clients reach the HTTP server through mcp-remote.
    add_mcp="$temporary/add-mcp"
    npm install --prefix "$add_mcp" --no-save --no-fund --no-audit "$ADD_MCP_PACKAGE"
    cat >"$temporary/detect-mcp-clients.mjs" <<'EOF'
const [library, transport] = process.argv.slice(2);
const { pathToFileURL } = await import("node:url");
const { agents, detectGlobalAgents } = await import(pathToFileURL(library).href);
for (const agent of await detectGlobalAgents()) {
  const supported = agents[agent].supportedTransports;
  if (supported.includes(transport)) console.log(`direct ${agent}`);
  else if (transport === "http" && supported.includes("stdio")) console.log(`bridge ${agent}`);
  else console.error(`Skipping ${agents[agent].displayName}: no ${transport} MCP support.`);
}
EOF
    clients="$(node "$temporary/detect-mcp-clients.mjs" "$add_mcp/node_modules/add-mcp/dist/lib.js" "$transport")"
    add_mcp_cli="$add_mcp/node_modules/add-mcp/dist/index.js"
    direct=()
    bridge=()
    while read -r mode client; do
      case "$mode" in
        direct) direct+=(-a "$client") ;;
        bridge) bridge+=(-a "$client") ;;
      esac
    done <<<"$clients"
    if [ "${#direct[@]}" -gt 0 ]; then
      node "$add_mcp_cli" "${server[@]}" -g -y -n basic-memory "${direct[@]}"
    fi
    if [ "${#bridge[@]}" -gt 0 ]; then
      node "$add_mcp_cli" "$MCP_REMOTE_PACKAGE" --args "http://127.0.0.1:$memory_port/mcp" -g -y -n basic-memory "${bridge[@]}"
    fi
    if [ -z "$clients" ]; then
      printf 'Warning: no supported MCP client was detected. basic-memory was not registered.\n' >&2
    fi
  fi
  if [ -n "$memory_command" ] && [ "$startup" -eq 1 ]; then
    case "$os" in
      Darwin)
        plist="$HOME/Library/LaunchAgents/com.promptlings.basic-memory.plist"
        mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.basic-memory"
        cat > "$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.promptlings.basic-memory</string>
  <key>ProgramArguments</key>
  <array>
    <string>$memory_command</string><string>mcp</string><string>--transport</string><string>streamable-http</string>
    <string>--host</string><string>127.0.0.1</string><string>--port</string><string>$memory_port</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>$HOME/.basic-memory/mcp.log</string>
  <key>StandardErrorPath</key><string>$HOME/.basic-memory/mcp.log</string>
</dict>
</plist>
EOF
        launchctl bootstrap "gui/$(id -u)" "$plist"
        ;;
      Linux)
        unit="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user/promptlings-memory.service"
        mkdir -p "$(dirname "$unit")"
        printf '[Unit]\nDescription=Promptlings Basic Memory MCP\n[Service]\nExecStart="%s" mcp --transport streamable-http --host 127.0.0.1 --port %s\nRestart=on-failure\n[Install]\nWantedBy=default.target\n' \
          "$memory_command" "$memory_port" > "$unit"
        systemctl --user daemon-reload
        systemctl --user enable promptlings-memory.service
        systemctl --user restart promptlings-memory.service
        systemctl --user is-active --quiet promptlings-memory.service
        ;;
      *) fail "Native Windows login startup is configured by install.ps1." ;;
    esac
    request='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"promptlings-installer","version":"1"}}}'
    ready=0
    # A cold start after reinstalling can take several minutes.
    for _ in $(seq 600); do
      if curl -fsS --max-time 2 -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
        -d "$request" "http://127.0.0.1:$memory_port/mcp" 2>/dev/null | grep -Eiq '"name": ?"basic[ _-]?memory"'; then
        ready=1; break
      fi
      sleep 1
    done
    [ "$ready" -eq 1 ] || fail "Basic Memory did not become ready at 127.0.0.1:$memory_port. Inspect its native startup service."
  fi
fi
echo "Installed selected components. Restart your terminal and assistant. Repository changes remain unstaged."
