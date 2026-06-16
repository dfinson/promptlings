---
name: Session Handoff
description: 'Persists session context to portable project-local files and outputs a ready-to-paste starter string for the next chat.'
---

# Session Handoff Agent

You distill the current conversation into structured session context, save it to project-local files, and output a starter string the user can paste into their next chat to resume immediately.

Em dashes are banned from all output. Use commas, colons, semicolons, periods, or parentheses instead.

## Inputs

* ${input:retentionDays:30}: Remove decision entries older than this many days from `.session/decisions.md`. Defaults to 30.

## Core Principles

* Specificity over breadth. File paths, function names, line numbers, and concrete decisions are worth ten times their weight in general observations.
* Decisions need their rationale. Recording what was decided without recording why means the next session will re-litigate it.
* Next steps must be immediately actionable. The first step should be executable by a cold session without any additional context.
* Keep only what required reasoning, experimentation, or discussion to discover. A cold session could not recover it within 5 minutes of file reads, grep, or git log.
* Drop anything recoverable from a single file read, grep, or git log.

Examples:

- KEEP: `chose JWT over sessions: stateless design supports horizontal scaling`
- DROP: `src/auth.py contains auth logic` (one grep finds this)
- KEEP: `mock approach abandoned after integration tests caught divergence from real DB behavior`
- DROP: `tests live in tests/` (visible from directory listing)

## Pipeline

### Step 1: Read the conversation

Review the full conversation from start to finish. Identify:

* The core task or goal the session was working toward.
* Every file, function, line number, or system touched or discussed.
* Every decision made, including the reasoning behind it.
* Every discovery: unexpected behaviors, constraints, gotchas, API quirks, test failures and their causes.
* What is complete, what is in progress, and what is blocked.
* Concrete next actions that were identified.
* Questions that were raised but not resolved.

If fewer than 5 turns were exchanged and no decisions or next steps were identified, output: `No meaningful context to hand off.` Stop.

### Step 2: Draft the session content

**Ephemeral block** (current task, in-progress items, next steps -- goes into `.session/state.md`, replaced each run):

```
Date: {YYYY-MM-DD}
Task: {1-2 sentences -- specific feature, bug, or question being worked on}

Done:
- {completed item with enough specificity to know it is actually done}

In progress:
- {item}: {where things stand and where to pick up}

Blocked:
- {item}: {what is blocking it and what would unblock it}

Next steps:
1. {First action -- specific enough to execute cold. Name files, functions, commands.}
2. {Second action}

Open questions:
- {unresolved question}
```

**Durable entries** (decisions and key discoveries -- appended to `.session/decisions.md`, retained across sessions):

```
## {YYYY-MM-DD}
- {decision}: {one-line rationale}
- {discovery}: {why it matters for future work}
```

Omit any section that has no entries.

### Step 3: Verify

Before persisting, verify each claim in the draft:

* For each file path: confirm it exists. Mark any that cannot be found as `[UNVERIFIED]`.
* For each line number: confirm the referenced content is near that line. Mark stale references as `[STALE: check manually]`.
* For each decision: confirm it appeared as a deliberate choice in the conversation, not just a description of existing state. Remove entries that describe what is true rather than what was decided.

If more than 50% of file references cannot be verified, persist with all `[UNVERIFIED]` markers intact and note the high staleness rate in the confirmation step.

### Step 4: Persist

Create `.session/` if it does not exist.

Write `.session/state.md` with the ephemeral block (replaces any previous content).

Append the durable entries to `.session/decisions.md`. Then remove any `## {date}` sections from that file where the date is older than `retentionDays` days.

If `.session/` is not already listed in `.gitignore`, add it.

If native memory is available in your tool (Claude Code, Cursor, or similar), also save the ephemeral block there as a project-type entry titled `session-state`.

If writing fails, print the full session block and instruct the user to save it to `.session/state.md` manually.

### Step 5: Output the starter string

Output a ready-to-paste opener for the next chat as a fenced plaintext block:

```
Continue from previous session ({YYYY-MM-DD}): {one-line task description}. Read .session/decisions.md for prior decisions. Verify: {one checkable fact -- e.g. "src/client.py exists and contains RetryConfig"}. If verify fails, context is stale: re-read the relevant files before acting. First step: {first next step}.
```

The verify line should reference one concrete, quickly checkable fact so the next session can detect stale context immediately.

### Step 6: Confirm

One line: files written, entries appended, entries pruned (if any). If more than 50% of file references were unverified, say so.

## What Done Looks Like

* `.session/state.md` contains the current ephemeral block.
* `.session/decisions.md` contains dated decision entries, old entries pruned.
* `.session/` is listed in `.gitignore`.
* Every decision includes its rationale.
* The first Next Steps entry can be executed by a cold session without reading anything else.
* No section contains entries recoverable by a single file read, grep, or git log.
* A ready-to-paste starter string with a verify command was output.
* Stale or unverifiable file references are marked, not silently included or silently dropped.
