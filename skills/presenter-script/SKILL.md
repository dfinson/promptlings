---
name: presenter-script
description: 'Write the suggested script a human uses to deliver a live interactive experience or technical demo: a fully worded hook and close, cue lines bound to stops and beats, guided exploration segments, capture and video cues, timing, fallbacks and rehearsal checklists. Use when preparing a live talk, workshop, demo or review that a person presents.'
---

# Presenter Script

This skill writes what the presenter says and does while an interactive experience or demo runs. The experience belongs to `interactive-experience`; the story and approval belong to the directing agent (`interactive-presentation`). Narration for recorded video belongs to `reasoning-first-narration` and the video workflows.

A live script is a support for a person, not a text to read aloud. Reading verbatim sounds read and breaks eye contact, while improvising every line drifts and overruns. Word in full only the parts that must land exactly, and give the presenter short cues for the rest.

## Script structure

1. **Hook, fully scripted (30 to 60 seconds).** The opening sentences that earn attention: a problem the audience has, a surprising measurement or a question they will want answered. Write it with `reasoning-first-narration` in live human mode and apply its hook check.
2. **Body as cue lines.** For each beat, a cue of three to eight words that names the point to make, not the sentence to say. Add a fully worded line only where precision matters: a definition, a number, a claim with a caveat.
3. **Exploration segments.** For each mini-app stop the presenter drives, the question the exploration answers, two or three suggested moves with the preset keys that land them, a time cap, the answer to say aloud and the reset key. The presenter may wander inside the cap; the segment ends on a known state.
4. **Transitions.** Write the sentence that joins each section, using `narrative-transitions`. Transitions are where live talks lose the room, so script them.
5. **Close, fully scripted (about 30 seconds).** Restate the one idea the audience should keep, then the specific next action.
6. **Fallback lines.** For every live run, one scripted sentence that moves to the replay or recording without apology or debugging.

Bind each entry to its stop and beat identifier, so the presenter-view notes and the script stay identical. The experience's stop list holds the cue lines as each beat's notes; the full script document holds everything.

## Notation

- `[queue/2]` starts the entry for beat 2 of stop `queue`.
- `[preset 3: overload]` presses the preset key and names the state it lands on; `[reset]` presses `0`.
- `[~4:30]` marks the target elapsed time at that point.
- `[click]`, `[pause 3s]`, `[look at room]`, `[switch to terminal]` are stage directions.
- `[ask: question]` marks a question to the audience, with the expected answers and how to respond.
- `[predict]` marks a predict-then-reveal: ask, wait, then advance.
- `EXPLORE (90s):` opens an exploration segment with its question, moves, answer and `[reset]`.
- `[capture: stream]` records the room's answer in the named capture stream, with who enters it and the fallback if the room is silent.
- `[video: chapter]` plays or jumps to a video chapter, with `NARRATED` when the clip's own voice plays and `MUTED` when the presenter talks over it.
- `CUTTABLE` marks a section to drop if time runs short, with the step to skip to.
- `FALLBACK:` marks the line to say and the key to press when a live step fails.

## Rules

- **Never read the screen.** Speech explains the evidence; it does not repeat the headline or labels.
- **Name what you point at.** Describe the focal element aloud ("the queue on the left just filled") so remote viewers, low-vision viewers and anyone looking away can follow.
- **Budget words.** At 130 to 150 words a minute, fully scripted parts plus cue lines counted at about 15 to 20 spoken words each must fit about 80 percent of the slot. Live talks run long; leave the rest for questions, pauses and recovery. Mark CUTTABLE sections that recover at least two minutes.
- **Plan an audience moment every five to eight minutes.** A predict-then-reveal, a show of hands, a capture, an exploration the room steers, or a demo. Give each one an in-room form and a remote form (chat reply, poll or reaction).
- **Ask before you touch.** State the exploration question before the first control moves, and say the answer before resetting. Exploration without a stated question loses the room.
- **Never talk over narration.** During a `NARRATED` video stay silent; set up the clip before it and pick up after it. Talk freely over `MUTED` clips.
- **Read captures back.** After a capture, say what the room chose before the model uses it.
- **Script pauses.** After a reveal or a question, write the pause. Presenters fill silence too early.
- **Keep the claims honest.** Every number and outcome in the script matches the evidence on screen and its source. Say when a mini-app is a model and what it simplifies.

