---
name: spec-delivery
description: Coordinate approved spec-backed delivery while preserving intent. For specification-only work, use the human specification path without execution manifests or implementation authority.
---

# Spec Delivery

## Contract and authority

For specification-only requests, use design-writing and
`references/spec-template.md`, then stop at a human-reviewable specification.
This applies even when this delivery skill was loaded by a caller. Do not turn
"before implementation" or "implementation-ready" into a request for an execution
manifest. Delegate the user's actual scope, not extra commands, write sets or
gate metadata. Explicitly requested operational fields still need faithful
presentation or a surfaced conflict, not silent removal.

Inspect source, consumers and tests to establish intent, the requested delta
and feasibility. Preserve technical substance, meaningful named task sections,
concrete mechanisms, observable acceptance and justified edges. Known behavior
is not a human decision. Distinguish the requested case from other cases
grouped by the old condition. Reconcile intent whenever a proposed mechanism
or scope changes, not only after writing or implementation.

Select the smallest coherent implementation using existing mechanisms before
planning delivery. A complete opportunity catalogue is not a selected roadmap.
Separate the bounded contract, optional experiments and policy decisions.
Acceptance should prove that contract and its affected failure paths, not
silently require new general-purpose infrastructure.

Load intent-alignment before selecting the delivery mechanism. Check required
coverage and scope restraint against the user's evidenced intent and accepted
changes, not only the derived specification. Apply the same check before
presenting, assigning work or proceeding on a material change to assumptions,
dependencies or acceptance. A child brief cannot create new scope.
Reuse unchanged evidence and the existing record. Route corrections through
the existing owner and retain the human template's comprehension checks.
An alignment result does not replace human approval.

The execution rules below apply when preparing or carrying out authorized
delivery, not as mandatory fields of every human specification.
Writing permission is not implementation approval. Bind the selected behavior
to the user's actual implementation authorization and preserve its reviewed
revision. Agreement on the human specification alone is not execution readiness.
Before implementation, establish the selected scope and actual authority.
"Implement it" authorizes the clear selected contract, not every
unselected opportunity. Resolve only material ambiguity, policy choices or
authority gaps before proceeding.

Record scope, product base and appropriate checks in the existing session
record. Do not demand a separate approval of routine file choices or commands
for an ordinary bounded change. When the user requests an execution plan or
an active delivery contract requires it, preserve exact paths, owners, criterion commands
and critical markings at an immutable revision. Obtain that plan's required
approval before use.
When presenting such a plan to a human, invoke `reasoning-first-writing` and
frame the exact operational content with its overview and shorter closing
synthesis. Follow `references/execution-plan-template.md` without omitting
fields. An internal execution record need not acquire presentation prose.
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
and host permissions. Write every PR title and description with
`pr-description-writing`. If publication is not authorized, preserve PR-shaped
branches and report that boundary rather than combining them locally.
Approval does not authorize merging a PR or final human acceptance.

## Ready work

One bounded change normally has one owner and one reviewable patch in the
existing worktree. Record its intended target, product base, selected scope and
checks. Split into delivery lanes only for a concrete independent outcome,
review/deployment risk or genuine dependency, within the user's constraints.
The number of research headings or available agents is not a reason to split.

Recheck proportionality before fan-out when a modest objective produces many
abstractions, services, persistent stores, PRs or clarification questions.
Simplify the mechanism and reuse existing functionality. If necessary work
cannot fit an explicit size constraint, explain that conflict rather than
silently widening or discarding scope. Retain unselected opportunities as
reference, not mandatory later work.

For genuinely separate delivery lanes, the master coordinates planning,
PRs and evidence rather than writing product code. Each lane gets an isolated
child and branch. Record the lane base before tests or product edits. Supply
verbatim approved behavior, immutable approval references, recorded base, exact
paths, interfaces, commands, exclusions, PR target, runnable helper and accessible
artifact and scratch locations. Use `references/lane-brief-template.md`.

Carry the selected mechanism, overall size/complexity constraint and exclusions
into each assignment. Ask for the minimum sufficient change, not fresh
architecture or PR decomposition by default. The coordinator remains
accountable for expansion.

The following concurrency rules apply after a delivery split is justified.
Maximize safe concurrency. Start every ready independent lane before waiting.
An acyclic graph's hard edges need an unavailable producer contract or
demonstrated ordering invariant. Existing generic contracts, logical flow,
shared files and separate schema regions alone do not create one. Agree
interfaces and coordinate actual overlap and migration hazards. Start consumers
as soon as their required producer contract is available and its prerequisite
checks pass, including on an unmerged PR. Do not wait for final acceptance or
merge when a passing stack permits progress. Keep unaffected work moving when
one lane is blocked. Independent PRs target the intended delivery branch.
A genuine consumer may target an unmerged producer's passing branch.
Do not invent owners, lanes or speculative contracts.

Never use an accumulating local integration branch as the default handoff or
publication source. Do not feed unrelated lane commits back into review
branches. A real prerequisite belongs in an explicit stack, not hidden ancestry.

## Critical implementation

Apply this procedure only to human-marked critical criteria under the approved
gate contract. Do not invent critical markings or new tests to make routine
documentation work fit it. First write only approved critical tests. Put proposed complete product file
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

For gate-managed changed-behavior handoffs, run `scripts/gate.py handoff --help`, then invoke
handoff with `--base <lane-base-sha>`, `--target <actual-target-sha>` and
`--head <actual-pr-head-sha>`, exact paths, changed tests, intended
fail-on-base/pass-on-head commands and authorized scratch. Read its
revision-bound evidence and inspect semantics, including peer changes within
shared files. The helper checks scope and tests without merging branches. It
does not establish human approval, PR publication or checklist completeness.
Documentation-only lanes need appropriate diff review, not invented failing
tests. Ordinary bounded changes use the repository's smallest relevant checks
and actual required acceptance. Reject skipped, vacuous, out-of-scope or unrelated-setup evidence.
For bug fixes, reproduce the observed failure on the baseline and demonstrate
its resolution on the changed revision with the same focused check when
feasible. Existing tests or a bounded runtime observation can supply that
evidence without the handoff helper or new maintained test infrastructure.
If baseline execution is blocked, retain the specific reason and distinguish
passing changed-revision checks from demonstrated regression protection.
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
outcome, including proportional scope and the selected mechanism. Keep unresolved intent and unverified behavior explicit without
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
