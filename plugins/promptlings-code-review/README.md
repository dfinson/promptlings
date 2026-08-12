# Promptlings Code Review

Two pull request review agents for Claude Code, packaged as an installable plugin.

Both agents already exist in the [promptlings](https://github.com/dfinson/promptlings) repository as plain `.agent.md` files. This plugin is an additional way to get them, not a replacement. The files stay copyable by hand and stay usable in GitHub Copilot CLI.

## What ships here

| Agent | Invoked as | What it produces |
| --- | --- | --- |
| the-nitcracker | `promptlings-code-review:the-nitcracker` | A full review: inline defect comments anchored to diff lines, separate design fork and implicit bet sections, and a narrative walkthrough. |
| pr-walkthrough | `promptlings-code-review:pr-walkthrough` | Orientation only: a narrative map of the change, its architecture, and the judgment calls buried in it. No defect hunting. |

Use pr-walkthrough when you want to understand a diff before reviewing it. Use the-nitcracker when you want the understanding plus the findings.

## The three channels

Most review tools sort output by severity: blocker, major, minor, nit. These agents sort by what kind of statement it is, because the three kinds need different things from the reader.

**Defects** are mechanically verifiable. Something concretely breaks if the diff merges as-is. They go inline, anchored to a specific line, and that line must be one the diff actually added or modified. Pre-existing code is out of scope. This is the only channel where the agent renders judgment.

**Design forks** are places the diff leaves a real choice open. The code is internally consistent and the right answer depends on context the agent does not have: roadmap, scale targets, team shape, prior decisions in unseen code. A fork must name at least two concrete options, state the axis on which they differ, and state **what would settle it**. The settling criterion is mandatory. Without it, a fork is just the model narrating its own uncertainty, and it gets dropped.

**Implicit bets** are choices the diff already resolved, cleanly, where the resolution commits the codebase to something expensive to reverse. Only one option appears in the diff, so there is nothing to choose; there is something to agree with. A bet must state what the diff does, why it is defensible, what the road not taken would have cost, and **a concrete question the reviewer has to answer** before approving. The question is mandatory.

The agent is explicitly forbidden from rendering judgment on forks and bets. It may not say a choice is reasonable, defensible, or good. It states the tradeoff and stops. The mandatory settling criterion and the mandatory question are what keep these two channels from collapsing back into "major" and "minor".

Both agents drop findings that do not clear the bar. A review with zero defects still ships a full narrative, because the reader still needs to understand the diff.

## Install

```bash
claude plugin marketplace add dfinson/promptlings
claude plugin install promptlings-code-review@promptlings
```

Or from inside Claude Code:

```text
/plugin marketplace add dfinson/promptlings
/plugin install promptlings-code-review@promptlings
```

To try it without installing:

```bash
claude --plugin-dir ./plugins/promptlings-code-review
```

Once enabled, both agents appear in the `@`-mention typeahead under their scoped names.

## Install without the plugin

The plugin is a convenience. The agents are still just markdown files:

```bash
cp agents/code-review/the-nitcracker.agent.md ~/.claude/agents/
```

The same files work in GitHub Copilot CLI under `~/.copilot/agents/`. The repository installers handle both tools. Nothing here needs a runtime.

## What this plugin does not ship

The promptlings repository contains six agents. This plugin contains two. Session Handoff, Technical Demo, BMAD Orchestrator, and Spec-Kit Flow stay in the repository and stay installable by hand; they are simply not in this plugin's `agents/` directory, which is the whole mechanism.

## What the agents do at runtime

Worth knowing before you install, since these agents drive your tools:

- They run `git` and `gh` commands to read the diff, PR metadata, and CI status.
- They read files in your workspace around the changed lines, not only the diff fragment.
- They make outbound web requests. Both agents treat contextual research as mandatory: pr-walkthrough looks for a CVE, RFC, postmortem, or named pattern relevant to the change, and the-nitcracker researches domain references for the narrative.
- the-nitcracker writes its review to `$COPILOT_ARTIFACTS_DIR` when that variable is set, and otherwise to the system temp directory.
- pr-walkthrough writes its walkthrough into your repository working tree, at `.copilot-tracking/pr/review/<sanitized-branch>/walkthrough.md`, creating that directory if it does not exist. This is the one write that lands inside your project rather than a scratch location, so add `.copilot-tracking/` to your `.gitignore` if you do not want it tracked.

This plugin ships no hooks, no MCP servers, no LSP servers, and no executable code. It is two markdown files and a manifest. It collects no telemetry and makes no network calls of its own; the requests above are ones the agent asks your Claude Code session to make, and you see them as normal tool calls.

## Example outputs

Both agents were run against [ollama/ollama#17485](https://github.com/ollama/ollama/pull/17485), and the unedited output is committed in the repository's [`examples/`](https://github.com/dfinson/promptlings/tree/main/examples) directory. The two outputs disagree with each other about whether a code path is reachable, and neither was edited to hide it, which is worth reading for what the review channels do and do not settle.

The agent definitions also contain the exact output formats, including the templates for the design fork and implicit bet blocks, in [the-nitcracker](agents/the-nitcracker.md) and [pr-walkthrough](agents/pr-walkthrough.md).

## Relationship to the source files

`agents/the-nitcracker.md` is a byte-for-byte copy of `agents/code-review/the-nitcracker.agent.md` in the repository root, renamed only because Claude Code derives an agent's name from its filename, so a `.agent.md` suffix would produce an agent named `the-nitcracker.agent`.

`agents/pr-walkthrough.md` is the same copy with exactly two changes: the frontmatter `name` becomes the slug `pr-walkthrough` instead of `PR Walkthrough`, and the Copilot input placeholder `${input:baseBranch:origin/main}` becomes plain prose, because Claude Code does not substitute it.

To check for drift after the source agents change:

```bash
git diff --no-index agents/code-review/the-nitcracker.agent.md \
  plugins/promptlings-code-review/agents/the-nitcracker.md

git diff --no-index agents/code-review/pr-walkthrough.agent.md \
  plugins/promptlings-code-review/agents/pr-walkthrough.md
```

The first must report no differences. The second must report exactly the two lines described above. Anything else means the copies drifted and need regenerating.

## Submission

See [SUBMISSION.md](SUBMISSION.md) for what a directory submission would require. Nothing has been submitted.

## License

Apache 2.0, same as the repository. See the [LICENSE](../../LICENSE) at the repository root.
