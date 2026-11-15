---
name: presenter-script
description: 'Write the suggested script a human uses to drive a live interactive experience: a scripted hook and close, say-act-wait-read cues for every mini-app stop, predict-then-run sequences, capture facilitation, video audio cues, timeboxes, priorities, fallbacks and rehearsal. Use when preparing a live talk, workshop, demo or review that a person presents from working models.'
---

# Presenter Script

This skill writes what the presenter says and does while they drive an interactive experience in front of a room. The experience belongs to `interactive-experience`; the story and approval belong to the directing agent (`interactive-presentation`). Narration for recorded video belongs to `reasoning-first-narration` and the video workflows.

The presenter is operating working models live, not reading slides. The script supports that: it tells them what to say before they touch a control, what to do, when to stay silent while the model moves and what to say once the result is on screen. It words in full only what must land exactly and gives cues for the rest, because reading verbatim breaks eye contact and improvising every line overruns.

Invoke `reasoning-first-writing` for the user-facing script document. Before
its detailed cues, give a short overview of the audience, intended takeaway,
selected scope and route through the experience. Make that orientation
visually precede the beat-by-beat material. Close the document with a briefer
synthesis that helps the presenter own the experience and its remaining
decision or rehearsal action. Keep this document framing outside spoken
lines, preserving the exact hook, close and approved narration.

Apply `reasoning-first-narration` to the complete spoken path, not only the
hook. Short cues must still let the presenter give context, point to a visible
object, explain what changed and land its consequence. Fully word an essential
causal bridge when cue compression would make the presenter reconstruct it.
Keep ordinary body cues flexible without turning them into release-note labels.

## The driving loop

Every manipulation on stage follows four moves, the structure of think-aloud narration around a live system:

1. **Say.** Name what you are about to change and why ("I'll add 400 milliseconds to the middleware only").
2. **Act.** Press the preset key or move the control. One change at a time.
3. **Wait.** Stop talking for two to four seconds while the model responds. The room looks at the screen when the presenter goes still and quiet; talking over the change hides it.
4. **Read.** Say what happened and what it means, pointing at the focal element by name ("checkout stayed up; every request just paid the delay").

Write every beat that moves the model in this order. A beat with no "Read" line is unfinished.

Before handoff, walk the whole script at speaking pace with the screen
sequence. Check first-listen comprehension from entry through close, including
the transitions, waits and source of every claim. Accuracy and a fitting word
budget are necessary but do not establish that the audience can follow.
Rewrite dense passages before rehearsal, preserving the selected coverage.
Use the rehearsal to check actual spoken delivery, not as a substitute for
repairing an unclear script.

## Script structure

1. **Hook, fully scripted (30 to 60 seconds).** Pose the question the first model will answer, built from why this audience is in the room and the one thing they should leave with. Write it with `reasoning-first-narration` in live human mode and apply its hook check.
2. **Stop entries.** For each stop: its question in one sentence, the driving-loop cues for each beat, the answer to say aloud and the reset. Fully word definitions, numbers and claims with limits; cue everything else in three to eight words.
3. **Predict sequences** where the outcome is guessable (see below).
4. **Exploration segments** where the room steers: the question, two or three suggested moves with the preset keys that land them, a hard timebox, the answer and the reset.
5. **Capture prompts** where the room's answer is recorded for a later stop.
6. **Video cues** for every video stop, with its audio mode.
7. **Transitions.** Write the sentence that joins each section with `narrative-transitions`. Rooms are lost between stops, so script them.
8. **Close, fully scripted (about 30 seconds).** Call back to the hook's question, state the answer the session built and the specific next action.
9. **Fallbacks** for every live run and every capture, written as one line each.

Bind each entry to its stop and beat identifier, so the presenter-view notes and the script are the same text. The experience's stop list holds the cue lines as each beat's notes; the full script document holds everything.

## Predict before you run

Watching a demonstration without predicting teaches about as much as not seeing it; predicting first is what produces the learning. For each predictable result:

