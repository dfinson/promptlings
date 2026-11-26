---
name: promptlings-delivery
description: Use when explicitly asked to take a Promptlings change through design, implementation, Sparring Partner review, passing CI, a pull request, admin merge and local reinstall. Repository-only maintenance flow.
---

# Deliver a Promptlings change

Keep the change small and carry it from a reasoned design to the merged revision and verified local installation. Use existing agents, skills and commands, not a new execution framework. This skill belongs only to this repository and must not be staged into the published skill bundle.

## Design and implement

Confirm the requested outcome, scope and acceptance criteria. Inspect the relevant instructions, current implementation and prior decisions. Explain the selected approach and consequential tradeoffs briefly in the conversation. Ask only for unresolved decisions that materially affect scope or correctness.

Implement the smallest coherent change in the current worktree. Preserve unrelated work. Promptlings delivers Markdown agents and skills: do not create scripts or tests unless explicitly requested. Put repository-only skills under `.github/skills/`. Update directly related documentation and use existing focused checks.

## Spar until green

Invoke `sparring-partner` with the original requirement, actual target branch, full change scope and relevant evidence. Require actionable findings and their supporting scenarios, not approval by confidence alone.

Resolve each finding through evidence. Correct substantiated defects, explain rejected findings, and return material revisions to the same reviewer for a focused follow-up. Green means no unresolved substantiated finding and all acceptance criteria accounted for. Do not weaken checks or silently discard feedback to reach green.

## PR and CI

Load `pr-description-writing` before creating or editing PR text. Preserve any template and include the required Agent assessment against the actual committed head. Commit and push the reviewed change, then create the requested PR against the intended base. A PR must exist before PR-triggered CI can run.

Inspect CI on that exact head. Use the host's background mechanism for `gh pr checks NUMBER --watch --fail-fast -i 20`, not sleep or polling loops. Fix relevant failures and rerun affected checks. Material changes return to Sparring Partner and refresh the PR assessment. Green CI means every required check passed for the final head, not an earlier revision or an accepted workflow submission.

## Admin merge and reinstall

Admin merge requires an explicit user request for this run. Invoking the skill alone grants no merge, bypass or installation authority. Check the live PR state, head SHA, CI and review threads immediately before merging. Do not use admin authority to skip the review or CI gates above. Use the repository's supported merge method with an exact-head guard, for example `gh pr merge NUMBER --squash --admin --match-head-commit HEAD_SHA` when squash is supported. Read the PR back and verify it is merged.

Load `rulesync-publishing` before any local reinstall and follow its inventory, recovery, preview and readback procedure. Reinstall from a checkout containing the verified merged revision without overwriting unrelated work. Preserve existing agent definitions and ordered rule registrations. A repository-only skill stays in this checkout and is not globally published. Do not substitute an npm release or wider toolchain installation for the authorized reinstall.

Read installed changed artifacts back against the merged sources. Report the PR, verified merge and installation result, plus any specific unfinished acceptance criterion. Delivery is complete only when the intended change is merged and the authorized installation is verified.

Em dashes are banned from all output. Use commas, colons, periods or parentheses instead.
