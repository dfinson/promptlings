# Opt-in BMAD and Isolated Child Worktrees

BMAD is selected by choosing **BMAD Orchestrator**, not by making an ordinary
engineering request. Its delivery obligations belong only to that orchestrator
and children explicitly assigned BMAD work. Other sessions must not discover
BMAD skills, run BMAD readiness checks or stop because its runtime is absent.
An explicit user decision to work without BMAD takes precedence for that scope.

## Install the orchestrator, not global skills

```powershell
.\install.ps1 -Agents bmad-orchestrator -DryRun
.\install.ps1 -Agents bmad-orchestrator -Yes
```

```bash
bash install.sh --agents bmad-orchestrator --dry-run
bash install.sh --agents bmad-orchestrator --yes
```

Both installers put the selected agent under `<host-root>/agents`, and two
companion procedures under `<host-root>/promptlings/bmad`:

- [setup.md](../agents/orchestration/bmad/setup.md): installation and repair.
- [bootstrap.md](../agents/orchestration/bmad/bootstrap.md): child provisioning.

Copilot's host root is `COPILOT_HOME` or `~/.copilot`. Claude's is `~/.claude`.
Manual installation must include the same resources. The agent reads the
procedures directly. They are not skills and are not installed into discovery.
The installer does not install BMAD itself.

There is no global BMAD startup block or bootstrap flag. Memory Manager's
independently opted-in read-side behavior is unchanged.

## Verify discovery isolation

This setup covers new installations, not migration of existing global files.
At installation acceptance, check an ordinary checkout's actual skill inventory,
not just the filesystem. This is not a per-child readiness check. Native discovery
can also inherit ancestor integrations, so profile environment overrides alone
do not establish isolation. For Copilot:

```text
copilot -C <ordinary-checkout> skill list --json
```

It must have no BMAD skills. This is the acceptance gate for global isolation.
The installer does not register any global BMAD skill directory.

## Prepare a dedicated orchestrator worktree

Use the official BMAD installation only in an isolated worktree owned by the
selected orchestrator. Never install into a shared primary checkout used by
ordinary sessions. Inspect the installed version's options and approve only
checkout-local host integrations. If that version cannot avoid global writes,
stop that setup and report the unsupported configuration.

Copilot supports checkout-local `.github/skills`, `.agents/skills` and
`.claude/skills`. Claude uses `.claude/skills`. Keep original skill contents,
personas and launchers intact. Do not use global custom skill directories,
global plugins, a shared mutable runtime or a global enable/disable cycle.
An ordinary session deliberately opened in a prepared BMAD checkout can see its
local skills, so never reuse that checkout for unrelated sessions.

Verify version, runtime, manifests, integrations and effective configuration.
For personal files, use approved Git `info/exclude` entries rather than changing
team `.gitignore`. Exclusions affect publication, not skill discovery.
Do not hide tracked team deliverables or ignore whole shared directories.

## Provision children before delivery

Each BMAD child needs a dedicated worktree, an explicit assignment from its
orchestrator and separate writable outputs. A branch session sharing the parent
checkout is not isolated.

The [bootstrap procedure](../agents/orchestration/bmad/bootstrap.md) owns payload
copying, output binding and child readiness checks. The orchestrator supplies its
absolute path and prepares the child before delivery. In-process subagents
sharing a prepared checkout follow their installed handoff without bootstrapping
again.

## Resume and historical evidence

Preserve approved continuation locations, active bindings and original artifacts.
The orchestrator records references and assignment ownership, not a duplicate
BMAD status ledger. On resume, read the actual artifacts and reconcile live
children before redispatch. Never copy a child's output folder over parent state.

The provisioning acceptance recorded on 2026-10-29 exercised the earlier native
discovery policy, not the isolation boundary described here. It does not prove
ordinary-session isolation. The [historical setup record](bmad-setup-history.md)
and version-pinned research are historical evidence, not current setup policy.