## Example skeleton

The wording below is illustrative. Write each script from the actual subject.

```text
[title] [~0:00]
HOOK (scripted):
  "Last quarter our nightly build failed eleven times, and nine of those
   failures came from one cache. Today you'll break that cache yourselves,
   and then watch the change that made it tell the truth."
[pause 2s] [click]

[cache/1] [~0:40]
  Cue: what the cache stores, and when
[click] [cache/2] Cue: the key ignores the toolchain version

[cache/3] [~2:10]
  [predict] [ask: "Same inputs, new compiler: hit or miss?"]
  [capture: compiler-guess] Facilitator enters the show of hands.
    Silent room: "Most people say miss." [preset 2: new-compiler]
  [pause 3s] [click] Answer: "It's a hit. That's the bug."

[cache/4] [~3:30] EXPLORE (90s)
  Question: "Which inputs can change without the key noticing?"
  Moves: [preset 3: env-var] then [preset 4: lockfile]; drag the
    compiler version if the room asks.
  Answer: "Anything not in the key is invisible to it." [reset]

[build-video] [~5:00] [video: second-run] NARRATED
  Set up: "Here's the real build, recorded this morning."
  [silent while it plays] Pick up: "Second run, zero work, wrong binary."

[cache-leaks] [~6:00] CUTTABLE (skip to fix)
  Cue: three other places the key leaks

TRANSITION (scripted):
  "So the cache is fast because it is forgetting something. Here's how
   we taught it to remember."

[fix/1] [~7:30]
  Cue: add toolchain hash to the key  [preset 2: after]
...
CLOSE (scripted):
  "If your cache key doesn't include every input, your cache is guessing.
   Check yours this week: the handout has the model you just broke."
```

## Live demo safety

- Start from prepared state with a reset script, and run the reset in rehearsal.
- Paste or replay commands rather than typing them; zoom terminal and editor fonts to match the stage size floor.
- Keep a recorded fallback for every live run, reachable with one key or click.
- Know every mini-app's reset key and preset keys without looking; recovery from any exploration is one key.
- Silence notifications, close unrelated windows and use a separate browser profile.
- Never debug on stage: say the FALLBACK line and continue.
- Run the experience from its own local server; nothing needs the venue network.

## Rehearsal and tech check

- Rehearse aloud at least twice with the presenter view, once recorded, and compare elapsed times with the timing marks.
- Rehearse the transitions, exploration segments, captures and fallbacks, not just the content. Clear rehearsal records from `data/` before the session.
- In the room or meeting: confirm the display mode (mirrored or extended), resolution, clicker keys and battery, audio and the back-row legibility of a dense stop, and video audio through the room or meeting.
- For remote delivery: share the audience window only, check how the experience looks through the meeting client, share computer audio for video stops, and keep chat visible for audience moments.
- After the talk, export the handout with the session's captured data and share it with the clips.

## Evidence

The structure follows practitioner guidance on live talks (Chris Anderson, ["How to Give a Killer Presentation"](https://hbr.org/2013/06/how-to-give-a-killer-presentation), HBR 2013; Zach Holman, [speaking.io](https://speaking.io/)) and the learning research in the `interactive-experience` [sources](../interactive-experience/references/sources.md): redundancy (do not read the screen), signaling (name the focal element), retrieval and curiosity (predict-then-reveal) and guided rather than unframed exploration of simulations. Timing and rehearsal guidance is practitioner consensus rather than controlled research.
