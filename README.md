<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo-dark.png">
    <img src="logo.png" alt="promptlings" width="321">
  </picture>
</p>

Focused custom agents for code review, session continuity, technical demos, and spec-driven delivery. Prompts stay portable. The installer provisions the toolchain so agents can focus on their work instead of setting up the machine.

## Pick an Agent

| Agent | Use it when you need |
| --- | --- |
| [the-nitcracker](agents/code-review/the-nitcracker.agent.md) | A full PR review with inline defects, separate design judgments, and a candid narrative walkthrough. |
| [PR Walkthrough](agents/code-review/pr-walkthrough.agent.md) | A narrative map of a PR before reviewing it: architecture, important files, design forks, and implicit bets. |
| [Memory Manager](agents/context/memory-manager.agent.md) | Capture a session's purpose, reasoning, decisions, and continuation state in Basic Memory, then recall and maintain scoped knowledge. |
| [Technical Demo](agents/media/technical-demo.agent.md) | A polished technical demo video built from approved design, deterministic scenes, real evidence, narration, and review. |
| [BMAD Orchestrator](agents/orchestration/bmad-orchestrator.agent.md) | Conduct BMAD delivery through installed workflows, with scope preservation and evidence-backed acceptance. |
| [Spec-Kit Flow](agents/orchestration/speckit-flow.agent.md) | Anchor every change in Spec-Kit specification, plan, and tasks, then use only the additional phases and Fleet capabilities that add value. |

## Install

Copy any `.agent.md` file into the directory for your tool:

| Tool | Directory |
| --- | --- |
| GitHub Copilot CLI, user-wide | `~/.copilot/agents/` |
| GitHub Copilot CLI, per-project | `.github/agents/` |
| Claude Code | `~/.claude/agents/` |

```bash
mkdir -p ~/.copilot/agents
curl -fsSL -o ~/.copilot/agents/the-nitcracker.agent.md \
  https://raw.githubusercontent.com/dfinson/promptlings/main/agents/code-review/the-nitcracker.agent.md
```

Restart your assistant to pick it up. For other frameworks, parse the YAML frontmatter and use the Markdown body as the system prompt.

### Installer script

Everything is enabled by default. Native PowerShell and Bash recipes install
normal packages, publish our agents to Copilot and Claude, and use upstream
installers for skills and repository integrations. There is no private runtime
distribution or agent-led setup workflow.

```bash
curl -fsSL https://raw.githubusercontent.com/dfinson/promptlings/main/install.sh -o install.sh
bash install.sh --yes
```

```powershell
irm https://raw.githubusercontent.com/dfinson/promptlings/main/install.ps1 -OutFile install.ps1
powershell -ExecutionPolicy Bypass -File .\install.ps1 -Yes
```

Windows PowerShell 5.1 defaults to the `Restricted` execution policy, which blocks running a downloaded script. The `-ExecutionPolicy Bypass -File` form applies to that one invocation and changes nothing about your machine.

The default installation includes:

