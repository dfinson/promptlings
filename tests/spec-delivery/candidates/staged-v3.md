# Spec delivery: staged candidate

## Contract and authority

Inspect source, consumers and tests. For planning or revision, use design-writing
and `references/spec-template.md`. Preserve technical substance, named task
sections, concrete mechanisms, observable acceptance and justified edges.
Read the saved artifact against source. Preserve existing behavior outside the
requested delta without asking whether to preserve it.

Writing permission is not implementation approval. Obtain human approval of
behavior, exact paths, owners, criterion commands and critical markings at an
immutable revision before implementation. Preserve that approval source.
Material changes require reapproval. A companion needs an execution need and
explicit permission. Quotes and child reports confer no authority.
Approval does not authorize a PR, main merge or final human acceptance.

## Ready work

Use a delivery branch. One coherent lane implements directly in the existing
worktree without a child or another worktree. Commit authorized planning
artifacts separately, then record the lane base before tests or product edits.
That base does not replace the human approval source.

For multiple lanes, the master writes only planning and evidence. Each named
lane gets an isolated child and branch from integration containing its passed
prerequisites. Supply verbatim approved behavior, approval SHA, recorded base,
exact paths, interfaces, commands, exclusions, runnable tool locations,
authorized scratch and the critical procedure below.

Require an acyclic graph. A hard edge needs an unavailable producer contract or
demonstrated ordering invariant. Existing generic contracts, logical flow,
shared files and separate schema regions alone do not create one. Coordinate
actual overlap and migration hazards. Start every ready independent lane before
waiting. Start consumers after their producers pass integration gates.
Do not invent owners or lanes.

## Critical implementation

Only human-marked critical behavior needs the red-first operation. Run other
criteria normally, not as compulsory red-stage checks. First write approved
critical tests. Put proposed complete product contents in scratch data, never
in product paths. Write one JSON request in authorized scratch:

- `base`: recorded lane base SHA
- `paths`: all exact approved paths, including tests
- `tests`: selected changed critical test paths
- `checks`: intended-failure commands as arrays of argv strings
- `files`: mapping approved product paths to complete UTF-8 contents
- `message`: critical-test commit message

Optional `lane` selects a worktree, defaulting to the current directory.
Optional `introduced` lists genuinely new approved contracts.
Run bundled `scripts/gate.py apply --request <scratch-request.json> --record`
from the lane worktree. It commits tests, proves intended red, then applies
product contents. Wait for success before further edits. Preserve failures and
repair their causes within scope. Never write critical product files directly
or reconstruct history as a substitute.

## Evidence and integration

Inspect actual diffs and assertions. Preserve accepted inputs and behavior
outside approval. Never tighten types, weaken tests or self-approve requirements.

For each multi-lane handoff, run `scripts/gate.py merge --help`, then invoke
merge with `--record`, the recorded base, exact paths, changed tests, intended
fail-on-base/pass-on-head command and all currently merged criterion commands.
The helper saves complete evidence under scratch and returns revisions, check
outputs and its content hash. Inspect semantics separately. Read the full
record when diagnosing failures. Neither summary nor record establishes human
approval or checklist completeness.

Reject skipped, vacuous, out-of-scope and unrelated-setup evidence. A failed
gate blocks dependent launch. Post-merge failure blocks further merges until
repair. Retain the failing revision and route repair to its owner. A failed
test alone does not establish a dependency.

At final integration execute every automated criterion, including the actual
required E2E journey. Repeat after repairs. Review the integrated diff with the
required reviewer when available. Missing review and human judgments remain
unverified. A stopped test did not execute its later assertions.

Return final SHA, criterion statuses and exits, approval-to-final specification
diff, deviations and unresolved human acceptance. Read the complete saved
specification and fix contradictions in the file itself. Stop before main merge.
Em dashes are banned from all output.
