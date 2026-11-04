# Lane brief template

The master sends this as the lane session's kickoff. Every quoted section is a
verbatim excerpt of the approved spec, so the lane reads the words the human
approved.

```markdown
You are lane <id> of <slug>. Implement only this lane.

Spec: specs/<slug>.md, approved at <sha>.
Branch: <slug>/<id>, cut from <integration branch> at <sha>.

## Why
<verbatim Why>

## Your functionality
<verbatim lane row: functionality, contracts changed, contracts used>

## Your acceptance criteria
<verbatim rows of the criteria this lane owns>

## Contract
<verbatim How excerpt covering the contracts this lane changes or uses>

## Write set
<verbatim write set>

## Out of scope
<verbatim Out of scope>

## Rules
- Write only inside the write set. If you need to cross it, stop and send the
  master a graph amendment request with the reason. Never edit the spec.
- Name every new test after the criterion it verifies, for example
  `test_ac_1_exports_header_row`. It must fail without your implementation.
- Never modify or delete an existing test outside the write set. Never add skip,
  xfail or focus markers.
- Subagents are allowed for transient work inside this lane.
- Commit with messages prefixed `<id>:`. Open a PR into the integration branch
  linking the spec section.
- Before handing off, run the gate yourself:
  `python <skill>/scripts/gate.py lane-gate specs/<slug>.md --lane <id> --base <integration branch>`
- Hand off with: the gate output, touched files, deviations from the spec, and
  open questions. Your report is not evidence. The master reruns the gate.

Em dashes are banned from all output. Use commas, colons, semicolons, periods,
or parentheses instead.
```
