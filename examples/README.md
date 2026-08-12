# Examples

Unedited output from the two code-review agents in this repository. Both files review the same
pull request, so you can compare what each agent is for.

Nothing here has been trimmed, reordered, or cleaned up. If a claim in one of these files is
wrong, it is wrong in the committed file too. That is the point: a curated sample tells you
nothing about what the agent does on a Tuesday.

**These two files contradict each other, and neither was edited to hide it.**
[`ollama-17485-review.md`](ollama-17485-review.md) concludes that an empty done reason cannot reach
the code path in question and records it as "Noted, not flagged," on the grounds that
`server/routes.go:2777` is the only assignment on the chat path.
[`ollama-17485-walkthrough.md`](ollama-17485-walkthrough.md) identifies the cloud passthrough branch,
which never goes through that assignment, so "only assignment on the chat path" does not hold. The
[top-level README](../README.md#real-output-unedited) walks the full mechanism if you want to
adjudicate it yourself.

## What was reviewed

| Field | Value |
| --- | --- |
| Pull request | [ollama/ollama#17485](https://github.com/ollama/ollama/pull/17485), "openai: match openai's streaming wire format for chat completions" |
| Author | BruceMacD, an Ollama core maintainer |
| State | Merged |
| Size | 4 files, +846 / -103 |
| Reviewed at PR head | `cb5871d5` |
| Merge base | `a199313eb334d59486160fcfc3f8f2d30fc576be` |
| Date reviewed | August 2026 |

Neither agent had prior knowledge of this repository. Both were pointed at the pull request and
the checked-out source tree at the commits above.

## The files

| File | Agent | What it is |
| --- | --- | --- |
| [`ollama-17485-walkthrough.md`](ollama-17485-walkthrough.md) | [PR Walkthrough](../agents/code-review/pr-walkthrough.agent.md) | Orientation before you open the diff. Architecture, what calls what, and where judgment is required. It does not hunt for bugs. |
| [`ollama-17485-review.md`](ollama-17485-review.md) | [the-nitcracker](../agents/code-review/the-nitcracker.agent.md) | A full review. Narrative first, then inline findings, design forks, and implicit bets as an appendix. |

## Reproducing this

Check out the pull request head and run the agent against the merge base:

```bash
gh repo clone ollama/ollama
cd ollama
gh pr checkout 17485
git checkout cb5871d5
```

Then invoke either agent with `a199313eb334d59486160fcfc3f8f2d30fc576be` as the comparison base.

Expect the output to differ from what is committed here. See the reproducibility note in the
[top-level README](../README.md#what-these-agents-cannot-do) for measured run-to-run variance on
this exact pull request.
