<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo-dark.png">
    <img src="logo.png" alt="promptlings" width="321">
  </picture>
</p>

Focused custom agents and reusable skills for technical reasoning, complementary code review, session continuity, technical demos, and spec-driven delivery. Agents are portable Markdown with YAML frontmatter. Skills package reusable methods and workflows for the host's native agent system, without an orchestration service. The installer provisions the toolchain so agents can focus on their work instead of setting up the machine.

## Pick an Agent

| Agent | Use it when you need |
| --- | --- |
| [the-nitcracker](agents/code-review/the-nitcracker.agent.md) | A full PR review with inline defects, separate design judgments, and a candid narrative walkthrough. |
| [PR Walkthrough](agents/code-review/pr-walkthrough.agent.md) | A narrative map of a PR before reviewing it: architecture, important files, design forks, and implicit bets. |
| [Sparring Partner](agents/reasoning/sparring-partner.agent.md) | Work through an idea, design, plan, implementation, debugging hypothesis, or testing question with an evidence-driven reasoning partner. |
| [Memory Manager](agents/context/memory-manager.agent.md) | Capture a session's purpose, reasoning, decisions, and continuation state in Basic Memory, then recall and maintain scoped knowledge. |
| [Technical Demo](agents/media/technical-demo.agent.md) | A polished technical demo video built from approved design, deterministic scenes, real evidence, narration, and review. |
| [BMAD Orchestrator](agents/orchestration/bmad-orchestrator.agent.md) | A BMAD-only coach: binds the repository to BMAD, runs every delivery through installed BMAD workflows, checks recorded approval before implementation, and sends work outside BMAD to a separate session. |
| [Spec-Kit Flow](agents/orchestration/speckit-flow.agent.md) | A Spec-Kit-only coach: binds the repository to Spec-Kit, anchors spec, plan, and tasks with Clarify before Plan, checks recorded approval before implementation, then runs the implement and converge loop or the gated delivery workflow on request. |

For maintainers and CI callers, [Artifact Inspector](agents/maintenance/artifact-inspector.agent.md) is a thin, subagent-oriented wrapper around the shared [artifact-inspection](skills/artifact-inspection/SKILL.md) skill.

## Invoke a Workflow

Install the review set, then ask your current coding agent:

```text
Run the review ensemble on this branch against origin/main.
Run the review ensemble on my staged and unstaged changes.
Run the review ensemble, fix the verified in-scope issues, and verify the repairs.
```

The [review-ensemble](skills/review-ensemble/SKILL.md) skill dispatches **the-nitcracker**, **PR Walkthrough**, and the host's built-in **rubber-duck** independently in parallel. The invoking agent investigates their combined output, verifies claims, identifies additional gaps, and synthesizes defects, architectural reasoning, and judgment calls. A supported singleton finding survives even if the other reviewers missed it. Agreement alone establishes nothing.

This needs a host that can invoke those identities as independent parallel subagents. The installer ships the two Promptlings reviewers, not the built-in rubber-duck. When a reviewer or parallel dispatch is missing, the skill reports the blocker instead of inventing an equivalent run. To choose another composition explicitly, say:

```text
Run the review ensemble with Sparring Partner instead of rubber-duck.
```

The default installation includes Sparring Partner. For a review-only install, use `--agents the-nitcracker,pr-walkthrough,sparring-partner`. Claude Code users can use this explicit composition with the installed Promptlings agents. Plugin-only installs still contain just the two existing review agents, not this skill or Sparring Partner. Resolve actual names through the host's registry, including plugin namespaces.

Review defaults to analysis, not source edits or publication. The caller resolves required report outputs to authorized scratch storage outside the source tree before dispatch. Review-and-repair requires an explicit request. No review request authorizes posting or staging comments, approving, or merging. The workflow retains complete substantive worker results, verifies claims against code and requirements, and reports incomplete execution explicitly. It does not claim exhaustive detection.

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

Restart your assistant to pick it up. For agents with companion skills, use the installer or copy the required skill directories as well. For other frameworks, parse the YAML frontmatter and use the Markdown body as the system prompt, preserving resource loading and authority boundaries.

