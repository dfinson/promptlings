# Spec delivery: checked candidate

## Plan and authority

Inspect actual source, consumers and tests before deciding. Load design-writing
and the human specification template. Explain the current situation, proposed
mechanisms, rationale, resulting user experience, exact constraints and
important interfaces and failure behavior. Give each task a meaningful name
and its own section with ownership, boundaries, supported prerequisites and
observable acceptance. Use no tables unless necessary information has no
other presentation. Preserve technical substance and revise the whole artifact
after feedback. Keep unknown owners, behavior and estimates unresolved.

Writing permission authorizes only writing. An execution companion needs an
actual delivery need and explicit user authorization. If authorized, map it
to the human explanation and approve both at one revision. Obtain human
approval of exact scope, criterion methods, ownership, write sets and critical
or risky markings before implementation. Record approval immutably, never
force-move its tag. Material changes pause affected work for reapproval.
Use a delivery branch separate from main. Implementation approval never
substitutes for human acceptance or main-merge authorization.

## Ownership and dependencies

Use one coherent lane unless independent ownership repays delegation. Implement
and repair directly on this path, without lane sessions, briefs or handoff
gates. Commit critical changed-behavior tests and demonstrate their intended
failure before implementation, then make the same assertions pass.

For multiple lanes the master never edits product code or tests. Give every
criterion one named owner, including integration E2E and human judgments.
Require an acyclic graph and exact approved write sets, not widened globs.
Add an edge when a consumer needs an unavailable producer contract or a real
ordering invariant requires it. Existing generic contracts, logical data flow,
shared files and distinct schema regions are not themselves prerequisites.
Inspect concurrent pairs and record concrete coordination or recovery for
hotspots. Serialize only when safe concurrent editing cannot be established.

Start each ready lane in its own named child session and isolated branch or
worktree, based on integration containing its prerequisites. Start independent
ready lanes concurrently where supported. Supply verbatim approved behavior,
scope, interfaces, criterion commands, exclusions and approval SHA. Use the
lane brief template without adding PR instructions unless a PR was requested.
Children stop for scope changes. If isolated execution is unavailable, stop.

## Executable gates

Treat reports as claims. Review the actual lane diff for scope, undeclared
contracts and weakened or deleted assertions. Route scope changes back for
approval, not into a rewritten spec. Identify a changed-behavior test command
that fails without this lane. Existing regression tests may still pass on base.
A direct-call requirement needs a test of that call, not response tests that
already pass through a different caller.

For every multi-lane merge, use the bundled `scripts/gate.py` merge operation,
not a separate bare Git merge. Pass the lane worktree, its recorded base, exact
approved paths, changed test files, introduced contracts, changed-behavior
command as JSON argv, an authorized external scratch directory and ALL
criteria owned by currently merged lanes including the incoming lane.
Run `--help` for the exact CLI. The helper checks committed state, scope,
markers, pass-on-head, intended fail-on-base, then merges and immediately runs
the merged criteria. Read its full evidence. It does not assess semantics,
approval or completeness of the supplied check list.

Never mark a failed inspection as an empty successful result. A helper failure
blocks the next merge and dependent launch. Preserve the failing revision,
diagnose implementation, environment, conflict and missing prerequisite
separately, and route repair to the owner. Change the graph only when evidence
requires it and obtain reapproval for material amendments. Stop after two
failed repair rounds for a material approach decision. After conflicts the
owner reconciles against current integration and repeats the gate.

At the final head run every automated criterion, including the actual specified
E2E journey. Unit, mock and partial integration checks never replace E2E.
Review the integrated diff against the spec with sparring-partner, escalating
human-marked risky work to review-ensemble where available. Missing required
review and human judgments remain unverified. Disposition findings and rerun
final criteria after repairs.

Present final SHA, criterion-by-criterion verified/unmet/unverified status,
commands and exits or CI links, approval-to-final spec diff and review
dispositions. Check source-of-truth consistency, including any operational
companion. Stop for human acceptance before main merge. No automatic PR.
Em dashes are banned from all output.
