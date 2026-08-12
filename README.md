<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo-dark.png">
    <img src="logo.png" alt="promptlings" width="321">
  </picture>
</p>

## One ranked list is the bug

Most AI code reviewers produce a single ranked list of comments. That is the bug.

A defect the model verified, a choice the diff leaves open, and a tradeoff the diff already made
are three different kinds of statement. They have different truth conditions, they need different
things from the reader, and they are wrong in different ways. Merging them into one list, sorted by
a severity score, is why the output reads as noise. The reader cannot tell which items are claims
about the code and which are the model narrating its own uncertainty, so they discount all of them
equally.

The two code-review agents here split the output into three channels and hold each to a different
bar.

## The three channels

**1. Defects.** Inline, anchored to a specific line. This is the only channel where the agent
renders judgment. Every finding has to answer "what concretely breaks," and the mechanism has to
be traced, not guessed. Most candidates die here, which is the intended outcome.

**2. Design forks.** The diff leaves a real choice open, the code is internally consistent either
way, and the right answer depends on context the agent does not have (roadmap, scale targets, team
shape, prior decisions in unseen code). The agent must name at least two concrete options, name the
axis they differ on, and name **what would settle it**: a number, a benchmark, a roadmap decision,
a sign-off. The settling criterion is mandatory. A fork without one is the model narrating its own
uncertainty, and it gets dropped.

**3. Implicit bets.** The choice is already resolved in the diff, only one option is present, and
the code works. But the decision is costly to reverse, so the reviewer should agree with it
consciously rather than by default. The agent must state what the diff does, why it is defensible,
what the road not taken would have cost, and **a concrete question the reviewer has to answer**
before approving. The question is mandatory. It is what separates a bet from narration.

The agent is forbidden from rendering judgment in channels 2 and 3. It surfaces the choice and
shuts up. Its opinion on whether the call was correct is noise, because it does not have the
context that would make the opinion worth anything.

The mandatory settling criterion and the mandatory question are the load-bearing constraints. Take
them away and the three channels collapse back into ordinary severity levels within a week.

## The two agents

| Agent | What it produces |
| --- | --- |
| [the-nitcracker](agents/code-review/the-nitcracker.agent.md) | A full review: narrative walkthrough first, then inline defects, design forks, and implicit bets as an appendix. |
| [PR Walkthrough](agents/code-review/pr-walkthrough.agent.md) | Orientation before you open the diff: architecture, what calls what, which files carry weight, forks and bets. It does not hunt for bugs. |

## Real output, unedited

