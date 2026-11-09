# Camera

Demo comps: [`examples/src/tech/camera.tsx`](../examples/src/tech/camera.tsx). Each one is 960×540 @ 30 fps, 75 f, and also registered as its own composition, so you can render one with `npx remotion still src/index.ts <CompId> out.png --frame=50` from `examples/`.

Timings marked **@60** are 60 fps frame counts. Halve them for 30 fps (`f60(n)` in `lib/anim.ts`).

## C01 · Continuous pan + time of day

- **Comp:** `C01-ContinuousPan` (`examples/src/tech/camera.tsx` → `ContinuousPan`)
- **Used in:** [NxrStyle 05](../styles/NxrStyle-05-one-pan-flat-world.md)
- **Build:**
  - One long world strip translated by `-t·1920` (E.dolly).
  - The skyline layer runs at 0.3× for parallax.
  - Sky colour is a function of camera x (3 keyed gradients).
  - Door glow switches on past 60%.
  - The walking character is fixed on screen with a bob, `|sin(f·.5)|·6`.
  - The tally ticks with x, so scenes are places along one pan.

## C02 · Parallax truck

- **Comp:** `C02-ParallaxTruck` (`examples/src/tech/camera.tsx` → `ParallaxTruck`)
- **Used in:** [NxrStyle 05](../styles/NxrStyle-05-one-pan-flat-world.md), [NxrStyle 10](../styles/NxrStyle-10-pixel-bar-grid-trailer.md), [NxrStyle 14](../styles/NxrStyle-14-paper-stop-motion.md)
- **Build:** Three planes with factors .3/1/1.6. The far plane gets 2px blur and the near plane 4px (DOF).
- **DOF formula:** blur radius = 75×(focus−depth)/depth in front of the focus plane and 6×… behind it, capped at 120.

## C03 · Impact kick + flash

- **Comp:** `C03-ImpactKick` (`examples/src/tech/camera.tsx` → `ImpactKick`)
- **Used in:** [NxrStyle 01](../styles/NxrStyle-01-beat-reel.md), [NxrStyle 02](../styles/NxrStyle-02-night-caption-explainer.md), [NxrStyle 08](../styles/NxrStyle-08-duotone-storybook.md), [NxrStyle 10](../styles/NxrStyle-10-pixel-bar-grid-trailer.md)
- **Build:** Shake = sum of `hitPulse(f−h,1,4)` over hits × 8px × a seeded direction per frame. Each word slams 1.6→1 with blur. A white flash runs 2f at 85%.

## C04 · Log-zoom world camera

- **Comp:** `C04-LogZoomWorld` (`examples/src/tech/camera.tsx` → `LogZoomWorld`)
- **Used in:** [NxrStyle 07](../styles/NxrStyle-07-frost-collectible.md), [NxrStyle 11](../styles/NxrStyle-11-one-take-portal-zoom.md), [NxrStyle 12](../styles/NxrStyle-12-console-as-film.md), [NxrStyle 13](../styles/NxrStyle-13-clean-launch-film.md)
- **Build:** World transform = `translate(W/2,H/2) scale(s) translate(-camX,-camY)`, with `s=lmix(1,14,p)`. The camera point is mixed to the target tile, and the tile is exactly W/14 × H/14, so at s=14 it is the frame.

## C05 · Push-in to a door

- **Comp:** `C05-PushInDoor` (`examples/src/tech/camera.tsx` → `PushInDoor`)
- **Used in:** [NxrStyle 07](../styles/NxrStyle-07-frost-collectible.md), [NxrStyle 08](../styles/NxrStyle-08-duotone-storybook.md)
- **Build:** Log push 1→2.6 (E.cam), origin at the door. The door rotates Y with perspective. The eyes fade in, then blink (2f off). The title exits before the push peaks.

