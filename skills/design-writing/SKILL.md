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
2. Name the reader's immediate task: deciding a proposal, understanding a contract, or executing work. Orient them with the concrete problem, relevant context, and intended outcome. For each detail, ask what decision, behavior, constraint, or action it helps them assess. Keep required content and the explanation needed for that task. Omit incidental investigation history and repeated qualifications.
3. Apply the foundation's fidelity and language rules, then the selected reference's content checks. Preserve required IDs, numbers, constraints, comparisons, negations, and status values. Avoid replacing a technical distinction with a smoother but weaker sentence.
4. Keep each claim and requirement near the evidence, rationale, or acceptance check that makes it usable. State unresolved criteria explicitly. Do not invent a decision, estimate, owner, measurement, or deadline to fill a template.
5. Explain the behavior and rationale before commands or file inventories. Keep exact commands, write sets, interfaces, failure behavior, and migration steps wherever the contract requires them. Use a precise grouping only if it preserves the same scope. Link to existing authoritative detail rather than duplicate it, but never replace a required field with a pointer unless the owner permits it. Creating a companion brief, annex, or execution plan needs an actual delivery need and user authorization. It is not the default fix for unreadable writing. Mandatory headings and columns do not require exhaustive prose in every cell. If required detail cannot fit the owner's readability or length constraint without losing meaning, identify the specific conflict for the owner instead of silently changing the template, widening scope, or hiding detail elsewhere.
6. Explain the plan, not just its desired outcomes. Connect the current behavior and its consequence to the concrete proposed change, why that mechanism addresses the problem, and what the user will experience. Use established evidence and label proposals. A ticket-link index, safeguard slogan, or list of acceptance IDs cannot supply that explanation. Give each task a meaningful name and its own section when presenting a multi-task plan to a human. For lane-based delivery, retain each named lane's responsibility, scope, known prerequisites, important contracts, and observable acceptance in that specification. Do not invent personal assignees or dependencies. Connect the sections through the problem and dependencies, not a series of interchangeable headings. Readability must preserve a technical specification, not turn it into an essay without a delivery contract.
7. When revising after feedback, correct the artifact now within authorized scope rather than waiting for an unrelated workflow or skill repair. Reread the whole result for the reader's task, not only the quoted passage. Cutting words, removing tables, or moving an inventory does not restore missing context or reasoning. Preserve useful explanation while removing bookkeeping, and check that the revision actually resolves the criticism before returning it.

## Finish and return

Check the full artifact against upstream scope and the active template. Then perform a reader-task pass: read the explanation without relying on commands, path inventories, or table lookups to supply the argument. Can the intended reader explain what changes, why, the consequential constraints, what remains undecided, and how success will be demonstrated?

Revise before returning when the reader must open source tickets or decode task IDs to learn the plan, when a decision is buried after execution detail, a table cell mixes independently assessable requirements, a non-comparative table hides the explanation, or repeated qualifications obscure the main point. Put material unknowns next to the proposal they constrain, and keep dependent implementation conditional rather than assigning a settled contract. Preserve required tables and independently verifiable criteria. Recheck scope, evidence distinctions, exact values, IDs, ownership, and source-of-truth locations after restructuring. Word counts, identifier checks, and a statement that the draft is readable do not demonstrate comprehension. Shorter output alone does not pass. An unanswered question is not an accepted decision.

Return the requested draft, revision, review, or owner-directed handoff in its required format. In a review-only request, return findings without rewriting. Stop when that output is usable or a concrete missing input blocks it. Writing a ticket never authorizes creating, updating, assigning, or transitioning a live work item.

Read [research and scope](references/sources.md) when checking the evidence behind the genre rules.
