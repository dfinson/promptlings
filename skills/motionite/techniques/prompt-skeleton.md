# Prompt skeleton (writing a motion brief that works)

Use this skeleton when you brief yourself, another agent, or a human.

```text
<inputs>
  Real assets only: logo files, screenshots, footage, brand hex, fonts, VO script, music (BPM).
  List what is missing. Never invent a real product's UI.
</inputs>
<direction>
  NxrStyle: NN <name> (one only). A 2–3 item mood board and what to take from each.
  Feel in 3 adjectives. Aspect + duration + fps.
</direction>
<structure>
  Beat table: time/frames → what is on screen → what moves → text → technique ID.
  Cuts on the bar (2 f early). One idea per beat. Frame 0 = poster.
</structure>
<build>
  Remotion; render(frame) pure; seeded rand; springs closed-form;
  log-space scale; sum-of-springs for retargets; tokens from lib/anim.ts.
</build>
<gotchas>
  No opacity/filter on preserve-3d; no will-change on scaled text; tabular-nums on counters;
  text inside morphing containers timed separately; floods overscale past corners;
  no backdrop-filter in headless; quote font names with digits.
</gotchas>
<start>
  First: render stills of every beat at f(beat)+N and a contact sheet; wait for approval.
</start>
```

## What a good brief does
- **Skeleton:** `<inputs>` (assets, never invented) → `<direction>` (feel and mood board) → `<structure>` (beats with timestamps) → `<build>` (stack, seek(t), springs) → `<gotchas>` → `<start>` (what to do first).
- **Build rules worth stating every time:**
  - `seek(t)` is pure.
  - Closed-form springs.
  - Drags are direct manipulation, then spring back.
  - Two-edge indicators.
  - Floods overscale past the corners.
  - Text inside morphing containers is timed separately.
  - Loops: last = first.
  - SFX are placed at the measured peak, and loudness normalised to −14 LUFS.
  - Check one still per beat.
  - Scan for single-frame pops (frame-diff spikes 3× their neighbours).
  - No opacity/filter on `preserve-3d`.
  - No `will-change` on camera-scaled text (it rasterises blurry).
- **Timing specifics:**
  - Keyframe tables `kf(frame,[[f,v],…])` with no `Math.floor` on motion.
  - Blur 24→1.5→0 over 6f.
  - Cuts land 2f before the beat.
- **Continuity:**
  - One object (dot or ball) connects every scene.
  - One world camera.
  - The chart comes from the motion function.
- **Zoom worlds:**
  - Camera = focus + log scale.
  - Corners go to 0 at full-bleed.
  - 12f loop dissolve.
- **Paper explainer:** Caveat notes, Anton, hard light/dark switches, a new idea every 1.5–2s.
- **The prompt is not the differentiator.** The same one-line prompt gives wildly different films. Iteration with stills, and the taste in the critique loop, are what matter.
