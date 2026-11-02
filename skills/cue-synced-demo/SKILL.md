---
name: cue-synced-demo
description: 'Record real browser or editor events and assemble approved per-line narration with pre-event holds, disclosed wait cuts and final audio checks.'
---

# Cue-Synced Demo

Use approved story and evidence from the director and narration from `reasoning-first-narration`. Synthetic speech setup and listening-based voice acceptance belong to `tts-setup`. This skill owns event-bound footage and narration timing, not explainer art direction or composition tooling. The director selects that route.

This skill supplies practice, not a recorder, assembler or required programming language. Build on established capture specialists rather than hand-rolling a browser driver, recorder or document renderer. Write glue code only for a step the specialists cannot express, and never in this skill or the promptlings repository.

## Use established capture specialists

The Promptlings installer's demo toolchain provides these specialists, so use them without asking. If one is missing, tell the user to rerun the Promptlings installer with its demo toolchain. Do not install it during production or build a substitute.

- **Browser capture:** invoke the `playwright-cli` skill from [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli). It handles navigation and input, viewport size, named sessions, saved authentication state, screenshots, and video with chapter markers.
- **Code walkthroughs in VS Code:** record what a person giving the walkthrough would show, not a slide of zoomed code. Keep the full workbench at normal zoom with the Explorer, tabs and editor visible. A visible pointer travels at human speed to each thing before it is used: expand folders in the file tree, click the file, scroll through it to the region, hover or go to a definition, then select or highlight the discussed block in place. Narrate during the navigation so the movement carries the viewer from one place to the next. Never jump straight to a line, crop to a fragment or present code as a still.
  - **Pointer and real input:** drive desktop VS Code with Playwright's Electron support and real mouse and keyboard input on the workbench. Playwright recordings draw no pointer, so render one with [`ghost-cursor-playwright`](https://github.com/reaz1995/ghost-cursor-playwright) (MIT), which moves along human-like paths and shows its position as an overlay. Attach it as soon as the VS Code window opens. Install it and `playwright` as dependencies of the production workspace, not globally and not in this repository.
  - **Editor actions:** use the `demotime-code-demo` skill from [Demo Time](https://github.com/estruyf/vscode-demo-time) (Apache-2.0) for what clicks cannot express cleanly, such as patching a file from base to head or a precise highlight, and its `executeVSCodeCommand` action for commands such as `revealInExplorer` or `editor.action.revealDefinition`. Read-only acts that only navigate and highlight are valid.
  - **Recording:** Demo Time's `npx @demotime/video export` uses the same Electron route and writes an MP4 with `demo-events.jsonl` scene times, but it hides the workbench chrome and draws no pointer. Use it only when its settings show the Explorer and the pointer layer can attach; otherwise record the Playwright-driven window and log events yourself. Pass exporter settings as a file path, set the capture size to the delivery resolution, add narration afterward because the export is silent, trim VS Code startup frames, and delete the temporary workspace copy the exporter keeps, mapping its `actFile` paths back to the repository.
- **VS Code stills and Web workbench states:** invoke the `vscode-playwright` skill from [microsoft/hve-core](https://github.com/microsoft/hve-core) (MIT). It drives VS Code Web through `serve-web` with Playwright, applies theme, zoom and layout, and verifies readable editor text.
- **Produced documents:** convert office files to PDF with LibreOffice headless, or with Word where it is installed for the closest Word layout. Then render the PDF pages to images with Poppler `pdftoppm`, or display them in the browser with pdf.js. Show the real pages as held frames or composed overlays.

## Capture real events

Rehearse the actual workflow, protect privacy and inspect a short native-viewport capture before a full take. Drive the flow with the capture specialist, supplying the app's address and any authentication it needs. Preserve originals in a new take directory. Stop and retain failure evidence when a required action fails. When narration presents a produced file the capture does not show, render its actual pages as described above and show them, narrating only what is visible.

Record named events against a monotonic clock with a documented recording origin. Log each event when its narrated condition first becomes visible, not after an arbitrary settling delay. Mark long waits with start/end times. Number repeated names across the whole take: `complete`, `complete#2`, `complete#3`, including across scenes. Record explicitly skipped optional actions by the exact narrated event name. A missing required event always fails. For an explicitly skipped optional event, warn, list the omitted cue in the timing report and fail if the approved delivery requires every cue.

Inspect raw event frames to establish the event-to-video clock. Apply an observed offset when necessary. Do not assume page creation, recorder startup and encoded frame zero coincide. For a Demo Time export, the `start` event in `demo-events.jsonl` is the origin and each `sceneStart` is a scene event; map them to the narrated event names. Verify cuts with frames extracted at exact timestamps or with scene detection, because a contact-sheet still can land on a transitional frame. Audio checks alone do not prove visual alignment.

## Bind narration to events

Keep the approved Markdown narration as the source, with scene headings and inline event bindings:

```text
## result
@complete The result is ready.
This line continues the same cue.
@complete#2 Here is the result after the revision.
```

Associate each cue with its audio file, exact text and selected voice, model and settings using the project's existing notes or a small index. Reuse only unchanged text and speech settings. Reject mismatched text or voice before rendering. Measure actual clip onset and end rather than trusting cached duration.

Bind each cue to the moment its subject becomes visible, not to the start of its scene. In an editor, that is when the file has rendered, scrolled into place and the discussed lines are highlighted.

## Schedule and assemble

Produce a timing-only report before encoding. Required narrated events must exist in order. Target speech onset 0.2 seconds after its visible event, allowing the clip's own initial silence only while total drift stays in `[0, 0.3)` seconds. Leave at least 0.25 seconds between spoken lines and reject overlapping audio. If narration would overrun the next event, freeze the frame immediately before that event. Never stretch speech to fit.

Compress long waits only outside required cues, retaining enough context on either side and showing a skipped-time badge. Preserve native dimensions without upscaling. For compatible H.264 output, pad odd dimensions to even values and use `yuv420p`. Resample variable-frame footage if needed rather than rejecting it for nonuniform timestamps.

## Verify the delivered file

Measure speech onset in the final encoded audio and compare it with each scheduled visible event. Search before the expected onset, back to just after the previous measured speech end, or at least one second before the first event. A search restricted to the expected cue window can falsely pass early audio. Reject negative drift, drift of 0.3 seconds or more, overlap, missing speech and out-of-order cues. Check isolated narration before adding music. Energy detection is not speech recognition or a listening judgment.

Carry cue times into the final composition timeline, updating them for cuts, holds and transitions. For joined parts, use their actual starts in the final timeline, including crossfade overlap, not accumulated source durations. Verify across joins in the joined encoded file. Keep the timing report, final path/hash, inspected event frames and a contact sheet with one frame per scene start.

Choose captions and mastering for the delivery using existing tools. Reverify after muxing, joining or mastering. Listen through the final video with the visuals for pronunciation, pacing, joins, omissions and story/evidence fit. Flag silent frozen spans longer than about six seconds for editorial review, preserving deliberate reading or inspection time rather than cutting automatically. Screenshots and timing checks are not human acceptance.

Reuse audio whose text and voice settings are unchanged. Re-render from original captures after timing or visual changes. Reverify the exact final file.
