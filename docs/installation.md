# Installation

## Choose what to install

The default installation includes all nine agents, bundled Promptlings skills,
and the supporting toolchain. Agent selection and dependency selection are
separate: `--review` selects two agents but still installs the default tools.
Use `--no-dependencies` to publish agents and bundled skills using an existing
Node.js installation.

Download and run the installer as shown in the [README](../README.md#install).
It prints its plan and asks for approval. Add `--yes` or `-Yes` for an
approved noninteractive run. Help, listing, and dry-run perform no downloads
or writes.

### Supported systems

| System | Package manager |
| --- | --- |
| Windows | WinGet, supplied by Microsoft's [App Installer](https://aka.ms/getwinget) |
| macOS | Homebrew, installed through its official installer if missing |
| Ubuntu 24.04+ or Debian 12+, x86_64 | APT |

Run the scripts as your normal user. Native package installation can request
elevation. The Linux browser recipe installs Google's Chrome package and its
system libraries through APT, so that recipe requires x86_64. Linux also uses
NodeSource's Node.js 24 setup and Astral's uv installer.

On Windows, `powershell -ExecutionPolicy Bypass -File .\install.ps1` permits the
downloaded script for that invocation without changing the machine's execution
policy. Invoke npm tools through their `.cmd` entrypoints in Windows PowerShell,
such as `npx.cmd`, `playwright-cli.cmd`, and `hyperframes.cmd`.

### Default components

| Component | What the installer provides |
| --- | --- |
| Python, Node.js, uv, Git, and GitHub CLI | Native packages and command checks, requiring Python 3.11+ and Node.js 22.20+ |
| Basic Memory | uv tool, published memory skills, MCP registration, and user-login startup |
| BMAD | Global npm application, with project-local skills added during repository initialization |
| Spec-Kit | uv tool, repository initialization, and the Promptlings delivery workflow |
| Playwright | Global npm application, published skill, Chrome browser, and a CLI browser check |
| HyperFrames | Global npm application, published skills, rendering browser, FFmpeg, and FFprobe |
| Demo capture | VS Code when missing, pinned Demo Time extension and skills, vscode-playwright skill, document-rendering tools, and diff2html CLI |
| Design skill | Pinned frontend-design skill |
| Interactive Presentation | When the agent is selected: Playwright CLI with its browser and skill, the skills CLI, the frontend-design and HyperFrames skills, and the pinned experience toolkit (esbuild, Shiki, Magic Move, Flubber, Rough.js, D3, dagre, Lucide, Tabler Icons, Fontsource fonts and axe-core) as global npm packages. These install regardless of opt-outs; `--no-dependencies` / `-NoDependencies` fails while the agent is selected |

Document rendering uses Microsoft Word or LibreOffice. LibreOffice is installed
only when neither is found. On Windows, its program directory is added to the
user PATH. Poppler supplies PDF rendering.

Python applications use standard uv tool locations. Node applications use the
configured global npm location. Application versions and upstream skill
revisions are pinned at the top of both installers.

### Installer options

| Bash / PowerShell | Effect |
| --- | --- |
| `--all` / `-All` | Select all nine agents, the default |
| `--review` / `-Review` | Select the three ensemble agents: the-nitcracker, PR Walkthrough, and Sparring Partner |
| `--agents a,b` / `-Agents "a,b"` | Select agents by name |
| `--no-dependencies` / `-NoDependencies` | Publish agents and bundled skills without installing tools, external skills, MCP, or startup. Requires Node.js |
| `--no-system-packages` / `-NoSystemPackages` | Use existing Python, Node, Git, gh, FFmpeg, and uv, but still install selected applications and skills |
| `--no-bmad` / `-NoBmad` | Skip BMAD |
| `--no-speckit` / `-NoSpeckit` | Skip Spec-Kit and its delivery workflow |
| `--no-memory` / `-NoMemory` | Skip Basic Memory, its skills, MCP, startup, and read-side instruction |
| `--no-startup` / `-NoStartup` | Register client-launched stdio MCP instead of login startup |
| `--memory-port 8123` / `-MemoryPort 8123` | Use a different Basic Memory port |
| `--no-playwright` / `-NoPlaywright` | Skip Playwright CLI, its browser check, and skill. Linux Chrome is still required by HyperFrames |
| `--no-hyperframes` / `-NoHyperframes` | Skip HyperFrames, media binaries, and skills |
| `--no-demo` / `-NoDemo` | Skip VS Code, Demo Time, vscode-playwright, LibreOffice, Poppler, and diff2html |
| `--no-skills` / `-NoSkills` | Skip external published skills, not bundled Promptlings skills or repository-local framework integrations |
| `--no-readside` / `-NoReadSide` | Skip the global memory read-side rule |
| `--project PATH` / `-Project PATH` | Initialize an existing Git repository through official framework installers |
| `--project-only` / `-ProjectOnly` | Initialize the named repository without installing global tools or changing profiles/startup |
| `--shared-frameworks` / `-SharedFrameworks` | With a project path, make framework setup and documents eligible for version control |
| `--integration claude` / `-Integration claude` | Choose Claude instead of the default Copilot Spec-Kit integration |
| `--list` / `-List` | List agent names and exit |
| `--dry-run` / `-DryRun` | Print the plan without downloading or writing |
| `--yes` / `-Yes` | Approve the printed installation plan without a prompt |
| `--help` / `-Help` | Show usage |

For example, to install the default review ensemble:

```powershell
.\install.ps1 -Review -NoDependencies -NoReadSide
```

```bash
bash install.sh --review --no-dependencies --no-readside
```

Bundled skills are published with any agent selection, including their scripts
and references. The memory capture companion is included when Memory Manager
is selected and memory is enabled. Sparring Partner's four review methods
(`technical-investigation`, `design-analysis`, `test-analysis`, and
`evidence-verification`) are included. The default ensemble does not require
the host's built-in rubber-duck.

Opt-outs skip installation. They do not uninstall tools, stop existing services,
or remove earlier registrations. Failed commands stop installation, and earlier
successful package installations remain available for retry.

## Where files go

The installers use pinned cross-harness tools through `npx`:

| Content | Publisher | Targets |
| --- | --- | --- |
| Skills | [`skills`](https://github.com/vercel-labs/skills) | Every harness it supports |
| Agents | [`rulesync`](https://github.com/dyoshikawa/rulesync) subagents | Every harness with global subagent support |
| Memory read-side rule | `rulesync` rules | Harnesses with dedicated global rule files |
| Basic Memory MCP | [`add-mcp`](https://github.com/neon-solutions/add-mcp) | Detected harnesses |

Agent and skill publication includes harnesses that are not installed, so
unused harness directories can appear in your home directory. Paths follow
each publisher's defaults. `add-mcp` does not honor `CLAUDE_CONFIG_DIR`.
Stdio-only clients such as Claude Desktop connect through
[`mcp-remote`](https://github.com/geelen/mcp-remote).

## Basic Memory setup

Basic Memory binds to `127.0.0.1`, using port 8000 by default. Windows uses a
limited, current-user Scheduled Task, macOS a LaunchAgent, and Linux a systemd
user service. Each starts the installed command directly. Linux startup
requires an active systemd user session. The installer checks the MCP
initialization response before reporting success.

`add-mcp` replaces only the `basic-memory` entry in detected harness
configurations. An unrelated listener on the selected port stops installation.
Use `--memory-port` or `-MemoryPort` to choose another port.

With Memory Manager selected and memory enabled, the installer also publishes a
read-side rule that tells future sessions to retrieve relevant context and save
decisions and outcomes. **This applies to future sessions across repositories.**
Use `--no-readside` or `-NoReadSide` to omit it, including in a
`--no-dependencies` installation.

The rule lives in a dedicated `promptlings-memory` file per supported harness,
such as `~/.copilot/instructions/promptlings-memory.instructions.md` or
`~/.claude/rules/promptlings-memory.md`. Existing instruction files are not edited.

The installer does not create repository/domain projects or routing mappings.
Ask Memory Manager to set up routing after installation. It matches repositories
by canonical remote identity across branches and worktrees. New projects, stable
storage locations, and global configuration changes require approval. Keep
approved routing in your user or repository instructions, outside generated
rule files, with explicit project IDs and an approved host key.

Session capture needs the relevant conversation or an accessible source.
Automatic end-of-session capture requires a supported, configured, verified
host hook.

## Initialize a delivery repository

Machine installation does not initialize arbitrary repositories:

```powershell
.\install.ps1 -Project C:\repos\my-project -ProjectOnly -Yes
```

```bash
bash install.sh --project "$HOME/repos/my-project" --project-only --yes
```

Initialize each clone or linked worktree before using BMAD or Spec-Kit.
Framework setup and generated planning documents are locally ignored by default
through Git's `info/exclude`. Add `--shared-frameworks` or `-SharedFrameworks`
for a team that wants to commit them. Initialization never stages or commits files.

See [framework setup and repository ownership](bmad-setup.md) for details.
Framework upgrades use their official update operations, not a global CLI update.
Provider accounts, secrets, licensed assets, and narration voice choices remain
separate production inputs.

## Manual installation

Copy an agent's `.agent.md` file to your assistant's agent directory:

| Tool | User-wide | Repository-local |
| --- | --- | --- |
| GitHub Copilot CLI | `~/.copilot/agents/` | `.github/agents/` |
| Claude Code | `~/.claude/agents/` | `.claude/agents/` |

Copy required companion skills as complete directories, including scripts and
references:

| Tool | User-wide | Repository-local |
| --- | --- | --- |
| GitHub Copilot CLI | `~/.copilot/skills/<skill>/` | `.github/skills/<skill>/` |
| Claude Code | `~/.claude/skills/<skill>/` | `.claude/skills/<skill>/` |

Each directory contains `SKILL.md`. The agent definitions identify their
companions. Both `design-writing` and `reasoning-first-narration` also require
`reasoning-first-writing`. Restart your assistant after copying.

## Claude Code plugin

The plugin contains only the two review agents:

```text
/plugin marketplace add dfinson/promptlings
/plugin install promptlings-code-review
```

Use the repository installer or manual installation for the other agents and
skills, including `review-ensemble`. See the [plugin guide](../plugins/promptlings-code-review/README.md)
for scoped agent names and runtime behavior.