Both agents were run against [ollama/ollama#17485](https://github.com/ollama/ollama/pull/17485),
a merged change by an Ollama core maintainer, 4 files, +846 / -103. The output is committed here
without edits:

- [`examples/ollama-17485-review.md`](examples/ollama-17485-review.md) (the-nitcracker)
- [`examples/ollama-17485-walkthrough.md`](examples/ollama-17485-walkthrough.md) (PR Walkthrough)
- [`examples/README.md`](examples/README.md) for the exact commits and how to reproduce it

Here is the kind of thing the split is for. That PR normalizes a `finish_reason` in two places, and
the two places disagree:

- `FinishChunk` computes `reason := cmp.Or(r.DoneReason, "stop")` and then applies
  `if reason == "stop" && toolCallSent`
- `ToChatCompletion` applies `if reason == "stop" && len(toolCalls) > 0` but has no `cmp.Or`
  default
- So for a response with tool calls and an empty done reason, the streaming path emits
  `"tool_calls"` and the non-streaming path emits `null`
- The human reviewer had proposed this rewrite across two separate review comments. The second one
  quoted only half of the first, and only half of the fix got mirrored to the second call site

That is not a lint hit and it is not a style preference. It is one code path and its sibling
disagreeing about what an empty value means, introduced by a review comment that was applied twice
and quoted incompletely the second time.

Note what the committed run then does with it. It traces whether the divergent branch is reachable
today, concludes it is not, and records the divergence in the narrative instead of promoting it to a
defect. Its words: "Noted, not flagged." Whether that was the right call rests entirely on the
reachability conclusion, which is where the second output comes in.

The two committed outputs disagree about that conclusion, and both are published unedited so you can
adjudicate. The review traces the local inference path and states that `server/routes.go:2777` is the
only assignment on the chat path. The walkthrough, in its implicit bets section, identifies a path the
review did not consider: the cloud passthrough at `server/routes.go:2543-2557` marshals an upstream
`api.ChatResponse` and writes it straight into `ChatWriter`, so a remote host's done reason does reach
this code. That branch is guarded by a locally registered model pointing at a remote host, and it
serves non-streaming requests too, which is the path without the default. It never goes through
`server/routes.go:2777`, so the review's "only assignment on the chat path" does not hold.

This is the same effect as the run-to-run variance below. Independent passes over the same diff
surface different things, and neither output was edited to make them agree.

## What these agents cannot do

Worth knowing before you install anything:

- **No codebase indexing.** No embeddings, no symbol graph, no persistent index. The agent reads
  the diff and the files it decides to open, in one session.
- **No learning.** It does not remember previous comments, previous reviews, or which of its
  findings you rejected. Every run starts from nothing.
- **No GitHub App.** Nothing runs on a webhook. You invoke it yourself, in your terminal.
- **No CI integration.** There is no check run, no status, no bot account posting to your PR.

### Run-to-run variance, measured

The same agent was run seven times against the same pull request. Four runs produced exactly one
finding, three produced zero, and no run ever produced more than one. The severity floor is highly
reproducible: it never invented a pile of comments to look busy.

Which specific finding surfaces is not reproducible. Four of those runs surfaced four different
valid findings, all within the same function.

Run it twice on a change that matters.

## Install

Each agent is one `.agent.md` file with YAML frontmatter and a Markdown body. There is nothing to
build and no runtime to install.

### Manual (recommended)

Copy the file you want into your tool's agents directory:

| Tool | Directory |
| --- | --- |
| GitHub Copilot CLI, user-wide | `~/.copilot/agents/` |
| GitHub Copilot CLI, per-project | `.github/agents/` |
| Claude Code | `~/.claude/agents/` |

For the two review agents:

```bash
mkdir -p ~/.copilot/agents
curl -fsSL -o ~/.copilot/agents/the-nitcracker.agent.md \
  https://raw.githubusercontent.com/dfinson/promptlings/main/agents/code-review/the-nitcracker.agent.md
curl -fsSL -o ~/.copilot/agents/pr-walkthrough.agent.md \
  https://raw.githubusercontent.com/dfinson/promptlings/main/agents/code-review/pr-walkthrough.agent.md
```

Restart your assistant to pick them up. For other frameworks, parse the YAML frontmatter and use
the Markdown body as the system prompt.

### Script

A script is available if you want detection and multiple targets handled for you. It downloads only
the agents you select, prints every path it will write before writing anything, and does not modify
any file outside the agents directory unless you explicitly ask it to.

```bash
curl -fsSL https://raw.githubusercontent.com/dfinson/promptlings/main/install.sh -o install.sh
less install.sh
bash install.sh --review        # the two code-review agents
```

```powershell
irm https://raw.githubusercontent.com/dfinson/promptlings/main/install.ps1 -OutFile install.ps1
Get-Content install.ps1 | more
powershell -ExecutionPolicy Bypass -File .\install.ps1 -Review
```

Windows PowerShell 5.1 defaults to the `Restricted` execution policy on client editions, which
blocks running a downloaded script file at all. The `-ExecutionPolicy Bypass -File` form above
applies to that single invocation and changes nothing about your machine's policy. If you have
already set a policy that permits local scripts, `.\install.ps1 -Review` works directly.

Flags, identical in both scripts:

| Flag | Effect |
| --- | --- |
| `--review` / `-Review` | Install the two code-review agents only |
| `--all` / `-All` | Install all six agents |
| `--agents a,b` / `-Agents a,b` | Install agents by name, for example `the-nitcracker,pr-walkthrough` |
| `--list` / `-List` | Print the available agent names and exit |
| `--dry-run` / `-DryRun` | Print every path that would be written, write nothing |
| `--yes` / `-Yes` | Skip the confirmation prompt |
| `--with-readside` / `-WithReadSide` | Opt in to the global instruction change described below |

With no selection flag and an interactive terminal, the script asks which set you want. With no
selection flag and no terminal, which is what a piped one-liner gets, it installs the two
code-review agents and tells you how to ask for more.

#### Exactly what the script touches

Creates the agents directory if missing, and writes one file per selected agent:

- `~/.copilot/agents/<agent>.agent.md` when GitHub Copilot CLI is detected
- `~/.claude/agents/<agent>.agent.md` when Claude Code is detected

Nothing else, by default. It does not write to `~/.copilot/copilot-instructions.md`, it does not
write to `~/.claude/CLAUDE.md`, and it does not change your shell profile, your PATH, or any global
agent configuration.

#### The one opt-in that changes global behavior

[Session Handoff](agents/context/session-handoff.agent.md) needs a companion read-side instruction
so that future sessions load the context it persisted. That instruction is a block appended to your
global instruction file (`~/.copilot/copilot-instructions.md` or `~/.claude/CLAUDE.md`), and it
applies to **every future session in every repository**, including sessions that have nothing to do
with this repo. Among other things it tells the agent to read the handoff files before answering
anything.

That is a real change to how your assistant behaves everywhere, so it never happens unless you ask
for it:

```bash
bash install.sh --agents session-handoff --with-readside
```

```powershell
.\install.ps1 -Agents session-handoff -WithReadSide
```

Run interactively without the flag and the script prints the target file and what the block does,
then asks. Piped, with no terminal to ask on, it skips the modification and prints the command to
run later. To do it by hand instead, see
[Read-Side Setup](agents/context/session-handoff.agent.md#read-side-setup).

## Also in this repo

Four more agents, installable the same way. They are not the point of this repository, and they are
not part of the argument above. They are here because the author uses them.

| Agent | Use it when you need |
| --- | --- |
| [Session Handoff](agents/context/session-handoff.agent.md) | Durable context across chats: current state, environment facts, decisions, and a verified restart prompt. Read the read-side note above before installing this one. |
| [Technical Demo](agents/media/technical-demo.agent.md) | A polished technical demo video built from approved design, deterministic scenes, real evidence, narration, and review. |
| [BMAD Orchestrator](agents/orchestration/bmad-orchestrator.agent.md) | Adaptive [BMAD](https://github.com/bmad-code-org/BMAD-METHOD) delivery through one interface, from verified setup and bounded fixes to full-assurance initiatives. Start with a software request, not a BMAD command. Requires [BMAD installed](https://docs.bmad-method.org/how-to/install-bmad/). |
| [Spec-Kit Flow](agents/orchestration/speckit-flow.agent.md) | Anchor every change in [Spec-Kit](https://github.com/github/spec-kit) specification, plan, and tasks, then add phases and [Fleet](https://github.com/sharathsatish/spec-kit-fleet) capabilities only when they resolve a named need. |

## Principles

- **High bar, low noise.** Ship output that changes an experienced reviewer's mind.
- **Portable.** Plain Markdown, no required agent runtime.
- **Opinionated.** Every agent has a defined point of view and judgment boundary.
- **No em dashes.** Use commas, colons, semicolons, periods, or parentheses.

## Contributing

PRs are welcome. The inclusion bar is simple: would you use this agent every day?

## License

Apache 2.0. See [LICENSE](LICENSE).
