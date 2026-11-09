# Hand-drawn, stop-motion, texture

Demo comps: [`examples/src/tech/drawn.tsx`](../examples/src/tech/drawn.tsx). Each one is 960×540 @ 30 fps, 75 f, and also registered as its own composition, so you can render one with `npx remotion still src/index.ts <CompId> out.png --frame=50` from `examples/`.

Timings marked **@60** are 60 fps frame counts. Halve them for 30 fps (`f60(n)` in `lib/anim.ts`).

## H01 · Self-draw line + boil on twos + marker note

- **Comp:** `H01-SelfDrawBoil` (`examples/src/tech/drawn.tsx` → `SelfDrawBoil`)
- **Used in:** [NxrStyle 15](../styles/NxrStyle-15-hand-drawn-ink.md)
- **Build:**
  - The drawing index is `d=onTwos(f)/2`. Every vertex jitters by `rand(`${d}:${i}`)`, so the line "boils" at 15 drawings/s.
  - The draw-on uses `pathLength=1` and dashoffset `1−p`, and *its progress also advances on twos*.
  - The marker note is Caveat stroked (dashoffset), then filled once 70% drawn.
- **Caveat:** in good hand-drawn films the **textures do not boil** (frame diff about 1/255). Only lines and characters boil. Keep paper and fills still.

## H02 · Paper cut-out stop-motion

- **Comp:** `H02-PaperStopMotion` (`examples/src/tech/drawn.tsx` → `PaperStopMotion`)
- **Used in:** [NxrStyle 14](../styles/NxrStyle-14-paper-stop-motion.md)
- **Build, ported 1:1 in spirit:**
  - **Exposure:** `e=floor(f·12/30)`, so puppets pose 12×/s (the original's EXPO=5 @60) while the **camera moves every frame**. This mix gives the "real stop-motion shot on a moving rig" feel.
  - **Camera:** `cam(st)` pull-out `u=1−(1−st/2.5)^2.1`, z 1.52→1.1. Planes use `setCam(c,cam,p)` with p=.3/.6/1.
  - **Cut-paper edges:** `cutPath` with noise-nudged edges, amp 1.2 and step 16.
  - **Paper and boil:** `sprite()` gives a contact shadow (offset 6,9, blur 11, alpha .3). Boil is ±1.1px and ±.003 rad per exposure.
  - **Beat:** a squash of sy .88 for 0.1s on each beat (96 BPM = 0.625s).
  - **Steam:** a verlet rope (8 iterations, damping .985), re-simulated from frame 0 so it stays deterministic.
  - **Post:** grain re-offset per exposure, flicker `(hash(e)−.5)·.05`, a warm vignette.
- **Not ported:** the original's Karplus–Strong plucked-string audio, where each melody note triggers a visual event. Its score is 4 shots × 1 bar at 96 BPM. The example comp is silent.

## H03 · Riso halftone with misregistration

- **Comp:** `H03-RisoHalftone` (`examples/src/tech/drawn.tsx` → `RisoHalftone`)
- **Used in:** [NxrStyle 08](../styles/NxrStyle-08-duotone-storybook.md), [NxrStyle 14](../styles/NxrStyle-14-paper-stop-motion.md), [NxrStyle 15](../styles/NxrStyle-15-hand-drawn-ink.md)
- **Build:**
  - Three plates (pink 15°, blue 75°, yellow 0°) drawn with `multiply`.
  - Each plate is a rotated dot grid. Its dot radius is `step/2·√tone`, with tone sampled in screen space.
  - Each montage card (every 7.5f) re-seeds a ±3px misregistration per plate.

## H04 · Mosaic resolve

- **Comp:** `H04-MosaicResolve` (`examples/src/tech/drawn.tsx` → `MosaicResolve`)
- **Used in:** [NxrStyle 06](../styles/NxrStyle-06-press-start-menu.md), [NxrStyle 10](../styles/NxrStyle-10-pixel-bar-grid-trailer.md), [NxrStyle 11](../styles/NxrStyle-11-one-take-portal-zoom.md)
- **Build:** Draw the scene to an offscreen canvas, downsample to W/s, then upscale with `imageSmoothingEnabled=false`.

## H05 · Dot-grid wave reacting to a hero dot

- **Comp:** `H05-DotGridWave` (`examples/src/tech/drawn.tsx` → `DotGridWave`)
- **Used in:** [NxrStyle 01](../styles/NxrStyle-01-beat-reel.md), [NxrStyle 09](../styles/NxrStyle-09-live-bento-grid.md)
- **Build:** Dot radius = `1.5+8·(sin(d/28−f/3)·.5+.5)·exp(−d/260)`, where d is the distance to the moving hero.

## H06 · Cadence comparison

- **Comp:** `H06-CadenceCompare` (`examples/src/tech/drawn.tsx` → `CadenceCompare`)
- **Used in:** [NxrStyle 06](../styles/NxrStyle-06-press-start-menu.md), [NxrStyle 14](../styles/NxrStyle-14-paper-stop-motion.md), [NxrStyle 15](../styles/NxrStyle-15-hand-drawn-ink.md)
- **Build:** The same eased move sampled on ones, twos and 12/s. Use it to decide per layer: UI on ones, characters on twos, puppets on 12s.

## H07 · Particle burst

- **Comp:** `H07-ParticleBurst` (`examples/src/tech/drawn.tsx` → `ParticleBurst`)
- **Used in:** [NxrStyle 09](../styles/NxrStyle-09-live-bento-grid.md)
- **Build:** 260 seeded particles with closed-form drag, `s=(v/k)(1−e^{−kt})`, plus gravity `60t²`, and a seeded lifetime per particle. The card squashes, then vanishes in 4f.
- **Note:** particles are banned by default. This is the deliberate rule-break, and it earns its place only as a single payoff.

## H08 · Point sphere → wire cube

- **Comp:** `H08-PointSphereCube` (`examples/src/tech/drawn.tsx` → `PointSphereCube`)
- **Used in:** [NxrStyle 01](../styles/NxrStyle-01-beat-reel.md)
- **Build:** A Fibonacci sphere (500 pts, golden angle 2.39996) morphs to the cube surface: each point is divided by its max-abs component, mixed by p. The rotation matrices and perspective `k=700/(700+z)` are hand-rolled, and depth drives alpha. Edges draw once m > 0.9: vertex pairs whose index XOR is 1, 2 or 4.


