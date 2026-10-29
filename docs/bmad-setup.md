# Personal BMAD and Child Worktrees

Use normal BMAD. Keep its personal installation out of delivery commits with
private Git exclusions. Before a child starts work, the orchestrator copies the
required BMAD files and documents from its parent session's checkout and verifies
child-local outputs.
No Copilot app worktree-copy feature is required.

## Install the agent and companion skills

Selecting `bmad-orchestrator` in either installer installs:

- The [orchestrator](../agents/orchestration/bmad-orchestrator.agent.md).
- [Personal setup](../skills/promptlings-bmad-setup/SKILL.md), for installation,
  configuration and Git policy.
- [Standalone bootstrap](../skills/promptlings-bmad-bootstrap/SKILL.md), for
  parent-first worktree provisioning without requiring BMAD to run.
- The bootstrap's [startup instruction](../skills/promptlings-bmad-bootstrap/startup.md).

Copilot agents and skills use `~/.copilot`, or the explicit `COPILOT_HOME`.
Claude uses `~/.claude`. Manual installation places each agent under `agents`
and each complete companion skill directory under `skills`.

The orchestrator always requires bootstrap before a child starts work.
To give other BMAD-using agents the same readiness instruction, explicitly opt
in to appending the startup block to global host instructions:

```powershell
.\install.ps1 -Agents bmad-orchestrator -WithBmadBootstrap -DryRun
.\install.ps1 -Agents bmad-orchestrator -WithBmadBootstrap -Yes
```

```bash
bash install.sh --agents bmad-orchestrator --with-bmad-bootstrap --dry-run
bash install.sh --agents bmad-orchestrator --with-bmad-bootstrap --yes
```

The opt-in appends once, preserves existing instructions, and is separate from
Session Handoff's read-side flag. Without it, global instructions are unchanged.
Refresh or restart existing hosts to load new instructions and skills.
The installed skill's availability alone does not run it.

## Prepare the parent once

Use an ordinary official BMAD installation. Setup verifies its installed version,
runtime, supported host integrations and effective configuration. Unknown versions
need matching source or documentation rather than guessed paths.

For a personal installation, setup appends approved patterns to the Git-provided
`info/exclude` file, which linked worktrees share. Typical paths are `_bmad`,
BMAD-specific integration entries and `.bmad-local`. Personal output exclusions
are a separate ownership choice. Do not ignore a whole shared `.github` or
`.agents` directory, alter team .gitignore, or hide tracked team deliverables.
Ignore rules do not remove files from existing commits.

Normal skills remain in native discovery. There is no private source registry,
content-addressed source map, or enable/disable cycle. Choosing this orchestrator
uses BMAD for the assignment. Explicit user exceptions still take priority.
Bootstrap does not select BMAD for unrelated tasks.

Existing personal preferences and artifact destinations can be retained.
External outputs are optional. A child always needs its own writable destination,
whether inside its checkout or under an approved personal workspace.

## Provision children before dispatch

The parent creates an idle child when possible, observes its checkout, provisions
it, and then sends its task. If the host requires an immediately running kickoff,
the kickoff makes bootstrap the first operation and blocks delivery until it
succeeds.

The assignment supplies:

| Input | Purpose |
| --- | --- |
| Exact parent session and absolute checkout | Source of the current wave's installation and documents |
| Task/spec/context paths and work-unit ownership | Selected input documents, companions and execution owner |
| Approved copy scope and child output destination | Permission to provision without a repeated setup question |
| Optional authorized primary-checkout fallback | Used only when the parent is unavailable or lacks the installation |

Git identifies repository worktrees, not session ancestry. Do not guess the
parent from directory names or the first `git worktree list` entry. A grandchild
copies from its immediate parent. Remote execution requires an explicitly
supported transfer, not an assumed shared filesystem.

Bootstrap copies the complete installed runtime and required normal BMAD
integrations, plus selected task documents. It excludes render snapshots, caches,
locks, logs, virtual environments, credentials, application code and `.git`.
It verifies file inventories and hashes across the copy. Existing identical
files can be reused. Differing files and partial installations stop for
reconciliation, without overwriting child progress or silently switching sources.

The child session validates the same procedure before work. Once provisioned,
it keeps its own files rather than continuously mirroring the parent.
In-process reviewers, researchers and generic coding subagents sharing that
prepared checkout do not bootstrap it again. Installed handoffs that prohibit
skill invocation remain in force.

## Separate writable state

Copied configuration can retain absolute parent output paths. Bootstrap inspects
and rebinds them through the installed version's supported user overrides before
running any workflow.

