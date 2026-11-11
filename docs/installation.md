# Installation

## Choose what to install

Run `npx promptlings` as shown in the [README](../README.md#install). Node.js
22.20 or later is the only prerequisite. The default installation includes all
nine agents, bundled Promptlings skills, and the supporting toolchain.

| Command | Effect |
| --- | --- |
| `npx promptlings` | Same as `install`: tools, then agents and skills, then Basic Memory |
| `npx promptlings publish` | Agents and bundled skills only. Needs nothing beyond Node.js |
| `npx promptlings memory` | Basic Memory, its skills, MCP registration, and login startup |
| `npx promptlings tools` | System packages, applications, and external skills |

Agent selection and component selection are separate: `--review` selects three
agents but `install` still installs the default tools.

The installer prints its plan and asks for approval. Add `--yes` for an
approved noninteractive run. Help, listing, and dry-run perform no downloads
or writes.

### Releasing to npm

Merge product changes into `main`, then select **Actions > Publish > Run workflow**
with branch **main**, or run `gh workflow run publish.yml --ref main`.
The default release type is `alpha`. Select `beta`, `patch`, `minor` or `major`
in the form, or pass `-f release_type=minor` to the command.
No explicit version, local publish command, version-bump commit, or follow-up merge
is needed. The workflow rejects other branches and tags before running tests
or granting the publishing job write permissions. Pushing a tag does not trigger
publication.

The Git tag records the released version and points to the exact selected main
commit. [The Bash release script](../.github/scripts/release.sh) uses npm's pinned
SemVer library to select a version above every existing release tag, npm version,
and the source manifest's baseline. Invalid versions and release types fail.
It stamps that version into `package.json` and `npm-shrinkwrap.json` only in its
temporary checkout. The source manifest identifies the development baseline,
not the latest published version. npm's `latest` tag identifies the installed release.

| Current highest version | Selected type | Next version |
| --- | --- | --- |
| `0.1.0-alpha.5` | `alpha` (default) | `0.1.0-alpha.6` |
| `0.1.0-alpha.5` | `beta` | `0.1.0-beta.0` |
| `0.1.0-beta.2` | `beta` | `0.1.0-beta.3` |
| `0.1.0-beta.2` | `alpha` | `0.1.1-alpha.0` |
| `0.1.0` | `alpha` | `0.1.1-alpha.0` |
| `0.1.0` | `patch` | `0.1.1` |
| `0.1.0` | `minor` | `0.2.0` |
| `0.1.0` | `major` | `1.0.0` |

Stable increments follow npm's SemVer rules, including finalizing an existing
prerelease: `minor` from `0.1.0-beta.2` produces `0.1.0`.
Returning to an earlier prerelease channel advances the patch first so version
precedence always increases. Every release type is published as `latest`.

The workflow tests the stamped package on Windows, macOS and Linux, reserves
its version tag, and publishes with provenance and `--tag latest` through npm
trusted publishing. New reservations require the selected SHA to equal the
current main tip, checked during preparation and again before reserving the tag.
If main advances before reservation, start a new run from main. The pipeline
does not silently switch to source that the test jobs did not check.

Release runs are serialized through verification and never cancel an active
publication. `queue: max` retains up to 100 pending runs instead of replacing the
waiting run when another is dispatched. GitHub cancels further runs when that
queue is full. A queued run still has to pass the source-freshness check.
The token writes tags, not commits to protected main.

A rerun or another dispatch for the same commit and release type reuses its
reserved version. The annotated tag records the selected release type.
An existing reservation can resume after main advances, while its source remains
on main and no newer version has superseded it.
If npm already has it, CI compares archive integrity and skips publishing only
when the bytes match. It refuses conflicting packages and releases superseded
by a newer reserved or published version. A failed publish leaves its tag
reserved for recovery. Rerun that workflow rather than deleting or moving the tag.

Registry verification is a separate job. It retries stale metadata and transient
read failures up to 30 times, ten seconds apart. Each metadata fetch has a
30-second request timeout and at most three transport retries within 120 seconds.
Rerun failed jobs after a verification failure without publishing again.
Verification reads back `latest`, downloads the exact package from npm, checks
its archive hashes, and retains the tarball plus registry/package metadata in
a `promptlings-release-<RUN_ID>` workflow artifact for 14 days. That downloaded
tarball supports local installation when direct npm access is unavailable.
Dependencies still use the configured registry.

### Supported systems

| System | Package manager |
| --- | --- |
| Windows | WinGet, supplied by Microsoft's [App Installer](https://aka.ms/getwinget) |
| macOS | Homebrew, installed through its official installer if missing |
| Ubuntu 24.04+ or Debian 12+, x86_64 | APT |

Run the installer as your normal user. Native package installation can request
elevation, and global npm applications use `sudo` only when the global npm
prefix is not writable. The Linux browser recipe installs Google's Chrome
package and its system libraries through APT, so that recipe requires x86_64.
Linux also uses Astral's uv installer.

In Windows PowerShell, invoke npm tools through their `.cmd` entrypoints, such
as `npx.cmd`, `playwright-cli.cmd`, and `hyperframes.cmd`, when script
execution is restricted.

### Default components

| Component | What the installer provides |
| --- | --- |
| Python, uv, Git, and GitHub CLI | Native packages, requiring Python 3.11+ |
| Basic Memory | uv tool, published memory skills, MCP registration, and user-login startup |
| Playwright | Global npm application, published skill, and Chrome browser |
| HyperFrames | Global npm application, published skills, rendering browser, FFmpeg, and FFprobe |
| Technical Demo | Pinned upstream Motionite skill and Markdown production/writing/capture guidance. A reusable user-local runtime includes Remotion 4.0.539 (CLI, Player, bundler, renderer and media), React, TypeScript and matching Chrome Headless Shell |
| Demo capture | VS Code when missing, pinned Demo Time extension and skills, vscode-playwright skill, document-rendering tools, and diff2html CLI |
| Interactive Presentation | When the agent is selected: Playwright CLI with its browser and skill, the frontend-design and HyperFrames skills, and the pinned experience toolkit (esbuild, Shiki, Magic Move, Flubber, Rough.js, D3, dagre, Lucide, Tabler Icons, Fontsource fonts and axe-core) as global npm packages. These install regardless of opt-outs. Under `npx promptlings publish`, the default selection leaves the agent out, and naming it with `--agents` fails |

Document rendering uses Microsoft Word or LibreOffice. LibreOffice is installed
only when neither is found. On Windows, its program directory is added to the
user PATH. Poppler supplies PDF rendering.

Python applications use standard uv tool locations. Node applications use the
configured global npm location. Application versions and upstream skill
revisions are pinned in [`lib/pins.js`](../lib/pins.js). The publishers are
pinned package dependencies.

### Installer options

| Option | Effect |
| --- | --- |
| `--all` | Select all nine agents, the default |
| `--review` | Select the three ensemble agents: the-nitcracker, PR Walkthrough, and Sparring Partner |
| `--agents a,b` | Select agents by name |
| `--no-system-packages` | Use existing Python, Git, gh, FFmpeg, and uv, but still install selected applications and skills |
| `--no-memory` | Skip Basic Memory, its skills, MCP, startup, and read-side instruction |
| `--no-startup` | Register client-launched stdio MCP instead of login startup |
| `--memory-port 8123` | Use a different Basic Memory port |
| `--no-playwright` | Skip Playwright CLI, its browser, and skill. Linux Chrome is still required by HyperFrames |
| `--no-hyperframes` | Skip HyperFrames, media binaries, and skills |
| `--no-demo` | Skip VS Code, Demo Time, vscode-playwright, Motionite, the Remotion runtime and Headless Shell, LibreOffice, Poppler, and diff2html |
| `--no-skills` | Skip external published skills, not bundled Promptlings skills |
| `--no-readside` | Skip the global memory read-side rule |
| `--list` | List agent names and exit |
| `--dry-run` | Print the plan without downloading or writing |
| `--yes`, `-y` | Approve the printed installation plan without a prompt |
| `--version`, `--help` | Show the version or usage |

Bundled skills are published with any agent selection, including their scripts
and references. New agents and skills in the package are discovered
automatically. The memory capture companion is included when Memory Manager
is selected and memory is enabled. Sparring Partner's four core review methods
(`technical-investigation`, `design-analysis`, `test-analysis`, and
`evidence-verification`) are included. The default ensemble does not require
the host's built-in rubber-duck. The shared `intent-alignment` skill is also
included and required in every ensemble. Standalone reviews select it when
requested or needed for purpose or scope reconciliation. Ensemble readiness
checks all required methods before dispatch; installing the skill does not
add another reviewer.

Technical Demo uses Motionite/Remotion by default and HyperFrames when explicitly
selected. `install` and `tools` fetch Motionite from the revision pinned in
[`lib/pins.js`](../lib/pins.js), with the other external demo skills. `--no-demo`
or `--no-skills` skips it. `publish` supplies only our agent and
[production support](../skills/technical-demo-production/SKILL.md), so it assumes
the upstream toolchain is already installed. No Motionite checkout is bundled in
this package.

With demo tools enabled, installation also prepares
`~/.promptlings/runtimes/remotion-4.0.539` under the user's home directory on every
OS. Exact package pins live in [`lib/pins.js`](../lib/pins.js).
Matching packages and the browser cache are reused on subsequent installs.
Remotion's own CLI prepares Headless Shell with `browser ensure`. `--no-demo`
skips both packages and browser, while `--no-skills` only skips upstream skills.
CUDA and GPU drivers are never installed.

The producing agent uses upstream CLI/configuration or public APIs from its external
workspace. The production skill explains explicit package/browser resolution,
version matching, measured rendering defaults, reuse, cancellation and output
inspection. It does not ship a custom renderer, job format or process supervisor.
Additional project dependencies, captures, bundles and generated media stay outside
the managed runtime, repository and installed skills. Runtime and asset licenses
remain separate.

Experiment Director and its `ab-testing` routing and `comparative-evaluation`
method skills are discovered through the same publication path. To select only
that agent, use `npx promptlings publish --agents experiment-director --no-readside`.
This publishes instructions, including the method's protocol template and
research references, plus `reasoning-first-writing` for proposals and results
explanations by the director and caller.
Selective agent installs still publish bundled skills, so a caller using
`ab-testing` must check that Experiment Director is actually available before
delegating.

Opt-outs skip installation. They do not uninstall tools, stop existing services,
or remove earlier registrations. Failed commands stop installation, and earlier
successful package installations remain available for retry.

### Install from source

`npx promptlings` resolves through your configured npm registry, including
corporate mirrors of the public registry. When the package is not yet available
there, run it directly from GitHub. Both source routes need Git, and behind a
proxy both Git (`http.proxy`) and npm (`proxy`, `https-proxy`) must be set:

```bash
npx github:dfinson/promptlings
```

Or from a clone, which also works for local changes:

```bash
git clone https://github.com/dfinson/promptlings
cd promptlings
npm install
node bin/promptlings.js
```

The published package ships `npm-shrinkwrap.json`, so `npx promptlings` installs
the exact dependency versions that CI tested. A source install uses the same
lockfile through `npm install`.

Both forms take the same commands and options.

## Where files go

| Content | Publisher | Targets |
| --- | --- | --- |
| Agents | [`rulesync`](https://github.com/dyoshikawa/rulesync) subagents | Every harness with global subagent support |
| Bundled skills | `rulesync` skills | Every harness with global skill support |
| External skills | [`skills`](https://github.com/vercel-labs/skills) | Every harness it supports |
| Memory read-side rule | `rulesync` rules | Harnesses with dedicated global rule files |
| Basic Memory MCP | [`add-mcp`](https://github.com/neon-solutions/add-mcp) | Detected harnesses |

Agent and skill publication includes harnesses that are not installed, so
unused harness directories can appear in your home directory. Paths follow
each publisher's defaults. `add-mcp` does not honor `CLAUDE_CONFIG_DIR`.
Stdio-only clients such as Claude Desktop connect through
[`mcp-remote`](https://github.com/geelen/mcp-remote).

## Basic Memory setup

Basic Memory binds to `127.0.0.1`, using port 8000 by default. Windows uses a
limited, current-user Scheduled Task, macOS a LaunchAgent, and Linux a systemd
user service. Windows uses the installed Basic Memory environment's `pythonw.exe`
for both the task action and the server, loading the installed `basic-memory`
console entry point without its console-executable shim. Neither process
allocates a console. The child also uses `CREATE_NO_WINDOW`. The other platforms
start the command directly. Linux startup
requires an active systemd user session. The installer checks the MCP
initialization response before reporting success.

The startup definitions use scheduling appropriate for a service answering
interactive requests:

| System | Scheduling policy |
| --- | --- |
| Windows | Task Scheduler priority `4`, which starts the process with Normal CPU, memory, and I/O priorities rather than the background default of `7` |
| macOS | launchd `ProcessType=Interactive`, avoiding the CPU and I/O throttling applied when the type is omitted |
| Linux | systemd `Nice=0`, `CPUSchedulingPolicy=other`, `IOSchedulingClass=best-effort`, and `IOSchedulingPriority=4`, explicitly selecting normal CPU and I/O scheduling |

On Windows, background CPU, memory, and I/O priorities caused reproducible MCP
discovery stalls under paging pressure. Priority `5` restores Normal CPU priority
but still lowers memory priority, so the task uses `4`. macOS has a separate
default-throttling mechanism. `Adaptive` is unsuitable for this HTTP service because its activity
boost depends on XPC transactions. Linux already defaults to normal scheduling.
Its explicit settings preserve that policy.

See the platform references for [Windows task priority][task-priority],
[launchd process types][launchd-process-type], and
[systemd execution scheduling][systemd-scheduling].

For an existing installation, rerun the installer with your usual selections to
regenerate and restart its managed startup service. The new scheduling takes
effect when the service starts, not when this repository is updated. This does
not change the client-launched stdio mode selected by `--no-startup`.

The Windows task retains `IgnoreNew` instance handling and an unlimited execution
time. Native task-launch failure retries are configured for three attempts,
one minute apart. A nonzero process exit does not reliably trigger those retries:
on the tested Windows host, the scheduler recorded the exit code but did not
restart the action.

The existing windowless action therefore waits for each server exit and retries
a failed server up to three times, one minute apart. A successful exit stops
immediately. After four total attempts it logs budget exhaustion and exits with
the final failure code. This is a finite child-exit loop, not a watchdog or
health-polling service. The task remains Running during a retry wait.
The native and child budgets are separate: if Windows restarts the action,
that invocation receives its own four-attempt child budget. Neither is unlimited.

The former `conhost --headless` action returned success when its child failed,
preventing Task Scheduler from detecting that exit code. The windowless action
appends timestamped startup and exit records, retry decisions, stdout, and stderr to
`%USERPROFILE%\.basic-memory\mcp.log`. Basic Memory also retains its own
`basic-memory-<pid>.log` files. An externally terminated wrapper cannot write a
final exit record. Inspect the task's Last Run Result for that case.

Once a release includes this repair, run
`npx promptlings@latest memory --no-skills --yes` to apply it to an existing
installation. From a source checkout with dependencies installed, use
`node .\bin\promptlings.js memory --no-skills --yes` on Windows.
Include your usual `--memory-port` if different. Both use the same stop, install,
replace-task, start, and MCP readiness sequence. The stop step captures the
managed environment's process trees before stopping the task, then terminates
those captured processes without opening command windows. It replaces the fixed
`Promptlings Basic Memory` task rather than adding a second task and leaves
project data intact. Updating the package or repository alone does not update
the registered task. No separate updater is required.

For recovery, start the existing task with
`Start-ScheduledTask -TaskName 'Promptlings Basic Memory'` instead of launching
a detached server. Check server health with a fresh MCP initialization request.
If that succeeds while an assistant retains an initialization error, reconnect
that client. Multiple MCP registrations pointing at the endpoint do not by
themselves establish a server failure or require removal.

### Windows lifecycle acceptance

The focused Windows wrapper test requires `pythonw.exe` rather than silently
skipping. CI supplies Python 3.12. To exercise the installed Basic Memory
environment locally, set `PROMPTLINGS_TEST_PYTHONW` to its
`Scripts\pythonw.exe` and run:

```powershell
node --test --test-name-pattern='Windows|memory installs' tests\installer.test.js
```

For real scheduled-task acceptance, also set
`PROMPTLINGS_MEMORY_ACCEPTANCE_DIR` to an absolute disposable artifact directory
outside the repository, then run:

```powershell
node --test tests\windows-memory-lifecycle.test.js
```

This opt-in test takes several minutes. It uses an isolated interpreter,
configuration, project directory, task name, and loopback port. Installed packages
are reused read-only. It checks real MCP initialization, stop-and-replace,
child termination and recovery, the real one-minute retry delays, finite
exhaustion, and zero console handles in launcher and server processes.
It preserves the shared task, listener and configuration, and removes its
temporary task, processes and data in its finalizer. It never runs the shared
installer or upgrades packages.

[task-priority]: https://learn.microsoft.com/en-us/windows/win32/taskschd/tasksettings-priority
[launchd-process-type]: https://keith.github.io/xcode-man-pages/launchd.plist.5.html#ProcessType
[systemd-scheduling]: https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#Scheduling

`add-mcp` replaces only the `basic-memory` entry in detected harness
configurations. An unrelated listener on the selected port stops installation.
Use `--memory-port` to choose another port.

With Memory Manager selected and memory enabled, the installer also publishes a
read-side rule that tells future sessions to retrieve relevant context and save
decisions and outcomes. **This applies to future sessions across repositories.**
Use `--no-readside` to omit it, including with the `publish` command.

The rule lives in a dedicated `promptlings-memory` file per supported harness,
such as `~/.copilot/instructions/promptlings-memory.instructions.md` or
`~/.claude/rules/promptlings-memory.md`. Existing instruction files are not edited.

The installer does not create repository/domain projects or routing mappings.
Ask Memory Manager to set up routing after installation. It matches repositories
by canonical remote identity across branches and worktrees. New projects, stable
storage locations, and global configuration changes require approval. Keep
approved routing in your user or repository instructions, outside generated
rule files, with explicit project IDs and an approved host key.

Session capture needs the relevant conversation or an accessible source.
Automatic end-of-session capture requires a supported, configured, verified
host hook.

Captures retain the available, authorized, non-sensitive conversation and quoted
evidence in Basic Memory source records. Selective checkpoints and topical notes
link to stable source ranges, preserving conditions, exceptions, correction history,
and evidence status. Source records are verified before their derived notes are
published, so a later failure leaves the evidence available for retry. Incremental
saves reuse verified ranges. Missing or compacted content and redactions are recorded
explicitly. This does not authorize copying unrelated files or private instructions.
Attachments and generated files are indexed by purpose, location, and availability,
regardless of size, rather than embedding their payloads in memory notes. This also
applies to text files and files opened by a tool. Excerpts quoted in conversation
remain conversational evidence. Captures reuse existing artifact storage and expiry
policy, identify temporary or missing locations, and distinguish reported availability
from checked availability. An index entry does not mean a file's payload was retained.
If important material needs longer retention, the agent surfaces that need without
moving files or changing retention policy.
On recall, consequential claims are checked against the relevant retained source
and its qualifications rather than treating a search snippet as the complete rule.

Provider accounts, secrets, licensed assets, and narration voice choices remain
separate production inputs.

## Manual installation

Copy an agent's `.agent.md` file to your assistant's agent directory:

| Tool | User-wide | Repository-local |
| --- | --- | --- |
| GitHub Copilot CLI | `~/.copilot/agents/` | `.github/agents/` |
| Claude Code | `~/.claude/agents/` | `.claude/agents/` |

Copy required companion skills as complete directories, including scripts and
references:

| Tool | User-wide | Repository-local |
| --- | --- | --- |
| GitHub Copilot CLI | `~/.copilot/skills/<skill>/` | `.github/skills/<skill>/` |
| Claude Code | `~/.claude/skills/<skill>/` | `.claude/skills/<skill>/` |

Each directory contains `SKILL.md`. The agent definitions identify their
companions. Both `design-writing` and `reasoning-first-narration` also require
`reasoning-first-writing`. Restart your assistant after copying.

For A/B testing, copy `experiment-director.agent.md` and the complete
`ab-testing`, `comparative-evaluation` and `reasoning-first-writing` skill
directories. Include the evaluation method's `references` directory.
The routing skill needs the host's registered
director identity and a separate subagent or child-session capability to
delegate. Manual installation alone does not establish native activation or
end-to-end evaluation behavior.

## Claude Code plugin

The plugin contains only the two review agents:

```text
/plugin marketplace add dfinson/promptlings
/plugin install promptlings-code-review
```

Use `npx promptlings` or manual installation for the other agents and
skills, including `review-ensemble`. See the [plugin guide](../plugins/promptlings-code-review/README.md)
for scoped agent names and runtime behavior.
