---
name: cue-synced-demo
description: 'Record real browser or editor events and assemble approved per-line narration with pre-event holds, disclosed wait cuts and final audio checks.'
---

# Cue-Synced Demo

Use approved story and evidence from the director and narration from `reasoning-first-narration`. Synthetic speech setup and listening-based voice acceptance belong to `tts-setup`. This skill owns event-bound footage and narration timing, not explainer art direction or composition tooling. The director selects that route.

This skill supplies practice, not a recorder, assembler or required programming language. Build on established capture specialists rather than hand-rolling a browser driver, recorder or document renderer. Write glue code only for a step the specialists cannot express, and never in this skill or the promptlings repository.

## Use established capture specialists

The Promptlings installer's demo toolchain provides these globally installed specialists, so use them without asking. If one is missing, tell the user to rerun the Promptlings installer with its demo toolchain. Do not install it during production or build a substitute. Libraries the production workspace uses as its own dependencies, such as `playwright` for driving VS Code, are installed locally in that workspace.

- **Browser capture:** invoke the `playwright-cli` skill from [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli). It handles navigation and input, viewport size, named sessions, saved authentication state, screenshots, and video with chapter markers.
- **Code walkthroughs in VS Code:** use this route when the director selected real editor interaction as evidence or the user requested it. Explaining implementation with source-derived excerpts belongs to the director's composition route and does not require workbench capture. For an editor walkthrough, retain enough Explorer, tab and editor context to make the demonstrated navigation understandable. A visible pointer travels at human speed to each thing before it is used: expand folders, click the file, move to the region, hover or go to a definition, then highlight the discussed block in place. Narrate meaningful navigation, and omit routine travel that does not support the takeaway. Keep the relevant code legible at delivery size. A source excerpt or still may support explanation, but never substitute for editor actions the approved story promises to demonstrate.
  - **Launch:** start desktop VS Code with Playwright's Electron support (`_electron.launch`) on the VS Code executable, with the workspace folder, a fresh `--user-data-dir` per take so view state does not carry over, and a fixed window size equal to the delivery resolution. Keep extensions enabled, because `--disable-extensions` raises a notification. Dismiss notifications and wait for a visible Explorer row before the take starts, not for a fixed delay.
  - **Pointer and real input:** drive the workbench with Playwright mouse and keyboard input, using integer coordinates because Electron rejects fractional CDP mouse positions. Playwright recordings draw no pointer, and libraries such as `ghost-cursor-playwright` neither render one nor work against Electron. Inject a small DOM pointer overlay into the workbench that follows the mouse events, move it as described in "Move the pointer like a hand", and probe one visible move before the take. This overlay is the minimal project-local glue the walkthrough needs.
  - **Pace:** never show code scrolling for more than two or three seconds; slow, mechanical scrolling is not watchable. For short distances, scroll briskly with a human wheel rhythm. For long distances, move the pointer to the scrollbar or minimap and click or drag to jump near the target, or click the symbol in the Outline view or breadcrumbs, then finish with a short scroll. Keep silent navigation under about 1.5 seconds; narrate the move itself when it takes longer.
  - **Editor actions:** use the `demotime-code-demo` skill from [Demo Time](https://github.com/estruyf/vscode-demo-time) (Apache-2.0) for what clicks cannot express well, such as patching a file from base to head or a precise highlight, and its `executeVSCodeCommand` action for commands such as `revealInExplorer` or `editor.action.revealDefinition`. Read-only acts that only navigate and highlight are valid.
  - **Recording:** by default record the Playwright-driven window and log events against the driver clock. Demo Time's `npx @demotime/video export` hides the workbench chrome and draws no pointer, so it does not suit walkthroughs; use it only for editor-only clips that intentionally omit the Explorer, passing settings as a file path, setting the capture size, muxing narration afterward because the export is silent and deleting the temporary workspace copy it keeps.
- **Window presentation:** follow the director's selected film style and the user's brand or platform. When none specifies framing, use rounded corners, traffic-light controls, a soft drop shadow and a subtle backdrop. Hide unwanted native chrome before capture where possible and keep the evidence at its native size.
- **Terminals:** follow the selected film style, with a legible monospaced font such as JetBrains Mono, SF Mono or Cascadia Code at presentation size, and output that starts at the top and grows downward. Type commands at a human pace and reveal output as it arrives. Cut long output with a skipped-time badge rather than letting it scroll. Composed terminal output illustrates behavior and does not replace required recorded execution.
- **VS Code stills and Web workbench states:** invoke the `vscode-playwright` skill from [microsoft/hve-core](https://github.com/microsoft/hve-core) (MIT). It drives VS Code Web through `serve-web` with Playwright, applies theme, zoom and layout, and verifies readable editor text.
- **Produced documents:** convert office files to PDF with LibreOffice headless, or with Word where it is installed for the closest Word layout. Then render the PDF pages to images with Poppler `pdftoppm`, or display them in the browser with pdf.js. Show the real pages as held frames or composed overlays.

## Move the pointer like a hand

Apply these rules to any pointer overlay the production injects into a real capture, in the browser or the editor. Authored cursors on a composed route follow that route's motion rules instead.

- **Path:** curve every move through one control point offset 6 to 14 percent of the distance from the straight line, alternating sides. Never travel in a straight line.
- **Easing:** use minimum-jerk progress, 10t^3 - 15t^4 + 6t^5, so a move starts and stops smoothly.
- **Duration:** let distance set it, about 220 + 110 * log2(d / 12 + 1) milliseconds for d pixels, kept between 160 and 1100 ms. That gives about 0.48 s for 50 px, 0.73 s for 280 px and 0.92 s for 1000 px. When a cue starts late, shorten the move, never below 160 ms.
- **Steps:** emit one position per frame interval, about 16 ms, rounded to integer coordinates.
- **Landing:** on moves longer than about 280 px, pass the target by 3 to 7 px along the direction of travel and settle back over about 100 ms. Shorter moves land directly. This hand settle is recorded input, not authored bounce.
- **Press:** hold the button for about 70 ms and show it by shrinking the overlay briefly. Do not add click rings or ripples.
- **Waiting:** during a hold longer than about 1.5 s the pointer may drift 2 to 5 px slowly, returning to its exact rest point before the next action. Keep it still over text the viewer is reading.
- **Target:** aim at the measured centre of the target element, never a guessed coordinate.
- **Variation:** draw every varied value (bend side and amount, overshoot distance, drift) from a seed made of the section name and the move's index in it. Record the seed with the take. A retake of a section and both halves of a before/now comparison reuse it, so they move identically.

## Move overlays like the composed route

Skipped-time badges, highlights, callouts, zooms and crossfades that the production adds to a plain capture follow these rules. All but the zoom rule restate the pinned `hyperframes` skill's `references/motion.md` for installations without it; where it is installed, that file governs.

- An arrival lands on a long-tailed ease-out, a zoom or pan eases both ways, and an exit accelerates. Never move linearly, and do not give every element the same ease and duration.
- An exit is one smooth motion, 40 to 50 percent shorter than its entrance.
- A secondary element, such as a callout after its highlight, starts when the primary is 30 to 50 percent complete.
- Zoom in log space, so a 1 to 3 times zoom feels constant-speed, and frame it on measured bounds.
- Badges, highlights and callouts never bounce, pulse or breathe. Once landed, overlay text stays still until it leaves.
- Hold overlay text about 0.5 s plus 0.3 s per word before it leaves.
- Give every transition a cause on screen, and let a crossfade or zoom land and hold before the next one starts.

## Capture real events

Keep automation infrastructure in the background. Do not open dashboards, inspectors, reports or browser windows for the user unless an unavoidable login or other critical user action requires it. First check whether an authorized authentication context can be reused. If human action is necessary, verify that the presented surface actually supports interaction and connects to the capture session. A dashboard or read-only preview is not a sign-in surface.

Check privacy, the intended viewport and recording readiness before executing the workflow. Record the first authorized run with event timestamps so it serves as both rehearsal and a candidate take. Inspect an early native-resolution segment as soon as the recorder supports it. Keep footage that satisfies the approved evidence, framing and timing requirements rather than repeating a successful run solely for capture.

Use separate rehearsal only when a specific action is irreversible, changes state that is difficult to restore, or needs practice before a one-shot capture. Rehearse that action using a safe substitute or resettable state, then record the actual required evidence. Record the reason in the existing production notes.

Drive the flow with the capture specialist, supplying the app's address and any authentication it needs. Preserve originals in a new take directory. Stop and retain failure evidence when a required action fails. Snapshot the data each section starts from before recording it, so a retake, and both halves of a before/now comparison, start from the same state. Retake only affected sections when their starting state and continuity can be reproduced faithfully, otherwise repeat the dependent sequence. When narration presents a produced file the capture does not show, render its actual pages as described above and show them, narrating only what is visible.

Overlap preparation with recording inside this one production. Make slow state a later section needs (generated reports, long jobs, imports) in a separate headless context seeded from saved authentication state, while the visible flow records. Keep that state file outside the repository and logs, and never print it. Use a separate demo identity from the user's own session, discard rather than save shared settings, and keep the user's browser free. Record headless at a fixed viewport and device scale, so other windows cannot cover the take. Start unavoidable long waits first and record only their start and end. Encode each section as soon as it is recorded. Never run a full render or another recording during a take; the recorder drops frames.

Record named events against a monotonic clock with a documented recording origin. Log each event when its narrated condition first becomes visible, not after an arbitrary settling delay. Mark long waits with start/end times. Number repeated names across the whole take: `complete`, `complete#2`, `complete#3`, including across scenes. Record explicitly skipped optional actions by the exact narrated event name. A missing required event always fails. For an explicitly skipped optional event, warn, list the omitted cue in the timing report and fail if the approved delivery requires every cue.

With each named event, record the bounding box of the element it concerns, in recording pixels after device scale. Use these measured bounds for every placement: pointer targets, zoom framing, highlights and callouts, and captions, which move off the element rather than cover it. If an element is outside the viewport when its event fires, scroll it into view before the event or fail the take; never zoom or point at an estimate.

Inspect raw event frames to establish the event-to-video clock. Find the frame where the first logged action (a click, a tab opening) visibly takes effect, and use the difference from its logged time as the offset. Do not assume page creation, recorder startup and encoded frame zero coincide. Trim blank or pre-launch frames before assembly. For a Demo Time export, the `start` event in `demo-events.jsonl` is the origin and each `sceneStart` is a scene event; map them to the narrated event names. Verify cuts with frames extracted at exact timestamps or with scene detection, because a contact-sheet still can land on a transitional frame. Audio checks alone do not prove visual alignment.

## Bind narration to events

Keep the approved Markdown narration as the source, with scene headings and inline event bindings:

```text
## result
@complete The result is ready.
This line continues the same cue.
@complete#2 Here is the result after the revision.
```

Associate each cue with its audio file, exact text and selected voice, model and settings using the project's existing notes or a small index. Reuse only unchanged text and speech settings. Reject mismatched text or voice before rendering. Measure actual clip onset and end rather than trusting cached duration.

Bind each cue to the moment its subject becomes visible, not to the start of its scene. In a code walkthrough, a cue that describes where the viewer is going binds to the start of the visible navigation toward it, so speech accompanies the movement; a cue about specific lines binds to when they have rendered, scrolled into place and are highlighted.

## Schedule and assemble

Produce a timing-only report before encoding. Required narrated events must exist in order. Target speech onset 0.2 seconds after its visible event, allowing the clip's own initial silence only while total drift stays in `[0, 0.3)` seconds. Leave at least 0.25 seconds between spoken lines and reject overlapping audio. If narration would overrun the next event, freeze the frame immediately before that event. Never stretch speech to fit.

Compress long waits only outside required cues, retaining enough context on either side and showing a skipped-time badge. Preserve native dimensions without upscaling. For compatible H.264 output, pad odd dimensions to even values and use `yuv420p`. Resample variable-frame footage if needed rather than rejecting it for nonuniform timestamps.

## Verify the delivered file

Measure speech onset in the final encoded audio and compare it with each scheduled visible event. Search before the expected onset, back to just after the previous measured speech end, or at least one second before the first event. A search restricted to the expected cue window can falsely pass early audio. Reject negative drift, drift of 0.3 seconds or more, overlap, missing speech and out-of-order cues. Check isolated narration before adding music. Energy detection is not speech recognition or a listening judgment.

Carry cue times into the final composition timeline, updating them for cuts, holds and transitions. For joined parts, use their actual starts in the final timeline, including crossfade overlap, not accumulated source durations. Verify across joins in the joined encoded file. Keep the timing report, final path/hash, inspected event frames and a contact sheet with one frame per scene start.

Choose captions for the delivery. Master with existing tools: normalize loudness in two passes, measuring first and then applying, to -14 LUFS integrated (plus or minus 1) with true peak at or below -1 dBTP. Encode H.264 `yuv420p` with AAC and place the index at the start of the file (`+faststart`) for progressive web playback. Review silence and black-frame detection against the timeline and flag unexpected spans rather than cutting automatically. Check the size against the destination's limit; GitHub accepts videos up to 10 MB in free-plan repositories and 100 MB on paid plans. Reverify after muxing, joining or mastering. Listen through the final video with the visuals for pronunciation, pacing, joins, omissions and story/evidence fit. Flag silent frozen spans longer than about six seconds for editorial review, preserving deliberate reading or inspection time rather than cutting automatically. Screenshots and timing checks are not human acceptance.

Reuse audio whose text and voice settings are unchanged. Re-render from original captures after timing or visual changes. Reverify the exact final file.
