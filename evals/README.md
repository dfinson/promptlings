# Evals

Measures whether the review agents hold a reader's attention and build a mental
model of a change. That is what `pr-walkthrough` exists to do, and it is the
property most at risk when an agent file is shortened.

Two questions, in order:

1. What is the baseline for the agent files as they ship today?
2. Can an agent file be made shorter without regressing against that baseline?

## What is measured

The eight dimensions come from the A/B run on
[microsoft/hve-core#1947](https://github.com/microsoft/hve-core/pull/1947),
which compared inline voice guidance against the same guidance extracted to a
separate file, across 10 merged PRs with independent scoring subagents.

| Dimension | Fails when |
| --- | --- |
| architectural-abstraction | Organized around the file list instead of the idea |
| voice-intensity | Flat, interchangeable prose, accurate but anonymous |
| narrative-pull | Sections could be reordered without loss |
| specificity | Claims that would be true of any similar change |
| judgment-neutrality | The agent tells the reviewer a choice was correct |
| hunk-gluing-absence | Prose is filler between diff fragments |
| header-quality | Headers label files or layers instead of naming beats |
| cold-open-quality | Opens by announcing its subject |

Defect detection is deliberately absent. `pr-walkthrough` states it is not a
findings tool, so scoring it on findings would optimize the wrong thing.

## Running it

Both the agent under test and the judge run on GitHub Copilot CLI. No other
model provider or API key is involved.

```bash
npx promptfoo@latest eval -c evals/promptfooconfig.yaml
npx promptfoo@latest view
```

Prepare the target checkout and install the variants under test first:

```bash
mkdir -p evals/.work
git clone https://github.com/dfinson/promptlings.git evals/.work/target
mkdir -p evals/.work/target/.github/agents
cp agents/code-review/pr-walkthrough.agent.md \
   evals/.work/target/.github/agents/pr-walkthrough-baseline.agent.md
```

A variant is just another file in that directory. The provider selects one by
name through `PROMPTLINGS_AGENT`, so comparing a shortened agent means writing
`pr-walkthrough-short.agent.md` beside the baseline and enabling the `short`
provider in the config.

## Judge panel

`PROMPTLINGS_JUDGE_MODEL` overrides the judge model. Running the same rubric
under more than one model, then comparing per-dimension scores, is how a panel
is formed. Report agreement between judges, not only the mean: a dimension the
judges disagree about is not measuring anything stable yet.

## Reading a result

Judges cluster in a narrow band, so absolute scores carry less information than
the gap between two variants on the same case. A shortened variant that holds
its baseline on every dimension is evidence the removed text was not
load-bearing. One that drops on hunk-gluing-absence or voice-intensity while
holding elsewhere is the specific regression this suite exists to catch.

A tie is not proof of equivalence. It can also mean the instrument could not
resolve the difference, which is worth stating plainly when reporting one.

## Windows note

`copilot` resolves to a `.cmd` shim on Windows, and spawning a shim requires a
shell, which re-parses the argument vector and splits any prompt containing
spaces. `providers/copilot.js` resolves the package entry point and runs it
under the current node binary instead. Set `PROMPTLINGS_COPILOT_ENTRY` if the
entry point lives somewhere unusual.
