---
name: design-writing
description: Draft or revise ADRs, specifications, technical design documents, and Jira, Azure DevOps, GitHub, or other tracker tickets. Express context, decisions, behavior, tradeoffs, and verifiable outcomes clearly while preserving the active template, method, and artifact owner.
---

# Design Writing

## Goal and boundaries

Make a technical artifact understandable and usable for its reader's decision or delivery task. This skill owns expression and artifact-specific content checks. It does not choose the architecture, run a delivery method, create a backlog hierarchy, approve work, or publish tickets.

Before drafting or revising, invoke `reasoning-first-writing` through the host's skill mechanism. If invocation is unavailable, read that skill's `SKILL.md` through the host's documented discovery location. Do not assume a personal installation path or read another skill's private resources. If the foundation cannot be loaded, name the missing dependency and stop the writing task without installing or substituting it.

The active repository template, tracker schema, and owning method govern structure and lifecycle. BMAD, Spec-Kit, ADR tooling, and backlog planners retain their own required sections, identifiers, acceptance gates, and mutation authority. Give the relevant writing constraints to the owning invocation or supported customization. Do not bypass it by rewriting managed artifacts directly. If it cannot accept the guidance, report that limitation rather than claim integration.

## Select the artifact

Read only the reference matching the artifact being written. For a deliverable with multiple artifact types, load each applicable reference for its own part, not every reference by default.

| Artifact | Required reference | Reader's task |
| --- | --- | --- |
| ADR | [ADR writing](references/adr.md) | Understand one significant decision, its rationale, and consequences |
| Specification or implementation plan | [Specification writing](references/specification.md) | Determine required behavior, constraints, delivery work, and acceptance |
| Broader technical design | [Design document writing](references/design-document.md) | Follow the proposed system, its flows, interfaces, and tradeoffs |
| Jira, Azure DevOps, GitHub, or other tracker work item | [Ticket writing](references/tickets.md) | Understand one bounded outcome and how to verify it |

Identify the type from the request, existing artifact, and active workflow. Ask only when a genuine ambiguity changes the result. Do not turn a broad design into an ADR or force a technical task into a user-story persona.

## Draft or revise

1. Read the applicable template, upstream requirements, decision evidence, and draft when one exists. Establish what is decided, proposed, observed, or unresolved. Keep normative requirements separate from explanatory rationale.
2. Orient the reader with the concrete problem, relevant context, and intended outcome. Include only background needed to understand or execute this artifact, with links to longer material where useful.
3. Apply the foundation's fidelity and language rules, then the selected reference's content checks. Preserve required IDs, numbers, constraints, comparisons, negations, and status values. Avoid replacing a technical distinction with a smoother but weaker sentence.
4. Keep each claim and requirement near the evidence, rationale, or acceptance check that makes it usable. State unresolved criteria explicitly. Do not invent a decision, estimate, owner, measurement, or deadline to fill a template.
5. Use implementation detail where the artifact requires it. Link to longer designs rather than duplicating them in every ticket. Do not remove essential interfaces, failure behavior, or migration steps merely to shorten a specification.

## Finish and return

Check the full artifact against upstream scope and the active template. Verify that a reader can identify the intended outcome, rationale where relevant, constraints, material unknowns, and what would demonstrate success. Check term consistency and semantic repetition. An unanswered question is not an accepted decision.

Return the requested draft, revision, review, or owner-directed handoff in its required format. In a review-only request, return findings without rewriting. Stop when that output is usable or a concrete missing input blocks it. Writing a ticket never authorizes creating, updating, assigning, or transitioning a live work item.

Read [research and scope](references/sources.md) when checking the evidence behind the genre rules.
