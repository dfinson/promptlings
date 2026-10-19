# Personal BMAD setup

The orchestrator supports ordinary project-local BMAD and personal workflows.
Runtime execution stays in the code checkout. Artifact storage, Git ownership,
and skill exposure are separate decisions.

## Install the optional companion

Python 3.11 or newer is required. From a promptlings checkout:

```powershell
python .\scripts\bmad_setup.py --help
```

For use across repositories, copy `scripts/bmad_setup.py` to
`~/.config/promptlings/bmad_setup.py` alongside your installed agent.
Use both files from the same reviewed promptlings revision. The companion has
no third-party Python dependencies. `uv run` can also execute it.
Copying the agent alone remains supported, but deterministic personal setup
requires obtaining this optional companion when requested. The normal agent
installer does not install it or change personal preferences automatically.

The adapter recognizes BMAD 6.12.1. It does not install BMAD, modify generated
skills, or guess compatibility with other releases. The orchestrator uses the
official installer after approval, in the actual delivery checkout, then runs
the helper. Existing global skills are not proof of checkout runtime readiness.

## Preferences and approval

Personal preferences live at `~/.config/promptlings/bmad.toml`. An absolute
`--config` selects an alternate file. Defaults apply to future projects;
project exceptions use a hash of the absolute Git common directory, so linked
worktrees share preferences but independent or relocated clones do not.

Resolution order: explicit command options, personal project exception,
personal defaults, then `artifacts=project` and `exclusions=project`.
No absent setting installs BMAD or changes Git policy.

Every mutating command first prints a JSON preview with an `approval` token.
After approving those exact effects, repeat the command with
`--approve <token>`. Changed inputs invalidate the token. Do not treat the token
as authorization by itself: the user must approve the preview. Files are checked
again before writes, and cooperating operations use an exclusive lease.
Interrupted operations may leave a `.lock` file. Inspect the owning process and
affected files before separately approving removal of a stale lease.

For example, preview personal defaults:

```powershell
python .\scripts\bmad_setup.py configure --scope defaults --set artifacts=central --set exclusions=local --set "central_root=C:\personal\bmad-workspace"
```

After approval, repeat with the printed token. Preview a project exception:

```powershell
python .\scripts\bmad_setup.py configure --scope project --project C:\work\project-a --set planning=project
```

`--unset planning` removes that exception and resumes inheritance. Supported keys:

| Key | Values |
| --- | --- |
| `artifacts` | `project` or `central` |
| `planning`, `implementation`, `knowledge` | Optional per-category `project` or `central` |
| `central_root` | Absolute external workspace path |
| `exclusions` | `project`, `local`, or `global` |

`project` means inherit the existing BMAD setting, not force a new local path.
Review team-owned paths before redirecting them. Existing conflicting personal
values are rejected rather than overwritten.

## Bind and resume

```powershell
python .\scripts\bmad_setup.py status --project C:\work\project-a --run session-123
python .\scripts\bmad_setup.py bind --project C:\work\project-a --run session-123
```

`status` is read-only. `bind` requires its preview token to write anything.
Central storage requires an explicit unique run/session identifier and produces:

```text
<central_root>\projects\<project-id>\checkouts\<checkout-id>\runs\<run-id>\
    planning\
    implementation\
    knowledge\
```

When `artifacts=central`, `core.output_folder` also points to that run directory,
so default spec output lands there. Category exceptions leave the relevant
installed setting unchanged. The helper does not create or commit an artifact
repository, create output directories, run a workflow, or grant host access to
external paths. The invoked skills create their outputs when needed.

The binding adds a labeled block to `_bmad/custom/config.user.toml`, preserving
unrelated settings and comments, plus its own `promptlings-binding.json` record.
Snapshots remain checkout-local. Validate the installed config resolver before
delivery. Per-skill output overrides can supersede central settings, so inspect
the selected workflow's effective output settings too.

Checkout namespacing prevents two linked worktrees from sharing artifact state
even when they are accidentally given the same run ID. Concurrent agents inside
one checkout must still use different run IDs and cannot rebind an active checkout.

Resume uses the original run ID. Changing a binding requires explicit
retirement first:

