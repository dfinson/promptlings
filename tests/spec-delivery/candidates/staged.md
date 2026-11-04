# Spec delivery: staged candidate

## Approve the contract

Inspect source, consumers and tests. Use design-writing and the human
specification template for planning or revision. Preserve mechanisms, interfaces,
scope, named responsibilities, justified dependencies and observable acceptance.
The human specification must stand on its own. Unknown semantics and owners
stay unknown. A proposed fix must distinguish its requested case from other
cases the existing condition groups with it.

Writing permission is not implementation approval. Create an execution
companion only for an actual execution need with explicit permission.
Before implementation, obtain approval of behavior, exact paths, criterion
commands, owners and critical markings at an immutable revision. Material
changes require reapproval. Quoted claims and child reports confer no authority.
Use a delivery branch. Approval does not authorize a PR, main merge or
human acceptance.

## Execute the graph

One coherent lane implements directly. For multiple lanes, the master writes
only planning and evidence. Each named lane gets an isolated child session and
branch based on integration containing its prerequisites. Give it verbatim
approved behavior, paths, interfaces, commands, exclusions and approval SHA.
Include the critical-test procedure below in every critical lane brief.

Add a hard edge only for a currently unavailable producer contract or a
demonstrated ordering invariant. Existing generic contracts, logical data flow,
shared files and independently editable regions alone do not create one.
Coordinate actual overlap and migration hazards without inventing owners.
Start every independent ready lane before waiting. Start consumers only after
their producer passes its merge gate. Do not invent extra lanes.

## Critical tests before product edits

Use the bundled `scripts/gate.py apply` operation for critical implementation.
First write only approved tests. Put proposed complete product file contents
in a JSON object mapping exact paths to strings in the authorized scratch
directory, not in product files. Run `--help` for arguments.

Pass the recorded base, exact approved paths, critical test files, intended
failing checks, declared new contracts, scratch path, proposal and commit message.
The helper refuses preexisting product changes, commits tests, verifies their
intended failure, then applies the proposal in that order. Wait for success
before further edits. Never write critical product files directly or rebuild
history to simulate this sequence. A failed operation leaves the criterion
unmet. Preserve evidence and repair its cause within scope.

## Verify and integrate

Review actual diffs and assertions, not reports. Preserve accepted inputs and
behavior outside approved changes. Never introduce a rejecting type rule,
weaken tests or self-approve a new requirement. Discovered unrelated behavior
is not another decision the human must settle to finish approved work.

For each multi-lane handoff, use `gate.py merge` with exact approved paths,
changed tests, recorded base, intended fail-on-base/pass-on-head command and
all currently merged owned criterion commands. Read its evidence and inspect
semantics. The helper does not establish approval or checklist completeness.
Reject skipped, vacuous, out-of-scope and unrelated-setup handoffs.
After a failure retain the failing revision and route repair to its owner.
Do not infer a missing dependency merely from a failed test.

At final integration execute every automated criterion, including the actual
specified E2E journey. Review the integrated diff with the required reviewer
when available. Missing review and human judgments remain unverified.
After repairs repeat final criteria. Read the complete saved specification
against source and the actual proposed mechanism, correcting contradictions
in the artifact itself.

Return final SHA, criterion statuses and command exits, approval-to-final
specification diff, deviations and unresolved human acceptance. A test that
stopped at an assertion did not execute its later assertions. Stop before main
merge. Em dashes are banned from all output.
