<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo-dark.png">
    <img src="logo.png" alt="promptlings" width="321">
  </picture>
</p>

Focused custom agents and skills for code review, session continuity, technical demos, narration, and spec-driven delivery. An agent is one portable `.agent.md` file. A skill has a `SKILL.md` entry point and may bundle helpers. Both use YAML frontmatter and a Markdown body. Optional production helpers use existing Playwright, Python, and FFmpeg.

## Pick an Agent

| Agent | Use it when you need |
| --- | --- |
| [the-nitcracker](agents/code-review/the-nitcracker.agent.md) | A full PR review with inline defects, separate design judgments, and a candid narrative walkthrough. |
| [PR Walkthrough](agents/code-review/pr-walkthrough.agent.md) | A narrative map of a PR before reviewing it: architecture, important files, design forks, and implicit bets. |
| [Session Handoff](agents/context/session-handoff.agent.md) | Durable context across chats: current state, environment facts, decisions, and a verified restart prompt. |
| [Technical Demo](agents/media/technical-demo.agent.md) | A polished technical demo video built from approved design, deterministic scenes, real evidence, narration, and review. |
| [BMAD Orchestrator](agents/orchestration/bmad-orchestrator.agent.md) | Adaptive BMAD delivery through one interface, from verified setup and bounded fixes to full-assurance initiatives. |
| [Spec-Kit Flow](agents/orchestration/speckit-flow.agent.md) | Anchor every change in Spec-Kit specification, plan, and tasks, then use only the additional phases and Fleet capabilities that add value. |

## Pick a Skill

| Skill | Use it when you need |
| --- | --- |
| [Reasoning-First Narration](skills/reasoning-first-narration/SKILL.md) | Natural spoken technical explanations that preserve reasoning, evidence, meaning, and attribution, for human delivery, teleprompters, or TTS. |
| [TTS Setup](skills/tts-setup/SKILL.md) | Local/cloud/reuse choice, current hardware-aware research, selected-path setup and representative sample approval. |
| [Cue-Synced Demo](skills/cue-synced-demo/SKILL.md) | Real event capture, per-line audio reuse, pre-event holds, disclosed wait cuts and final encoded-audio checks. |

## Install

Copy an agent file or a skill folder into the location for your tool:

| Tool | Agent directory | Skill file |
| --- | --- | --- |
| GitHub Copilot CLI, user-wide | `~/.copilot/agents/` | `~/.copilot/skills/<name>/SKILL.md` |
| GitHub Copilot CLI, per-project | `.github/agents/` | `.github/skills/<name>/SKILL.md` |
| Claude Code | `~/.claude/agents/` | `~/.claude/skills/<name>/SKILL.md` |

```bash
mkdir -p ~/.copilot/agents
curl -fsSL -o ~/.copilot/agents/the-nitcracker.agent.md \
  https://raw.githubusercontent.com/dfinson/promptlings/main/agents/code-review/the-nitcracker.agent.md

mkdir -p ~/.copilot/skills/reasoning-first-narration
curl -fsSL -o ~/.copilot/skills/reasoning-first-narration/SKILL.md \
  https://raw.githubusercontent.com/dfinson/promptlings/main/skills/reasoning-first-narration/SKILL.md
```

Restart your assistant to pick it up. For other frameworks, parse the YAML frontmatter and use the Markdown body as the system prompt.

### Installer script

Handles tool detection and multiple targets. It downloads selected agents, their declared companion skills, and every bundled skill file. It prints every path and separate agent/skill/file counts before writing anything.

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
| `--all` / `-All` | Install all agents and skills |
| `--review` / `-Review` | The two code-review agents only |
| `--agents a,b` / `-Agents a,b` | Install agents by name, including declared companion skills |
| `--skills a,b` / `-Skills a,b` | Install skills by name (Bash also accepts `--skills=a,b`) |
| `--list` / `-List` | Print available agent and skill names and exit |
| `--dry-run` / `-DryRun` | Print every path that would be written, write nothing |
| `--with-readside` / `-WithReadSide` | Opt in to the Session Handoff read-side instruction |

Choose at most one selection flag: `--review`, `--all`, `--agents`, or `--skills` (or its PowerShell equivalent). With no selection flag, a non-interactive run installs only the two code-review agents.

`technical-demo` installs `reasoning-first-narration`, `tts-setup`, and `cue-synced-demo` once per detected tool. `--all` / `-All` deduplicates those companions. Skills-only selection remains independent:

```bash
bash install.sh --agents technical-demo --dry-run
bash install.sh --skills tts-setup,cue-synced-demo
```

```powershell
.\install.ps1 -Agents technical-demo -DryRun
.\install.ps1 -Skills tts-setup,cue-synced-demo
```

Copy complete skill folders for manual installation, including `cue-synced-demo/scripts/record.mjs` and `cue-synced-demo/scripts/assemble.py`. Downloads use per-file replacement protection: a failed fetch does not truncate that installed file. A multi-file install is not a transaction, so rerun after a partial failure. New files are available through the main-branch installer only after merge; local fixture checks do not prove pre-merge main availability.

By default the script writes only to your agents and skills directories, according to your selection. It does not touch `~/.copilot/copilot-instructions.md`, `~/.claude/CLAUDE.md`, your shell profile, or your PATH.

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

### Session Handoff

Requires a companion read-side instruction so future sessions load the persisted context. That instruction is appended to your global instruction file and applies to **every future session in every repository**, so the installer never adds it unless you ask:

```bash
bash install.sh --agents session-handoff --with-readside
```

For manual setup, see [Read-Side Setup](agents/context/session-handoff.agent.md#read-side-setup).

### BMAD Orchestrator

[BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD), short for Breakthrough Method of Agile AI-driven Development, carries software work from clarification and planning through implementation and review.

Start with a software request, not a BMAD command. The agent verifies setup, uses focused evidence for bounded work, escalates uncertainty and high-risk changes to full assurance, and keeps every output conformant with the installed BMAD workflow.

- [Install BMAD](https://docs.bmad-method.org/how-to/install-bmad/)
- [BMAD releases](https://github.com/bmad-code-org/BMAD-METHOD/releases)

### Technical Demo

The director supports technical explainers, verified hands-on demos, and hybrids. It owns audience, story, evidence, script approval, semantic coverage, readiness and final acceptance. It explicitly invokes Reasoning-First Narration for explanation writing, TTS Setup for approved synthetic speech, and Cue-Synced Demo for production. Existing HyperFrames, browser/window capture, audio and synthesis skills retain their specialized roles.

The repository agent is named `technical-demo`. An existing user installation named `technical-demo-producer` can adopt the same contract while preserving its name; the installer does not overwrite that separate identity. Fixed provider/tool assignments are replaced by evidence-fit capture and a user-approved speech recipe. No voice provider, personal clone, cloud upload, account setup, paid synthesis, model installation, or global Git configuration is implied by installing these instruction files.

The optional helpers require Python 3.10+, FFmpeg/ffprobe on PATH, and caller-supplied Playwright/browser configuration. The recorder produces unmarked viewport footage and timestamped events. The assembler measures narration, schedules holds/cuts, checks final encoded audio and produces scene/event frames for inspection. Its event-to-video clock is an inspected recording assumption, with an explicit offset when needed, not automatic visual proof. Captions and mastering are delivery choices. Checks do not replace a human listen-through or semantic acceptance. See the skill for commands and the small audio-index/joined-check schemas. The legacy `local-technical-video-production` skill is not removed or silently migrated.

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
