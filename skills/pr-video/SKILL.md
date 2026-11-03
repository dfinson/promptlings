---
name: pr-video
description: 'Turn a pull request or diff into a short narrated video that explains why the change exists, what it changes in behavior and which code carries it. Use when a reviewer, stakeholder or teammate needs to understand a change faster than reading the diff.'
---

# PR Video

A PR video explains a change to someone who has not read it. It opens with a hook built from why the change exists (the opening hook check in `reasoning-first-narration`), shows the behavior it changes, then walks the code that carries it in order of consequence. Review findings and verdicts belong to review tools such as The Nitcracker; this video builds understanding.

This skill supplies the change-specific discovery and story practice. The `technical-demo` agent owns the video when it is installed: audience, story, script approval and acceptance. Narration, transitions, speech, capture and composition come from the companion skills named below.

## Read the change

- Gather the PR title and description, linked issues, commits and the full diff, for example with `gh pr view` and `gh pr diff`, or `git diff base...head` for a branch. For a bare diff, use its commit messages and the surrounding code.
- Read every changed file and the code that calls into the changed paths before choosing the story. Descriptions are indexes, not evidence.
- When the PR Walkthrough agent is available, treat its orientation as one input alongside the diff, the PR description and observed behavior. The video's story, order and emphasis remain the director's decisions.
- Establish who watches and what they need to decide: approve, adopt, integrate or learn.
- Write the change's intent in one sentence and confirm it with the author or user when the PR does not state it.
- Rank changed files by consequence: entry points, public contracts, schemas, configuration and data shape first; internal implementation next; mechanical edits last.

## Shape the story

1. **Why:** the problem and why it matters now, in one or two sentences.
2. **Behavior:** when the change is visible to a user or an API caller, show the base and head behavior side by side or in sequence, captured from real builds of both commits.
3. **Code tour:** one scene per hunk or tight hunk group, in consequence order, each with one takeaway: the problem the hunk addresses, shown by base behavior or a case the preceding scene showed on screen, and how the change addresses it.
4. **Decisions to weigh:** design forks, migrations, compatibility and rollout steps the change actually carries.

Summarize mechanical churn such as renames, formatting and generated files in one line with a count. Scale length to the change: a small fix needs about a minute.

## Show code legibly

- Show the changed hunk with two or three lines of context and colored additions and removals. Keep text readable at the final playback size.
- Highlight the line the narration is discussing while it discusses it. Keep one focal point per frame.
- Allow about three to five seconds per small hunk, longer for dense logic, with a short beat after each change of file.

Pick the specialist by what the viewer needs to see:

- **Code in its editor:** a human-style walkthrough that navigates the file tree to the changed file, applies the change in place from base to head and follows definitions, captured as `cue-synced-demo` describes. Walk into surrounding code the change relies on the same way.
- **The diff itself:** render the hunk to HTML with the installed `diff2html` CLI from [diff2html-cli](https://github.com/rtfpessoa/diff2html-cli) (MIT) and hold or compose it.
- **Before-to-after morph:** animate the two versions with Shiki's [`@shikijs/magic-move`](https://github.com/shikijs/shiki/tree/main/packages/magic-move) (MIT) inside a `hyperframes` composition, loaded from a version-pinned CDN URL the way compositions load their other runtime libraries.

Handle a missing specialist as `cue-synced-demo` describes, and never hand-roll a substitute.

## Produce and deliver

Write narration with `reasoning-first-narration` and joins with `narrative-transitions`. Use `tts-setup` for synthetic speech, `cue-synced-demo` for captured footage and timing, and `hyperframes` for composed scenes. Every claim traces to a diff line, a test or observed behavior. Hand the finished video to the user for review, and offer to attach it to the pull request.
