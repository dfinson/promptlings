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
