# Personal BMAD setup

The [BMAD orchestrator](../agents/orchestration/bmad-orchestrator.agent.md) loads
[promptlings-bmad-setup](../skills/promptlings-bmad-setup/SKILL.md) for explicit
setup, repair, or later settings changes. It is an instruction skill, not a
Python program. It uses the host's existing file, shell, Git, and skill controls.
Ordinary implementation requests are not setup consent.

## Installation

Selecting `bmad-orchestrator` in either installer also installs its setup skill
into each detected host's skills directory. The preview lists both files.
Installing the skill does not install BMAD, change preferences, alter Git
exclusions, or disable any workflow skills.

For manual installation, copy both files from the same trusted revision:

| File | Copilot CLI | Claude Code |
| --- | --- | --- |
| `agents/orchestration/bmad-orchestrator.agent.md` | `~/.copilot/agents/bmad-orchestrator.agent.md` | `~/.claude/agents/bmad-orchestrator.agent.md` |
| `skills/promptlings-bmad-setup/SKILL.md` | `~/.copilot/skills/promptlings-bmad-setup/SKILL.md` | `~/.claude/skills/promptlings-bmad-setup/SKILL.md` |

Refresh or restart the host and inspect its catalog. The orchestrator can read
the same skill file directly when native invocation is unavailable. It must
report a missing skill rather than reconstructing the procedure.

## Choices and timing

On first setup, the orchestrator inspects existing settings, asks only for
missing choices, previews effects, and applies approved changes. It remembers
personal defaults and project exceptions in `~/.config/promptlings/bmad.toml`.
Explicit run choices override project exceptions, then defaults, then unchanged
project behavior. Linked worktrees share project preferences but not artifacts.

Artifact placement and Git visibility are independent. Choose project, central,
or a category mix for artifacts. Choose unchanged project Git behavior, private
repository exclusions, or global exclusions. `project` inherits installed
destinations rather than forcibly replacing them. Central artifacts may have
their own Git repository, but personal commits are never part of code pushes.
Git cannot omit selected files from commits being pushed.

Runtime stays in the actual code checkout. BMAD 6.12.1 supports external output
paths through user overrides. A global skill installation does not make an
arbitrary checkout executable. Unknown versions require compatibility evidence.

Ask the orchestrator to change defaults or project settings at any time. It
uses the same skill and records original settings and paths for restoration.
It does not migrate active work, overwrite changed settings, or remove shared
exclusions implicitly. Moving existing artifacts is a separate approved action.

## Activation and acceptance

The orchestrator cannot stop globally exposed workflow skills from activating
before it runs. Setup must inspect and use actual host controls. Copilot CLI
toggles are persistent across sessions. App session controls are separate.
Filesystem relocation is a scoped fallback only when all discovery sources
are known. Unsupported boundaries stop setup instead of receiving invented
patches. Installers and updates require exposure checks again.

The setup skill specifies verification, including fresh ordinary-session
nonactivation and real orchestrator-driven delivery with actual artifacts.
These journeys must be observed before claiming acceptance. Markdown lint and
the optional native control check do not substitute for them:

```powershell
$env:PROMPTLINGS_TEST_COPILOT = "1"
python -B -m unittest discover -s tests -p test_bmad_copilot.py -v
```

That check uses isolated host configuration and synthetic skills. It does not
change the user's real skill state. There is no custom setup runtime, approval
token protocol, or transaction engine to install or maintain.