| Skill location | Copilot CLI | Claude Code |
| --- | --- | --- |
| User-wide | `~/.copilot/skills/<skill>/SKILL.md` | `~/.claude/skills/<skill>/SKILL.md` |
| Repository-local | `.github/skills/<skill>/SKILL.md` | `.claude/skills/<skill>/SKILL.md` |

Copy each complete directory from `skills/`, including bundled scripts and references.

### Installer script

Everything is enabled by default. Native PowerShell and Bash recipes install
normal packages, publish our agents and skills to every supported harness, and use
upstream installers for external skills and repository integrations. There is no
private runtime distribution or agent-led setup workflow.

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
| Spec-Kit | A normal uv tool installation, with upstream repository initialization and the promptlings delivery workflow |
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
HyperFrames is selected. VS Code and LibreOffice are skipped when their commands
are already present. On Windows the installer adds LibreOffice's program directory
to the user PATH because its package does not. Package-manager failures stop the installation.

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
| `--all` / `-All` | All eight agents, the default |
| `--review` / `-Review` | Select the two review agents, without changing dependency selection |
| `--agents a,b` / `-Agents a,b` | Select agents by name |
| `--no-dependencies` / `-NoDependencies` | Publish agents only, without tools, external skills, MCP or startup. Requires Node.js |
| `--no-system-packages` / `-NoSystemPackages` | Use existing Python, Node, Git, gh, FFmpeg and uv, but still install selected applications and skills |
| `--no-bmad` / `-NoBmad` | Skip BMAD |
| `--no-speckit` / `-NoSpeckit` | Skip Spec-Kit and its delivery workflow |
| `--no-memory` / `-NoMemory` | Skip Basic Memory, its skills, MCP, startup and read-side instruction |
| `--no-startup` / `-NoStartup` | Use client-launched MCP instead of installing login startup |
| `--no-playwright` / `-NoPlaywright` | Skip Playwright CLI, its browser check and skill. Linux Chrome is still required by HyperFrames |
| `--no-hyperframes` / `-NoHyperframes` | Skip HyperFrames, media binaries and skills |
| `--no-demo` / `-NoDemo` | Skip the demo capture tools: VS Code, Demo Time, vscode-playwright, LibreOffice and Poppler |
| `--no-skills` / `-NoSkills` | Skip external published skills, not promptlings skills or repository-local framework integrations |
| `--no-readside` / `-NoReadSide` | Skip the global memory read-side rule |
| `--project PATH` / `-Project PATH` | Initialize an existing Git repository through official framework installers |
| `--project-only` / `-ProjectOnly` | Initialize the named repository without installing global tools or changing profiles/startup |
| `--shared-frameworks` / `-SharedFrameworks` | With `--project`, opt into version-controlled framework setup and documents instead of the local-only default |
| `--integration claude` / `-Integration claude` | Choose Claude instead of the default Copilot Spec-Kit integration |
| `--list` / `-List` | List agent names and exit |
| `--dry-run` / `-DryRun` | Print the plan, write nothing |

Every promptlings skill is published with any agent selection, with its bundled
references and scripts. The review ensemble's default roster also needs the host's
built-in rubber-duck, which no installer provides.

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
Repository initialization adds the [promptlings delivery workflow](workflows/speckit/promptlings-delivery/workflow.yml)
with `specify workflow add`. Generated framework files are not patched by promptlings.

Also available as a Claude Code plugin, currently carrying the two code-review agents:

```
/plugin marketplace add dfinson/promptlings
/plugin install promptlings-code-review
```

## Agent Notes

### Writing skills

| Skill | Responsibility |
| --- | --- |
| [reasoning-first-writing](skills/reasoning-first-writing/SKILL.md) | Draft or revise natural, intelligible prose while preserving evidence, meaning, attribution, terminology, and the writer's voice |
| [reasoning-first-narration](skills/reasoning-first-narration/SKILL.md) | Apply that foundation to spoken delivery, including TTS, teleprompters, human narration, and confirmed on-screen evidence |
| [design-writing](skills/design-writing/SKILL.md) | Apply the foundation to ADRs, specifications, broader designs, and tracker tickets through selectively loaded references |

