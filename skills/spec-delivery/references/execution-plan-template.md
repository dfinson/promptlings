# Agent execution plan template

Use only after the user authorizes this operational artifact for executable
delivery. Do not create it during an ordinary writing or revision request.
Write `specs/<slug>-lanes.md` alongside the human specification. This is the
agent-facing source for exact criteria, commands, write sets, contracts,
dependencies, and coupling decisions. It does not replace the human explanation.
Both files need approval at the same commit.

Use meaningful task names and stable descriptive keys such as `report-amounts`,
not numbered lane codes. Every task has its own section in both artifacts.
The human specification owns behavior, rationale, named lane responsibilities,
dependencies and observable acceptance. Link each operational
entry to the relevant human section and resolve mismatches before execution.
Do not hide a new requirement or an undecided behavior in this file.

```markdown
# <Title>: execution plan

Human specification: [<Title>](<slug>.md)

## Acceptance criteria

| ID | Criterion | Spec basis | Method | Owner | Critical |
| --- | --- | --- | --- | --- | --- |
| AC-1 | One observable statement. | [Task explanation](<slug>.md#meaningful-task-name) | `exact command that exits 0 when it holds` | report-amounts | no |
| AC-2 | One observable end-to-end statement. | [Validation](<slug>.md#validation) | `exact end-to-end command` | integration | no |
| AC-3 | One observable statement a person must judge. | [Decision](<slug>.md#decisions) | `human` | integration | no |

## Task graph

(Mermaid dependency graph. Nodes display meaningful task names and edges show
prerequisites. Use descriptive keys, not numbered lane labels.)

## Task: <Meaningful task name>

Key: `report-amounts`
Spec basis: [Task explanation](<slug>.md#meaningful-task-name)
Functionality: The bounded functionality this task delivers.
Write set: Exact approved paths or deliberately approved patterns.
Contracts changed: Exact signatures, schemas, endpoints, or config keys.
Contracts used: Exact contracts this task consumes.
Depends on: Descriptive task keys, or none.
Criteria owned: Exact criterion IDs, or `tests: AC-<n>` for a test task.
Risky: `yes` or `no`

(Repeat a Task section for each task, including test tasks.)

## Concurrency risks

For each flagged concurrent pair, give the task names and keys, coupling
evidence, `edge` or `accept` decision, and recovery with estimated cost.
An edge must appear in both task dependencies and the graph.
If no pairs are flagged, state that briefly.
```

## Execution plan rules

- Criterion IDs are `AC-<n>` and unique. Each is one independently verifiable
  statement with a Spec basis linking to its required behavior in the human
  specification. Method is one backticked command or `human`. Owner is a
  descriptive task key or `integration`. Critical is `yes` or `no`, and every
  `yes` has an upstream test task that lists it.
- Every task has a meaningful name, its own section, and a unique descriptive
  key. Every non-test task owns at least one criterion. Its Criteria owned
  field lists exactly the criteria whose Owner is that key. A test task lists
  `tests: AC-<n>` for each critical criterion it writes tests for.
- Every Depends on target exists, graph edges match those fields, and the
  graph has no cycle.
- Preserve exact write sets. A directory glob that admits future files is
  not equivalent to an explicit file list.
- Each concurrent pair with a shared declared contract, overlapping write
  sets, a shared lockfile or migrations directory, or a coupling-check hit
  needs a Concurrency risks entry. An `edge` adds the dependency. An `accept`
  includes recovery and estimated cost.
- Neither narrative prose nor a test command settles an open behavior
  decision. Keep affected work conditional until the human decides and the
  two files agree.