1. Show the setup on its preset and say what will change, without the result.
2. Ask a concrete question with two or three named answers ("stays up or falls over?"), never an open "what do you think".
3. Give silent think time (at least five seconds), then collect: a show of hands for a gut check, a capture stop when a later stop uses the answer. In workshops, add "turn to your neighbor for thirty seconds" and collect again.
4. Read back the split in numbers ("about sixty-forty for stays up").
5. Run the model, then wait.
6. Name the match or mismatch with the room's call ("most of you expected a failure; it got slow instead"). When the room was wrong, stay on it: the gap between prediction and result is where the point lands.

## Capture facilitation

- **Collect only what a later stop uses.** If nothing reads the answer back, ask with hands and skip the capture stop.
- **Timebox aloud:** "Twenty seconds, pick one." Show the count on the stage aggregate.
- **Name who enters it:** the presenter in the presenter view, or a facilitator at the stage controls.
- **Give remote attendees their own moment:** "Teams, put your answer in the chat now," then read the chat count into the record.
- **Low response:** say the count and lower the stakes ("three votes so far, that is enough to work with"), then proceed.
- **Silent room:** a scripted default ("most rooms pick miss") entered as the facilitator's estimate, marked as such.
- **Read back before use:** say what the room chose before a model runs with it.

## Video cues

Write the audio mode on every video cue:

- **MUTED (default).** The presenter narrates in short phrases timed to what appears, adding what the picture cannot show. Never read on-screen text aloud.
- **NARRATED.** Only when the clip's own voice is the evidence: a customer, a user or an expert. The presenter introduces it, stays silent while it plays and debriefs after. Captions are on.
- **AMBIENT.** When the sound itself is evidence (a fan spinning up, an alarm). Say what to listen for, then pause two to three seconds after it plays.

For every clip, script the setup (why it is recorded rather than live, and the question it answers), the chapter keys used to seek, the takeaway after it and the bridge back to the next live stop. In a Teams session, the script's tech check confirms "Include sound" for NARRATED and AMBIENT clips.

## Questions and failure

- **Park questions with a return point:** write it on the parking list and say where you will answer it ("at the wrap-up"). Answer it there.
- **Audience-suggested values** go in an exploration timebox with a spoken "last one".
- **When something breaks:** name it in one sentence, press the fallback key and continue. If the failure teaches something, say what ("this is the same timeout we just modeled"). Never debug on stage.
- **Reset in view and say so** ("back to the healthy baseline"), so the room trusts the next run.

## Notation

| Cue | Meaning |
| --- | --- |
| `[queue/2]` | Start of the entry for beat 2 of stop `queue` |
| `[~4:30]` | Target elapsed time at this point |
| `[preset 3: overload]` | Press preset key 3; names the state it lands on |
| `[drag: arrival rate to 40/s]` | A direct manipulation with its landing value |
| `[run]`, `[step]`, `[pause]` | Transport keys `K`, `L`, `K` |
| `[wait 3s]` | Silent beat; do not talk over it |
| `[predict: question / answer A / answer B]` | Opens a predict sequence |
| `[capture: stream, who enters, timebox]` | Records the room's answer to the named stream |
| `[read back]` | Say the captured split or the result aloud |
| `[explore 90s: question]` | Opens a timeboxed exploration, closed by its answer and `[reset]` |
| `[reset]` | Press `0` |
| `[video: id, MUTED]`, `[video: id, NARRATED]`, `[video: id, AMBIENT]` | Plays a clip with its audio mode; `[chapter 2]` seeks |
| `[point: element]`, `[step back]`, `[face room]` | Stage directions |
| `[park: question, return at stop]` | Defers a question to a named place |
| `MUST-KEEP` / `DROPPABLE (saves 2:00, skip to fix)` | Cut decision made in advance |
| `FALLBACK: line [R]` | What to say and press when a live step fails |

## Timing

- Budget 110 to 130 spoken words a minute. Fully worded parts plus about 15 spoken words per cue line fit about 70 percent of the slot; predict sequences, waits, explorations and recovery take the rest.
- Place a time checkpoint every ten to fifteen minutes so a glance says ahead or behind.
- Mark every stop MUST-KEEP or DROPPABLE. DROPPABLE stops together recover at least a fifth of the slot.
- Change activity every five to eight minutes: predict, explore, capture, video, a pause for questions.

