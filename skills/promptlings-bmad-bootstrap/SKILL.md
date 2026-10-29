---
name: promptlings-bmad-bootstrap
description: For the session owning a new or unprepared BMAD checkout, provision its runtime, integrations and task documents from its explicitly identified parent checkout. Also use when that session selects a BMAD entry but its runtime is missing. Not for in-process reviewers, researchers or generic coding subagents using a prepared checkout, especially handoffs prohibiting skill invocation. Runs without BMAD installed.
---

# BMAD Worktree Bootstrap

The checkout-owning session runs this procedure before invoking a BMAD entry
or starting work in its independently assigned child checkout. In-process
reviewers, researchers and generic coding subagents in the already prepared
checkout do not run it. Respect installed handoffs that prohibit skill
invocation. Report missing inputs to the owning session instead of provisioning
from such a subagent. This procedure uses file, Git and shell tools, not BMAD.
Never invoke Build to bootstrap Build. Em dashes are banned from output.

## 1. Identify the source and authority

Read the assignment's exact parent session ID and absolute checkout path,
child task, relevant document/spec paths, allowed copy destinations and output
ownership. On resume, read the checkout's `.bmad-local/provisioning.md` if present.
Preserve inherited HOME, USERPROFILE and COPILOT_HOME.

Check the current checkout first. If it is already provisioned, validate it and
preserve its existing work. Do not refresh it merely because the parent changed.
Otherwise prefer the explicitly identified parent session checkout. A primary
checkout is a fallback only if explicitly supplied and authorized, and the parent
is unavailable or lacks the required installation. Record why it was used.
A contradictory version or incomplete parent is a repair decision, not permission
to silently select a different source.

Use Git's canonical common-directory identity to verify local source and child
belong to the same repository. Git worktree listings establish membership, not
session parentage. Never infer parentage from filesystem nesting, branch names
or the first worktree returned. If no parent or approved fallback was supplied,
ask for the source rather than scanning unrelated worktrees or the home folder.
Remote hosts need an explicitly approved transfer of the same selected payload,
not an assumed accessible local path.

Obtain approval for exact reads, child writes, output destinations and private
exclusions unless the assignment already grants it. BMAD workflow approval does
not permit overwriting existing child files.

## 2. Copy the selected BMAD payload

Inventory the source's actual manifest, runtime, configuration, integration
entries and required task documents. For a known installation, copy:

- The complete `_bmad` runtime, including installed modules, scripts, manifests
  and customizations. Omit render snapshots, caches, bytecode, locks and logs.
- Complete BMAD-owned skill and persona directories required by the selected
  host and installed workflow, including review/handoff dependencies. Keep their
  normal supported relative locations. Do not copy entire shared `.agents`,
  `.github` or `.claude` directories, host settings, credentials or plugins.
  Shared personal skills can be used in place if actually visible to the child.
- Explicitly selected planning, architecture, context, spec and task documents,
  plus their referenced companions needed by the assignment.

Copy files, never junctions or symlinks to mutable parent state. Reject source
links and destination links/reparse points in copied paths and their ancestors.
Do not copy `.git`, application code, virtual environments, another session's
continuation, in-flight locks, or rendered snapshots as BMAD provisioning.

Verify the source is stable while copying: compare the selected file inventory
and content hashes before and after the copy, and verify destination hashes.
If source content changes, stop and reconcile. An identical existing file can
be reused. A differing existing file, partial installation or unknown ownership
requires explicit reconciliation before any write to that path. Do not merge
versions, overwrite child progress or delete partial effects automatically.

Copied documents are task inputs, not evidence that the child's work is done.
An active parent spec must not be concurrently advanced by both sessions.
The assignment must transfer exclusive ownership of that work unit or choose
a separate child unit through the installed BMAD contract before execution.
Do not rewrite copied spec status to manufacture a new workflow state.

## 3. Bind writable paths to this child

Inspect the source's resolved destinations before copying task artifacts.
Preserve the relative document layout or explicitly record old/new paths and
check references and companions. Absolute references can remain only for
approved read-only inputs. Unresolved parent paths block delivery.

Set supported user overrides so the child writes only to its own checkout or
an explicitly approved distinct external directory. For BMAD 6.12.1 use
`_bmad/custom/config.user.toml` and the four destination keys documented in
`promptlings-bmad-setup`. A straightforward local choice is
`{project-root}/_bmad-output` with separate planning, implementation and knowledge
subdirectories. Never edit generated base config or broadly replace path strings.
Record intentional override differences separately from copied-file hashes.

Resolve the effective configuration for the actual selected entry, including
skill-specific customizations and review/deferred outputs. No child-writable
destination may equal, contain, or be contained by a parent/sibling writable
destination. A shared writable sprint/deferred file requires a single assigned
owner, not concurrent updates. Do not run any workflow until collisions are
resolved. Never synchronize child documents back over the parent wholesale.

## 4. Verify before work starts

Use approved private info/exclude entries for actual personal BMAD paths and
`.bmad-local`, not the project's committed .gitignore. Check tracked paths first:
do not hide team deliverables. Preserve existing rules and verify with
`git check-ignore -v --no-index` and final status.

Verify the installed version, required scripts and complete integration files.
Run the installed non-mutating configuration/Help probe from the child root.
Use a dependency-isolated invocation or an existing interpreter for Python
readiness probes. Do not let `uv run` synchronize the application's dependencies
just to check BMAD. Stop if the probe fails or configuration still targets another
checkout. Reload the child host's skill catalog if copied entries were not present
at session start. If reload is unavailable, restart before native invocation,
not a global toggle or a private source-map workaround.

Write `.bmad-local/provisioning.md` with source session/checkout, fallback reason
if any, version, selected payload and hash results, input path mapping, approved
override changes, effective child destinations, and the successful readiness
probe. Preserve existing provenance on resume. Partial effects are reported,
not a success record.

Only then begin the assigned workflow through its normal installed entry and
original launcher contract. For a generic coding child under a BMAD-owning
parent, follow the installed handoff and spec instead of invoking a second Build.
No usable source means explicit setup through `promptlings-bmad-setup`, not
silent ordinary-tool substitution or an invented runtime.
