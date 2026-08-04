<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo-dark.png">
    <img src="logo.png" alt="promptlings" width="321">
  </picture>
</p>

Focused custom agents for code review, session continuity, technical demos, and BMAD-driven delivery. Each promptling is one portable `.agent.md` file.

## Install

**Linux / macOS**

```bash
curl -fsSL https://raw.githubusercontent.com/dfinson/promptlings/main/install.sh | bash
```

**Windows PowerShell**

```powershell
irm https://raw.githubusercontent.com/dfinson/promptlings/main/install.ps1 | iex
```

The installer detects GitHub Copilot CLI and Claude Code, installs all agents, and configures the session-handoff read-side instruction.

## Pick an Agent

| Agent | Use it when you need |
| --- | --- |
| [PR Walkthrough](agents/code-review/pr-walkthrough.agent.md) | A narrative map of a PR before reviewing it: architecture, important files, design forks, and implicit bets. |
| [the-nitcracker](agents/code-review/the-nitcracker.agent.md) | A full PR review with inline defects, separate design judgments, and a candid narrative walkthrough. |
| [Session Handoff](agents/context/session-handoff.agent.md) | Durable context across chats: current state, environment facts, decisions, and a verified restart prompt. |
| [Technical Demo](agents/media/technical-demo.agent.md) | A polished technical demo video built from approved design, deterministic scenes, real evidence, narration, and review. |
| [BMAD Orchestrator](agents/orchestration/bmad-orchestrator.agent.md) | One conversational interface that bootstraps, configures, operates, repairs, and updates BMAD-driven delivery. |

## Agent Notes

### BMAD Orchestrator

No preinstalled BMAD workspace is required. The agent detects the repository and BMAD state, recommends the appropriate modules and tool integration, obtains approval for mutations, runs the official installation or repair path, validates the result, and then conducts delivery through the installed capabilities. It resolves documentation against the installed module version because the public docs can track unreleased `main`.

- [Install BMAD](https://docs.bmad-method.org/how-to/install-bmad/)
- [BMAD releases](https://github.com/bmad-code-org/BMAD-METHOD/releases)

### Session Handoff

Requires a companion read-side instruction so future sessions load the persisted context. The installers configure this automatically. For manual setup, see [Read-Side Setup](agents/context/session-handoff.agent.md#read-side-setup).

## Manual Install

Copy any `.agent.md` file into the directory for your tool:

| Tool | Directory |
| --- | --- |
| GitHub Copilot CLI, user-wide | `~/.copilot/agents/` |
| GitHub Copilot CLI, per-project | `.github/agents/` |
| Claude Code | `~/.claude/agents/` |

For other frameworks, parse the YAML frontmatter and use the Markdown body as the system prompt.

## Principles

- **High bar, low noise.** Ship output that changes an experienced reviewer's mind.
- **Portable.** Plain Markdown, no required agent runtime.
- **Opinionated.** Every agent has a defined point of view and judgment boundary.
- **No em dashes.** Use commas, colons, semicolons, periods, or parentheses.

## Contributing

PRs are welcome. The inclusion bar is simple: would you use this agent every day?

## License

Apache 2.0. See [LICENSE](LICENSE).