```powershell
python .\scripts\bmad_setup.py unbind --project C:\work\project-a
```

Approve its preview only after inspecting active work and recording old paths.
It removes the helper's overrides and record, not existing artifacts or ignore
rules. Then configure new preferences and bind again. Artifact migration and
exclusion removal are separate approved operations. This prevents accidental
history loss or changing another linked worktree's shared exclusions.

Each new worktree needs official installation and binding. Do not copy or link
another checkout's runtime. The helper's layout checks are not a substitute for
the installer's full readiness checks.

## Git ownership

| Exclusion choice | Behavior |
| --- | --- |
| `project` | No ignore changes. Use the team's normal Git process |
| `local` | Append a labeled block in Git's `info/exclude`, shared by linked worktrees |
| `global` | Extend an already configured `core.excludesFile`, affecting all repositories |

The helper refuses to hide already-tracked BMAD paths. Global mode does not
replace or automatically configure `core.excludesFile`. It preserves existing
rules. Both personal modes cover only `_bmad` and BMAD-prefixed integration
entries, not entire `.github` or `.agents` directories.

Output destinations outside the runtime are not implicitly ignored. When
artifacts remain in the code checkout, decide their ownership explicitly.
Ignoring `_bmad` also ignores customizations inside it. Preserve valuable
personal configuration in its designated repository, not just an ignored copy.
Personal artifacts and production code need separate commits and separate
publication decisions. An ignore rule cannot strip files from existing commits.

## Prevent unwanted activation

The orchestrator's opt-in rule cannot govern another assistant that discovers
globally advertised BMAD skills. Enforce the boundary in the actual host.

| Host | Supported boundary |
| --- | --- |
| Copilot CLI with native controls | Inspect `copilot skill list --json`, then approve `copilot skill disable <name>` for each inventoried BMAD skill. Changes persist for future sessions |
| Copilot app with session controls | Keep ordinary sessions disabled and selectively enable BMAD in the explicitly chosen session |
| Filesystem-based discovery | Reversibly isolate exact inventoried skill directories outside discovery, with approval |
| Other or plugin-only source | Require a documented host control. Otherwise activation protection is unsupported |

CLI re-enabling is persistent, not project-local or session-local. Do not enable
it silently or call it isolated from other users of that configuration. Restart
or refresh the host as required, and verify its effective catalog before claiming
protection. Already running sessions can retain old skill descriptions.

Filesystem fallback, preview first:

```powershell
python .\scripts\bmad_setup.py skills isolate --skill-root C:\Users\example\.agents\skills --inventory C:\work\project-a\_bmad\_config\skill-manifest.csv
python .\scripts\bmad_setup.py skills restore --skill-root C:\Users\example\.agents\skills
```

Both need preview approval tokens to mutate. The fallback supports `bmad-*`
manifest entries only, preserves unrelated skills, rejects linked content,
and refuses restore collisions or modified isolated content. It isolates one
explicit discovery root, not all project, ancestor, added-directory, or plugin
sources. Scan all actual host sources. Do not move plugin internals. If any source
cannot be disabled, report the boundary as unverified or unsupported.

Installers and updates can recreate exposed skills. Recheck exposure afterward.
Do not patch generated skill descriptions: updates overwrite them and workflow
hooks execute too late to prevent selection.

## Validation

Run the helper's disposable CLI and Git integration tests:

```powershell
python -B -m unittest discover -s tests -p "test_bmad*.py" -v
```

The tests use temporary code and personal repositories, actual helper commands,
and filesystem-only Git pushes. They never modify your home preferences or
real skill installation. Native Copilot controls can be exercised separately
with `PROMPTLINGS_TEST_COPILOT=1`, using an isolated `COPILOT_HOME` and synthetic
skills. These checks do not substitute for an actual agent-driven BMAD delivery.

`PROMPTLINGS_TEST_DELIVERY=1` enables a separate real delivery check. It invokes
the official pinned installer in a disposable checkout and an authenticated
Copilot session running `bmad-build-auto`, then checks actual behavior, tests,
external terminal artifacts, and the code repository's tracked files. It requires
network access and consumes AI credits. It does not run in default CI.
