# Research and scope

Reviewed on 2026-11-02. These sources informed conditional content checks. They do not override an active repository template, tracker process, or delivery method.

| Source | Application |
| --- | --- |
| [Michael Nygard: documenting architecture decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) | Focused records of significant decisions, context, status, and consequences |
| [Design docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/) | Problem context, design explanation, alternatives, tradeoffs, and collaboration |
| [Spec-Kit specification template](https://github.com/github/spec-kit/blob/main/templates/spec-template.md) | User scenarios, requirements, identifiers, success criteria, and explicit unknowns. The installed version owns the current contract |
| [BMAD customization](https://github.com/bmad-code-org/BMAD-METHOD/blob/main/skills/bmod-core-tools/help/customization.md) | Method-supported customization rather than direct edits to managed artifacts. Verify installed support before applying guidance |
| [Ticket research and platform sources](tickets.md#research-basis) | Outcome-focused work items, testable acceptance, type-aware writing, and schema boundaries |

Use `design-analysis` when the technical choice needs evaluation. Use `design-writing` when expressing the established evidence, proposal, or decision. A clearer sentence cannot settle a missing architectural choice.

## Human-readable specifications

Reviewed online on 2026-11-04:

- [Google Technical Writing: organizing large documents](https://developers.google.com/tech-writing/two/large-docs) supports explaining why before tasks, task-based headings, context under headings, and checking the whole document against its intended coverage. It explicitly treats single versus multiple documents as an audience-dependent choice, not a required split.
- [Design docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/) is Malte Ubl's practitioner account, not a universal Google specification standard. It supports context, goals and non-goals, overview before detail, relevant interfaces, and actual tradeoffs. It distinguishes a reasoned design from an implementation manual and allows project-dependent lengths.
- [Microsoft Engineering Playbook: design reviews](https://microsoft.github.io/code-with-engineering-playbook/design/design-reviews/) supports presenting critical information for informed decisions, examining options before implementation, and recording decisions. It does not prescribe a human-specification layout or require another artifact for every writing task.
- [Atlassian: product requirements](https://www.atlassian.com/agile/product-management/requirements) supports motivation, behavior, goals, assumptions, open questions, scope, and enough context for shared understanding. It discusses links as supporting detail, not a substitute for the proposal.
- [Atlassian: acceptance criteria](https://www.atlassian.com/work-management/project-management/acceptance-criteria) supports plain-language, outcome-focused, independently testable conditions. These preserve specification substance alongside explanatory prose.

The synthesis is explanation plus a usable delivery contract, not maximum
brevity or an unstructured essay. The reader needs to understand the problem,
proposed mechanisms and rationale while retaining concrete requirements,
named lane responsibilities, dependencies and acceptance.

The no-default-table rule, meaningful lane names and requirement for user
authorization before creating a companion document are explicit local user
requirements. They are not industry-wide conclusions from these sources.
Atlassian even suggests a questions table. Its format recommendation does not
override this repository's human-specification policy. Sources also do not
establish a universal word count or prove that a new prompt improves outcomes.

## Intent alignment, precision and execution boundaries

Reviewed on 2026-11-10. These precedents inform the distinction between human
agreement, precise contracts and execution readiness:

- [OpenSpec's spec-driven schema](https://github.com/Fission-AI/OpenSpec/blob/579fcac57ae00c2dff38f971b6d88b6f1f098b8a/schemas/spec-driven/schema.yaml)
  separates the proposal, behavioral specifications, technical design and tasks.
  Requirements retain scenarios. Its
  [validator](https://github.com/Fission-AI/OpenSpec/blob/579fcac57ae00c2dff38f971b6d88b6f1f098b8a/src/core/validation/validator.ts)
  warns about long requirement descriptions but exempts modified requirements
  from that length check to preserve existing contracts.
  [Scenario-loss regression tests](https://github.com/Fission-AI/OpenSpec/blob/579fcac57ae00c2dff38f971b6d88b6f1f098b8a/test/core/validation.scenario-loss.test.ts)
  protect baseline scenarios. The local rule is to separate assessable behaviors
  without losing cases, not to adopt OpenSpec's 500-character threshold.
- [Spec Kit's specification template](https://github.com/github/spec-kit/blob/08252af8c5fb1c68135768fde2049d6578fa46c3/templates/spec-template.md)
  starts with prioritized user journeys, acceptance scenarios and requirements,
  separate from the technical plan. Its
  [analysis method](https://github.com/github/spec-kit/blob/08252af8c5fb1c68135768fde2049d6578fa46c3/templates/commands/analyze.md)
  checks coverage, ambiguity, duplication and contradictions. Promptlings retains
  consequential technical design in a human specification where the decision
  needs it, rather than importing a blanket prohibition on implementation detail.
- [Kiro's feature specifications](https://kiro.dev/docs/specs/feature-specs/)
  distinguish requirements, design and tasks, including a design-first path.
  Its [requirements analysis](https://kiro.dev/docs/specs/analyze-requirements/)
  examines interactions and ambiguity. Separating execution metadata does not
  defer necessary feasibility investigation or settle unresolved choices.
- [The Rust RFC template](https://github.com/rust-lang/rfcs/blob/3bdcd22feea6848a7920fa06d17ad4c6ada9db89/0000-template.md)
  provides direct precedent for guide-level explanation through examples followed
  by reference-level semantics, interactions and corner cases in one artifact.
  [RFC 2394](https://github.com/rust-lang/rfcs/blob/3bdcd22feea6848a7920fa06d17ad4c6ada9db89/text/2394-async_await.md)
  applies that structure. Its historical syntax is not a current Rust reference.
  This supports layering, not an arbitrary size limit or mandatory companion.
- [PEP 1](https://peps.python.org/pep-0001/) makes consensus, rationale, precise
  specification, compatibility and unresolved issues part of proposal work.
  Acceptance and Final implementation status are distinct. A reference
  implementation is required before Final, while early prototypes can establish
  feasibility. [PEP 572](https://peps.python.org/pep-0572/) is an applied example
  with semantics, rationale and rejected alternatives. This supports informed
  agreement without treating agreement as completed delivery.

The repository-source links pin the inspected revisions. Kiro and PEP links
are live documentation, assessed on the date above. Source and upstream tests
were inspected, not executed as part of this research. These sources establish
precedent for the chosen boundaries, not measured superiority of this combined
prompt. Local no-default-table, companion-authorization and delivery-gate rules
remain local policy. Native regression evidence must separately establish what
the revised Promptlings instructions actually do.
