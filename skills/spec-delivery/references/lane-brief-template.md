# Lane brief template

The master sends this as the lane session's kickoff. Every quoted section is a
verbatim excerpt of the approved human specification or execution plan, so
the lane reads the exact artifact versions the human approved. Supply readable
snapshots when the source location is not accessible from the child.

```markdown
You own <meaningful task name> of <slug>. Implement only this task.

Human specification: <accessible locator>, version or SHA-256 <approved identity>.
Execution plan, only if authorized: <accessible locator and approved identity>.
Approval reference: <human decision identifying those exact artifact versions>.
Task key: <descriptive-task-key>.
Branch: <lane branch>, cut from <delivery or required producer branch> at <lane-base-sha>.
PR target: <intended delivery branch, or producer branch for a genuine stack>.
PR publication authority: <user request, or publication not yet authorized>.
Recorded lane base: <lane-base-sha>, separate from artifact approval.
Required producer heads and passing prerequisite checks: <identities, or none>.
Runnable gate helper: <actual location accessible from this lane worktree>.
Authorized scratch: <actual location accessible from this lane worktree>.

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
  master a graph amendment request with the reason. Never edit the approved
  planning artifacts.
- Keep planning artifacts and evidence outside product Git history unless
  explicitly authorized. Share the supplied approved snapshots, not invented
  repository paths or approval commits.
- Work concurrently with independent lanes. Coordinate shared files and
  interfaces. Wait only for genuine unavailable prerequisites, and use the
  stated PR stack when a passing unmerged producer supplies them. Never merge
  an aggregate integration branch or unrelated lanes into your review branch.
- Link tests to their criterion. Changed-behavior checks must fail without
  your implementation for the intended reason. Existing regression checks
  may pass on base. For human-marked critical behavior, use the master's supplied
  `gate.py apply` request procedure. Write tests in approved test paths and put
  proposed product contents in scratch data. The helper must commit tests and
  prove intended red before applying product contents. Preserve the assertions. If the operation is
  unavailable, report the blocker. Do not write critical product files directly
  or have the master apply them for you.
- Never modify or delete an existing test outside the write set. Never add skip,
  xfail or focus markers.
- Subagents are allowed for transient work inside this lane.
- Commit with messages prefixed `<task-key>:`. Open a PR only when the user
  authorized publication, using the stated target and accessible spec reference.
  PRs are the default handoff and integration boundary. Without publication
  authority, hand off the scoped branch and report that missing permission.
- Before handing off, commit everything, confirm
  `git diff --name-only <lane-base-sha> HEAD` stays inside your write
  set, inspect the full `git diff <pr-target-sha>...HEAD` and commit range for
  unrelated lane changes, and run each of your criterion commands. Use the
  actual PR target and head SHAs when published. Refresh after target or head changes.
- Hand off with: PR URL when published, target and head SHAs, recorded lane
  base, approval references, command outputs, touched files, deviations from
  the spec, and open questions. Your report is not evidence. The master reruns
  the checks without locally merging your branch.

Em dashes are banned from all output. Use commas, colons, semicolons, periods,
or parentheses instead.
```
