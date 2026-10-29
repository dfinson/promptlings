---
name: cue-synced-demo
description: 'Record real browser events and assemble approved per-line narration with pre-event holds, disclosed wait cuts and final audio checks.'
---

# Cue-Synced Demo

Use approved story/evidence from the director and narration from `reasoning-first-narration`; synthetic speech setup belongs to `tts-setup`. Rehearse the real workflow, protect privacy and inspect a short native-viewport capture. Use existing specialists for other capture surfaces or motion design.

Import `scripts/record.mjs` into a project-local Playwright flow. Supply your own browser configuration, app/auth and selectors. Required failures stop and preserve evidence; only explicitly optional actions may be skipped. Name an `optional(name, action)` after its narrated event: if that event is missing and the action was recorded as skipped, the assembler warns and lists the omitted cue in `timing.json`; `--strict` fails instead. Other missing events always fail. Never overwrite a take.

```javascript
import { chromium } from "playwright";
import { record } from "<skill>/scripts/record.mjs";
await record({ chromium, directory: "take-001", viewport: { width: 1280, height: 720 },
  launchOptions: {}, contextOptions: {}, cursor: true,
  flow: async ({ page, ev, waitSpan, optional }) => {
    await page.goto("http://localhost:3000");
    ev("scene:result");
    await waitSpan("run", () => page.getByText("Complete", { exact: true }).waitFor());
    ev("complete"); // Repeated names become complete#2, complete#3.
  } });
```

Write Markdown `## result`, then `@scene The result is ready.` and `@complete Here is the output.`; plain lines continue the preceding cue. Keep per-line audio in an index compatible with the original `script.json`:

Event suffixes run across the whole take, not per scene: the second `ev("complete")` is written `@complete#2`, even in another scene. To omit that cue after an optional failure, name the action `optional("complete#2", ...)`, not `optional("complete", ...)`.

```json
[{"scene":"result","voice":"chosen-voice","model":"chosen-model","settings":{},"cues":[{"event":"scene","text":"The result is ready.","file":"result.1.wav"},{"event":"complete","text":"Here is the output.","file":"result.2.wav"}]}]
```

Reuse only unchanged text/voice/model/settings. The assembler checks text and requested voice, optionally model/settings, and measures clip onset/end rather than trusting cached duration.

```text
python <skill>/scripts/assemble.py take-001 script.md audio/script.json render-001 --voice chosen-voice --dry
python <skill>/scripts/assemble.py take-001 script.md audio/script.json render-002 --voice chosen-voice --offset 0.04 --fps 30
python <skill>/scripts/assemble.py --verify-joined final.mp4 join-timeline.json joined-check-001
```

Joined timeline schema: `{"parts":[{"report":"render-002/timing.json","offset":0.0},{"report":"part2/timing.json","offset":12.5}]}`. Paths resolve from that JSON; offsets are actual starts in the joining timeline, including crossfade overlap, not accumulated source durations. This verifies a joined file; it does not create one.

All required narrated events must exist in order. Aim for 0.2s voice lead, drift in `[0, 0.3)`, deliberate gaps and no overlapping clips. Hold the frame before the next event instead of stretching speech. Wait compression keeps required cues and carries an on-screen skipped-time badge (`--font font.ttf` overrides the system font). Preserve native dimensions, padding an odd width/height by one pixel for compatible `yuv420p`; output fps may resample variable-frame capture, not prove its original cadence.

Each new output directory preserves originals and contains timing, final encoded-audio onset checks with final path/hash, event frames and a scene-start contact sheet. The visual event clock remains a recording assumption: inspect raw/final event frames, apply an observed offset if needed, and never claim RGB-level visual proof from audio checks. Energy checks assume isolated narration above -40 dBFS, not music or ASR.

Choose captions/mastering for the delivery using existing tools. Reverify after muxing, joining or mastering. Listen through the final video for pronunciation, pacing, joins, omissions and story/evidence fit; screenshots and timing checks are not human acceptance. On duration, capture or timing changes, reschedule and render from original assets, never splice a stale export as the new master.
