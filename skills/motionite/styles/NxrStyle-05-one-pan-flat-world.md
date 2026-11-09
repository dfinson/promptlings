# NxrStyle 05 · One-Pan Flat World

> One continuous camera truck through a flat-vector street. The sky's time of day is tied to the camera's x position, and a tally and receipt cards ride on top.

![NxrStyle 05 still](../examples/stills/NxrStyle-05-one-pan-flat-world.png)

Example comp: [`examples/src/styles/S05WorldPan.tsx`](../examples/src/styles/S05WorldPan.tsx) · id `NxrStyle05-WorldPan` · 1920×1080 · 30 fps · 150 f

## Visual DNA
| Axis | Spec |
|---|---|
| Palette | flat vector: day sky `#8fd3ff` → golden `#ffb46b` → dusk `#6b4fa0` → night `#1d2350`. Shop fronts each get one saturated colour. Caption white with **cyan `#3ee6e0`** key words. |
| Type | Rounded sans (Plus Jakarta Sans 800) for the caption and tally pill. Shop signs in a condensed caps face (Bebas Neue). |
| Layout | Horizon at about 62 % of height. The walker is locked to the screen at x ≈ 40 %. The tally pill sits at the top centre, receipt cards at the top right, and the caption at the bottom centre. |
| Motion | The world strip translates `-t·worldW` with `E.dolly`. The skyline layer runs at 0.3× for parallax. The walker bobs `|sin(f·.5)|·6`. Door glow switches on past 60 %. |
| Transitions | **None.** Scenes are places along one pan. A dark overlay can dim the world for the payoff number. |
| Timing | A tally tick every 16–22 f, keyed to camera x (when a shop passes the walker), not to a timer. |
| Audio | Street ambience, a footstep tick on the bob's contact, and a "ka-ching" on each tally tick. |

## Techniques
C01 Continuous pan + time of day · C02 Parallax truck · N07 Tally counter + receipt rows · R19 Logo chain · U11 Floating cards.

## Do / Don't
- **Do** make the sky a function of camera x, with 3–4 keyed gradients and `interpolateColors`.
- **Do** tie every event (tick, receipt row, door glow) to a place in the world, so it happens where the camera is.
- **Do** keep the shapes flat: no gradients on buildings, one shadow tone per surface.
- **Don't** cut. If you need a new place, keep panning to it.
- **Don't** move the camera faster than about 25 px/frame@60 without motion blur.
- **Don't** let the caption cover the walker.

## Example brief
"A 5-second loop of a day of cashless payments on one street."

| Frames | Beat |
|---|---|
| 0 | Mid-pan, day sky, the WARUNG front, the walker mid-step, "1× Scan Pay today". |
| 0–150 | The camera trucks past WARUNG, KOPI, BAKSO, PULSA, ROTI and BUAH; the sky goes day → golden → dusk. |
| 40 / 76 / 112 | Receipt cards slide in at the top right and the tally ticks 2×, 3×, 4×. |
| 20–150 | Caption "One street. One wallet. Zero cash." (blur-in, "Zero cash" in cyan). |

## Remotion starter
```tsx
import React from 'react';
import {interpolateColors, useCurrentFrame} from 'remotion';
import {E, prog} from '../lib/anim';
import {Fill} from './kit';

const SHOPS = ['WARUNG', 'KOPI', 'BAKSO', 'PULSA', 'ROTI', 'BUAH'];
const COLORS = ['#e8412e', '#2b3bff', '#f2c531', '#22c55e', '#ff7a1a', '#a855f7'];

export const WorldPanStarter: React.FC = () => {
  const f = useCurrentFrame();
  const t = prog(f, 0, 150, E.dolly);
  const camX = t * 2400;
  const sky = interpolateColors(t, [0, 0.5, 1], ['#8fd3ff', '#ffb46b', '#6b4fa0']);
  return (
    <Fill bg={sky}>
      <div style={{position: 'absolute', top: 420, left: -camX * 0.3, width: 6000, height: 250, background: 'rgba(0,0,0,.12)'}} />
      <div style={{position: 'absolute', top: 0, left: -camX, width: 6000, height: 1080}}>
        {SHOPS.map((s, i) => (
          <div key={s} style={{position: 'absolute', left: 300 + i * 620, top: 400, width: 460, height: 270, background: COLORS[i]}}>
            <div style={{fontFamily: 'Bebas Neue', fontSize: 60, color: '#fff', padding: 16}}>{s}</div>
          </div>
        ))}
        <div style={{position: 'absolute', left: 0, top: 670, width: 6000, height: 410, background: '#3a3f4a'}} />
      </div>
      {/* screen-locked walker */}
      <div style={{position: 'absolute', left: 760, top: 560 - Math.abs(Math.sin(f * 0.5)) * 6, width: 60, height: 120, borderRadius: 30, background: '#111'}} />
    </Fill>
  );
};
```
