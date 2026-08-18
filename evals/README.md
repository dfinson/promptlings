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
name through its `config.agent`, so comparing a shortened agent means writing
`pr-walkthrough-l3.agent.md` beside the baseline and adding a provider block.

## How the shortened variants are chosen

The obvious way to test "can this be shorter" is to write one shortened version
and score it. That tests a single guess, and if it holds, all it shows is that
one particular edit was survivable. It says nothing about where the limit is.

So the cut is built as a ladder instead. Four analysts, each a different model
family (`claude-opus-4.6`, `gpt-5.6-terra`, `gemini-3.1-pro`, `grok-4.6`), read
the agent file independently and tiered every part of it:

| Tier | Meaning |
| --- | --- |
| TIER1 | Pure redundancy, restated elsewhere verbatim |
| TIER2 | Compressible with bounded risk |
| TIER3 | Cuttable but plausibly load-bearing |
| NEVER | Removing this changes what the agent does |

They disagreed a lot, which is the useful part. They also used different segment
names and different granularity, so the merge happens per **line**: each entry
casts its tier as a vote for every line it covers, and a line nobody scored is
kept, because silence is not agreement.

The levels then relax how strongly a line must be defended to survive:

| Level | Rule | Cut |
| --- | --- | --- |
| L1 | Every vote is TIER1 | 0% |
| L2 | Every vote is TIER1 or TIER2 | 3.5% |
| L3 | No NEVER vote, and a majority say cuttable | 16.1% |
| L4 | Veto needs 2+ NEVER votes | 26.0% |
| L5 | Veto needs 3+ NEVER votes | 52.1% |
| L6 | Veto needs unanimous NEVER | 76.7% |

The sets nest by construction, so the result is a dose-response curve and the
question stops being "did this edit survive" and becomes "at what dose does
quality break".

**L1 is empty, and that is a result.** Across four model families there was not
one line all four independently called pure redundancy. The file has no
uncontested fat.

Two rules keep the ladder honest:

- **Structure is held fixed.** Headings and frontmatter are never cut. The first
  run cut the H1 and the entire `## Output Format` section at the deepest level,
  which does not produce a shorter agent, it produces a broken one, and it would
  have failed the eval for the wrong reason. The question under test is whether
  the *prose* is load-bearing.
- **Variants are rejected, not warned about.** `tools/variant.js` fails hard if a
  variant loses required headings, changes its frontmatter identity, or is not
  strictly smaller than the rung above it.

L4 through L6 were added after the first run, when L1 came out empty and L2/L3
landed 13 points apart with L3 and L4 byte-identical: too narrow a span to
locate a knee. The amendment is recorded in `tools/consensus.js` rather than
quietly folded into the rules, because moving the rungs after seeing results is
exactly the failure mode this design is trying to avoid.

```bash
node evals/tools/consensus.js   # merge inventories -> consensus.json
node evals/tools/variant.js     # materialize the ladder as agent files
node evals/tools/smoke.js       # confirm Copilot resolves every agent name
node evals/tools/compare.js evals/results/ladder.json evals/results/baseline.json
```

## Judge panel

`PROMPTLINGS_JUDGE_MODEL` overrides the judge model. Running the same rubric
under more than one model, then comparing per-dimension scores, is how a panel
is formed. Report agreement between judges, not only the mean: a dimension the
judges disagree about is not measuring anything stable yet.

## Reading a result

The reading rule is fixed before the numbers arrive, so it cannot be fitted to
them.

At n=1 per case, a dimension moving a few hundredths is noise. Two dimensions
are exceptions: `judgment-neutrality` scored 1.00 and `architectural-abstraction`
scored 0.98 at baseline, so neither has headroom and any drop there is real.
Elsewhere, a move on one case is noise; the same move in the same direction on
all three cases is signal.

The baseline is re-run inside every sweep rather than compared against the
stored one. Run-to-run variance and cut-induced variance are otherwise
indistinguishable, and the gap between the two baselines is the noise floor that
every ladder delta has to clear.

The composite is a summary, not the verdict. A rung that holds its composite
while collapsing one dimension has still regressed.

A tie is not proof of equivalence. It can also mean the instrument could not
resolve the difference, which is worth stating plainly when reporting one.

### Known limits of this instrument

- **n=1 per cell.** Three cases, one run each. Enough to see a knee, not enough
  to put an interval on it.
- **The judge shares a family with the thing it judges.** Both run on Copilot.
  `PROMPTLINGS_JUDGE_MODEL` exists so this can be checked rather than assumed.
- **Three cases is a narrow slice.** Two are from this repository, one from
  `ollama`. A result here is evidence, not a general claim about the agent.

## Two harness details that changed the numbers

**The provider returns the artifact, not the transcript.** Even under `--silent`,
the CLI emits the model's own progress narration before the walkthrough. Judging
that text scores the harness rather than the agent: on the first run it dropped
cold-open quality to 0.05 while every other dimension scored above 0.82, because
the judge read "I''ll map the requested commit-to-commit diff first" as the
opening paragraph. The provider now slices from the first H1.

**Providers are in-process JavaScript, not `exec:`.** promptfoo passes the
prompt, the provider config, and the full test context as command-line arguments
to an exec provider. Eight rubrics in that context exceed the Windows
command-line limit and fail with `ENAMETOOLONG`. A JavaScript provider receives
the same values as function arguments, so there is no ceiling.

## Windows note

`copilot` resolves to a `.cmd` shim on Windows, and spawning a shim requires a
shell, which re-parses the argument vector and splits any prompt containing
spaces. `providers/copilot.js` resolves the package entry point and runs it
under the current node binary instead. Set `PROMPTLINGS_COPILOT_ENTRY` if the
entry point lives somewhere unusual.