For BMAD 6.12.1, the supported override is `_bmad/custom/config.user.toml`:

```toml
[core]
output_folder = "{project-root}/_bmad-output"

[modules.bmm]
planning_artifacts = "{project-root}/_bmad-output/planning"
implementation_artifacts = "{project-root}/_bmad-output/implementation"
project_knowledge = "{project-root}/_bmad-output/knowledge"
```

The installed resolver and selected entry must confirm effective values,
including any skill-specific overrides. Writable paths cannot overlap a parent's
or sibling's outputs. Copied inputs retain reference mappings and companions.
An active parent spec requires explicit exclusive ownership transfer or a
separate child work unit, not two concurrent writers or manually rewritten status.

Children return result paths and code evidence. The parent integrates them through
BMAD rather than copying entire output folders back over its own state.

## Resume and operating decisions

`.bmad-local/provisioning.md` records source, version, selected payload, path mapping,
override changes, exclusions and readiness evidence.
For multi-dispatch delivery, `.bmad-local/continuation.md` records active artifact
references, outstanding child assignments, the next gate and scoped user decisions.
Existing approved continuation locations remain valid on resume.

After restart or compaction, the orchestrator rereads those references and actual
artifacts before dispatch. It does not duplicate BMAD task/status state or restart
an assignment whose liveness is unknown.

Generic coding children are normal when BMAD's installed handoff uses them.
They follow the spec rather than invoking a second Build. The parent owns
workflow verification and progression. A launcher failure does not authorize an
ordinary-tool bypass. An explicit user exception retains its scope, and an
unbounded instruction to abandon BMAD remains until the user changes it.

## Observed acceptance on 2026-10-29

Independent native Copilot processes on Windows exercised official BMAD 6.12.1
in isolated profiles and real Git-linked worktrees:

| Case | Observed result |
| --- | --- |
| Parent-first provisioning | Empty child received the selected runtime, integrations and documents; 238 payload files matched, with recorded user-override differences |
| Resume and actual delivery | Child progress and original provenance survived readiness validation; original Build ran in the child |
| Immediate-parent inheritance | Grandchild received revision 2 from its immediate parent, not revision 1 from the primary checkout; 242 payload files matched |
| Approved fallback | Child used the explicitly authorized primary after the parent was unavailable; 238 payload files matched |
| Conflict, identity and authority | Differing child configuration was preserved; foreign-repository and missing-source cases stopped without provisioning |

All three provisioned checkouts resolved their four writable output categories
inside their own checkout, with no overlap. All 29 original skills appeared in
normal native discovery. Protected original fixtures and parent runtime,
integrations, documents and external outputs remained unchanged.

The initial delivery attempt exposed a startup-scoping defect: a BMAD reviewer
invoked bootstrap despite its installed no-skills handoff. The skill description,
body, startup instruction and orchestrator now explicitly exclude those
in-process subagents. A targeted same-task retry used the original Build
launcher and reviewer contract, reached spec status `done`, and recorded no
reviewer skill or nested-agent calls. A separate reviewer verified the fixture's
test repair and exercised its public API. All 13 test methods passed.

The accepted retry used the scope-fixed sources. The preceding provisioning
cases used the earlier scope text. Raw native transcripts, inventories,
protected-file hashes and verdicts are retained in the producing session's
`bmad-simple-native-acceptance` evidence folder.

Installer tests passed on Windows PowerShell 5.1, PowerShell 7 and Git Bash,
covering both host destinations, custom roots with spaces, default instruction
isolation, explicit opt-in, preservation, idempotence and download failures.
An independent contract review found no remaining actionable defects.

A final native read-only compatibility case exercised the retained schema-1
preferences with conflicting defaults, a matching project exception, a decoy
project and an active binding. It selected the correct identities and existing
destinations without changing any seeded file, creating a new run or migrating
artifacts. This follow-up used the final setup skill, whose SHA256 was
`43e908df08f8d9763a78f8310632cad141d1c3463b3327697e3c41e8d73e1877`.

## Previous installations and evidence

Installing these promptlings files does not modify a live BMAD installation.
If an earlier private-map setup was actually applied, setup must obtain approval
before restoring its unchanged skills to supported discovery locations.
Active runs, old evidence and existing artifacts are not deleted or rebound.

The [historical setup record](bmad-setup-history.md) preserves the earlier
private-source and seeded-continuation acceptance. Those runs tested the earlier
design, not this replacement. The version-pinned research remains a historical
record of why runtime readiness and workflow continuity are separate concerns.
