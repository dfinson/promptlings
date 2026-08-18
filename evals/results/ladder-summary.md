# Cut ladder result

Run `eval-5VZ-2026-08-18T18:29:04`, 18 runs, 0 errors, 2h17m at concurrency 1.
Six variants of `pr-walkthrough` across three cases, judged on the eight
attention dimensions.

## The instrument is noisier than most of the effects

The baseline was re-run inside this sweep so it could be compared against the
stored baseline from the previous run. Same agent file, same cases, same judge:

| Dimension | Prior | This run | Swing |
| --- | --- | --- | --- |
| specificity | 0.72 | 0.90 | +0.18 |
| narrative-pull | 0.73 | 0.90 | +0.17 |
| cold-open-quality | 0.57 | 0.48 | -0.09 |
| voice-intensity | 0.90 | 0.94 | +0.04 |
| hunk-gluing-absence | 0.93 | 0.95 | +0.02 |
| header-quality | 0.84 | 0.85 | +0.01 |
| judgment-neutrality | 1.00 | 0.99 | -0.01 |
| architectural-abstraction | 0.98 | 0.98 | 0.00 |

**The noise floor is 0.18.** Any ladder delta smaller than that is not
measurable with this instrument at n=1.

This also invalidates one of the pre-registered reading rules. "The same move on
all three cases is signal" assumed run-to-run noise is independent per case, but
specificity moved +0.18 as a *block* across all three cases between two
identical configurations. The noise is correlated, so direction-consistency does
not protect against it. Every specificity result below is therefore unreadable,
including the four rungs that "consistently" declined.

## What survives the noise floor

Two effects are large enough to be real, and one reported effect was an artifact.

### The 77 percent cut breaks the output contract

L6 scored 0.05 on cold-open-quality on all three cases. That number is not a
writing result. All three L6 runs produced **no H1 at all**, so artifact
extraction fell through to the raw session transcript and the judge scored
`"I'll map the requested commit range first..."` as the opening paragraph.

The real finding is more serious than the number: at 9,975 bytes the agent stops
producing its required output format. The structural guard kept headings in the
*agent file*, but the instruction telling the agent to *emit* a title was prose,
and the cut removed it.

The provider now returns an error instead of falling back to the transcript.
Silently scoring a contract violation as a prose regression is how a harness
manufactures a finding, and it nearly produced one here.

### Cutting the file in half made the openings better

This is the result worth taking seriously, because it is large, consistent, and
points the opposite way from the hypothesis.

| Case | Baseline | L5 (52% cut) |
| --- | --- | --- |
| ollama-17485 | 0.25 | 0.98 |
| promptlings-bmad-gate | 0.84 | 0.97 |
| promptlings-installer | 0.35 | 0.86 |

Baseline cold-open quality is volatile (0.25 to 0.84) and mediocre on two of
three cases. L5 is high on all three. The gain is +0.46, far beyond the 0.09
same-config swing on this dimension, and it climbs monotonically from L2 to L5.

The plain reading: the voice and narrative guidance is over-specified to the
point of degrading the thing it exists to protect. Roughly half the file can go
and the openings improve.

## The one genuine warning at L5

L5 dropped judgment-neutrality to 0.72, and neutrality is a ceiling dimension
where any drop is real. It is driven entirely by one case:

| Case | Score |
| --- | --- |
| ollama-17485 | **0.20** |
| promptlings-bmad-gate | 0.98 |
| promptlings-installer | 0.98 |

The judge's reason: the walkthrough emitted a heading `Why it's defensible` and
argued each choice avoided a specific alternative cost, which renders a verdict
rather than surfacing the fork. That is exactly the failure the agent's
neutrality rules exist to prevent, and L5 cut those rules.

One case is not a regression, it is a risk signal. L6, a deeper cut, scored 1.00
on the same dimension, so the effect is non-monotonic and unreplicated.

## Where the knee is

Between L5 (20,524 bytes, holds or improves on seven of eight dimensions) and L6
(9,975 bytes, stops following its output format).

That is a wide interval, and this run cannot narrow it. What it does establish:

- The file is not merely compressible, it is **over-specified**. Half of it can
  be removed with no measurable loss, and the openings get better.
- The failure at the bottom is not gradual degradation of prose. It is an abrupt
  loss of instruction-following.
- The specific thing worth protecting on the way down is the neutrality rules,
  which produced the only real quality failure observed.

## What this does not show

- **n=1 per cell.** Three cases, one run each, and a 0.18 noise floor. This
  locates a knee; it does not put an interval on it.
- **One judge family.** Agent and judge both run on Copilot.
- **One agent.** Only `pr-walkthrough` was laddered.
- **L1 was empty.** Across four model families, no line was unanimously called
  pure redundancy, yet half the file turned out to be removable. Analyst
  agreement on what is safe to cut was a poor predictor of what actually was.

## Next

1. Replicate L5 at n=3 to test whether the neutrality failure recurs.
2. Bisect between L5 and L6 to find where output-format compliance breaks.
3. Build an L5 variant that restores only the neutrality rules and re-test.
