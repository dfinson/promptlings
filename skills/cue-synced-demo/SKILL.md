---
name: cue-synced-demo
description: 'Record real browser events and assemble approved per-line narration with pre-event holds, disclosed wait cuts and final audio checks.'
---

# Cue-Synced Demo

Use approved story and evidence from the director and narration from `reasoning-first-narration`. Synthetic speech setup and listening-based voice acceptance belong to `tts-setup`. This skill owns event-bound footage and narration timing, not explainer art direction or composition tooling. The director selects that route.

This skill supplies practice, not a recorder, assembler or required programming language. Build on established capture specialists rather than hand-rolling a browser driver, recorder or document renderer. Write glue code only for a step the specialists cannot express, and never in this skill or the promptlings repository.

## Use established capture specialists

Check whether the session already has these skills before offering installs.
- **Browser capture:** invoke the `playwright-cli` skill from [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli). It handles navigation and input, viewport size, named sessions, saved authentication state, screenshots, and video with chapter markers. If it is missing, give the user `npm install -g @playwright/cli@latest` followed by `playwright-cli install --skills`, and install it only after the user approves.
- **Code walkthroughs in VS Code:** script the walkthrough with the `demotime-code-demo` skill from [Demo Time](https://github.com/estruyf/vscode-demo-time) (Apache-2.0). It writes a reset-able act file that opens, types, patches and highlights code, including the base-to-head change of a diff or pull request. Record it unattended with `npx @demotime/video export`, which plays the act in a fresh VS Code profile and writes an MP4 with chapters and `demo-events.jsonl` scene start times. Size each scene's `autoAdvanceAfter` to its accepted narration and bind narration to the recorded scene starts. If the skill is missing, give the user `code --install-extension eliostruyf.vscode-demo-time`, then the **Demo Time: Install or update AI skills** command for Copilot CLI or Claude Code.
- **VS Code stills and Web workbench states:** invoke the `vscode-playwright` skill from [microsoft/hve-core](https://github.com/microsoft/hve-core) (MIT). It drives VS Code Web through `serve-web` with Playwright, applies theme, zoom and layout, and verifies readable editor text. If it is missing, give the user `copilot plugin marketplace add microsoft/hve-core` followed by `copilot plugin install hve-core@hve-core`.
- **Produced documents:** convert office files to PDF with LibreOffice headless, or with Word where it is installed for the closest Word layout. Then render the PDF pages to images with Poppler `pdftoppm`, or display them in the browser with pdf.js. Show the real pages as held frames or composed overlays.

Install any specialist only after the user approves. If a required specialist is unavailable and the user declines to install it, report the gap and propose options instead of building a substitute.

## Capture real events

Rehearse the actual workflow, protect privacy and inspect a short native-viewport capture before a full take. Drive the flow with the capture specialist, supplying the app's address and any authentication it needs. Preserve originals in a new take directory. Stop and retain failure evidence when a required action fails. When narration presents a produced file the capture does not show, render its actual pages as described above and show them, narrating only what is visible.

Record named events against a monotonic clock with a documented recording origin. Log each event when its narrated condition first becomes visible, not after an arbitrary settling delay. Mark long waits with start/end times. Number repeated names across the whole take: `complete`, `complete#2`, `complete#3`, including across scenes. Record explicitly skipped optional actions by the exact narrated event name. A missing required event always fails. For an explicitly skipped optional event, warn, list the omitted cue in the timing report and fail if the approved delivery requires every cue.

Inspect raw event frames to establish the event-to-video clock. Apply an observed offset when necessary. Do not assume page creation, recorder startup and encoded frame zero coincide. Audio checks alone do not prove visual alignment.

## Bind narration to events

Keep the approved Markdown narration as the source, with scene headings and inline event bindings:

```text
## result
@complete The result is ready.
This line continues the same cue.
@complete#2 Here is the result after the revision.
```

Associate each cue with its audio file, exact text and selected voice, model and settings using the project's existing notes or a small index. Reuse only unchanged text and speech settings. Reject mismatched text or voice before rendering. Measure actual clip onset and end rather than trusting cached duration.

## Schedule and assemble

Produce a timing-only report before encoding. Required narrated events must exist in order. Target speech onset 0.2 seconds after its visible event, allowing the clip's own initial silence only while total drift stays in `[0, 0.3)` seconds. Leave at least 0.25 seconds between spoken lines and reject overlapping audio. If narration would overrun the next event, freeze the frame immediately before that event. Never stretch speech to fit.

Compress long waits only outside required cues, retaining enough context on either side and showing a skipped-time badge. Preserve native dimensions without upscaling. For compatible H.264 output, pad odd dimensions to even values and use `yuv420p`. Resample variable-frame footage if needed rather than rejecting it for nonuniform timestamps.

## Verify the delivered file

Measure speech onset in the final encoded audio and compare it with each scheduled visible event. Search before the expected onset, back to just after the previous measured speech end, or at least one second before the first event. A search restricted to the expected cue window can falsely pass early audio. Reject negative drift, drift of 0.3 seconds or more, overlap, missing speech and out-of-order cues. Check isolated narration before adding music. Energy detection is not speech recognition or a listening judgment.

Carry cue times into the final composition timeline, updating them for cuts, holds and transitions. For joined parts, use their actual starts in the final timeline, including crossfade overlap, not accumulated source durations. Verify across joins in the joined encoded file. Keep the timing report, final path/hash, inspected event frames and a contact sheet with one frame per scene start.

Choose captions and mastering for the delivery using existing tools. Reverify after muxing, joining or mastering. Listen through the final video with the visuals for pronunciation, pacing, joins, omissions and story/evidence fit. Flag silent frozen spans longer than about six seconds for editorial review, preserving deliberate reading or inspection time rather than cutting automatically. Screenshots and timing checks are not human acceptance.

Reuse audio whose text and voice settings are unchanged. Re-render from original captures after timing or visual changes. Reverify the exact final file.
