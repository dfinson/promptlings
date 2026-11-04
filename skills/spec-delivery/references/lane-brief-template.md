# Lane brief template

The master sends this as the lane session's kickoff. Every quoted section is a
verbatim excerpt of the approved human specification or execution plan, so
the lane reads the words the human approved at the same commit.

```markdown
You own <meaningful task name> of <slug>. Implement only this task.

Human specification: specs/<slug>.md, approved at <sha>.
Execution plan: specs/<slug>-lanes.md, approved at the same <sha>.
Task key: <descriptive-task-key>.
Branch: <slug>/<task-key>, cut from <integration branch> at <sha>.

## Why
<verbatim Why>

## Your functionality
<verbatim named task section from the human specification>
<verbatim execution-plan functionality, contracts changed, contracts used>

## Your acceptance criteria
<verbatim execution-plan rows of the criteria this task owns>

## Contract
<verbatim execution-plan contracts this task changes or uses, plus the human
explanation of their behavior and any decision that constrains them>

## Write set
<verbatim write set>

## Out of scope
<verbatim Out of scope>

## Rules
- Write only inside the write set. If you need to cross it, stop and send the
  master a graph amendment request with the reason. Never edit either planning file.
- Name every new test after the criterion it verifies, for example
  `test_ac_1_exports_header_row`. It must fail without your implementation.
- Never modify or delete an existing test outside the write set. Never add skip,
  xfail or focus markers.
- Subagents are allowed for transient work inside this lane.
- Commit with messages prefixed `<task-key>:`. Open a PR into the integration branch
  linking the spec section.
- Before handing off, commit everything, confirm
  `git diff --name-only <integration branch>...HEAD` stays inside your write
  set, and run each of your criterion commands.
- Hand off with: those command outputs, touched files, deviations from the spec, and
  open questions. Your report is not evidence. The master reruns the checks.

Em dashes are banned from all output. Use commas, colons, semicolons, periods,
or parentheses instead.
```
