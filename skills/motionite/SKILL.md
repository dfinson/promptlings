---
name: motionite
description: Make high-quality motion-graphics videos (launch films, explainers, social reels, game trailers, loops, stings) with Remotion. Use it when asked to create, animate, storyboard, or render a motion video, kinetic type, a product promo, or an animated social post, or to pick a visual style for one. It includes 15 house styles (NxrStyle 01–15), 70 ID'd techniques with exact timings, universal motion laws, and a QA process (ffprobe, −14 LUFS, contact sheets, determinism). By NxrLabs.
---

# Motionite: motion design for agents

Motionite turns a brief into a finished, deterministic Remotion film that looks designed, not generated. It has three parts:

| Part | Where | Use it to… |
|---|---|---|
| **15 NxrStyles** | [`styles/`](styles/) · [comparison + picker](styles/COMPARISON.md) | Choose one complete visual system per film |
| **70 techniques** | [`techniques/`](techniques/README.md) | Build each move with proven numbers (IDs T, N, X, C, U, H, R) |
| **Working code** | [`examples/`](examples/) | Copy `lib/anim.ts` tokens, the demo comps and the style comps |

> The prompt is not the differentiator. The same one-line showreel prompt can give wildly different films. What makes the difference is iteration on **stills** and **taste** in the critique loop. This skill is that loop.

## Workflow (follow in order)

### 1 · Brief → facts vs choices
Write down:
- **Facts:** real assets you have (logo files, screenshots, footage, brand hex, fonts, VO, music + BPM), the claims, the aspect ratio, the duration and the platform.
- **Choices:** everything else. If a real product's UI or logo is missing, **ask or leave a labelled placeholder**. Never invent it.
- **One sentence** the viewer must remember. A film has one idea per beat and one message overall.

### 2 · Mood board
Collect 2–3 mood-board films and write what to take from each, in numbers: cut rhythm (seconds per shot), palette hex, type family, signature move. You can find the IDs in [`techniques/README.md`](techniques/README.md). If you can, make a contact sheet of each one (`ffmpeg -vf fps=2,scale=480:-1,tile=6x5`) and read it.