Use the foundation alone for an explanation, report, documentation draft, or editing task. Use a specialist for its destination. Specialists load the foundation explicitly, not each other. A video explaining a design can use design writing for the document and narration for the script. There is no mandatory three-stage pipeline and no global writing hook.

Design writing adapts to the artifact: an ADR centers on one significant decision, a broader design can cover several, a specification preserves normative requirements and acceptance, and [tickets](skills/design-writing/references/tickets.md) express bounded work with verifiable outcomes. Ticket guidance covers stories, tasks, bugs, epics/features, and investigations across Jira, Azure DevOps, GitHub Issues, and similar trackers. It is grounded in linked Atlassian, Microsoft, and GitHub guidance, while preserving the project's actual schema and template.

Technical Demo invokes narration before script work. BMAD Orchestrator and Spec-Kit Flow pass design-writing guidance to the installed authoring owner without changing managed files directly or bypassing method gates. Child authoring contexts must receive the guidance or have the companions available. Installation does not prove a running session has loaded a skill. Missing dependencies are reported before the writing task.

`design-analysis` still evaluates technical choices. Design writing expresses them without pretending that better prose resolves a missing decision. `no-ai-slop` remains an optional editor, not a dependency, and its change report or contrast-removal defaults do not override fidelity or spoken-only output. Existing review agents, Memory Manager, and Artifact Inspector keep their own output and workflow contracts. They can use the writing foundation for an explicitly requested drafting task without making it a prerequisite for every review or memory operation.

The [shared writing sources](skills/reasoning-first-writing/references/sources.md) and [design-writing sources](skills/design-writing/references/sources.md) describe the research and its limits. Manual installs must copy both a specialist's complete directory and `reasoning-first-writing`. The Claude review plugin still contains only its two review agents, not these skills.

### Demo production skills

| Skill | Responsibility |
| --- | --- |
| [narrative-transitions](skills/narrative-transitions/SKILL.md) | Join sections, scenes, slides, or steps so the piece plays as one line of thought |
| [tts-setup](skills/tts-setup/SKILL.md) | Choose and accept a synthetic voice, honoring a recorded default before installed alternatives |
| [cue-synced-demo](skills/cue-synced-demo/SKILL.md) | Record real browser or editor events, including human-style code walkthroughs, and bind narration to them |
| [pr-video](skills/pr-video/SKILL.md) | Find the story in a pull request and plan a video that shows the change |

Technical Demo or any agent producing a demo can load these alongside `reasoning-first-narration`. The installer publishes them with the other promptlings skills.

### Sparring Partner

One reasoning agent covers design exploration, investigation, debugging, implementation and plan critique, testing analysis, and decision support. Its four companion skills provide deeper methods without adding separate investigator or test-skeptic personas. It contributes reasoning and recommendations as well as questions, seeks counterevidence, and recommends whatever fully addresses a demonstrated problem. Correction size is not a review criterion.

### Artifact Inspector

This maintainer-facing wrapper uses the same canonical `artifact-inspection` skill that a current agent can invoke directly. `user-invocable: false` marks it for subagent use on hosts that honor that metadata. Its read-only boundary is an instruction, not a host-enforced permission sandbox.

The skill checks purpose, activation, contradictions, required capabilities, resource discovery and loading, trust and authority boundaries, outputs, stopping rules, and obligations retained through maintenance. CI runs the bundled mechanical checker separately:

```bash
python skills/artifact-inspection/scripts/check_artifacts.py --root .
python skills/artifact-inspection/scripts/check_artifacts.py --root . --base origin/main
```

The optional base selects the committed diff plus staged, unstaged, and untracked agent/skill changes. The default scans canonical agents and skills. Checks cover required single-line metadata, skill directory naming, agent em dash bans, and local inline Markdown links. They are intentionally not a full YAML parser, semantic inspection, or proof of native behavior. CI runs this checker. Maintainers request semantic inspection through the skill or Artifact Inspector, with the original requirements and baseline.

