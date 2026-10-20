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

## Private-source verification

On 2026-10-20, an independent executor exercised the private-source design with
Copilot CLI 1.0.100-1 and official BMAD 6.12.1 in isolated Windows profiles.
All 29 workflow skills were absent from fresh effective catalogs. All 214
official skill files matched the package, and all 219 pre/post-relocation files
were unchanged.

The original private Build entry completed actual delivery with an external
`done` spec, context-separated review, and committed code. Nine unit tests and
seven independently invoked public API journeys passed. Separately, an original
private Help quick-start handed off to the original private QA skill through
the same exact map. That was a genuine Help-owned handoff, not a nested
requirement of the small Build route.

An ordinary read session in the same checkout and an ordinary implementation
session in a linked worktree overlapped actual BMAD delivery. They shared the
isolated host configuration but made no BMAD skill calls or private-source
reads. The linked worktree had no BMAD runtime and completed its own committed
implementation with four passing tests. Source tampering caused explicit
refusal before another launcher or delivery, without protected-file changes.
Normal completion left workflow sources outside discovery.

Initial setup incorrectly transcribed a 21-character project ID. Explicit
recovery preserved existing artifact paths, so the initial bootstrap result
remains qualified rather than being reported as an uninterrupted success.
Instructions now emit sliced identity JSON and require exact parsed-value
comparisons before application and after writes. A fresh, unsteered setup
preview produced the correct 20/12-character IDs and derived paths. A fresh
existing-binding resume preserved all 491 protected files and accepted the
exact map without a false mismatch. Those narrow checks did not apply a new
setup or exercise the new post-write assertions.

A separate fresh application exposed a PowerShell installer argument defect:
the `npx.ps1` wrapper received unquoted `core,bmm` as an array, and BMAD reported
the nonexistent module `core bmm`. Installation exited 1 with 78 partial runtime
files but no preferences, binding, exclusions, or source relocation. The actor
stopped rather than retrying silently. Setup now requires quoted list/path
arguments, installer-selection verification, and an inventory of partial effects
before proposing an approved retry.

The approved retry succeeded with the correct modules and tool integration.
Independent inspection verified persisted 20/12-character IDs, derived paths,
native post-write identity assertions, and 29 private skills with 214 matching
file hashes. Readiness then incorrectly required 21 obsolete manifest source
paths to exist despite their valid private entries. Both the setup skill and
orchestrator completion gate now resolve skill identity through the private map,
not those provenance paths, without recreating discovery entries or weakening
runtime-file verification.

A fresh independent read-only resume then passed the corrected readiness gate.
It reverified persisted identities, the exact map, all private skill hashes,
catalog absence, and Git visibility. The original Help entry's configuration
probe exited 0 with the saved destinations, and all 318 protected files remained
unchanged. No obsolete paths were recreated and no generated inventories were
edited. This was a discovery/configuration check, not another delivery or
concurrency run. Apply-time post-write assertions remain separate evidence.

These results cover the exercised routes, not every host, storage combination,
upgrade, plugin, or native-registration-only workflow. Installation exposure was
contained in an explicitly approved isolated maintenance window. A later wording
clarification distinguishes non-skill command targets from private skill-map
entries. Those non-skill integrations were not exercised. The user's live
installation was not changed.
