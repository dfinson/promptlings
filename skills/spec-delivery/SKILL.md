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
Keep working specs, plans and evidence in session artifacts or the user's
chosen external system by default. Record each artifact's locator and immutable
version, or SHA-256 of its exact saved bytes, with the human approval reference.
This approval identity is separate from the product Git base. Approval of
content does not authorize adding planning artifacts to Git. Track them only
when the user explicitly requests it, and keep authorized documentation commits
separate from implementation.
Material changes require reapproval. A companion needs both an execution need
and explicit permission. Quotes and child reports confer no authority.
Plan PRs as the default delivery surface. Publish only with user authorization
and host permissions. If publication is not authorized, preserve PR-shaped
branches and report that boundary rather than combining them locally.
Approval does not authorize merging a PR or final human acceptance.

## Ready work

Use one reviewable PR per coherent lane by default. Record its branch, intended
target, product base SHA, scope and genuine dependencies in the existing
session record or authorized plan. Independent PRs target the repository's
intended delivery branch. A consumer that needs an unmerged producer can stack
on its passing head and target that producer's branch. Do not equate three
sessions with three independent PRs if the implementation genuinely requires
a different split, but never collapse lanes merely because they were tested
together.

One coherent lane implements directly in the existing worktree without a child
session or another worktree. For multiple lanes, the master coordinates planning,
PRs and evidence rather than writing product code. Each lane gets an isolated
child and branch. Record the lane base before tests or product edits. Supply
verbatim approved behavior, immutable approval references, recorded base, exact
paths, interfaces, commands, exclusions, PR target, runnable helper and accessible
artifact and scratch locations. Use `references/lane-brief-template.md`.

Maximize safe concurrency. Start every ready independent lane before waiting.
An acyclic graph's hard edges need an unavailable producer contract or
demonstrated ordering invariant. Existing generic contracts, logical flow,
shared files and separate schema regions alone do not create one. Agree
interfaces and coordinate actual overlap and migration hazards. Start consumers
as soon as their required producer contract is available and its prerequisite
checks pass, including on an unmerged PR. Do not wait for final acceptance or
merge when a passing stack permits progress. Keep unaffected work moving when
one lane is blocked. Do not invent owners, lanes or speculative contracts.

Never use an accumulating local integration branch as the default handoff or
publication source. Do not feed unrelated lane commits back into review
branches. A real prerequisite belongs in an explicit stack, not hidden ancestry.

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

## PR handoff and integration

Inspect actual diffs and assertions. Preserve accepted inputs and behavior
outside the approved delta. Never tighten types, weaken tests or self-approve
requirements. Unrelated discoveries do not become mandatory human decisions.

For each PR, inspect its actual target, head, full diff and commit range.
Confirm it contains only its approved change and authorized documentation.
Check both the lane delta from its recorded base and the review diff against
the current target. A lane-scoped delta does not prove a lane-scoped PR.
If the PR is not yet published, use its intended target and branch head, then
confirm those identities after publication. Retargeting, rebasing or a target
advance requires refreshed diff evidence. Never move the recorded base merely
to conceal unrelated changes.

For changed-behavior handoffs, run `scripts/gate.py handoff --help`, then invoke
handoff with `--base <lane-base-sha>`, `--target <actual-target-sha>` and
`--head <actual-pr-head-sha>`, exact paths, changed tests, intended
fail-on-base/pass-on-head commands and authorized scratch. Read its
revision-bound evidence and inspect semantics, including peer changes within
shared files. The helper checks scope and tests without merging branches. It
does not establish human approval, PR publication or checklist completeness.
Documentation-only lanes need appropriate diff review, not invented failing
tests. Reject skipped, vacuous, out-of-scope or unrelated-setup evidence.
Retain failing revisions and route repair to owners. A failed prerequisite
blocks its consumers, not unrelated lanes. A failed test alone does not
establish a dependency.

Use the repository's PR checks for integration. When combined acceptance needs
multiple unmerged lanes, an isolated disposable checkout may test their exact
heads. Keep that synthetic result out of review branches and product history.
Record the tested heads and resulting revision. Refresh affected checks when
they change. PR merges still require separate authority. After a producer
merges, reconcile and retarget its consumers without pulling unrelated lanes
into their diffs, then rerun the affected handoff and integration checks.
If rebasing changes a lane's starting revision, record the new product base
while preserving the original test-first evidence and approval references.
Do not reconstruct history as a substitute for that evidence.

At final integration execute every automated criterion, including the actual
required E2E journey. Repeat after repairs. Load intent-alignment to compare the
integrated behavior and evidence with the approved baseline and intended
outcome. Keep unresolved intent and unverified behavior explicit without
inventing additional acceptance criteria. Use sparring-partner for integrated
review and review-ensemble for human-marked risky work when available.
Missing review and human judgments remain
unverified. A stopped test did not execute its later assertions.

Return the PRs and their targets and head SHAs, the exact combined revision
tested when applicable, criterion statuses and exits, approval-to-final
specification changes, deviations and unresolved human acceptance. Read the
complete saved specification and fix contradictions in that artifact itself.
Stop before any unauthorized PR merge.
Em dashes are banned from all output.