### the-nitcracker and PR Walkthrough

Both split their output into three channels and hold each to a different bar, instead of producing one ranked list of comments.

**Defects** are inline and anchored to a line. This is the only channel where the agent renders judgment, and every finding has to answer "what concretely breaks," with the mechanism traced rather than guessed.

**Design forks** are places the diff leaves a real choice open and the right answer depends on context the agent does not have. The agent names at least two options, the axis they differ on, and what would settle it. That settling criterion is mandatory; a fork without one is the model narrating its own uncertainty.

**Implicit bets** are choices already resolved in the diff that are costly to reverse. The agent states what the diff does, why it is defensible, what the road not taken would have cost, and a concrete question the reviewer has to answer before approving. That question is mandatory.

The agent is forbidden from rendering judgment in the second and third channels. It surfaces the choice and stops.

PR Walkthrough is read-only in every mode. It returns its full narrative in conversation, never saves a report or creates tracking files, and never fetches or updates Git refs. A supplied diff, commit range, or bounded working-tree scope takes precedence over its default base. Otherwise it uses locally available refs and reports missing evidence.

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

The companion [read-side instruction](agents/context/memory-manager-read-side.md) makes future sessions retrieve relevant context and save decisions, verified outcomes, failed approaches, and handoffs on their own through the [memory capture skill](skills/promptlings-memory-capture/SKILL.md), which the installer adds with Memory Manager. Memory Manager handles setup, full session capture, and graph maintenance. The read-side block affects **every future session in every repository** and is included in the printed default plan. Disable it explicitly if that is not wanted:

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

Starts from a software request and always establishes current `spec.md`, `plan.md`, and `tasks.md` anchors before implementation. It then selects the lightest anchored execution path, adding [Spec-Kit](https://github.com/github/spec-kit) phases only when they resolve a named need. On request it runs the [promptlings delivery workflow](workflows/speckit/promptlings-delivery/workflow.yml) through Spec-Kit's workflow engine: an approval gate, implement and converge until converged, and an acceptance gate, with run state that resumes across sessions.

## Principles

- **High bar, low noise.** Ship output that changes an experienced reviewer's mind.
- **Portable.** Plain Markdown, no required agent runtime.
- **Opinionated.** Every agent has a defined point of view and judgment boundary.
- **No em dashes.** Use commas, colons, semicolons, periods, or parentheses.

## Contributing

PRs are welcome. Keep each agent's responsibility and judgment boundary explicit, and put reusable methods in skills instead of multiplying personas. Maintainer-facing helpers need not be everyday user-facing agents. Run the mechanical checker above and obtain semantic inspection for changed instruction contracts.

### Design provenance

The new reasoning and inspection prompts and review-ensemble procedure are original Promptlings text. Design influences include [HVE Core](https://github.com/microsoft/hve-core) (independent critique, evidence-based arbitration, artifact review, and requirements-led authoring) and the existing Promptlings review agents. HVE's report-specific workflows and framework-specific contracts are not imported. The workflow formalizes the established Promptlings reviewers plus Copilot's built-in rubber-duck without copying that built-in agent or silently replacing it.

When changing an agent, keep its purpose, output channels, approval boundaries, and host capabilities intact unless the change explicitly targets them. Remove repeated rules only when their required behavior remains covered, resolve contradictory instructions, and state what happens when evidence is missing. These maintenance criteria adapt the [HVE Builder requirements](https://github.com/microsoft/hve-core/blob/c0726875613fed25bcd7d6d42cc720b96bfe1dda/.github/skills/hve-core/hve-builder/references/requirements-catalog.md), without adding an HVE dependency.

For review-agent changes, run the three [review regression cases](tests/review-regressions.md) and assess the actual output against their expected behavior. Keep the Claude plugin copies synchronized using its [documented adaptations](plugins/promptlings-code-review/README.md#relationship-to-the-source-files). Markdown lint checks formatting, not review accuracy.

## License

Apache 2.0. See [LICENSE](LICENSE).
