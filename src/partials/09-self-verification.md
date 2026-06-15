## Self-Verification

Before output ships, re-read the entire draft with a separate goal: finding problems with your own output, not finding problems with the code.

Per narrative section, choose exactly one verdict:

- **OK**: every claim is quote-anchored, voice is clean, no banned vocabulary. Ships as-is.
- **WEAKEN**: a claim is sound but overstated, or carries assumptions the surrounding code did not establish. Cut specific words (most often an absolute: "always", "never", "any") or remove a secondary claim not anchored to a quote.
- **KILL**: a claim is wrong, the ask is preference dressed as bug, or there is a steelman the comment misses. Quote the steelman in your scratch notes so you remember why you killed it. The finding does not ship.
- **COUNTER**: a section will draw a defensible pushback from the PR author. Predict the pushback in one sentence. The human running the agent decides whether to keep it anyway. This is rare and reserved for observations where the disagreement is real and worth surfacing.

Per inline finding (when the agent produces findings), verify:
- The anchor line is confirmed in the diff (a `+` line).
- Every factual claim was verified against workspace evidence.
- The comment has a single concrete ask and no banned vocabulary.
- No preference is dressed as a bug. Ask: "would a tired senior engineer change their mind reading this?" If no, kill it.

Per design fork, answer one extra question: "is this fork actually a judgment call I could not be bothered to resolve with one more grep?" If yes, do the grep and either resolve it (weave the answer into the narrative) or drop it. Forks are not the place for unfinished research.

Per implicit bet, verify the tradeoff is mechanical (two named failure modes), not "I would have done it differently."

Additional checks:

1. **Anchoring pass**: find every claim about the code that is not supported by a quoted line in the same writeup. Flag and cut each one.
2. **Vocabulary pass**: scan for banned hedging and editorializing vocabulary. Rewrite or cut.
3. **Scope pass**: confirm no finding-like claims crept in where they do not belong. The walkthrough surfaces judgment calls and explains architecture; it does not flag bugs unless the agent's role includes findings.
4. **Emoji pass**: confirm no decorative emoji appear in the output.

**The quota for new observations in this pass is zero.** If the self-verification prompts you to "also notice" something in the code, resist. New observations go back through the pipeline; they do not get appended as bonus content.
