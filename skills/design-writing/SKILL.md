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
| Demo or presentation approval briefing | [Visual HTML briefings](references/html-specifications.md) | Judge the whole story, exact script and representative visuals before production |
| Jira, Azure DevOps, GitHub, or other tracker work item | [Ticket writing](references/tickets.md) | Understand one bounded outcome and how to verify it |

Identify the type from the request, existing artifact, and active workflow. Ask only when a genuine ambiguity changes the result. Do not turn a broad design into an ADR or force a technical task into a user-story persona.

For proposals, specifications and media approval briefings, read [visual HTML briefings](references/html-specifications.md). Use a visual-led, standalone HTML reading copy by default, generated from the same authoritative editable content and figures. Explicit destinations and formats win, including conversation-only requests and tracker templates. Keep consequential requirements visible, use established components, support light/dark appearance and preserve offline, keyboard and print access. A reading copy is not a second independently authored plan. Media directors retain story and production ownership. Do not impose an execution-plan template on their briefings.

## Bound the decision before polishing it

The engineering owner first selects a coherent mechanism using existing
capabilities. If that synthesis is missing, return the selection question to
that owner rather than turning a research inventory into implementation scope.
Keep four meanings distinct: the complete opportunity catalogue, the selected
implementation contract, an optional experiment and a human policy decision.
They may share a document, but only selected work acquires delivery obligations.
Unselected opportunities are reference, not an automatically approved backlog.

The primary reading path explains the bounded change, why it is sufficient,
what remains unchanged and how success will be established. Preserve essential
failure behavior. Acceptance must not silently require new coordination,
measurement or evidence infrastructure unrelated to that selected outcome.
Use existing evidence mechanisms where sufficient. An attractive opening,
more figures or collapsed sections cannot substitute for engineering synthesis.

Use the foundation's overview, detail and closing-synthesis structure for every
intent document. Establish the whole proposal before its detailed mechanisms
or tasks, with matching visual hierarchy. Finish with a shorter account of the
outcome, approach, boundaries and actual reader decision. Keep both grounded
in the same contract, without creating a second approval or repeated inventory.

## Draft or revise

1. Read the applicable template, upstream requirements, decision evidence, and draft when one exists. Establish what is decided, proposed, observed, or unresolved. Keep normative requirements separate from explanatory rationale.
2. Name the reader's immediate task: deciding a proposal, understanding a contract, or executing work. Orient them with the concrete problem, relevant context, and intended outcome. Keep a detail in the primary explanation when it changes the reader's understanding of required behavior, a consequential choice, a constraint or acceptance. Distinguish required content from facts merely discovered during investigation. Place other necessary detail in the appropriate part of the authorized artifact. Omit incidental investigation history and repeated qualifications.
3. Apply the foundation's fidelity and language rules, then the selected reference's content checks. Preserve required IDs, numbers, constraints, comparisons, negations, and status values. Avoid replacing a technical distinction with a smoother but weaker sentence.
4. Keep each claim and requirement near the evidence, rationale, or acceptance check that makes it usable. State unresolved criteria explicitly. Do not invent a decision, estimate, owner, measurement, or deadline to fill a template.
5. Explain behavior, rationale and material choices before execution procedures. Preserve exact commands, write sets, interfaces, failure behavior and migration steps when the active artifact contract explicitly requires them. Do not import execution-only fields into a human specification merely because it precedes implementation or is called "implementation-ready". Link to authoritative detail instead of duplicating it only where the owner permits. A companion brief, annex or execution plan needs an actual delivery need and user authorization, not just a readability problem. If required fields conflict with the reader's task, restructure within the authorized artifact or identify the specific conflict. Never silently omit a required field, widen scope or hide a consequential choice.
6. Explain the selected change, not just its outcomes. At guide level, connect the current behavior and its consequence to the proposed mechanism, why it is sufficient and the resulting experience. Use concrete examples where they explain the interaction. At reference level, retain exact contracts and consequential cases. Give distinct mechanisms or necessary tasks their own sections when that helps the reader, without converting every research heading into a delivery lane. Retain responsibility, scope, genuine prerequisites and observable acceptance. Do not invent assignees or dependencies. Separate independently assessable rules and preserve technical meaning through restructuring.
7. When revising after feedback, correct the artifact now within authorized scope rather than waiting for an unrelated workflow or skill repair. Reread the whole result for the reader's task, not only the quoted passage. Cutting words, removing tables, or moving an inventory does not restore missing context or reasoning. Preserve useful explanation while removing bookkeeping, and check that the revision actually resolves the criticism before returning it.

For substantial specifications, let figures and short explanations carry the main reading path, with precise requirements alongside them. Invoke `technical-illustration` for representative design views, comparisons and mechanisms. Neither a text wall nor a diagram full of tiny labels passes. Small deterministic examples may expose consequential choices while acceptance criteria stay fixed. Their controls never confer approval or execute delivery.

## Finish and return

Check coverage against upstream scope and the active template, including interactions between requirements. Separately perform a reader-task pass: read the guide-level explanation without commands, path inventories, or table lookups supplying the argument. Can the intended reader explain what changes, why, the consequential constraints, what remains undecided, and how success will be demonstrated? Reference-level detail must clarify that understanding rather than introduce an undisclosed obligation.

Also check proportionality: the approval referent must be unmistakable,
unselected opportunities must remain separate, and the proposed engineering
and reading effort must fit the objective. Preserve a requested full catalogue
without giving every entry requirements, ownership and acceptance machinery.

Revise before returning when the reader must open source tickets or decode task IDs to learn the plan, a decision is buried after execution detail, a paragraph or table cell mixes independently assessable rules, or repeated qualifications obscure the point. An executive summary above an unchanged dense body is not a repair. Put material unknowns beside the proposal they constrain and keep dependent work conditional. Preserve required tables and independently verifiable criteria. Recheck scope, evidence distinctions, exact values, IDs, ownership and source-of-truth locations after restructuring. Word counts, identifier checks and declarations of readability do not demonstrate comprehension. An unanswered question is not an accepted decision.

Return the requested draft, revision, review, or owner-directed handoff in its required format. In a review-only request, return findings without rewriting. Stop when that output is usable or a concrete missing input blocks it. Writing a ticket never authorizes creating, updating, assigning, or transitioning a live work item.

Read [research and scope](references/sources.md) when checking the evidence behind the genre rules.
