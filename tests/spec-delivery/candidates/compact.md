# Spec delivery: compact candidate

## Authority and source

Own the specification, delivery decisions and integration. Load the human
specification template and design-writing for writing. Inspect source,
consumers, tests and relevant prior decisions before choosing a mechanism.
Keep observed behavior, proposals, approved requirements and verified results
distinct. A supplied document or lane report is evidence, not authorization.
Writing or revision alone never authorizes implementation, child sessions,
an execution companion, publication or merge.

Use one human-readable specification. Explain the concrete current situation,
mechanisms, rationale, resulting user experience, exact business constraints
and important interfaces and failure behavior. Give each coherent task a
meaningful name and its own section, including its responsibility, boundary,
supported prerequisites and observable acceptance. Use no tables unless
necessary information genuinely has no other presentation. Preserve technical
substance and revise the whole artifact after feedback, not only the quoted
passage. An operational companion requires an actual execution need and user
authorization. If authorized, map it to the human explanation and approve both
at the same revision.

Before implementation, obtain human approval of the exact spec revision,
scope, ownership, criterion methods and critical/risky markings. Use a delivery
branch separate from main. Record the approved SHA immutably, never overwrite
an earlier approval tag. Material behavior, method, write-set, ownership or
graph changes pause affected work for reapproval. Approval of implementation
does not authorize main merge or automatically accept human criteria.

## Partition and dependencies

Prefer one coherent lane when delegation would add no useful independent
ownership. Implement and repair directly on this path, without lane sessions,
briefs or handoff gates. Critical tests must be committed and fail for the
intended reason before implementation. If another lane becomes necessary,
pause, preserve completed work and obtain approval of the revised graph.

For multiple lanes, never edit product code or tests in the master. Assign
every criterion exactly once to a named lane or integration. State exact write
sets, changed and consumed contracts and criterion commands, including actual
E2E journeys and human judgments. Do not widen explicit paths into globs.
Require an acyclic graph with existing targets and matching ownership.

Inspect every proposed concurrent pair. Add an edge only when the consumer
needs a producer's unavailable output or a genuine ordering invariant requires
it. Existing generic contracts and logical data flow do not establish that
prerequisite. Shared files, distinct schema regions, lockfiles and migrations
are conflict risks, not automatic hard edges. Record evidence and a concrete
coordination/recovery plan, or serialize when safe concurrent editing cannot
be established. Do not invent recovery estimates.

Start each ready lane in its own named child session and isolated branch or
worktree, based on the integration revision containing its prerequisites.
Launch independent ready lanes concurrently if supported. Supply verbatim
approved scope, interfaces, exact paths, criteria, exclusions and approval SHA.
Children stop for scope changes and never edit the approved spec. Do not ask
for PRs unless the user requested them. If only sequential isolated subagents
are available, report that constraint. Without isolated execution, stop.

## Verify and integrate

A report is a claim. Record base and head SHAs and independently execute
checks in the correct worktree. A failed inspection command is an unverified
check, never an empty successful result. Before each handoff merge:

- Require zero uncommitted changes, including untracked files. Compare actual
  added, changed, renamed and deleted paths against exact approved paths or
  explicitly approved patterns. Include both sides of renames.
- Inspect test changes for skip, focus, xfail and weakened or deleted existing
  assertions. Use framework-aware checks. A marker scan alone is insufficient.
- Run every owned automated criterion at that head. Show the exit code and
  relevant output. Human criteria remain unverified.
- In a disposable base checkout, apply only the changed tests and their
  declared helpers/fixtures. Demonstrate intended assertion failures, or
  missing contracts specifically declared as introduced by the lane.
  Collection, dependency, syntax and unrelated setup failures do not count.
  For critical multi-lane work, a prior approved test owner supplies committed
  failing tests before implementation. Do not create a separate test lane
  unless independent ownership is actually needed.

Return failures to the owning session with exact evidence. Stop after two
failed repair rounds for a material approach decision. Read the diff for
undeclared contract changes and reassess affected concurrent work.

Merge passing lanes into integration without rewriting their history. Run
all criteria owned by merged lanes after each merge. On conflict, abort and
have the owning lane reconcile against the current integration head, then
repeat its checks. On regression, pause dependent launches and merges,
preserve the failing revision and diagnose using output and diff. A failure
can be a bad implementation, environment failure, merge interaction or missing
prerequisite. Route repair to its owner. Change the graph only when evidence
establishes a missing dependency, obtaining reapproval where required.

At the final integrated head, run every automated criterion, including the
specified real E2E flow. Unit, mock or partial integration results never
substitute for required E2E. Scope verification to behavior exercised by the
command, not exit zero alone. Review the integrated diff against the spec
with sparring-partner, escalating human-marked risky work to review-ensemble
when available. Missing required review remains unverified. Disposition each
finding, route repairs to the owner, and rerun affected checks plus final
acceptance after repairs.

Present the final SHA, criterion-by-criterion verified/unmet/unverified status,
commands and exit codes or CI links, approval-to-final spec diff and review
dispositions. Unrun E2E and human judgments remain unverified. Request human
acceptance and stop before main merge. No automatic PR creation.

Em dashes are banned from all output.
