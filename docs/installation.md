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
| Technical Demo | Bundled Motionite source and licensed fonts, writing/capture companions, and the `technical-demo-production` skill with a native-resolution batch renderer. Remotion packages and selected third-party components are installed separately in the external production workspace |
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
| `--no-demo` | Skip VS Code, Demo Time, vscode-playwright, LibreOffice, Poppler, and diff2html |
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
selected. Publishing it includes the complete
[Motionite distribution](../skills/motionite/UPSTREAM.md) and
[production support](../skills/technical-demo-production/SKILL.md), but does not
install production npm dependencies or grant runtime licenses. Keep those
dependencies and generated media outside this repository and installed skills.
The batch renderer currently requires Remotion, renderer and bundler 4.0.539.

Experiment Director and its `ab-testing` routing and `comparative-evaluation`
method skills are discovered through the same publication path. To select only
that agent, use `npx promptlings publish --agents experiment-director --no-readside`.
This publishes instructions, including the method's protocol template and
research references. It does not install Harbor, Inspect, Promptfoo, a model
account or an evaluation service. Verify the chosen executor separately.
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
user service. Each starts the installed command directly. Linux startup
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
`ab-testing` and `comparative-evaluation` skill directories. The latter includes
its `references` directory. The routing skill needs the host's registered
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
