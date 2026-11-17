# Agent execution plan template

Use only after the user authorizes this operational artifact for executable
delivery. Do not create it during an ordinary writing or revision request.
Keep it in session artifacts or the user's chosen external system. A tracked
repository path needs explicit authorization. This is the
agent-facing source for exact criteria, commands, write sets, contracts,
dependencies, and coupling decisions. It does not replace the human explanation.
Record both artifacts' locators and immutable versions or exact-byte SHA-256
hashes with the human approval reference, separately from product base SHAs.

This template serves a justified execution need, not every approved change.
For an ordinary bounded change, keep the necessary scope, base and checks in
the existing session record. When this plan is requested, preserve its exact
fields without converting opportunity-catalogue entries into tasks.

Use meaningful task names and stable descriptive keys such as `report-amounts`,
not numbered lane codes. Map each selected task to the human explanation.
Several operational tasks may serve one mechanism without duplicating sections.
The human specification owns selected behavior, rationale, responsibilities,
dependencies and observable acceptance. Link each operational
entry to the relevant human section and resolve mismatches before execution.
Do not hide a new requirement or an undecided behavior in this file.

When this plan is shown to the user, invoke `reasoning-first-writing`. Present
an overview before the operational detail and a shorter closing synthesis
after it, retaining every exact field below. They explain the whole selected
change and commitment, not a second plan. Internal-only records may omit that
presentation framing.

```markdown
# <Title>: execution plan

Human specification: <accessible locator and approved version or content hash>
Approval reference: <human decision identifying the approved artifact versions>

## Overview (when presented for human review)

Explain the selected outcome, bounded mechanism, how the necessary tasks
connect and the decision sought before the reader encounters criteria and
commands. Preserve the plan's actual approval status.

## Acceptance criteria

| ID | Criterion | Spec basis | Method | Owner | Critical |
| --- | --- | --- | --- | --- | --- |
| AC-1 | One observable statement. | [Task explanation](<slug>.md#meaningful-task-name) | `exact command that exits 0 when it holds` | report-amounts | no |
| AC-2 | One observable end-to-end statement. | [Validation](<slug>.md#validation) | `exact end-to-end command` | integration | no |
| AC-3 | One observable statement a person must judge. | [Decision](<slug>.md#decisions) | `human` | integration | no |

## Task graph

(For a justified multi-task plan, show genuine prerequisites with meaningful
task names. A one-task plan may state that it has no dependencies.)

## Task: <Meaningful task name>

Key: `report-amounts`
Spec basis: [Task explanation](<slug>.md#meaningful-task-name)
Functionality: The bounded functionality this task delivers.
Write set: Exact approved paths.
Contracts changed: Exact signatures, schemas, endpoints, or config keys.
Contracts used: Exact contracts this task consumes.
Depends on: Descriptive task keys, or none.
Review branch: Intended lane branch.
PR target: Intended delivery branch, or producer branch for a genuine stack.
Product base: Exact starting Git SHA, separate from artifact approval.
Criteria owned: Exact criterion IDs, or `tests: AC-<n>` for a test task.
Risky: `yes` or `no`

(Repeat a Task section for each task, including test tasks.)

## Concurrency risks

For each flagged concurrent pair, give the task names and keys, coupling
evidence, `edge` or `accept` decision, and concrete coordination or recovery.
Include a cost estimate only when supported, otherwise leave it unknown.
An edge must appear in both task dependencies and the graph.
If no pairs are flagged, state that briefly.

## Commitment (when presented for human review)

Briefly synthesize what will change, why this scope is sufficient, what remains
unchanged and which decision is actually requested. Introduce no new work.
```

## Execution plan rules

- Criterion IDs are `AC-<n>` and unique. Each is one independently verifiable
  statement with a Spec basis linking to its required behavior in the human
  specification. Method is one backticked command or `human`. Owner is a
  descriptive task key or `integration`. Critical is `yes` or `no`, and every
  `yes` identifies tests committed and shown failing before implementation.
  Its owner uses the bundled `gate.py apply` operation, not a later
  reconstruction of test-only history. Record the artifact approval identity
  separately from each lane's starting base and supply runnable helper and
  authorized scratch locations in its brief.
  A separate test task is needed only for genuinely independent ownership.
  On the single-lane path the owner is `integration`, with no lane handoff.
- Every task has a meaningful name, its own section, and a unique descriptive
  key. Every non-test task owns at least one criterion. Its Criteria owned
  field lists exactly the criteria whose Owner is that key. A test task lists
  `tests: AC-<n>` for each critical criterion it writes tests for.
- Every Depends on target exists, graph edges match those fields, and the
  graph has no cycle.
- Select a proportional split before creating lanes. One coherent change
  normally stays with one owner in one reviewable patch. Preserve explicit
  size and complexity constraints and justify additional delivery units.
- After that split, maximize safe concurrency. Launch ready independent lanes before
  waiting. A consumer may stack on an unmerged producer's passing contract
  rather than wait for its PR merge. Coordinate shared-file edits instead of
  treating overlap as an automatic whole-lane dependency.
- PRs are the default integration boundary. Keep each lane's full review diff
  scoped to its intended target. Combined validation may use a disposable
  checkout, never an accumulating local branch fed back into lane PRs.
- Preserve exact write sets. A directory glob that admits future files is
  not equivalent to an explicit file list. Expand deliberately approved
  patterns to the exact paths reviewed for each handoff before running the gate.
- Each concurrent pair with a shared declared contract, overlapping write
  sets, a shared lockfile or migrations directory, or a coupling-check hit
  needs a Concurrency risks entry. An `edge` requires evidence of an unavailable
  producer output or genuine ordering invariant. File overlap and an existing
  generic consumer contract alone do not establish that prerequisite. An
  `accept` includes concrete coordination and recovery, without an invented estimate.
- Neither narrative prose nor a test command settles an open behavior
  decision. Keep affected work conditional until the human decides and the
  two files agree.
