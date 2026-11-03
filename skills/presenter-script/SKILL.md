---
name: presenter-script
description: 'Write the suggested script a human uses to deliver an interactive deck or live technical demo: a fully worded hook and close, cue lines bound to deck steps, timing, fallbacks and rehearsal checklists. Use when preparing a live talk, demo or review that a person presents.'
---

# Presenter Script

This skill writes what the presenter says and does while a deck or demo runs. The deck belongs to `interactive-deck`; the story and approval belong to the directing agent (`interactive-presentation` when installed). Narration for recorded video belongs to `reasoning-first-narration` and the video workflows.

A live script is a support for a person, not a text to read aloud. Reading verbatim sounds read and breaks eye contact, while improvising every line drifts and overruns. Word in full only the parts that must land exactly, and give the presenter short cues for the rest.

## Script structure

1. **Hook, fully scripted (30 to 60 seconds).** The opening sentences that earn attention: a problem the audience has, a surprising measurement or a question they will want answered. Write it with `reasoning-first-narration` in live human mode and apply its hook check.
2. **Body as cue lines.** For each deck step, a cue of three to eight words that names the point to make, not the sentence to say. Add a fully worded line only where precision matters: a definition, a number, a claim with a caveat.
3. **Transitions.** Write the sentence that joins each section, using `narrative-transitions`. Transitions are where live talks lose the room, so script them.
4. **Close, fully scripted (about 30 seconds).** Restate the one idea the audience should keep, then the specific next action.
5. **Fallback lines.** For every live demo step, one scripted sentence that moves to the replay or recording without apology or debugging.

Bind each body entry to its deck step identifier, so the presenter-mode notes and the script stay identical. The deck's step list holds the cue lines as each step's notes; the full script document holds everything.

## Notation

- `[arch-03]` starts the entry for deck step `arch-03`.
- `[~4:30]` marks the target elapsed time at that point.
- `[click]`, `[pause 3s]`, `[look at room]`, `[switch to terminal]` are stage directions.
- `[ask: question]` marks a question to the audience, with the expected answers and how to respond.
- `[predict]` marks a predict-then-reveal: ask, wait, then advance.
- `CUTTABLE` marks a section to drop if time runs short, with the step to skip to.
- `FALLBACK:` marks the line to say and the key to press when a live step fails.

## Rules

- **Never read the screen.** Speech explains the evidence; it does not repeat the headline or labels.
- **Name what you point at.** Describe the focal element aloud ("the queue on the left just filled") so remote viewers, low-vision viewers and anyone looking away can follow.
- **Budget words.** At 130 to 150 words a minute, fully scripted parts plus cue lines counted at about 15 to 20 spoken words each must fit about 80 percent of the slot. Live talks run long; leave the rest for questions, pauses and recovery. Mark CUTTABLE sections that recover at least two minutes.
- **Plan an audience beat every five to eight minutes.** A predict-then-reveal, a show of hands or a question, or a demo. Give each one an in-room form and a remote form (chat reply, poll or reaction).
- **Script pauses.** After a reveal or a question, write the pause. Presenters fill silence too early.
- **Keep the claims honest.** Every number and outcome in the script matches the deck evidence and its source.

## Example skeleton

The wording below is illustrative. Write each script from the actual subject.

```text
[title] [~0:00]
HOOK (scripted):
  "Last quarter our nightly build failed eleven times, and nine of those
   failures came from one cache. Today I'll show you why that cache lies,
   and the change that made it tell the truth."
[pause 2s] [click]

[cache-01] [~0:40]
  Cue: what the cache stores, and when
[click] Cue: the key ignores the toolchain version

[cache-02] [~2:10]
  [predict] [ask: "Same inputs, new compiler: hit or miss?"]
    Expect "miss". Answer: "It's a hit. That's the bug."
  [pause 3s] [click]

[demo-01] [~3:30] [switch to terminal]
  Cue: run the build twice, watch the second hit
  FALLBACK: "Here is the same run captured this morning." [press R]

[cache-03] [~5:00] CUTTABLE (skip to fix-01)
  Cue: three other places the key leaks

TRANSITION (scripted):
  "So the cache is fast because it is forgetting something. Here's how
   we taught it to remember."

[fix-01] [~6:30]
  Cue: add toolchain hash to the key
...
CLOSE (scripted):
  "If your cache key doesn't include every input, your cache is guessing.
   Check yours this week: the script is in the repo, linked on this slide."
```

## Live demo safety

- Start from prepared state with a reset script, and run the reset in rehearsal.
- Paste or replay commands rather than typing them; zoom terminal and editor fonts to match the deck size floor.
- Keep a recorded fallback for every live step, reachable with one key or click.
- Silence notifications, close unrelated windows and use a separate browser profile.
- Never debug on stage: say the FALLBACK line and continue.
- Do not depend on venue network unless the network is the subject.

## Rehearsal and tech check

- Rehearse aloud at least twice in presenter mode, once recorded, and compare elapsed times with the timing marks.
- Rehearse the transitions and fallbacks, not just the content.
- In the room or meeting: confirm the display mode (mirrored or extended), resolution, clicker keys and battery, audio and the back-row legibility of a dense step.
- For remote delivery: share the audience window only, check how the deck looks through the meeting client, and keep chat visible for audience beats.
- Share the deck or a PDF export after the talk when the audience needs it for reference or accessibility.

## Evidence

The structure follows practitioner guidance on live talks (Chris Anderson, ["How to Give a Killer Presentation"](https://hbr.org/2013/06/how-to-give-a-killer-presentation), HBR 2013; Zach Holman, [speaking.io](https://speaking.io/)) and the learning research in the `interactive-deck` [sources](../interactive-deck/references/sources.md): redundancy (do not read the screen), signaling (name the focal element), and retrieval and curiosity (predict-then-reveal). Timing and rehearsal guidance is practitioner consensus rather than controlled research.
