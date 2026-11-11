---
name: pr-description-writing
description: Draft or update a pull request title and description for human reviewers, following the repository's PR template and instructions first, then showing the change with before/after screenshots (a video only when the user or template asks) and writing plain English. Use whenever any agent creates a pull request, edits a PR title or description, or prepares PR text for a user to publish.
---

# PR Description Writing

## Goal

A reviewer opens the PR and understands what changed for the people who use the software, sees it working, and knows what to check. The title and description are written for humans. They are not a log of the agent's work.

Describe the final change against this PR's target, not its development history or authoring-time status. Include a fact only when it helps the reader understand, evaluate, or adopt that change. Evidence gathered for a handoff is not automatically description content.

This skill owns PR text and the media that goes in it. Code changes, review, and publication authority stay with their existing owners. Creating a PR the user asked for authorizes publishing its description. It does not authorize merging.

## 1. Find the repository's rules first

Read these before drafting, in order of precedence:

1. The user's explicit instructions for this PR.
2. The PR template: `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/PULL_REQUEST_TEMPLATE/`, `docs/pull_request_template.md`, or a root `pull_request_template.md`. Keep its headings, order, and HTML comments. Fill every section. Write `N/A` for a section that does not apply instead of deleting it. Tick a checkbox only when that item was actually done.
3. Repository instructions that mention PRs, titles, commits, or changelogs: `.github/copilot-instructions.md`, `.github/instructions/`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and equivalent files in the changed package.
Where these say nothing, use the defaults below. A template or instruction wins over a default when they conflict.

## 2. Gather the evidence

Read the full diff against the actual PR target, the commit messages, the linked issue or work item, and the results of checks that ran. Establish:

- What a user, caller, or operator can now do or will now see differently.
- What deliberately stays the same where compatibility matters, including stored data, public contracts, configuration, and migration requirements.
- Which executed tests or manual checks demonstrate the changed behavior, and what they establish.
- Anything the reviewer needs to decide or act on about the change itself: a tradeoff, a rollout step, a product limitation.

Every claim in the description must trace to the diff, a check that ran, or the linked requirement. Leave out what you cannot support instead of guessing.

## 3. Show the change

Media comes first because it lets a reviewer judge the result before reading code.

- **User-visible change** (screens, rendered documents, exports, emails, CLI output, multi-step flows): capture before/after screenshots from real builds of the base and head revisions. Use the same data, viewport, and steps for both so the only difference is the change. For a flow, capture the step that changed in both builds. Pair them side by side or one after the other, each with a one-line caption saying what to look at.
- **Behavior without a screen** (APIs, data handling, jobs, libraries): show one concrete before/after example as text, such as input and output, a request and response, or a log line, in a fenced code block.
- **Mechanical change** (refactor, rename, dependency bump, CI): media is not needed. Say what stays identical and how that was confirmed.

Make a video only when the user's instructions or the PR template ask for one. Otherwise do not record one, whatever the kind of change. When a video is requested, record the head build covering only the changed flow, from the starting state to the visible result, with `cue-synced-demo` or the host's browser automation. Use `pr-video` instead only when the request asks for a narrated explanation of the code.
Capture rules:

- Use real captures from the running software. Never use mockups, generated images, or edited screenshots to represent behavior.
- Redact secrets, tokens, customer data, and personal information before capture or upload.
- Keep media out of the repository. Store working files in the host's artifact location.
- Upload through a mechanism that attaches files to the PR, such as the `github-pr-media` skill, the host's PR media tool, or GitHub's attachment upload. If no upload path is available, give the user the files and tell them where each one belongs in the description. Never publish placeholders, broken links, or local file paths.

## 4. Write the title

Follow the repository's title convention when one exists, including prefixes and ticket IDs. Then say what changes in plain words a reviewer would use, not the name of the code you touched.

- Good: `fix(report-templates): AB#672904 keep merged table cells and blank headings from Word`
- Weak: `Update TableMergeSchema and refactor parser`

Keep it to one line. No trailing period, emoji, or `WIP` unless the repository uses them.

## 5. Write the description

Load `reasoning-first-writing` and apply it. Then follow this shape unless the template defines another:

1. **Opening.** One or two short paragraphs: what someone can now do or see, and why it matters. Use concrete examples from the actual change, quoting real labels, values, or messages, for example: two columns used to read out as "Edit Plan charge, Alex"; each now reads as its own heading.
2. **Media.** The screenshots, video, or example from step 3, placed right after the opening.
3. **Separate behavior changes.** When the PR changes several distinct things, list each as a bullet that states the behavior, not the file.
4. **What stays the same.** Relevant compatibility, stored data, and migration implications in one or two sentences, for example: "Stored tables without merges read and write exactly as before. No migration."
5. **Behavioral evidence.** When useful, explain what an executed regression test or manual check demonstrates about this change. Distinguish the two. Omit routine check inventories and pass/pending/fail dashboards.
6. **Reviewer notes.** Only for a decision, product risk, rollout step, or dependency needed to understand or adopt this change. Keep genuine limitations specific without turning them into a readiness report.
7. **Links.** The issue or work item reference in the form the repository uses, such as `Fixes #123` or `AB#672904`.

Scale the description to the change. A one-line fix can be one sentence plus a link. Use headings only when the template has them or the description is long enough that a reader needs to navigate it.

When a PR is revised after review, integrate the resulting behavior and rationale into the description. Describe what the final patch does, without review-round attribution, superseded approaches, or an appended changelog. For stacked PRs, link the dependency when needed and describe this layer's diff, not inherited changes.

## Cut before publishing

Remove all of the following unless the template or repository instructions require it:

- Boilerplate headings such as `## Summary`, `## Overview`, or `## Changes` wrapped around a few sentences.
- Openers like "This PR...", "In this PR, we...", or "This change introduces...". Start with what changed.
- File-by-file inventories, lists of commit hashes, internal finding IDs, and line counts.
- Test counts used as reassurance ("all 342 tests pass") instead of what the tests cover.
- Authoring-time CI state, approval or discussion counts, merge readiness, retry/synchronization history, local setup blockers, and agent-review provenance. Put these in the requested status report or handoff, not the PR description. Missing evidence narrows a claim, not an excuse paragraph.
- Promotional or vague words: comprehensive, robust, seamless, enhance, streamline, leverage, various improvements.
- Hedges and disclaimers: "should work", "hopefully", "I think", "as an AI", "please review carefully".
- Tool or AI attribution footers, agent session notes, and process narration about how the agent worked.
- Emoji, decorative bold, and a closing recap that repeats the opening.
- Em dashes.

## Finish

Read the title and description as a reviewer who has not seen the conversation. Check that every claim matches the final diff, the media shows the head revision, links resolve, and every template section is filled. Then publish if authorized, or return the title, description, and media files to the caller.