## Example

The wording below is illustrative. Write each script from the actual subject.

```text
[title] [~0:00] MUST-KEEP
HOOK (scripted):
  "Last quarter our nightly build failed eleven times, and nine of those
   came from one cache. In ten minutes you'll know why, because you are
   going to break it."
[wait 2s] [next]

[cache/1] [~0:40]
  Question: what does the cache think "the same build" means?
  Cue: the key is inputs plus command
[cache/2] [preset 2: new-compiler]
  Say: "Same source, same command, new compiler."
  [predict: hit or miss? / hit / miss]
  [wait 5s] Hands. [read back]
  [run] [wait 3s]
  Read: "It's a hit. Old binary, new compiler. That's the bug."
  If the room said miss: "Most of you expected a miss, and so did we."

[cache/3] [~3:30] [explore 90s: which inputs can change without the key noticing?]
  Moves: [preset 3: env-var], [preset 4: lockfile]; drag compiler version
    if asked. "Last one."
  Answer: "Anything not in the key is invisible to it." [reset]
  [park: remote cache?, return at wrap-up]

[build-video] [~5:30] [video: second-run, MUTED]
  Setup: "This is this morning's real build; it takes twelve minutes,
    so here it is at speed. Watch the second run."
  Over it: "first run, full compile ... second run, nothing rebuilt"
  [chapter 2] Takeaway: "Zero work, wrong binary." Bridge: "So let's fix
    the key."

[cache-leaks] [~6:30] DROPPABLE (saves 2:00, skip to fix)
  Cue: three other places the key leaks

[fix/1] [~8:30] MUST-KEEP
  [capture: fix-vote, facilitator, 20s] "Which input do we add first?"
    Teams: chat now. Silent room: enter "toolchain" as facilitator estimate.
  [read back] [preset 2: room-choice] [run] [wait 3s]
  Read: "With your fix, the key changes and the stale hit is gone."
  FALLBACK: "Here's the run from rehearsal." [R]

CLOSE (scripted):
  "So, what did the cache think 'the same build' meant? Everything except
   the compiler. Check your keys this week; the handout has the model you
   just broke."
```

## Rehearsal and tech check

- Rehearse aloud at full voice at least twice with the presenter view, once recorded; compare elapsed time with each checkpoint.
- Rehearse predict sequences, explorations, captures, video cues and every fallback, not only the content. Press every preset and reset key without looking.
- Clear rehearsal records from `data/` before the session.
- Room: display mode (mirrored or extended), resolution, clicker keys and battery, back-row legibility of the densest stop, room audio for any NARRATED or AMBIENT clip.
- Teams: share the audience window, check legibility and the cursor ring through the meeting client, turn on "Include sound" when a clip has audio, and keep chat visible for audience moments.
- Silence notifications, close unrelated windows and use a separate browser profile. The experience runs from its own local server; nothing needs the venue network.
- After the session, export the handout with the captured data.

## Evidence

Prediction before observation: Crouch, Fagen, Callan and Mazur (2004), *American Journal of Physics* 72(6); the Interactive Lecture Demonstrations and Peer Instruction procedures documented on [PhysPort](https://www.physport.org/methods/method.cfm?G=ILD). Think time: Rowe (1986), *Journal of Teacher Education* 37(1). Say-act-read narration: Nielsen Norman Group, [Thinking Aloud](https://www.nngroup.com/articles/thinking-aloud-the-1-usability-tool/). Stage practice, one-click reset, must-keep and droppable marking, time-blocked notes: Scott Hanselman, [11 Top Tips](https://www.hanselman.com/blog/11-top-tips-for-a-successful-technical-presentation) and [Preparing for a Technical Presentation](https://www.hanselman.com/blog/tips-for-preparing-for-a-technical-presentation); Zach Holman, [speaking.io](https://speaking.io/). Video audio modes: Mayer and Moreno (2003), *Educational Psychologist* 38(1), and [WCAG 1.2.2](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html). Speaking rate: [VirtualSpeech](https://virtualspeech.com/blog/average-speaking-rate-words-per-minute). Further learning research is in the `interactive-experience` [sources](../interactive-experience/references/sources.md).
