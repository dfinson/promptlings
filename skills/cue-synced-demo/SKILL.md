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
  - **Pointer and real input:** drive the workbench with Playwright mouse and keyboard input, using integer coordinates because Electron rejects fractional CDP mouse positions. Playwright recordings draw no pointer, and libraries such as `ghost-cursor-playwright` neither render one nor work against Electron. Inject a small DOM pointer overlay into the workbench that follows the mouse events, move it along eased paths of several steps at human speed, and probe one visible move before the take. This overlay is the minimal project-local glue the walkthrough needs.
  - **Pace:** never show code scrolling for more than two or three seconds; slow, mechanical scrolling is not watchable. For short distances, scroll briskly with a human wheel rhythm. For long distances, move the pointer to the scrollbar or minimap and click or drag to jump near the target, or click the symbol in the Outline view or breadcrumbs, then finish with a short scroll. Keep silent navigation under about 1.5 seconds; narrate the move itself when it takes longer.
  - **Editor actions:** use the `demotime-code-demo` skill from [Demo Time](https://github.com/estruyf/vscode-demo-time) (Apache-2.0) for what clicks cannot express well, such as patching a file from base to head or a precise highlight, and its `executeVSCodeCommand` action for commands such as `revealInExplorer` or `editor.action.revealDefinition`. Read-only acts that only navigate and highlight are valid.
  - **Recording:** by default record the Playwright-driven window and log events against the driver clock. Demo Time's `npx @demotime/video export` hides the workbench chrome and draws no pointer, so it does not suit walkthroughs; use it only for editor-only clips that intentionally omit the Explorer, passing settings as a file path, setting the capture size, muxing narration afterward because the export is silent and deleting the temporary workspace copy it keeps.
- **Window presentation:** follow the director's selected film style and the user's brand or platform. When none specifies framing, use rounded corners, traffic-light controls, a soft drop shadow and a subtle backdrop. Hide unwanted native chrome before capture where possible and keep the evidence at its native size.
- **Terminals:** follow the selected film style, with a legible monospaced font such as JetBrains Mono, SF Mono or Cascadia Code at presentation size, and output that starts at the top and grows downward. Type commands at a human pace and reveal output as it arrives. Cut long output with a skipped-time badge rather than letting it scroll. Composed terminal output illustrates behavior and does not replace required recorded execution.
- **VS Code stills and Web workbench states:** invoke the `vscode-playwright` skill from [microsoft/hve-core](https://github.com/microsoft/hve-core) (MIT). It drives VS Code Web through `serve-web` with Playwright, applies theme, zoom and layout, and verifies readable editor text.
- **Produced documents:** convert office files to PDF with LibreOffice headless, or with Word where it is installed for the closest Word layout. Then render the PDF pages to images with Poppler `pdftoppm`, or display them in the browser with pdf.js. Show the real pages as held frames or composed overlays.

## Capture real events

Keep automation infrastructure in the background. Do not open dashboards, inspectors, reports or browser windows for the user unless an unavoidable login or other critical user action requires it. First check whether an authorized authentication context can be reused. If human action is necessary, verify that the presented surface actually supports interaction and connects to the capture session. A dashboard or read-only preview is not a sign-in surface.

Check privacy, the intended viewport and recording readiness before executing the workflow. Record the first authorized run with event timestamps so it serves as both rehearsal and a candidate take. Inspect an early native-resolution segment as soon as the recorder supports it. Keep footage that satisfies the approved evidence, framing and timing requirements rather than repeating a successful run solely for capture.

Use separate rehearsal only when a specific action is irreversible, changes state that is difficult to restore, or needs practice before a one-shot capture. Rehearse that action using a safe substitute or resettable state, then record the actual required evidence. Record the reason in the existing production notes.

Drive the flow with the capture specialist, supplying the app's address and any authentication it needs. Preserve originals in a new take directory. Stop and retain failure evidence when a required action fails. Retake only affected sections when their starting state and continuity can be reproduced faithfully, otherwise repeat the dependent sequence. When narration presents a produced file the capture does not show, render its actual pages as described above and show them, narrating only what is visible.

Record named events against a monotonic clock with a documented recording origin. Log each event when its narrated condition first becomes visible, not after an arbitrary settling delay. Mark long waits with start/end times. Number repeated names across the whole take: `complete`, `complete#2`, `complete#3`, including across scenes. Record explicitly skipped optional actions by the exact narrated event name. A missing required event always fails. For an explicitly skipped optional event, warn, list the omitted cue in the timing report and fail if the approved delivery requires every cue.

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

Choose captions and mastering for the delivery using existing tools. Reverify after muxing, joining or mastering. Listen through the final video with the visuals for pronunciation, pacing, joins, omissions and story/evidence fit. Flag silent frozen spans longer than about six seconds for editorial review, preserving deliberate reading or inspection time rather than cutting automatically. Screenshots and timing checks are not human acceptance.

Reuse audio whose text and voice settings are unchanged. Re-render from original captures after timing or visual changes. Reverify the exact final file.
