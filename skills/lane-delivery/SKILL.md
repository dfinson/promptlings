---
name: lane-delivery
description: Deliver a multi-part change through a human-approved spec and lane graph, one named session per lane, and mechanical gates. Use when the human starts a master session for spec-backed delivery, not for small fixes an ordinary session can make directly.
---

# Lane Delivery

Em dashes are banned from all output. Use commas, colons, semicolons, periods, or parentheses instead.

A master session owns the spec, the lane graph and integration. Lane sessions own documented functionality. The human starts the master session, approves the spec and accepts the result. Every other pass or fail decision comes from [`scripts/gate.py`](scripts/gate.py) or CI output, never from a session's own report.

## Master rules

- The master never writes product code. It plans, starts lanes, runs gates, merges and reports.
- Evidence is gate output, criterion command output or CI status. Claims are verified, unmet or unverified. A lane's handoff and the master's reading of a diff are not evidence.
- No database, queue or task store. State is the spec file, lane branches, lane PRs and `git log`.

## 1. Spec and graph (G0)

1. Investigate the code. Draft `specs/<slug>.md` from the [spec template](references/spec-template.md), using `design-writing` and `reasoning-first-writing` when available, and `mermaid-architecture-diagrams` for the lane diagram.
2. Split lanes. A lane is one coherent piece of functionality with its own executable criteria, large enough to repay a fresh session (about thirty minutes or more). Two candidates that cannot be separated are one lane. Lane B depends on lane A when B uses a contract A changes or adds.
3. Run the coupling check on every pair of concurrent lanes with code intelligence (references, call and import graphs, LSP), falling back to grep. Flag a pair when A changes a contract B's write set references or B uses, when both change the same contract or symbol, when both touch a hotspot (lockfiles, migrations, registries, generated code, shared config, shared fixtures), or when both write the same files. Give each flagged pair a Concurrency risks row: `edge` (add the dependency) or `accept` with the recovery and its estimated cost.
4. Run `python <skill>/scripts/gate.py spec-lint specs/<slug>.md --flag A,B ...`, passing every pair step 3 flagged. Fix every FAIL.
5. Optional readability aid: give a fresh reader with no conversation context only the spec and ask what changes and why, how it is built, what each lane owns and waits on, how completion is verified, what is out of scope and what the human must decide. Revise passages it gets wrong. After two failed rounds, raise the passage with the human.
6. Present the spec. The human decides the Decisions rows, marks risky lanes and critical criteria, and approves. For each critical criterion, add an upstream test lane that writes its failing tests outside the implementing lane's write set, then rerun `spec-lint`.
7. Commit the spec on the integration branch and tag the approved commit `spec/<slug>/approved`. A later change to Why, What, any criterion or its method, or a risky marking needs re-approval and a new tag. Graph amendments go in the Changelog.

## 2. Lanes

Start one named session per lane whose dependencies are all merged, for example `lane-2-export-api`, on branch `<slug>/<lane>` cut from the integration branch at that point. Send the [lane brief](references/lane-brief-template.md) filled with verbatim spec excerpts. Lanes with no dependency path between them run concurrently.

Host notes, using whichever the host supports:

- GitHub Copilot app: create a child session per lane with the brief as its kickoff prompt, so each lane is visible and resumable.
- Claude Code or Codex: start a session in a new `git worktree` on the lane branch with the brief as its first prompt.
- Without separate sessions: run lanes one at a time in this session, each on its own branch, with the same brief and gates. Report that lanes ran sequentially.

## 3. Lane gate (G1)

On every handoff, in the lane's worktree at its committed head:

```text
python <skill>/scripts/gate.py lane-gate specs/<slug>.md --lane <id> --base <integration branch>
```

It fails when a changed file is outside the write set (including the spec and existing tests), a skip, xfail or focus marker is added to a test, an owned criterion command fails on the head, or a new test naming a criterion passes on the base. Send failures back to the lane with the exact output. After two failed rounds on one lane, stop and ask the human to amend the spec, re-split the lane or change approach.

A `NOTE RECHECK` line lists contracts the lane changed without declaring them. Rerun the coupling check against lanes still running. Send any new hit to the affected lane immediately, or add a Concurrency risks row and report it to the human.

## 4. Merge (G2)

Merge each lane that passes G1 into the integration branch, then run the criteria of every lane merged so far:

```text
python <skill>/scripts/gate.py run-criteria specs/<slug>.md --owners L1,L2
```

A failure means a missing edge. Stop starting lanes, amend the graph and get re-approval. For an accepted concurrency risk that hits, the lane merged second rebases on the integration branch and reruns G1 and G2, as its recovery states. Then start the lanes this merge unblocked.

## 5. Acceptance and review (G3)

When all lanes are merged, run `gate.py run-criteria specs/<slug>.md` with no owner filter, including end-to-end commands. Then review the integrated diff against the spec: `sparring-partner` by default, `review-ensemble` for lanes the human marked risky. Code that does not match the spec is a finding. Review once and re-review only repaired regions. Every finding gets a disposition: fixed with its commit, or rejected with a reason. Route fixes to the owning lane.

## 6. Human acceptance (G4)

Open the integration PR to the main branch with:

- The criteria table from `run-criteria`, with gate or CI links. `human` criteria stay unverified until the human runs them.
- `git diff spec/<slug>/approved -- specs/<slug>.md`, so no post-approval change passes silently.
- Every review finding and its disposition, and links to the lane PRs.

The human accepts or directs the next step. Do not merge without that acceptance.
