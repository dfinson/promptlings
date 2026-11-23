# Installation

## Choose what to install

Run `npx promptlings` as shown in the [README](../README.md#install). Node.js
22.20 or later is the only prerequisite. The default installation includes all
ten agents, bundled Promptlings skills, and the supporting toolchain.

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
| Basic Memory | Pinned SQLite uv tool, MCP-only memory skills, shared write proxy, MCP registration, and user-login startup |
| Playwright | Global npm application, published skill, and Chrome browser |
| HyperFrames | Global npm application, published skills, rendering browser, FFmpeg, and FFprobe |
| Technical Demo | Pinned upstream motion-art-direction and animation-principles skills (HyperFrames skills come from the HyperFrames row) and Markdown production/writing/capture guidance. A reusable user-local runtime for the opt-in Remotion route includes Remotion 4.0.539 (CLI, Player, bundler, renderer and media), React, TypeScript and matching Chrome Headless Shell |
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
| `--all` | Select all ten agents, the default |
| `--review` | Select the three ensemble agents: the-nitcracker, PR Walkthrough, and Sparring Partner |
| `--agents a,b` | Select agents by name |
| `--no-system-packages` | Use existing Python, Git, gh, FFmpeg, and uv, but still install selected applications and skills |
| `--no-memory` | Skip Basic Memory, its skills, MCP, startup, and read-side instruction |
| `--no-startup` | Rejected when installing memory: client-launched servers bypass the shared queue. Use `--no-memory` to omit the service |
| `--memory-port 8123` | Use a different Basic Memory backend port |
| `--memory-proxy-port 8124` | Use a different client-facing proxy port (default: backend port + 1) |
| `--no-playwright` | Skip Playwright CLI, its browser, and skill. Linux Chrome is still required by HyperFrames |
| `--no-hyperframes` | Skip HyperFrames, media binaries, and skills |
| `--no-demo` | Skip VS Code, Demo Time, vscode-playwright, motion-art-direction, animation-principles, the Remotion runtime and Headless Shell, LibreOffice, Poppler, and diff2html |
| `--no-skills` | Skip external published skills, not bundled Promptlings skills |
| `--no-readside` | Skip the global memory read-side rule |
| `--no-dashboard` | Skip Foreman's dashboard, its bridge extension, and its settings file |
| `--list` | List agent names and exit |
| `--dry-run` | Print the plan without downloading or writing |
| `--yes`, `-y` | Approve the printed installation plan without a prompt |
| `--version`, `--help` | Show the version or usage |

Bundled skills are published with any agent selection, including their scripts
and references. New agents and skills in the package are discovered
automatically. The memory capture companion is included when Memory Manager
is selected and memory is enabled. Sparring Partner's four core review methods
(`technical-investigation`, `design-analysis`, `test-analysis`, and
`evidence-verification`) are included, along with `static-signals` and the shared
`design-forks-and-bets` skill that Sparring Partner, Nitcracker, and PR Walkthrough
load. The default ensemble does not require
the host's built-in rubber-duck. The shared `intent-alignment` skill is also
included; Sparring Partner applies it in every review, and every ensemble
requires it. Ensemble readiness
checks all required methods before dispatch; installing the skill does not
add another reviewer.

Technical Demo uses HyperFrames by default and Remotion only when explicitly
selected. HyperFrames skills are fetched unless `--no-hyperframes` or `--no-skills` is given; Interactive Presentation installs them regardless.
`install` and `tools` fetch the other external demo skills from the revisions pinned in
[`lib/pins.js`](../lib/pins.js), including
[motion-art-direction and animation-principles](https://github.com/iart-ai/motion-design-skills)
for motion direction, timing and review vocabulary. `--no-demo` or `--no-skills` skips them. `publish` supplies only our agent and
[production support](../skills/technical-demo-production/SKILL.md), so it assumes
the upstream toolchain is already installed. No upstream skill checkout is bundled in
this package.

With demo tools enabled, installation also prepares the opt-in Remotion runtime at
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

The bundled [technical-illustration](../skills/technical-illustration/SKILL.md)
skill reuses available diagram, browser and selected media tooling for early
design stills and explanatory figures. Publication distributes its instructions
and references automatically, not another renderer or service.
Its `frontend-design` guidance is optional for selective Spec Master or
Technical Demo installs: bundled composition guidance and an existing design
system remain available. Interactive Presentation retains its stricter
installer-managed design-tool requirements.

Standalone HTML specifications and media approval briefings use the
[document guidance](../skills/design-writing/references/html-specifications.md).
Established component libraries are selected and version-pinned in the
producing agent's authorized external workspace, with their styles and notices
embedded in the reading copy. They are not added as global installer
dependencies, and readers need no package installation or network connection.
Existing managed-toolchain failure procedures still apply.

Experiment Director and its `ab-testing` routing and `comparative-evaluation`
method skills are discovered through the same publication path. To select only
that agent, use `npx promptlings publish --agents experiment-director --no-readside`.
This publishes instructions, including the method's protocol template and
research references, plus `reasoning-first-writing` for proposals and results
explanations by the director and caller.
Selective agent installs still publish bundled skills, so a caller using
`ab-testing` must check that Experiment Director is actually available before
delegating.

Foreman dispatches to Spec Master and Sparring Partner and saves through Memory
Manager, so install those agents with memory enabled alongside it. With
`--agents foreman` alone, Foreman returns kickoff prompts for lanes whose
agents are missing and reports that nothing was saved. Its ensemble review lanes
also need the-nitcracker and PR Walkthrough; without them, Foreman uses
Sparring Partner.

Start Foreman by selecting it as the session's agent, for example
`copilot --agent foreman`. It is not meant to run as a subagent or child
agent. Copilot hosts block subagent use through `disable-model-invocation`,
and OpenCode, MiMo Code and Kilo publish it as a primary agent. Firebender,
Vibe and xum publish it as a non-delegable agent. Other hosts have no such
switch, so Foreman's instructions tell it to refuse when another agent invokes
it.

When Foreman is selected, `install` and `publish` also install its dashboard
unless `--no-dashboard` is given. The dashboard is a localhost page that shows,
for every repository Foreman briefs, its lanes, pull requests, checks, work
items, services, and worktrees, from a status file Foreman keeps current. The
installer copies:

- The page and its server to `~/.promptlings/foreman-dashboard/`, with the
  installed version in `version.json`. The page uses [Tabler](https://tabler.io)
  1.7.5 (MIT), shipped prebuilt with its licence, so it needs no package
  installation or network connection. The server needs only Node.js.
- The Foreman bridge, a Copilot extension that carries the page's requests to
  the Foreman session, to `~/.copilot/extensions/foreman-bridge/` (or under
  `COPILOT_HOME` when set). The Copilot app loads it automatically. Copilot CLI
  loads it only when started with `--experimental`; without it the page is
  read-only.
- `~/.promptlings/foreman/settings.json` with `{"pollMinutes": 5}`, only when
  that file does not exist. `pollMinutes` (1 to 120) sets how often Foreman
  refreshes the status file while lanes are active.

Foreman starts the server at the end of its briefing when nothing answers at
its recorded address (`http://127.0.0.1:4747` by default) and reports the
page's address. That address carries a key the server creates each time it
starts and records only in `~/.promptlings/foreman/dashboard.json`. The server
keeps `~/.promptlings/foreman/` readable only by you, so other users on the
machine cannot read the page or send requests through it. Open the address
once and the browser remembers the key until the server restarts; after a
restart, open the address from Foreman's next briefing. `--no-dashboard` leaves
existing copies in place; delete `~/.promptlings/foreman-dashboard/` and the
bridge folder to remove them.

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

Basic Memory 0.24.1 uses its unchanged SQLite backend on `127.0.0.1:8000`.
All MCP clients register `http://127.0.0.1:8001/mcp`, the shared write proxy,
rather than the backend port. The installer copies the Node proxy and service
entry point to `~/.promptlings/memory/`, outside disposable npm download paths.
The existing service starts that entry point, which owns the proxy and one
Basic Memory child. No additional package or database backend is installed.

Windows uses a limited, current-user Scheduled Task, macOS a LaunchAgent, and
Linux a systemd user service. Windows retains its `pythonw.exe` task wrapper,
which starts Node without a console. Node starts the installed Basic Memory
command with windowless child creation. The other platforms start Node directly.
Linux startup
requires an active systemd user session. The installer checks the MCP
initialization response before reporting success.

### Agent access and write serialization

Agents must use only Basic Memory MCP tools. Running `basic-memory` or `bm`,
starting another MCP server, opening `memory.db`, or accessing Basic Memory
note files directly is prohibited. An MCP failure is a blocker, not permission
to fall back to the CLI. Installer installation and maintenance commands are
exempt. The generated read-side rule, Memory Manager and bundled capture skill
carry this contract.

The installer also adapts the pinned upstream memory skills and their installed
Copilot/Claude copies. CLI-only doctor, literary-analysis and OKF recipes become
MCP workflows with explicit unsupported-maintenance boundaries. Import, orphan
and cloud-login CLI fallbacks are removed. Changed local skill copies stop
installation for reconciliation rather than being silently overwritten.
Full-body replacements require the exact pinned-source or recognized-adaptation
hash, including when all installed copies share the same customization.
Ownership metadata uses the publisher's `XDG_STATE_HOME` location when set,
including outside the home directory. Modified skill files remain home-scoped.

The proxy derives its classification from 0.24.1's MCP tool definitions.
`write_note`, `edit_note`, `move_note`, `delete_note`,
`create_memory_project` and `delete_project` share one FIFO queue across all
sessions and projects. Unknown tools also serialize. Declared read-only tools
pass through concurrently. Session deletion waits for writes, and advisory
write cancellation never releases an in-flight operation early.

Streamable HTTP initialization, MCP session IDs, protocol headers, GET event
streams, resumption headers and streaming POST responses pass through. The
proxy forwards streams without buffering complete responses or rewriting SSE
events. It accepts one JSON-RPC message per POST, not batches, and limits request
bodies to 64 MiB. Both endpoints bind only to IPv4 loopback. Do not register
the backend or launch another server when connecting additional clients.
Stdio-only clients use the pinned `mcp-remote` bridge to the same proxy.

Queued writes wait at most 120 seconds and the queue holds at most 1,000 waiting
requests. Timeout or queue-full errors state that the request was not dispatched.
A dispatched write has a ten-minute response limit. Transport failure or a
server-side HTTP failure can leave its commit outcome unknown. That blocks
further writes until the managed server restarts, while reads remain available.
The same protection applies to HTTP 200 MCP errors reporting
`EDIT_OUTCOME_UNKNOWN` or the default `Edit Outcome Unknown` message.
Read the exact target first and reconcile any accepted change before retrying.
The proxy never automatically retries a dispatched request, including an
`edit_note` failure after an accepted note commit. Client disconnection does not
cancel an active write: the proxy drains its response before releasing the queue.

The installer disables Basic Memory's automatic updates to preserve its pin.
It preserves project configuration and routing while setting the measured
materialization worker count. Worker measurements and live acceptance are
described below.
Configuration resolution follows Basic Memory 0.24.1: `BASIC_MEMORY_CONFIG_DIR`,
then `XDG_CONFIG_HOME/basic-memory`, then `~/.basic-memory`. Relative environment
paths resolve against the installer's working directory, with no tilde or
embedded-variable expansion. Managed startup records the absolute selected
directory so login or restart cannot select a different configuration.

### SQLite concurrency measurements

Real-server acceptance on Windows on 2026-11-23 used Basic Memory 0.24.1
and the existing SQLite database. Each round opened ten independent MCP
sessions, submitted ten `write_note` calls together, then submitted ten
`edit_note` appends together against one seeded note. No agent CLI processes
were used. Reads used MCP tools throughout. Two throwaway projects were
removed through `delete_project`, with registration and directory absence
verified afterward.

The first trial measured delayed search probes. The repeated trial started
polling immediately after each write acknowledgment for a unique body-only
token using `search_notes` with `search_type=text`, checking the exact returned
title. Search lag includes polling and HTTP latency, not vector-index completion.
Logs were observed for another 150 seconds after each round's edits.

| Route | Workers | Tool lock errors | Pool timeouts | Background SQLite lock exceptions, first / repeat | Edits retained exactly once, first / repeat |
| --- | --- | --- | --- | --- | --- |
| Direct, port 8000 | 4 | 0 / 0 | 0 / 0 | 0 / 0 | 6 / 8 of 10 |
| Proxy, port 8001 | 1 | 0 / 0 | 0 / 0 | 1 / 0 | 10 / 10 of 10 |
| Proxy, port 8001 | 2 | 0 / 0 | 0 / 0 | 0 / 0 | 10 / 10 of 10 |
| Proxy, port 8001 | 4 | 0 / 0 | 0 / 0 | 0 / 0 | 10 / 10 of 10 |

Direct concurrent edits returned four explicit concurrent-modification refusals
in the first trial and two in the repeat. Proxy rounds returned zero tool errors,
and all markers appeared exactly once in both `read_note` and the materialized
file read through `read_content`. The one-worker first-trial failure was one
SQLAlchemy SQLite lock exception from an internal `search_vector_chunks`
update, represented by two log lines. The competing lock holder was not
identified.

**The installer sets `materialization_workers=2`.** This is the lowest tested
value with zero observed lock errors in both trials. Its repeated-trial
acknowledgment-to-text-search lag averaged 331.1 ms, with a 294 ms median and
an 84-949 ms range. Four workers averaged 416.4 ms, with a 290 ms median and
a 171-1099 ms range. One worker averaged 233.6 ms in the repeat, but its
earlier lock failure disqualifies it. These sub-second two-worker text-search
lags are acceptable for the measured workload.

Per-note acknowledgment-to-search lag in the repeated trial, in milliseconds:

| Note index | Direct, 4 workers | Proxy, 1 worker | Proxy, 2 workers | Proxy, 4 workers |
| --- | --- | --- | --- | --- |
| 0 | 15052 | 255 | 304 | 201 |
| 1 | 11844 | 448 | 151 | 318 |
| 2 | 6426 | 451 | 284 | 171 |
| 3 | 9317 | 136 | 445 | 1099 |
| 4 | 5663 | 214 | 278 | 243 |
| 5 | 3386 | 188 | 949 | 405 |
| 6 | 5850 | 140 | 306 | 243 |
| 7 | 3569 | 178 | 195 | 363 |
| 8 | 4302 | 242 | 315 | 262 |
| 9 | 8130 | 84 | 84 | 859 |

Submission-to-search time includes queue waiting and the complete tool response,
not just materialization lag. Per-note totals in milliseconds:

| Note index | Direct, 4 workers | Proxy, 1 worker | Proxy, 2 workers | Proxy, 4 workers |
| --- | --- | --- | --- | --- |
| 0 | 28851 | 5601 | 5233 | 5214 |
| 1 | 36674 | 12804 | 10973 | 11760 |
| 2 | 36962 | 18871 | 19118 | 19389 |
| 3 | 26904 | 24735 | 27578 | 30151 |
| 4 | 37033 | 31051 | 34799 | 40371 |
| 5 | 37081 | 37374 | 42793 | 53828 |
| 6 | 36655 | 42975 | 54372 | 63604 |
| 7 | 32800 | 48061 | 64526 | 71855 |
| 8 | 36878 | 54888 | 75490 | 81710 |
| 9 | 32715 | 62322 | 82171 | 89756 |

The first trial's search probes started after the complete write batch.
Its reported timings are upper bounds and are not used as materialization-lag
measurements. Raw reports are `memory-concurrency-batch-probes.json` and
`memory-concurrency.json` in
`C:\agent-artifacts\61a53cc9-af32-4920-82c5-7444c0bfb615\`.
That artifact location expires after 14 days. The tables above retain the
decision evidence in this repository.

To repeat acceptance against the shared installed server, pause other memory
writers and use an external artifact directory:

```powershell
$env:PROMPTLINGS_MEMORY_ACCEPTANCE_DIR = 'C:\agent-artifacts\<session-id>'
node --test tests\memory-concurrency.test.js
```

This opt-in test restarts the shared service, tries workers 1, 2 and 4, removes
its throwaway project and restores the installer-selected worker count.
It does not open SQLite or operate on note files directly.

Post-reinstallation acceptance on this host:

| Item | Status | Evidence |
| --- | --- | --- |
| MCP-only agent access | Verified | No actionable CLI invocations in shipped or installed memory instructions. The installed managed block, Memory Manager, Foreman and capture skill contain the ban |
| Shared write proxy | Verified | Ten-session stress rounds, zero proxy tool errors, every edit present exactly once in accepted and materialized content, both throwaway projects removed |
| Worker choice | Verified | Workers 1, 2 and 4 measured. Two workers were the lowest consistently lock-free choice across both trials |
| Reinstalled clients | Verified | Scheduled task Running, one listener per selected port, both Copilot registrations retained at the proxy URL. Fresh SDK clients initialized, discovered 27 tools, performed scoped search/read and closed sessions. Both native App MCP namespaces read successfully after disable/re-enable |
| Actual Unix service startup | Unverified | Startup definitions are covered by focused checks, but this acceptance host runs Windows |

### Service scheduling

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
effect when the service starts, not when this repository is updated. This keeps
clients on the shared proxy. Client-launched Basic Memory stdio mode
is no longer supported because separate servers bypass its queue.

The Windows task retains `IgnoreNew` instance handling and an unlimited execution
time. Native task-launch failure retries are configured for three attempts,
one minute apart. A nonzero process exit does not reliably trigger those retries:
on the tested Windows host, the scheduler recorded the exit code but did not
restart the action.

The existing windowless action therefore waits for each managed service exit and retries
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
Include your usual `--memory-port` and `--memory-proxy-port` if different. Both use the same stop, install,
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
configurations with the proxy URL. It does not remove other duplicate server
entries. An unrelated listener on either selected port stops installation.
Use `--memory-port` and `--memory-proxy-port` to choose distinct ports.
Existing Copilot registrations targeting the same loopback backend endpoint
receive the proxy URL without removing or merging duplicate registrations.

With Memory Manager selected and memory enabled, the installer also publishes a
read-side rule that tells future sessions to retrieve relevant context and save
decisions and outcomes. **This applies to future sessions across repositories.**
Use `--no-readside` to omit it, including with the `publish` command.

The rule lives in a dedicated `promptlings-memory` file per supported harness,
such as `~/.copilot/instructions/promptlings-memory.instructions.md` or
`~/.claude/rules/promptlings-memory.md`. A memory reinstall refreshes existing
managed blocks, including legacy blocks in `copilot-instructions.md` and
`CLAUDE.md`, preserving text outside their markers. Unmanaged instructions
are not rewritten.

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
