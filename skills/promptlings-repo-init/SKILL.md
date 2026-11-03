---
name: promptlings-repo-init
description: 'Initialize the bound delivery method (BMAD or Spec-Kit) in the current Git working copy. Use when a repository is bound through promptlings.method and the working copy lacks the framework, for example in a new clone or linked worktree.'
---

# Repository Initialization

Em dashes are banned from all output. Use commas, colons, periods, or parentheses instead.

Framework machinery is local and ignored, so a new clone or linked worktree starts without it. This skill adds it to one working copy. It installs no software. The promptlings machine installer owns tool installation and runs once per machine.

## When to run

Run it when the repository is bound and the marker for the bound method is absent from the working copy root:

| `promptlings.method` | Marker |
| --- | --- |
| `bmad` | `_bmad/config.toml` |
| `speckit` | `.specify/integration.json` |

An unbound repository needs the user's method choice first. Binding stays a user decision.

## Run

Run the script from this skill's directory with the working copy root as the current directory. Do not copy or rewrite it.

```powershell
powershell -ExecutionPolicy Bypass -File <skill-directory>\scripts\init.ps1
```

```bash
bash <skill-directory>/scripts/init.sh
```

The script reads `promptlings.method`, then:

1. Verifies the root and refuses malformed promptlings blocks in Git's shared `info/exclude`.
2. Checks the installed framework CLI against the promptlings pin.
3. Writes the exclusion blocks before any framework file exists. Linked worktrees share these rules.
4. Installs the framework into the working copy when its directory is absent. Existing installations are not upgraded.
5. Confirms the required files and that no framework file appears as untracked.

Rerunning it is safe. Pass `-SharedFrameworks` or `--shared-frameworks` only when the user explicitly chose to version framework content. `-Integration claude` or `--integration claude` selects Claude for Spec-Kit.

## Failures

Report the script's exact error and stop the workflow that needed the framework. Never hand-create framework files, install or upgrade tools, edit `info/exclude` by hand, or force-add ignored files. A missing or mismatched CLI points to the machine installer. An exclusion conflict needs the user.
