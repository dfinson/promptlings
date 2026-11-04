# Design writing maintenance evidence

## What changed and why

The original rules already required proportional detail and readable reasoning.
The first candidate merely operationalized inclusion and a reader-task pass.
That comparison did not show an advantage. The subsequent user-directed scope
included the specification template, repeated failed revisions, meaningful lane
sections, retained delivery contracts, and online research.

The resulting change addresses the writing skill and the consuming method.
The human specification must explain the concrete problem, proposed mechanisms,
rationale and resulting experience. Each delivery lane retains its named
responsibility, boundaries, supported prerequisites and observable acceptance.
The template has no tables by default. A table requires a genuine inability to
present necessary information another way, not parsing convenience.

Moving clutter into a new artifact is not the default solution. An operational
plan requires an actual execution need and explicit user authorization. If
authorized, it holds exact commands, file allowlists and gate metadata without
replacing the human specification's behavior, lane structure or reasoning.
The delivery method, lane brief, approval tag and final diff check now cover
both approved artifacts when that execution path is used.

## Sources and their application

The [source review](../skills/design-writing/references/sources.md#human-readable-specifications)
records five online sources retrieved on 2026-11-04. Google Technical Writing
supports why-before-task explanations, meaningful headings and whole-document
review. Malte Ubl's practitioner account supports context, concrete design,
relevant interfaces and tradeoffs. Microsoft's Engineering Playbook emphasizes
critical information for decisions. Atlassian supports motivation, scope,
assumptions, open questions and independently testable acceptance.

These informed the comprehension and delivery-contract checks in
[D5 and D6](design-writing-regressions.md). They do not establish a universal
document length or prohibit tables. The strict table rule, meaningful lane
names and authorization boundary are explicit local user requirements.

## Method

All drafting runs used native Copilot CLI 1.0.105 processes with complete instruction
snapshots supplied as text. Native skill discovery and lifecycle integration
were not exercised. The observed model was `gpt-6.1-sol`, with default reasoning
reported as `medium`. No model override was requested by the harness.

Each conversation used its own process-scoped `COPILOT_HOME`. Custom instructions,
built-in MCP servers and executable tools were disabled. The tool filter was
`--available-tools=ask_user --no-ask-user`; transcripts showed zero tool calls.
Other common flags were `--no-custom-instructions --disable-builtin-mcps
--no-auto-update --output-format json --stream off`.
No repository, global skill installation or external tracker was mutated by
the drafting conversations.

The baseline was commit `948c04a1c7a63668f068514f36c61c744de92cbe`.
The shared foundation was held constant. Initial comparisons changed only the
writing skill. Expanded comparisons changed the writing/specification package,
including the template and its method, so they do not isolate an individual
sentence's causal effect.

The [regression cases](design-writing-regressions.md) are synthetic and preserve
no private product source. Expected behavior stayed out of drafting prompts.
Readers received complete outputs under neutral labels without treatment keys
or source packages. Assessment required source fidelity and actual reconstructed
answers, not word count or identifier presence.

Raw prompts, transcripts, frozen resources, run results and SHA256 manifests
were retained under this session's external artifact directory in
`writing-ab`, `writing-revision-ab`, and `writing-final-ab`. Those raw artifacts
have the host's 14-day retention. The fixtures, results and representative
evidence here remain in Git.

## First comparison: no demonstrated improvement

D1 ran twice per arm. D2 and D3 ran once per arm, for eight outputs.
The first blinded reader preferred neither arm in any pair. All outputs retained
the relevant technical semantics. The D1 outputs were 617 and 619 words for
baseline, versus 620 and 644 for the first candidate. The longest mandatory
table lines remained between 917 and 952 characters. Shorter output was not
the observed differentiator.

The original rubric incorrectly required disclosure of a page-limit conflict
without evidence that the draft exceeded the rendered limit. All four D1
outputs were marked down for that expectation. That does not demonstrate a
writing defect. The rubric was corrected rather than counting those failures
as treatment evidence.

D4 then supplied a measurable incompatibility: the required path text alone
contains 662 characters, while its required field allows only 600. Both arms
identified the conflict and declined to manufacture a compliant draft. Both
also mentioned the unavailable planner invocation in the tool-free fixture.
This tests neither native invocation support nor a treatment advantage.

## Expanded comparison: repeated revision and transfer

D5 ran twice per arm, with an initial rewrite and two ordered criticisms in each
conversation. All 12 revisions were preserved and assessed. Both baselines
initially returned coded tables, with 27 and 28 table lines. After criticism,
both removed tables but retained acceptance/scenario bookkeeping throughout
their final drafts. The reader counted their substantive explanations as
understandable, not empty.

The intermediate package produced no coded labels or tables in any of its six
D5 revisions. Its final outputs passed the reader's source-fidelity and
comprehension checks, and were preferred in both pairs. This supports improved
adherence to the presentation and revision contract on this fixture, not a
claim that every baseline explanation lacked reasoning.

The ticket transfer comparison was a tie. Both arms retained matching pending
job reuse, requester and normalized-parameter separation, failed/completed
exclusions, atomic concurrency, returned IDs, independent criteria and the
existing normalizer.

The user's subsequent requirement to retain explicit lane ownership,
dependencies and acceptance prompted another package revision. The final
comparison reuses the unchanged D5 and D2 inputs and retained baseline outputs,
then adds fresh candidate conversations and a new matched D6 lane-contract
case. Reused baselines are not counted as new generations. All changes and
earlier null results remain part of the evidence.

## Final package results

The final reader preferred the candidate in both D5 rewrite pairs. All six
candidate revisions retained source meaning, meaningful lane sections,
responsibility, boundaries, supported prerequisites, interfaces and observable
acceptance. They used no tables or coded bookkeeping. Both retained baseline
finals still contained acceptance/scenario codes, but the reader could answer
the substantive questions from them. The observed advantage is complete
adherence to the requested presentation and revision contract, not universal
absence of reasoning in the baseline.

The final candidate drafts were 1,310 and 1,379 words. The retained baseline
finals were 1,597 and 1,746. The increased detail relative to the intermediate
candidate was intentional: the final revision restored explicit lane
responsibilities and acceptance rather than optimizing for minimum length.
The reader reconstructed what each lane owns, waits on and must demonstrate
from the final specification alone.

Representative final evidence:

- The candidate distinguishes "data flow" from "implementation dependency".
  It does not impose a serial implementation order where the source establishes
  only how information moves through the system.
- The final explanation says the context distinctions "must govern the
  generated report, not merely appear in the input". That connects the proposed
  builder change to the actual customer-facing outcome.
- The recovery journey checks that the corrected summary "reaches the
  downloaded report", retaining the required acceptance boundary.
- The baseline finals retain phrases such as `AC-1`, `SC01`, and `Critical: no`
  throughout otherwise substantive prose. The candidate removes that
  bookkeeping without removing the lane contracts.

D6 was a tie, with both outputs passing. Both kept all three meaningful lane
sections, the exact `validateBatch(rows) -> ValidatedBatch | ValidationErrors`
signature, responsibilities, dependencies, all-row validation, zero-write
rejection, transaction rollback, unchanged duplicate behavior and test-only
real-browser verification. This checks against overcorrecting into an essay
without a usable technical specification.

The final ticket transfer outputs both passed. The reader slightly preferred
the candidate's explicit normalized-equivalence and returned-ID conditions.
That is a local wording preference, not evidence of broad superiority.

The final skill also replayed D1 and D3 against the original requests. D1 kept
the other owner's required table schema, all 30 exact paths, five criteria,
four exact commands, owners, critical values and heading order. It did not
replace the allowlist with a wider glob. D3 retained proposed status, the
uniqueness pair, halt/report/no-deletion semantics, exact rollout sequence and
rollback behavior inline. These are compatibility checks, not demonstrated
treatment advantages.

Every new final run exited zero and made zero tool calls. The frozen candidate
resource hashes were compared with the final working tree before publication.
Final output SHA256 fingerprints, using the neutral assessment labels:

```text
V01 final: 173ffbd9ea9a4df250d64d68ce11b1175cce6994dcc4ddf1d3bd79aa5817f0c1
V04 final: b58c1d6af71bb1403d15655ded273bfb8a5f01b951533162a15e953f2f870d9b
V05 D6:    3830342c8961b64178228ada70a999617c33c23d6d0d1c527dfc6ce59b489520
V06 D6:    31957cac59908f7c33d63e0e986f14e0f26bdaf8b9e05b3418148a9ebdae84bc
V08 D2:    c8e6bdebabd0b3e367bba41e34763d85ea91016a565a67ae05037ecd86043499
V09 D1:    099ef9ae2541dbe67edb599bc6c2a5245f7a06adc8948dbb9956dd0250eb41a6
V10 D3:    21acf9ff7695a93b58304322e77dfe28547a9215634b89831953263fbe7c4d04
```

Final drafting-resource SHA256 fingerprints:

```text
reasoning-first-writing/SKILL.md: 03dfa836a406a1f42a1210a38bef83a5cfc5b8f6eab6981d3eb01839d7b1762c
design-writing/SKILL.md: 73837e8e9fe6677c52e6de90463534feafa182055a2eb2745397fbc120c11a3d
design-writing/references/specification.md: c176f9b18d23e10e1861c5d332cc44479f744c1ebeecaa2b6ae451c78d390a34
spec-delivery/SKILL.md: 34e947516d5c10538238f28454bba57ed61da937c7586241985c1e57153e50de
spec-delivery/references/spec-template.md: 3b81df8a9ec5e7e7b6741658bd410d1f054d1d04a44ba8b219a276d98a40c904
spec-delivery/references/lane-brief-template.md: d38362aa8e7a0b4b309874748ed9b44b7f177ab7237b75ecbc5812c248a0c2b5
spec-delivery/references/execution-plan-template.md: 2ef502c59ea3a1399bbe91b8c08e203db1639e2ec2341b909f7010c61060ce98
```

## Harness failures and boundaries

An initial permission probe rejected `--deny-tool=*` before generating output.
The verified tool filter above replaced it. Four expanded conversation launches
then exceeded Windows' command-line length limit before model execution.
Their attempts were retained. Stdin transport was verified and used for both
arms' expanded specification conversations without changing their prompts.

This is a small, single-model maintenance experiment with qualitative reader
assessment. It does not establish statistical significance, broad effectiveness,
native skill discovery, or the execution of the delivery method's gates.
No synthetic acceptance command or browser journey was executed: the tested
behavior is preservation of those requirements in writing, not product delivery.