### 3 · Pick ONE NxrStyle
Use the decision table in [`styles/COMPARISON.md`](styles/COMPARISON.md#which-style-for-which-brief), then open that style's file and follow its Visual DNA (palette, type, layout, motion, transitions, timing, audio) and its Do/Don't.
- A supplied brand guide overrides the style's palette and font, and any bans.
- You may borrow **one** technique from another style. Never borrow a whole palette or type system.

| # | Style | Feel | # | Style | Feel |
|---|---|---|---|---|---|
| 01 | [Beat Reel](styles/NxrStyle-01-beat-reel.md) | loud, bar-cut colour fields | 09 | [Live Bento Grid](styles/NxrStyle-09-live-bento-grid.md) | 1:1 looping poster of live tiles |
| 02 | [Night Caption Explainer](styles/NxrStyle-02-night-caption-explainer.md) | 9:16 VO captions, big number | 10 | [Pixel Bar-Grid Trailer](styles/NxrStyle-10-pixel-bar-grid-trailer.md) | pixel game trailer, dither cuts |
| 03 | [Floating Product UI](styles/NxrStyle-03-floating-product-ui.md) | 3D phone, giant number, chips | 11 | [One-Take Portal Zoom](styles/NxrStyle-11-one-take-portal-zoom.md) | one log-zoom through worlds |
| 04 | [Editorial Ink](styles/NxrStyle-04-editorial-ink.md) | paper, serif, highlighter | 12 | [Console-as-Film](styles/NxrStyle-12-console-as-film.md) | the object is the world |
| 05 | [One-Pan Flat World](styles/NxrStyle-05-one-pan-flat-world.md) | one camera truck, sky by x | 13 | [Clean Launch Film](styles/NxrStyle-13-clean-launch-film.md) | restrained, one accent |
| 06 | [PRESS START Menu](styles/NxrStyle-06-press-start-menu.md) | retro 8-bit menu | 14 | [Paper Stop-Motion](styles/NxrStyle-14-paper-stop-motion.md) | cut paper on 12s, riso |
| 07 | [Frost Collectible](styles/NxrStyle-07-frost-collectible.md) | icy, orbit, mint counter | 15 | [Hand-Drawn Ink](styles/NxrStyle-15-hand-drawn-ink.md) | self-drawing boil, ink blot |
| 08 | [Duotone Storybook](styles/NxrStyle-08-duotone-storybook.md) | engraved navy + one warm | | | |

### 4 · Shot list in frames
Write a table before you code:

| Shot | Frames | On screen at the first frame | What moves (frame-exact) | Text | Technique IDs | Audio cue |
|---|---|---|---|---|---|---|

Rules:
- Pick the fps (30 for most work, 60 for UI-smooth films), then set a beat grid: `BEAT = fps·60/BPM`. Shots last whole bars, and cuts land **2 f before** the beat.
- **Frame 0 is the poster**, so it must already be composed.
- One idea per shot, with ≥ 0.8 s of legible hold for any line.
- Never put two transition devices back to back. A look change lands on a hard cut and lasts ≥ 1 s.

### 5 · Build in Remotion
Start from [`examples/`](examples/). Copy `src/lib/anim.ts` (easings `E`, springs `SPR`, `prog`, `spr`, `lmix`, `track`, `hitPulse`, `blurIn/blurOut`, `rand`, `onTwos`), plus `src/styles/kit.tsx` and the comp of your chosen style.

Build rules:
- `render(frame)` is **pure**: no `Math.random`, `Date.now`, timers, CSS transitions/animations, or state across frames. Seeded `rand(key)` only. Re-simulate any physics from frame 0 at a fixed step.
- Enter with `E.out` and exit with `E.in`. The secondary move starts at 55–75 % of the primary.
- Scale moves in log space (`lmix`). A value that retargets is a **sum of springs** (`track`).
- Speed limit: ≤ 25 px/frame @60 unless smeared or blurred.
- Overshoot ≤ 2 per film and never on type. Flash ≤ 2 per film, capped at 65–85 % (never a blank full frame).
- Text **blurs in** (12–20 px → 0, sharp at 60 % of the move). Don't use plain opacity fades.
- `fontVariantNumeric: 'tabular-nums'` on every counter. Quote font names that contain digits: `'"Press Start 2P"'`.
- Never put opacity or filter on a `preserve-3d` element, never put `will-change` on camera-scaled text, and never use `backdrop-filter` in headless renders.
- Layer cadence: UI on ones, drawn characters on twos, paper puppets on 12s. Textures never boil.
- Loops: the last frame equals the first.

### 6 · Stills for approval (before any full render)
Render one still per beat, plus 3 frames around every transition:
```bash
npx remotion still src/index.ts <CompId> out/s_<f>.png --frame=<f> --scale=0.5
```
Put them in a contact sheet and **look at them**. Fix composition, legibility and palette at this stage, because a still costs seconds and a render costs minutes. If there is a human in the loop, get approval on the stills.

### 7 · Render
```bash
npx remotion render src/index.ts <CompId> out/raw.mp4 --codec=h264 --crf=18 --pixel-format=yuv420p
ffmpeg -i out/raw.mp4 -c:v copy -af loudnorm=I=-14:TP=-1:LRA=11 -c:a aac -b:a 192k -movflags +faststart out/film.mp4
```

### 8 · QA ([full commands](techniques/qa.md))
1. `ffprobe`: codec, size, fps, and video duration = audio duration (±1 f).
2. Loudness: −14 LUFS integrated (±1), ≤ −1 dBTP.
3. Contact sheet **from the final MP4** (not from stills): 2 fps, 6×5 tiles.
4. Determinism: render a frame twice and pixel-diff it (it must be identical).
5. Frame-diff curve: no single-frame spikes more than 3× their neighbours.
6. Brand hex sampled from a still, and audio onsets within ±1 f of their visual hits.

### 9 · Self-critique (3 rounds)
Score the contact sheet against the six tests in [qa.md](techniques/qa.md#self-critique-three-rounds-written-down): poster, read, beat, budget, style and brand. Fix the worst three issues, re-render, and repeat up to three times. Report what you changed each round.

## Universal taste rules (short form)
1. Frame 0 is a poster, and every paused frame is composed.
2. Blur-in text. No plain fades. Exits accelerate.
3. One accent colour, and it means something.
4. Zoom and scale in log space, and keep camera moves continuous rather than stepped (except in pixel styles).
5. Cut on the bar, one idea per bar, with readable holds.
6. Flash cap 65–85 %, at most twice. Overshoot at most twice, never on type.
7. Transitions are designed devices (iris, smear, blot, scale-through, polarity flip), never a cross-dissolve.
8. Real assets over drawn ones. Never fake a real product's UI.
9. Determinism is a feature: the same frame always renders the same pixels.
10. The aesthetic bans (serif, cream, glow, glass, emoji, particles) are **defaults for generic product films**. A brand or its mood board can override them. The *physics* laws are not optional.

Full laws: [`techniques/laws.md`](techniques/laws.md). Brief template: [`techniques/prompt-skeleton.md`](techniques/prompt-skeleton.md).

## Output contract
When you deliver a film, report:
- the style used
- the shot list (frames + technique IDs)
- the path to the MP4 and the contact sheet
- the ffprobe line, the LUFS reading and the determinism result
- what changed in each critique round
- any placeholder or invented asset
