---
name: spec-delivery
description: Deliver a multi-part change through a human-readable specification and a separately approved execution plan, one meaningfully named session per task, and mechanical gates. Use when the human starts a master session for spec-backed delivery, not for small fixes an ordinary session can make directly.
---

# Spec Delivery

Em dashes are banned from all output. Use commas, colons, semicolons, periods, or parentheses instead.

A master session owns the human specification, agent execution plan and integration. Lane sessions own documented functionality. The human starts the master session, approves both artifacts and accepts the result. The master checks the approval and execution-plan rules at G0, and the human's approval confirms them. Every other pass or fail decision comes from a command the master runs or from CI, never from a session's own report.

## Master rules

- The master never writes product code. It plans, starts lanes, runs gates, merges and reports.
- Evidence is a command with its exit code, or CI status. Every gate verdict quotes the command it ran and the exit code. Claims are verified, unmet or unverified. A lane's handoff and the master's reading of a diff are not evidence.
- No database, queue or task store. State is the human specification, execution plan, lane branches, lane PRs and `git log`.

## 1. Spec and graph (G0)

For writing-only work, apply the human narrative and reader-task checks below,
then return that specification. Task decomposition, coupling records, executable
criteria and all delivery gates apply only after operational planning is authorized.

1. Investigate the code. Draft the human explanation in `specs/<slug>.md` from the [human specification template](references/spec-template.md), using `design-writing` and `reasoning-first-writing` when available. A writing or revision request produces that artifact only. Do not create a companion brief to move clutter elsewhere. If executable delivery is requested, explain why the gates need exact operational metadata and obtain explicit authorization for `specs/<slug>-lanes.md` before creating it from the [execution plan template](references/execution-plan-template.md). Without that authorization, finish the human specification but do not start lanes. The narrative owns behavior, scope, rationale, named lane responsibilities and dependencies, and observable acceptance. The authorized execution plan records exact commands, write sets, criterion IDs, contracts and graph keys consistent with that specification. Preserve essential technical reasoning in the narrative and resolve disagreement between the two files before approval.
2. Split lanes. A lane is one coherent piece of functionality with its own executable criteria, large enough to repay a fresh session (about thirty minutes or more). Two candidates that cannot be separated are one lane. Give every task a meaningful name, its own section in both artifacts, and a descriptive execution key, not a numbered lane code. A task depends on another when it uses a contract the other changes or adds.
3. Run the coupling check on every pair of concurrent lanes with code intelligence (references, call and import graphs, LSP), falling back to grep. Flag a pair when A changes a contract B's write set references or B uses, when both change the same contract or symbol, when both touch a hotspot (lockfiles, migrations, registries, generated code, shared config, shared fixtures), or when both write the same files. Give each flagged pair a Concurrency risks entry in the execution plan: `edge` (add the dependency) or `accept` with the recovery and its estimated cost. Use `mermaid-architecture-diagrams` for the task graph there.
4. Check the [human approval checks](references/spec-template.md#approval-checks) and, when authorized, the [execution plan rules](references/execution-plan-template.md#execution-plan-rules). Fix every violation and trace each operational criterion to its human-readable behavior.
5. Perform a reader-task pass on the whole human specification without opening links or consulting the execution plan. Explain the concrete current problem, actual proposed changes, why their mechanisms address it, what each named lane owns and waits on, how the tasks connect, resulting user behavior, observable acceptance and open decisions. If those answers require decoding IDs, reading commands, or supplying conversation knowledge, revise the artifact. A fresh reader can help, but word counts, heading checks, or an agent's self-description cannot substitute for comprehension.
6. Present the narrative for the human's decision. Stop there for a writing-only request. Before starting delivery, the authorized execution plan must also be available for exact scope and gates. The human settles open choices, marks risky tasks and critical criteria, and approves both files. For each critical criterion, add a meaningfully named upstream test task that writes its failing tests outside the implementing task's write set, give it its own section in both files, then recheck both artifacts. The implementing task owns the criterion. The test task lists it as `tests: AC-<n>` and owns none. The test task never merges on its own: after it passes G1, cut the implementing lane from the test-lane branch, run the implementing lane's G1 with `<base>` the test-lane head, and merge the implementing lane, which brings both.
7. Commit both files on the integration branch and tag their approved commit `spec/<slug>/approved`. Every later change goes in the human specification's Changelog. A change to behavior, scope, rationale, any criterion or its method, a risky or critical marking, or a graph amendment that adds an edge, merges lanes or widens a write set needs re-approval of both files: record the old tag's SHA in the Changelog, move the tag with `git tag -f` (and `git push -f` it if pushed), and re-brief running lanes whose excerpts changed. A writing correction that leaves these contracts unchanged can proceed without waiting for unrelated skill maintenance.

## 2. Lanes

Start one meaningfully named session per task whose dependencies are all merged, for example `Preserve zero-valued report amounts`, on branch `<slug>/<task-key>` cut from the integration branch at that point. Send the [lane brief](references/lane-brief-template.md) filled with verbatim excerpts of the approved human specification and execution plan. Lanes with no dependency path between them run concurrently.

Host notes, using whichever the host supports:

- GitHub Copilot app: create a child session per lane with the brief as its kickoff prompt, so each lane is visible and resumable.
- Claude Code or Codex: start a session in a new `git worktree` on the lane branch with the brief as its first prompt.
- Without child sessions: run each lane as a subagent with the brief as its prompt, one at a time, each on its own branch, and report that lanes ran sequentially. If the host has neither, stop and tell the human that spec delivery needs separate sessions. The master never implements a lane itself.

## 3. Lane gate (G1)

On every handoff, in the lane's worktree, with `<base>` the integration branch unless stated otherwise. Each check fails the gate:

1. Committed state. `git status --porcelain` prints nothing. Record `git rev-parse HEAD` as the head.
2. Write set. `git diff --name-only <base>...HEAD | grep -v -E '<write set as one regex>'` prints nothing (grep exits 1). Both planning files and tests outside the write set are therefore rejected.
3. Test markers. `git diff -U0 <base>...HEAD -- <test paths> | grep -E '^\+.*(@skip|mark\.skip|xfail|\.only\(|\bfit\(|fdescribe\()'` prints nothing (grep exits 1). Extend the pattern for the project's test framework.
4. Criteria on head. Each automated criterion the lane owns exits 0 when its execution-plan Method command runs at the repository root.
5. Tests fail on base. For each criterion named by a new test, check that the test fails without the lane's code:

   ```text
   git worktree add --detach <tmp> $(git merge-base <base> HEAD)
   git -C <tmp> checkout <head> -- <new and changed test files, helpers and fixtures>
   (run the criterion's Method command in <tmp>; it must exit nonzero)
   git worktree remove --force <tmp>
   ```

   The quoted output must show each new test failing. An assertion failure qualifies. A collection, import or build error qualifies only when the missing name is one the lane adds (a declared contract or a file in its write set), or for a test lane, one the implementing lane declares. Any other error fails the check.

A test lane replaces step 4 with the inverse: each criterion it writes tests for exits nonzero at its head, with output showing those tests failing by the same rule as step 5. That also covers step 5 for those tests, so the implementing lane skips step 5 for them and step 4 makes them pass.

Send failures back to the lane with the exact command and output. After two failed rounds on one lane, stop and ask the human to amend the spec, re-split the lane or change approach.

Then read the diff for contracts the lane changed but did not declare (signatures, schemas, endpoints, config keys, hotspot files). This does not fail the gate. Rerun the coupling check against lanes still running, send any new hit to the affected lane immediately, or add a Concurrency risks entry to the execution plan and report it to the human.

## 4. Merge (G2)

Merge each lane that passes G1 into the integration branch, then run the Method command of every criterion owned by a lane merged so far, at the integration head. Record each as a row of the criteria table: ID, command, exit code, and verified (exit 0) or unmet.

A failure means a missing edge. Revert the merge with `git revert -m 1 <merge>`, rerun G2 to confirm the head passes, stop starting lanes, then amend the graph under the re-approval rule. If a merge conflicts, run `git merge --abort`. The lane merges the integration head into its own branch, resolves the conflict there and reruns G1 with that head as `<base>`. For an accepted concurrency risk that hits, fix forward and hold other merges until the fix passes G2: the lane merged second makes its recovery on a new branch `<slug>/<lane>-fix` cut from the integration head, then that branch passes G1 (with `<base>` the integration head and the lane's write set) and G2. Then start the lanes this merge unblocked.

## 5. Acceptance and review (G3)

When all lanes are merged, run every automated criterion, including the `integration` end-to-end commands, and record the full criteria table. `human` criteria stay unverified. Then review the integrated diff against the spec: `sparring-partner` by default, `review-ensemble` for lanes the human marked risky. Code that does not match the spec is a finding. Review once and re-review only repaired regions. Every finding gets a disposition: fixed with its commit, or rejected with a reason. Route each fix to the owning lane on a `<slug>/<lane>-fix` branch that passes G1 and G2. After the last fix, rerun every automated criterion at the final head. That run is the table G4 shows.

## 6. Human acceptance (G4)

Open the integration PR to the main branch with:

- The G3 criteria table, with CI links where they exist. `human` criteria stay unverified until the human runs them.
- `git diff spec/<slug>/approved -- specs/<slug>.md specs/<slug>-lanes.md`, so no post-approval change to either artifact passes silently.
- Every review finding and its disposition, and links to the lane PRs.

The human accepts or directs the next step. Do not merge without that acceptance.
