# Framework setup

Machine setup runs once per machine. Repository initialization runs once per
working copy, through the installed `promptlings-repo-init` skill. Agents
conduct delivery through installed frameworks. They do not install tools,
reconstruct runtimes or repair integrations.

## Install the machine toolchain

```powershell
.\install.ps1 -Yes
```

```bash
bash install.sh --yes
```

The native recipes install normal system prerequisites, Python applications
through uv, Node applications through global npm, and published global skills
through the upstream skills CLI. Basic Memory is registered with Copilot and
Claude and starts through the operating system's native user-login facility.

There are no private Python or Node distributions, copied media executables,
temporary framework template repositories, global BMAD skill promotion or
installer-owned command wrappers.

Use the [component opt-outs](installation.md#installer-options) to omit components.
`--no-system-packages` or `-NoSystemPackages` uses existing prerequisites.
Python 3.11+ is still required for profile configuration in prompts-only mode.

## Initialize a repository

The bound coach initializes its working copy automatically (see
[Initialize every working copy](#initialize-every-working-copy)). To initialize
one directly, run the installed skill script from the working copy root after
binding it with `git config promptlings.method bmad` or `speckit`:

```powershell
powershell -ExecutionPolicy Bypass -File "$HOME\.copilot\skills\promptlings-repo-init\scripts\init.ps1"
```

```bash
bash ~/.copilot/skills/promptlings-repo-init/scripts/init.sh
```

The skill is published to every supported harness, so `~/.claude/skills` and
similar locations hold the same script. Pass `-Method` or `--method` to choose
frameworks without binding the repository.

The installer can also initialize a repository, using the same script:

```powershell
.\install.ps1 -Project C:\repos\my-project -ProjectOnly -Yes
```

```bash
bash install.sh --project "$HOME/repos/my-project" --project-only --yes
```

Omit `-ProjectOnly` or `--project-only` to install the machine toolchain and
initialize the repository in one invocation. The installer initializes both
frameworks unless one is opted out.

The script checks the installed CLI against the promptlings pin, invokes the
official BMAD installer in that repository, then Spec Kit, and adds the
promptlings delivery workflow. It installs no software. Copilot uses the
upstream skills integration. Choose Claude's integration with
`-Integration claude` or `--integration claude`. BMAD installs integrations for
both hosts.

Existing framework directories are not implicitly upgraded or regenerated.
An incomplete runtime or a generated prerequisite pointing at a nonexistent
script fails explicitly. Use the framework's official update operation for
deliberate upgrades.

## Keep framework work local by default

Framework machinery and generated documents are working material for delivery,
not default additions to implementation commits. The initializer installs the
official frameworks normally and excludes their files locally before installation.
Their workflows, renderer, extensions and skills continue to run from disk.

The BMAD orchestrator is a BMAD-only coach. A request to skip or leave BMAD gets
two choices: the matching BMAD workflow or a separate ordinary session. The
orchestrator never does that work itself. Its obligations apply only to that
orchestrator and children it assigns BMAD work, never ordinary sessions.

Each repository is bound to one method through the local Git setting
`promptlings.method` (`bmad` or `speckit`). A coach sets it only with the user's
agreement and refuses delivery in a repository bound to the other method. Before
implementation, the coach records the hashes of the planning artifacts the user
approved, under the repository's Git directory, and re-checks them before every
implementation dispatch. A changed artifact needs approval again.

| Content | Default policy |
| --- | --- |
| `_bmad` configuration, scripts and customizations | Local, ignored |
| BMAD's installed project integrations and skills | Local, ignored |
| `_bmad-output` requirements, architecture, stories and delivery evidence | Local, ignored |
| `.specify` scripts, templates, constitution and extension configuration | Local, ignored |
| Spec Kit's installed project integrations and skills | Local, ignored |
| `specs` specifications, plans, tasks and checklists | Local, ignored |
| Personal overrides, caches and temporary execution state | Ignore |

Git resolves the local `info/exclude` path, including the common Git directory
for linked worktrees. The initializer maintains named blocks there and preserves
unrelated rules byte-for-byte. It does not change repository `.gitignore` files,
global Git settings, hooks, the index, commits or branches.
Linked worktrees share these local exclusion rules, not their ignored files.

The exclusions cover the frameworks' default output roots and their named
integration files, not entire `.github`, `.agents` or `.claude` directories.
Unrelated skills, agents, prompts, source files and documentation remain visible
to Git. The default `_bmad-output` and `specs` directories are reserved for
transient framework output. Custom output destinations need equivalent local
exclusions.

Spec Kit can create a generic host instruction file, such as
`.github/copilot-instructions.md` or `CLAUDE.md`. The initializer excludes that
file only when it does not already exist before framework initialization.
Existing team instruction files remain visible to Git.

Normal `git add .` omits framework files and generated documents. Agents are
instructed not to force-add them. Git exclusions are not deletion or secret
protection, and private data must not be put into shared configuration.

## Initialize every working copy

Local framework files are not copied into new clones or linked worktrees.
Each working copy needs initialization before framework delivery. When a coach
finds its bound framework missing from the working copy, it runs
`promptlings-repo-init` before the first workflow, without asking, and children
it starts in new worktrees do the same. The script installs no software, so a
missing or mismatched CLI still points to the machine installer. Each working
copy then has its own runtime, plans and tasks. Transient artifacts remain
available locally until deliberately removed.

## Opt into shared framework content

A team can explicitly choose version-controlled framework setup and documents:

```powershell
.\install.ps1 -Project C:\repos\my-project -ProjectOnly -SharedFrameworks -Yes
```

```bash
bash install.sh --project "$HOME/repos/my-project" --project-only --shared-frameworks --yes
```

Shared mode makes the selected frameworks' setup, integrations and documents
eligible for normal Git review and commits. Personal overrides, active-feature
selection, render caches and extension caches stay ignored locally.

Repeating initialization is idempotent. Selecting shared mode replaces only the
selected frameworks' promptlings-managed local rules. Component opt-outs leave
the other framework's existing rules alone. Conflicting user-authored rules
cause an explicit error rather than being overwritten.

Only deliberately committed shared files are inherited by clones and worktrees.
Earlier-version migration is outside this installer's scope.
