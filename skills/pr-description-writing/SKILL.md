---
name: pr-description-writing
description: Draft or update a pull request title and description for human reviewers, following the repository's PR template and instructions first, then showing the change with before/after screenshots or a short demo video and writing plain English. Use whenever any agent creates a pull request, edits a PR title or description, or prepares PR text for a user to publish.
---

# PR Description Writing

## Goal

A reviewer opens the PR and understands what changed for the people who use the software, sees it working, and knows what to check. The title and description are written for humans. They are not a log of the agent's work.

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
- What deliberately stays the same, including stored data, public contracts, and configuration. State whether a migration is needed.
- What was verified and how: the commands, tests, or manual checks that actually ran and their results.
- Anything the reviewer needs to decide or watch for: a tradeoff, a rollout step, a known limitation.

Every claim in the description must trace to the diff, a check that ran, or the linked requirement. Leave out what you cannot support instead of guessing.

## 3. Show the change

Pictures and a short video come first because they let a reviewer judge the result before reading code.

- **User-visible change** (screens, rendered documents, exports, emails, CLI output): capture before/after screenshots from real builds of the base and head revisions. Use the same data, viewport, and steps for both so the only difference is the change. Pair them side by side or one after the other, each with a one-line caption saying what to look at.
- **Interaction or flow** (a new step, a fixed sequence, an animation, a timing change): record a short demo video of the head build that covers only the changed flow, from the starting state to the visible result. Sound is optional. Use `cue-synced-demo` or the host's browser automation for capture. When the change needs a narrated explanation of the code as well, use `pr-video` and attach that video.
- **Behavior without a screen** (APIs, data handling, jobs, libraries): show one concrete before/after example as text, such as input and output, a request and response, or a log line, in a fenced code block.
- **Mechanical change** (refactor, rename, dependency bump, CI): media is not needed. Say what stays identical and how that was confirmed.

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
4. **What stays the same.** Compatibility, stored data, and migration status in one or two sentences, for example: "Stored tables without merges read and write exactly as before. No migration."
5. **How it was checked.** The checks that actually ran, in a sentence or a short list. Name manual verification separately from automated tests.
6. **Reviewer notes.** Only when there is a real decision, risk, or rollout step. Say what to look at and why.
7. **Links.** The issue or work item reference in the form the repository uses, such as `Fixes #123` or `AB#672904`.

Scale the description to the change. A one-line fix can be one sentence plus a link. Use headings only when the template has them or the description is long enough that a reader needs to navigate it.

When a PR is revised after review, rewrite the description so it describes the final change. Summarize review rounds by what behavior changed and why ("Review feedback: the safety nets were too broad. A labelled blank is now a signature line only when it names a signer or date."), not as an appended changelog.

## Cut before publishing

Remove all of the following unless the template or repository instructions require it:

- Boilerplate headings such as `## Summary`, `## Overview`, or `## Changes` wrapped around a few sentences.
- Openers like "This PR...", "In this PR, we...", or "This change introduces...". Start with what changed.
- File-by-file inventories, lists of commit hashes, internal finding IDs, and line counts.
- Test counts used as reassurance ("all 342 tests pass") instead of what the tests cover.
- Promotional or vague words: comprehensive, robust, seamless, enhance, streamline, leverage, various improvements.
- Hedges and disclaimers: "should work", "hopefully", "I think", "as an AI", "please review carefully".
- Tool or AI attribution footers, agent session notes, and process narration about how the agent worked.
- Emoji, decorative bold, and a closing recap that repeats the opening.
- Em dashes.

## Finish

Read the title and description as a reviewer who has not seen the conversation. Check that every claim matches the final diff, the media shows the head revision, links resolve, and every template section is filled. Then publish if authorized, or return the title, description, and media files to the caller.
