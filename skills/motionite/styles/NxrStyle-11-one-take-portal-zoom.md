# NxrStyle 11 · One-Take Portal Zoom

> One unbroken log-space zoom through nested worlds. Every scene has a portal at its centre, the next scene lives inside that portal, there are no cuts, and the last scene contains the first.

![NxrStyle 11 still](../examples/stills/NxrStyle-11-one-take-portal-zoom.png)

Example comp: [`examples/src/styles/S11PortalZoom.tsx`](../examples/src/styles/S11PortalZoom.tsx) · id `NxrStyle11-PortalZoom` · 1920×1080 · 30 fps · 150 f (seamless loop)

## Visual DNA
| Axis | Spec |
|---|---|
| Palette | Each level owns its palette, so the zoom reads as travel: city night (`#0f1630` with warm windows `#ffcf6b`) → room (warm `#2a2238` with a monitor) → subpixels (pure R/G/B on black) → back to the city. |
| Type | Minimal. A tiny HUD in Geist Mono ("ONE TAKE · NO CUTS", "CITY / ROOM / PIXEL · ×s"). The worlds carry the story. |
| Layout | The portal is a centred rect exactly `W/Z × H/Z` (here 240×135 for Z = 8), so at scale Z it becomes the frame. |
| Motion | `scale = Z^u` with `u = (f mod PER) / PER`: a constant ratio per frame, so the zoom feels constant-speed. The portal level is rendered inside its parent at `1/Z`. Three nested clip levels are enough. |
| Transitions | **None.** The zoom is the transition. When one level fills the frame, swap the stack (`level = floor(f / PER)`). |
| Timing | One world per `PER` = 50 f (1.67 s). A 150 f loop: f150 equals f0. |
| Audio | A continuous riser that resets on every level (Shepard-tone feel), and a soft "pass-through" whoosh at each portal. |

## Techniques
C04 Log-zoom world camera · X02 Iris (if a portal is round) · R06 Zoom smear wordmark (for an end card) · H04 Mosaic resolve (pixel level).

## Do / Don't
- **Do** design every level with a portal at the exact centre at the exact size `W/Z × H/Z`.
- **Do** keep detail inside the portal while it is small. That is what sells the travel.
- **Do** loop: the last level must render the first level's content.
- **Don't** zoom linearly. `interpolate(f, …, [1, 8])` slows down visually as it goes, so always use `lmix` or `Z^u`.
- **Don't** add text that has to be read during the zoom. Put it in the HUD.
- **Don't** add a crossfade at level swaps. If it pops, your portal rect is off.

## Example brief
"A 5-second looping hook: from a city window into a monitor, into its pixels, and back into the city."

| Frames | Beat |
|---|---|
| 0 | The city at night, already zooming, with the lit window at the centre as the portal. |
| 0–50 | Zoom ×8 into the window, which becomes a room with a monitor. |
| 50–100 | Zoom ×8 into the monitor, which becomes RGB subpixels. |
| 100–150 | Zoom ×8 into one subpixel, which holds the city again, so f150 equals f0. |

## Remotion starter
```tsx
import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';

const W = 1920, H = 1080, Z = 8, PER = 50;
const LEVELS = ['#0f1630', '#2a2238', '#111']; // city, room, pixels; level 3 = level 0 again

const Level: React.FC<{k: number; depth: number}> = ({k, depth}) => (
  <AbsoluteFill style={{background: LEVELS[k % LEVELS.length]}}>
    {/* ...the level's art goes here; its portal is the centred W/Z x H/Z rect... */}
    {depth > 0 && (
      <div style={{position: 'absolute', left: (W - W / Z) / 2, top: (H - H / Z) / 2, width: W / Z, height: H / Z, overflow: 'hidden'}}>
        <div style={{width: W, height: H, transform: `scale(${1 / Z})`, transformOrigin: '0 0'}}>
          <Level k={k + 1} depth={depth - 1} />
        </div>
      </div>
    )}
  </AbsoluteFill>
);

export const PortalZoomStarter: React.FC = () => {
  const f = useCurrentFrame();
  const k = Math.floor(f / PER);
  const u = (f % PER) / PER;
  const s = Math.pow(Z, u); // log-space: constant perceived speed
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `scale(${s})`, transformOrigin: '50% 50%'}}>
        <Level k={k} depth={2} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```
