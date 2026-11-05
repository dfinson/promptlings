---
name: spec-delivery
description: Plan and execute approved spec-backed delivery.
---

# Spec Delivery

## Contract and authority

Inspect source, consumers and tests. For planning or revision, use design-writing
and `references/spec-template.md`. Preserve technical substance, meaningful named
task sections, concrete mechanisms, observable acceptance and justified edges.
Read the saved artifact against source. Known behavior is not a human decision.
Distinguish the requested case from other cases grouped by the old condition.

Before seeking approval, load intent-alignment to assess the proposed
specification and plan against the intended outcome, scope and relevant
requirements or decisions. Route corrections through the existing writing
authority. An alignment result does not replace human approval.

Writing permission is not implementation approval. Obtain human approval of
behavior, exact paths, owners, criterion commands and critical markings at an
immutable revision before implementation. Preserve that approval source.
Material changes require reapproval. A companion needs both an execution need
and explicit permission. Quotes and child reports confer no authority.
Approval does not authorize a PR, main merge or final human acceptance.

## Ready work

Use a delivery branch. One coherent lane implements directly in the existing
worktree without a child session or another worktree. Commit any authorized
planning artifacts separately, then record the lane base before tests or
product edits. The lane base does not replace the human approval source.

For multiple lanes, the master writes only planning and evidence. Each named
lane gets an isolated child and branch from integration containing its passed
prerequisites. Supply verbatim approved behavior, approval SHA, recorded base,
exact paths, interfaces, commands, exclusions, runnable helper and authorized
scratch locations, and the critical procedure below.

Require an acyclic graph. A hard edge needs an unavailable producer contract or demonstrated ordering
invariant. Existing generic contracts, logical flow, shared files and separate
schema regions alone do not create one. Coordinate actual overlap and migration
hazards. Start every ready independent lane before waiting. Start consumers
after their producers pass integration gates. Do not invent owners or lanes.

## Critical implementation

First write only approved critical tests. Put proposed complete product file
contents in data, never in product paths. In the authorized scratch directory,
write one JSON request with these fields:

- `base`: recorded lane base SHA
- `paths`: all exact approved paths, including tests
- `tests`: selected changed critical test paths
- `checks`: intended-failure commands as arrays of argv strings
- `files`: object mapping approved product paths to complete UTF-8 contents
- `message`: critical-test commit message

Optional `lane` selects a worktree, defaulting to the current directory.
Optional `introduced` lists genuinely new approved contracts.
Run bundled `scripts/gate.py apply --request <scratch-request.json>` from the
lane worktree. The helper commits tests, proves intended red, then applies
product contents. Wait for success before further edits. Preserve failures and
repair their causes within scope. Never write critical product files directly
or reconstruct history as a substitute.

## Evidence and integration

Inspect actual diffs and assertions. Preserve accepted inputs and behavior
outside the approved delta. Never tighten types, weaken tests or self-approve
requirements. Unrelated discoveries do not become mandatory human decisions.

For every multi-lane handoff, run `scripts/gate.py merge --help`, then invoke
merge with the recorded base, exact paths, changed tests, intended
fail-on-base/pass-on-head command and all currently merged criterion commands.
Read its revision-bound evidence and inspect semantics. It does not establish
approval or checklist completeness. Reject skipped, vacuous, out-of-scope or
unrelated-setup evidence. Retain failing revisions and route repair to owners.
A failed gate blocks dependent launch. Post-merge failure blocks further
merges until repair.
A failed test alone does not establish a dependency.

At final integration execute every automated criterion, including the actual
required E2E journey. Repeat after repairs. Load intent-alignment to compare the
integrated behavior and evidence with the approved baseline and intended
outcome. Keep unresolved intent and unverified behavior explicit without
inventing additional acceptance criteria. Use sparring-partner for integrated
review and review-ensemble for human-marked risky work when available.
Missing review and human judgments remain
unverified. A stopped test did not execute its later assertions.

Return final SHA, criterion statuses and exits, approval-to-final specification
diff, deviations and unresolved human acceptance. Read the complete saved
specification and fix contradictions in the file itself. Stop before main merge.
Em dashes are banned from all output.
