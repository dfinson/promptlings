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

Both installers honor `COPILOT_HOME` for Copilot agent and skill destinations.
Without it, the default remains `~/.copilot`. The displayed plan shows the
effective paths before any write, including a separately opted-in read-side file.

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

BMAD workflow directories are moved unchanged outside all observed host
discovery roots. Each immutable source set has its own version-and-content
address under `bmad-sources/<installation-id>/<source-set-id>`. Its `sources.toml` records exact entry
paths, canonical IDs, installation identity, and file hashes. The orchestrator
reads those entries explicitly and follows their original launcher contracts.
Nested handoffs use the same map. Ordinary agents do not receive BMAD's broad
trigger descriptions, even during delivery. Workflow skills are never globally
re-enabled. This is discovery isolation, not an access-control sandbox against
an agent explicitly instructed to read arbitrary files.

Bindings pin an exact map. An update creates a different source set without
changing existing runs, and rebinding requires approval. Runtime updates still
require all affected runs to be inactive. A maintenance window is an explicitly
confirmed operational prerequisite, not an automatic lock over unrelated agents.
If sessions cannot be stopped or new starts withheld, setup stops before exposure.

Installation and updates can recreate discoverable files. Setup therefore
requires approved native suppression before exposure, or a quiescent maintenance
window, then relocation and fresh catalog checks before delivery. Unsupported
plugin sources, incomplete inventories, or workflows requiring native catalog
registration stop setup. Existing sessions need refresh or restart. The current
distribution does not configure your live machine merely by being installed.

Each worktree still needs its own official runtime installation on first BMAD
use. The selected orchestrator checks readiness and performs approved setup,
not a Git hook or worktree-manager automation. A shared runtime is not supported.
Private skill source storage is separate from central artifact placement and
does not share mutable runtime configuration or render snapshots.

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

## Earlier end-to-end verification

On 2026-10-19, an independent context exercised the actual orchestrator using
Copilot CLI 1.0.100-1 and official BMAD 6.12.1 in an isolated Windows fixture.
Central artifacts with local private exclusions worked through installation,
saved-binding reuse, a future-default change without artifact movement, a fresh
ordinary code request without BMAD activation, and actual BMAD delivery.
The delivery produced an external spec with status `done`, a context-separated
same-model review, a code commit, and a passing whitespace regression.

Execution exposed home-resolution, path-hashing, and self-acceptance-reporting
defects. The instructions were corrected and the affected real entry-point
journeys rerun. Final resume evidence showed canonical IDs, unchanged settings
and artifacts, and no false acceptance claim. All 29 fixture workflow skills
were restored disabled. This verifies the exercised Windows central/local
journeys, not every host, storage combination, or the user's live installation.
That earlier test used disabled skills and temporary delivery activation. It
does not establish the new private-source loading or concurrent-session boundary.
Those require their own real delivery, nested-handoff, and concurrent ordinary
session evidence before being reported as verified.
