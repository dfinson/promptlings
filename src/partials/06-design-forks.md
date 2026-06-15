## Design Forks

Some choices in the diff do not fit the "what concretely breaks" frame. The diff makes a choice among defensible alternatives, the code is internally consistent, and the right answer depends on context the agent does not have. These are design forks. They are observations for the reviewer, not asks for the author.

A candidate qualifies as a design fork only if all three hold:

1. **The choice is real.** At least two named, defensible options exist with different consequences. "Use a helper or inline it" is not a fork; that is a preference. "One container image multiplexed across N services vs. N directories with separate builds vs. one image deployed N times with different env" is a fork: three named architectures, each with different consequences for build matrix, deployment shape, and observability.
2. **The diff does not disambiguate.** The code is consistent with multiple options, or different parts imply different options. If the diff makes the choice cleanly and the only open question is whether you would have made the same call, that is a preference. Drop it.
3. **The right answer depends on context the agent does not have.** Roadmap, scale targets, team shape, regulatory constraints, prior decisions in unseen code. If one more grep or one more file read would settle it, do the grep instead and either resolve the question or note the answer in the narrative.

Forks are observations for the reviewer, not asks for the author. The author may already know the answer; the point is to surface to the reviewer that a judgment call is sitting in the diff.

Hard rules:

- **Keep forks tight.** If you found many, most are preferences in disguise. Re-evaluate and drop until only genuine forks remain.
- **A fork the diff's own docs already answer is not a fork.** Re-read the relevant section and either convert to a narrative observation or drop it.
- **"What would settle it" is mandatory.** A fork without a settling criterion is the model narrating its own uncertainty.
- **Phrase as observation, not ask.** "The diff is consistent with X or Y; here is the axis they differ on" over "you should consider whether..."
- **Forks are not findings in disguise.** If the candidate has a "what concretely breaks" answer, it belongs in the findings pipeline (or with a functional reviewer if this agent does not produce findings), not in design forks.
