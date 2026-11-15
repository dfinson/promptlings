---
name: design-forks-and-bets
description: Identify design forks (choices a change leaves open) and implicit bets (resolved choices that trade one failure mode for another) in a code change, for the reviewer's judgment. Qualifies candidates, formats entries, and promotes any fork or bet with a demonstrable failing scenario to a finding. Use during PR, branch diff, or local change review and walkthroughs.
---

# Design Forks and Bets

Em dashes are banned from all output. Use commas, colons, semicolons, periods, or parentheses instead.

## Goal

Surface the design choices in a change that a reviewer should consciously agree with, without rendering that judgment. Some review candidates do not fit the "what concretely breaks" frame: the code is internally consistent, and the open question is which tradeoff the team wants. These belong in their own channel, with their own bar, so they neither inflate the defect list nor disappear.

The calling agent decides where the entries appear (an output section, an appendix, or a structured channel). This skill decides what qualifies and what each entry must contain.

## Three kinds of candidate

- **Defect**: has a "what concretely breaks" answer. It is a finding, not a fork or bet.
- **Design fork**: the change is ambiguous between two or more defensible options with different consequences, and the right answer depends on context the reviewer has and the agent does not.
- **Implicit bet**: the change picks one option cleanly, and that choice trades one failure mode for another or commits the codebase to a direction that is expensive to reverse.

## Qualifying a design fork

A candidate is a fork only if all three hold:

1. **The choice is real.** At least two named, defensible options exist with different consequences. "Use a helper or inline it" is a preference, not a fork. "One container image multiplexed across N services at runtime vs. N directories with separate builds vs. one image deployed N times with different env" is a fork: three named architectures with different consequences for build matrix, deployment shape, and observability.
2. **The change does not disambiguate.** The code is consistent with several options, or different parts of the change or its docs imply different options. If the change makes the choice and the only open question is whether you would have made the same call, it is a preference. Drop it, or test it as a bet.
3. **The answer depends on context the agent lacks.** Roadmap, scale targets, team shape, regulatory constraints, prior decisions in unseen code or meetings. If one more search or file read would settle it, do that instead, then resolve the question, convert it to a finding, or drop it.

## Qualifying an implicit bet

A candidate is a bet if:

1. The code is internally consistent and works for the cases it was designed for.
2. A defensible alternative exists that the author did not take.
3. The choice has real consequences: cost to reverse, the shape of the failure mode, or who bears the operational burden.

A changed operating policy that materially trades freshness, latency, resource cost, or availability is a bet whenever the supplied context does not establish the acceptable operating point. Staying within a contract's permitted range does not settle that choice. A bet the change's own docs defend with citations is still a bet; the defense is context for the entry, not a reason to omit it.

## Promote failing forks and bets to findings

A fork or bet with a demonstrable failing scenario is also a defect. If you can name a concrete input, call sequence, or state in which the current code produces a wrong result, loses data, or violates a stated contract, verify it like any other finding and report it in every findings channel the caller requested, including any structured findings file. Keep the fork or bet entry for the tradeoff itself. A choice that only an ordering, timing, or policy decision separates from a wrong result (for example, acting on stale state before a freshness check) usually has such a scenario. Name it.

Conversely, do not downgrade a finding to a fork or bet because its mechanism was hard to verify. Either verify the mechanism and report the finding, or drop it.

## Entry format

Each fork entry contains:

- **Name**: one line.
- **Anchor**: file and line, or document section.
- **Current state**: one sentence on what the change does or implies.
- **Options**: two or three, one phrase each.
- **What differs**: the specific axis (build matrix, runtime cost, blast radius, contract surface, retention shape, failure mode), not "it depends".
- **What would settle it**: a concrete signal such as a number, a roadmap decision, a sign-off, or a benchmark.

Each bet entry contains:

- **Name**: one line.
- **Anchor**: file and line, quoting the line or comment that embodies the bet.
- **What**: one sentence on what the change does.
- **Why it's defensible**: the argument for this choice, including any defense the change's docs give.
- **Alternative cost**: what the road not taken would have cost.
- **The question to answer**: one concrete question the reviewer should have an opinion on before approving.
- **Failing scenario**, when one exists: the scenario and a pointer to the finding it produced.

The calling agent may render these fields as prose or bullets, but every field must be present.

## Rules

- **Keep both channels tight.** Many forks are usually preferences in disguise; many bets are usually obvious-good decisions being second-guessed. For each, ask whether a senior reviewer would actually push back in a real review. If not, drop it.
- **A fork the change's own docs already answer is not a fork.** Re-read the docs and either convert the gap between code and docs into a finding or drop the fork.
- **"What would settle it" and "the question to answer" are mandatory.** Without them the entry is the model narrating its own uncertainty.
- **State the mechanical tradeoff, not a verdict.** Name the two failure modes being traded. Do not call a choice reasonable, acceptable, appropriate, justified, sensible, or a good bet. The reviewer decides.
- **Phrase as observation, not ask.** "The change is consistent with X or Y, which differ on this axis" rather than "have you considered".
- **Anchor every entry in the changed lines.** Only added or modified code is subject to fork and bet analysis.
- **An empty channel is valid.** Do not invent forks or bets to fill a section.

## Proposed comments

When the author can answer a fork or bet's question, the caller may pair the entry with a proposed PR comment anchored to the changed line or range where the choice lives. Load `review-comment-writing` and `reasoning-first-writing` when available. Without them, write in plain English for the author: state what the code commits to and the consequence, then ask the one question that settles it, without headings, labels, internal IDs, hedges, disclaimers, praise, or emoji. Skip the comment when only the reviewer or a product owner can settle the question. Return proposed comments to the caller; never post them.

## Self-check

Before returning, re-read each entry once:

- For a fork: is this actually a finding I downgraded because I could not verify the mechanism? If so, verify and promote it, or drop it.
- For a bet: does it name two concrete failure modes, rather than "I would have done it differently"?
- For both: does a nameable failing scenario exist that should also be a finding?

## Return

Return the qualifying forks and bets in the entry format, the findings promoted from them, and a one-line statement when either channel is empty.
