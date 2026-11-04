# Lane brief template

The master sends this as the lane session's kickoff. Every quoted section is a
verbatim excerpt of the approved human specification or execution plan, so
the lane reads the words the human approved at the same commit.

```markdown
You own <meaningful task name> of <slug>. Implement only this task.

Human specification: specs/<slug>.md, approved at <sha>.
Execution plan, only if authorized: specs/<slug>-lanes.md, approved at the same <sha>.
Task key: <descriptive-task-key>.
Branch: <slug>/<task-key>, cut from <integration branch> at <sha>.

## Why
<verbatim Why>

## Your functionality
<verbatim named task section from the human specification>
<verbatim approved functionality, contracts changed, contracts used>

## Your acceptance criteria
<verbatim approved criteria and exact commands this task owns>

## Contract
<verbatim approved contracts this task changes or uses, plus the human
explanation of their behavior and any decision that constrains them>

## Write set
<verbatim write set>

## Out of scope
<verbatim Out of scope>

## Rules
- Write only inside the write set. If you need to cross it, stop and send the
  master a graph amendment request with the reason. Never edit either planning file.
- Link tests to their criterion. Changed-behavior checks must fail without
  your implementation for the intended reason. Existing regression checks
  may pass on base. For critical behavior, commit tests and demonstrate their
  intended failure before implementation, then preserve their assertions.
- Never modify or delete an existing test outside the write set. Never add skip,
  xfail or focus markers.
- Subagents are allowed for transient work inside this lane.
- Commit with messages prefixed `<task-key>:`. Open a PR only when the user
  requested one, using the requested target and linking the spec section.
- Before handing off, commit everything, confirm
  `git diff --name-only <integration branch>...HEAD` stays inside your write
  set, and run each of your criterion commands.
- Hand off with: base and head SHAs, those command outputs, touched files, deviations from the spec, and
  open questions. Your report is not evidence. The master reruns the checks.

Em dashes are banned from all output. Use commas, colons, semicolons, periods,
or parentheses instead.
```
