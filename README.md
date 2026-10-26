<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo-dark.png">
    <img src="logo.png" alt="promptlings" width="321">
  </picture>
</p>

Focused custom agents for code review, session continuity, technical demos, and spec-driven delivery. Each promptling is one portable `.agent.md` file: YAML frontmatter, a Markdown body, no runtime.

## Pick an Agent

| Agent | Use it when you need |
| --- | --- |
| [the-nitcracker](agents/code-review/the-nitcracker.agent.md) | A full PR review with inline defects, separate design judgments, and a candid narrative walkthrough. |
| [PR Walkthrough](agents/code-review/pr-walkthrough.agent.md) | A narrative map of a PR before reviewing it: architecture, important files, design forks, and implicit bets. |
| [Memory Manager](agents/context/memory-manager.agent.md) | Capture a session's purpose, reasoning, decisions, and continuation state in Basic Memory, then recall and maintain scoped knowledge. |
| [Technical Demo](agents/media/technical-demo.agent.md) | A polished technical demo video built from approved design, deterministic scenes, real evidence, narration, and review. |
| [BMAD Orchestrator](agents/orchestration/bmad-orchestrator.agent.md) | Adaptive BMAD delivery through one interface, from verified setup and bounded fixes to full-assurance initiatives. |
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

Handles tool detection and multiple targets. It downloads only the agents you select and prints every path it will write before writing anything.

```bash
curl -fsSL https://raw.githubusercontent.com/dfinson/promptlings/main/install.sh -o install.sh
bash install.sh --all
```

```powershell
irm https://raw.githubusercontent.com/dfinson/promptlings/main/install.ps1 -OutFile install.ps1
powershell -ExecutionPolicy Bypass -File .\install.ps1 -All
```

Windows PowerShell 5.1 defaults to the `Restricted` execution policy, which blocks running a downloaded script. The `-ExecutionPolicy Bypass -File` form applies to that one invocation and changes nothing about your machine.

| Flag | Effect |
| --- | --- |
| `--all` / `-All` | Install all six agents |
| `--review` / `-Review` | The two code-review agents only |
| `--agents a,b` / `-Agents a,b` | Install by name |
| `--list` / `-List` | Print available agent names and exit |
| `--dry-run` / `-DryRun` | Print every path that would be written, write nothing |
| `--with-readside` / `-WithReadSide` | Opt in to installing or replacing the managed Basic Memory read-side instruction |

By default the script writes only to your agents directory. It does not touch `~/.copilot/copilot-instructions.md`, `~/.claude/CLAUDE.md`, your shell profile, or your PATH.

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

Unedited output from both agents on a real PR is in [`examples/`](examples/), along with how to reproduce it. Worth knowing before you rely on either: no codebase index, no memory between runs, no GitHub App, no CI integration. Run twice on a change that matters, since the severity floor is reproducible but which finding surfaces is not.

### Memory Manager

Replaces Session Handoff with one session-first agent using [Basic Memory](https://docs.basicmemory.com/). Invoking it without a narrower request captures the available conversation's purpose, evolving reasoning, decisions and rationale, discoveries, failed approaches, outcome, and continuation state. It saves a coherent session checkpoint and reconciles reusable knowledge into canonical notes. Setup, recall, ingestion, and broader maintenance are explicit operations, not a mandatory full audit on every save.

Requires a configured Basic Memory MCP server. Install the relevant Basic Memory skills through your assistant's supported skill installation mechanism: `memory-notes` for note operations, `memory-tasks` for resumable work, and reflection, ingestion, lifecycle, schema, or defrag skills as needed. The agent discovers capabilities rather than assuming every optional skill exists. This installer installs the agent only, not Basic Memory or its skills.

```bash
bash install.sh --agents memory-manager
```

```powershell
.\install.ps1 -Agents memory-manager
```

Ask Memory Manager to set up routing. It reuses an existing repository/domain project or proposes one, keyed by canonical repository identity across branches and worktrees. A shared `agent-environment` project replaces machine-global handoff notes, with host-specific facts scoped under an approved stable host key. It can be the configured default if approved, but every memory operation still uses an explicit project identifier. Project knowledge never falls back into the environment project.

Setup requires approval for new projects, stable storage paths outside disposable worktrees, and global configuration changes. Record approved routing **outside the managed read-side block** in the chosen user/repository instructions:

```text
Environment project ID: <actual Basic Memory project ID>
Host key: <approved stable machine key>
Repository/domain project ID: <actual Basic Memory project ID>
Canonical repository identity: <credential-free remote identity, if applicable>
```

The companion [read-side instruction](agents/context/memory-manager-read-side.md) makes future sessions retrieve relevant context and use session capture. It affects **every future session in every repository**, so the installer never adds or replaces it without `--with-readside`, `-WithReadSide`, or interactive confirmation:

```bash
bash install.sh --agents memory-manager --with-readside
```

```powershell
.\install.ps1 -Agents memory-manager -WithReadSide
```

This installs or replaces complete `memory-manager-read-side` and legacy `session-handoff-read-side` marked blocks, collapsing duplicates while preserving unrelated instructions. Malformed or nested markers cause an error without rewriting that instruction file. Download failures also fail explicitly. Installation does not create memory projects or migrate their data.

**Upgrading from Session Handoff:** install Memory Manager without the read-side flag first. Ask it to migrate `~/.session-handoff/environment.md` and the repository's git-common-dir handoff records and referenced artifacts into the approved Basic Memory projects. It preserves provenance and history, screens secrets, avoids duplicate imports, and verifies retrieval before retiring the old read-side contract. Then enable the new block using the commands above. Original handoff data is not deleted.

The deprecated installer selection `session-handoff` resolves to `memory-manager` and installs only the canonical agent. Previously installed Session Handoff, Context Manager, and Memory Maintainer files are not deleted or overwritten. After migration, review and retire those obsolete agents manually. Manual installations of the old read-side instruction should replace the entire marked block, not append the new one beside it.

Saving requires invoking Memory Manager unless a supported host hook has actually been configured and verified. Delegated capture must receive the relevant conversation or an accessible source reference. An agent cannot recover conversation that was never supplied or saved.

### BMAD Orchestrator

[BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD), short for Breakthrough Method of Agile AI-driven Development, carries software work from clarification and planning through implementation and review.

Start with a software request, not a BMAD command. The agent verifies setup, uses focused evidence for bounded work, escalates uncertainty and high-risk changes to full assurance, and keeps every output conformant with the installed BMAD workflow.

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