| Component | Installed and checked |
| --- | --- |
| Python, Node.js and uv | Native Python, Node.js LTS and uv installation, with Python 3.11+ and Node.js 22.20+ checked |
| Git and GitHub CLI | Native packages and public command checks |
| Basic Memory | A normal uv tool installation, published memory skills, MCP registration and user-login startup |
| BMAD | A normal global npm installation, with project-local skills installed during repository initialization |
| Spec-Kit and Fleet | A normal uv tool installation, with upstream repository initialization and extension installation |
| Playwright | A normal global npm installation, its published skill, the CLI's default Chrome browser and a real CLI browser check |
| HyperFrames | A normal global npm installation, published skills, rendering browser and native FFmpeg/FFprobe |
| Demo capture | VS Code (when missing) with the pinned [Demo Time](https://github.com/estruyf/vscode-demo-time) extension and its skills, the hve-core [vscode-playwright](https://github.com/microsoft/hve-core) skill, LibreOffice, Poppler and FFmpeg, each checked by command |

Supported system recipes are Windows with WinGet, macOS with Homebrew, and
Ubuntu 24.04+ or Debian 12+ on x86_64 with APT. The Linux browser recipe uses
Chrome, which limits that recipe to x86_64. Other architectures are not claimed
as supported by the default recipe.

Windows needs Microsoft's [App Installer](https://aka.ms/getwinget), which supplies
WinGet. On macOS, missing Homebrew is installed through its official installer.
On Linux, the recipe uses NodeSource's Node.js 24 APT setup and Astral's official
uv installer. Run the scripts as your normal user. Native package installation
can request elevation. The Linux browser recipe installs Google's Chrome
package through APT, including its system libraries, whenever Playwright or
HyperFrames is selected. VS Code and LibreOffice are skipped when their commands\nare already present. On Windows the installer adds LibreOffice's program directory\nto the user PATH because its package does not. Package-manager failures stop the installation.

Python applications use standard uv tool locations. Node applications use the
configured global npm location, so commands such as `npx hyperframes` resolve the
installed package normally. Skills use the upstream `skills` CLI with complete
directory copies, not a custom archive extractor. BMAD and Spec-Kit skills are
never copied from temporary repositories into global discovery.

Harness coverage is delegated to existing cross-harness CLIs, pinned at the top
of both installers and run through `npx`:

| Job | Tool | Targets |
| --- | --- | --- |
| Published skills | [`skills`](https://github.com/vercel-labs/skills) | Every harness it supports, installed or not |
| Agents | [`rulesync`](https://github.com/dyoshikawa/rulesync) subagents | Every harness with global subagent support, in its native format |
| Memory read-side rule | `rulesync` rules | Harnesses with a dedicated global rule file, never shared files such as `~/.codex/AGENTS.md` |
| Basic Memory MCP | [`add-mcp`](https://github.com/neon-solutions/add-mcp) | Harnesses detected on the machine |

Skills and agents are written for every supported harness, so unused harness
directories can appear in your home directory. Locations follow each tool's
defaults. `add-mcp` does not honor `CLAUDE_CONFIG_DIR`.

Basic Memory binds only to `127.0.0.1`, using port 8000 by default.
Windows uses a limited, current-user Scheduled Task, macOS uses a LaunchAgent,
and Linux uses a systemd user service. Each starts the installed `basic-memory`
command directly, without an installer supervisor. The MCP initialization
response is checked before installation reports success. Linux startup requires
an active systemd user session.
Use a different port with `--memory-port 8123` or `-MemoryPort 8123`.
`--no-startup` registers client-launched stdio MCP instead.

The installer prints its plan and asks for approval unless `--yes` or `-Yes` was
supplied. Noninteractive installation requires that explicit approval flag.
Help, listing and dry-run need no Python and perform no downloads or writes.
In Windows PowerShell, invoke npm tools through their supplied `.cmd` entrypoints,
such as `npx.cmd`, `playwright-cli.cmd` and `hyperframes.cmd`. No persistent
PowerShell execution-policy change is made.

### Installer options

| Bash / PowerShell | Effect |
| --- | --- |
| `--all` / `-All` | All six agents, the default |
| `--review` / `-Review` | Select the two review agents, without changing dependency selection |
| `--agents a,b` / `-Agents a,b` | Select agents by name |
| `--no-dependencies` / `-NoDependencies` | Publish agents only, without tools, external skills, MCP or startup. Requires Node.js |
| `--no-system-packages` / `-NoSystemPackages` | Use existing Python, Node, Git, gh, FFmpeg and uv, but still install selected applications and skills |
| `--no-bmad` / `-NoBmad` | Skip BMAD |
| `--no-speckit` / `-NoSpeckit` | Skip Spec-Kit and Fleet |
| `--no-fleet` / `-NoFleet` | Skip Fleet and Verify |
| `--no-memory` / `-NoMemory` | Skip Basic Memory, its skills, MCP, startup and read-side instruction |
| `--no-startup` / `-NoStartup` | Use client-launched MCP instead of installing login startup |
| `--no-playwright` / `-NoPlaywright` | Skip Playwright CLI, its browser check and skill. Linux Chrome is still required by HyperFrames |
| `--no-hyperframes` / `-NoHyperframes` | Skip HyperFrames, media binaries and skills |
| `--no-demo` / `-NoDemo` | Skip the demo capture tools: VS Code, Demo Time, vscode-playwright, LibreOffice and Poppler |
| `--no-skills` / `-NoSkills` | Skip published global skills, not repository-local framework integrations |
| `--no-readside` / `-NoReadSide` | Skip the global memory read-side rule |
| `--project PATH` / `-Project PATH` | Initialize an existing Git repository through official framework installers |
| `--project-only` / `-ProjectOnly` | Initialize the named repository without installing global tools or changing profiles/startup |
| `--shared-frameworks` / `-SharedFrameworks` | With `--project`, opt into version-controlled framework setup and documents instead of the local-only default |
| `--integration claude` / `-Integration claude` | Choose Claude instead of the default Copilot Spec-Kit integration |
| `--list` / `-List` | List agent names and exit |
| `--dry-run` / `-DryRun` | Print the plan, write nothing |

Opt-outs skip installation, not uninstallation. They do not stop an existing
service, remove a previous registration or delete installed tools.
Agent selection and dependency selection are separate. For a prompts-only review
installation, use `--review --no-dependencies --no-readside`.

Machine installation does not initialize arbitrary repositories. Initialize a
new delivery repository explicitly:

```powershell
.\install.ps1 -Project C:\repos\my-project -ProjectOnly -Yes
```

```bash
bash install.sh --project "$HOME/repos/my-project" --project-only --yes
```

Framework setup, generated integrations and planning documents are **local and
ignored by default**, including `_bmad`, `_bmad-output`, `.specify` and `specs`.
The initializer writes scoped rules to Git's local `info/exclude`, not the
repository's `.gitignore` or global Git configuration. Normal `git add .` leaves
that machinery out of implementation commits. No hooks or agent reminders are
needed to enforce the default.

Run the same initialization command for each new clone or linked worktree before
using the frameworks. Ignored files do not travel with commits or appear in new
worktrees. For a team that deliberately wants to version framework files, add
`--shared-frameworks` or `-SharedFrameworks`, then review and commit them normally.
Personal overrides and caches remain ignored in either mode. Initialization never
stages or commits files. See [repository ownership](docs/bmad-setup.md).

`add-mcp` replaces only the `basic-memory` entry in each detected harness
configuration. Any other listener on the memory port and failed commands stop
installation explicitly. Earlier successful package installations remain
available for retry. A failed install is never reported as complete.

Provider accounts, secrets, licensed assets and the choice of narration voice
are not machine dependencies. They remain explicit production inputs.
The installer does not create repository/domain memory projects or routing
mappings. Basic Memory initializes its own default project on first start.

Application versions and upstream skill revisions are pinned at the top of
`install.ps1` and `install.sh`, with identical values. Framework updates are explicit
framework operations, not automatic rewrites when a global CLI is updated.
Specify 0.8.18, Fleet 1.1.0 and Verify 1.0.0 are pinned together because they
generate working references to Spec-Kit's shared prerequisite scripts. Generated
framework files are not patched by promptlings.

Also available as a Claude Code plugin, currently carrying the two code-review agents:

```
/plugin marketplace add dfinson/promptlings
/plugin install promptlings-code-review
```

## Agent Notes

### the-nitcracker and PR Walkthrough

Both split their output into three channels and hold each to a different bar, instead of producing one ranked list of comments.

**Defects** are inline and anchored to a line. This is the only channel where the agent renders judgment, and every finding has to answer "what concretely breaks," with the mechanism traced rather than guessed.

**Design forks** are places the diff leaves a real choice open and the right answer depends on context the agent does not have. The agent names at least two options, the axis they differ on, and what would settle it. That settling criterion is mandatory; a fork without one is the model narrating its own uncertainty.

**Implicit bets** are choices already resolved in the diff that are costly to reverse. The agent states what the diff does, why it is defensible, what the road not taken would have cost, and a concrete question the reviewer has to answer before approving. That question is mandatory.

The agent is forbidden from rendering judgment in the second and third channels. It surfaces the choice and stops.

Output from both agents on a real PR is in [`examples/`](examples/), along with how to reproduce it and a disclosed wording edit. Worth knowing before you rely on either: no codebase index, no memory between runs, no GitHub App, no CI integration. Run twice on a change that matters, since the severity floor is reproducible but which finding surfaces is not.

### Memory Manager

Replaces Session Handoff with one session-first agent using [Basic Memory](https://docs.basicmemory.com/). Invoking it without a narrower request captures the available conversation's purpose, evolving reasoning, decisions and rationale, discoveries, failed approaches, outcome, and continuation state. It saves a coherent session checkpoint and reconciles reusable knowledge into canonical notes. Project routing, recall, ingestion, and broader maintenance are explicit operations, not a mandatory full audit on every save.

The installer provides Basic Memory, its MCP registration and complete published memory skills. The agent handles session meaning, project ownership, retrieval and maintenance, not package or service setup.

```bash
bash install.sh --agents memory-manager --yes
```

```powershell
.\install.ps1 -Agents memory-manager -Yes
```

Ask Memory Manager to set up routing. It reuses an existing repository/domain project or proposes one, keyed by canonical repository identity across branches and worktrees. A shared `agent-environment` project replaces machine-global handoff notes, with host-specific facts scoped under an approved stable host key. It can be the configured default if approved, but every memory operation still uses an explicit project identifier. Project knowledge never falls back into the environment project.

Setup requires approval for new projects, stable storage paths outside disposable worktrees, and global configuration changes. Record approved routing in the chosen user/repository instructions, not in the generated rule files:

```text
Environment project ID: <actual Basic Memory project ID>
Host key: <approved stable machine key>
Repository/domain project ID: <actual Basic Memory project ID>
Canonical repository identity: <credential-free remote identity, if applicable>
```

The companion [read-side instruction](agents/context/memory-manager-read-side.md) makes future sessions retrieve relevant context and use session capture. It affects **every future session in every repository** and is included in the printed default plan. Disable it explicitly if that is not wanted:

```bash
bash install.sh --agents memory-manager --no-readside --yes
```

```powershell
.\install.ps1 -Agents memory-manager -NoReadSide -Yes
```

The rule is generated as a dedicated `promptlings-memory` file per harness, such as
`~/.copilot/instructions/promptlings-memory.instructions.md` and
`~/.claude/rules/promptlings-memory.md`. Existing instruction files are not edited.
This installer targets new installations. Migration from previous installers or
agents is outside its scope and is handled manually.

Saving requires invoking Memory Manager unless a supported host hook has actually been configured and verified. Delegated capture must receive the relevant conversation or an accessible source reference. An agent cannot recover conversation that was never supplied or saved.

### BMAD Orchestrator

[BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD), short for Breakthrough Method of Agile AI-driven Development, carries software work from clarification and planning through implementation and review.

Start with a software request, not a BMAD command. The agent selects and invokes the relevant installed workflow, preserves its artifact contracts, and distinguishes implementation, integration, acceptance and release.

The installer initializes each repository and worktree programmatically.
Framework setup and planning artifacts are local-only by default. The
orchestrator does not copy parent runtimes, manage exclusions or run setup skills. See
[installer-owned repository initialization](docs/bmad-setup.md).

- [Install BMAD](https://docs.bmad-method.org/how-to/install-bmad/)
- [BMAD releases](https://github.com/bmad-code-org/BMAD-METHOD/releases)

### Spec-Kit Flow

Starts from a software request and always establishes current `spec.md`, `plan.md`, and `tasks.md` anchors before implementation. It then selects the lightest anchored execution path, adding [Spec-Kit](https://github.com/github/spec-kit) phases only when they resolve a named need and handing control to [Fleet](https://github.com/sharathsatish/spec-kit-fleet) when parallel tasks, resume, rollback, remediation, or assurance make its lifecycle valuable.

## Principles

- **High bar, low noise.** Ship output that changes an experienced reviewer's mind.
- **Portable.** Plain Markdown, no required agent runtime.
- **Opinionated.** Every agent has a defined point of view and judgment boundary.
- **No em dashes.** Use commas, colons, semicolons, periods, or parentheses.

## Contributing

PRs are welcome. The inclusion bar is simple: would you use this agent every day?

## License

Apache 2.0. See [LICENSE](LICENSE).
