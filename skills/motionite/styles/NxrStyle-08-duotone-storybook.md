# NxrStyle 08 · Duotone Storybook

> An engraved, hatched navy illustration on pale paper with exactly one warm accent, a comic SLAM word, a speech bubble, and a slow push-in.

![NxrStyle 08 still](../examples/stills/NxrStyle-08-duotone-storybook.png)

Example comp: [`examples/src/styles/S08DuotoneStorybook.tsx`](../examples/src/styles/S08DuotoneStorybook.tsx) · id `NxrStyle08-DuotoneStorybook` · 1920×1080 · 30 fps · 150 f

## Visual DNA
| Axis | Spec |
|---|---|
| Palette | paper `#e9ecf4` · ink navy `#16245c` (all line work, hatching and fills) · **one warm accent `#ff7a1a`** (pumpkins, the SLAM word, window glow) |
| Type | Archivo Black for the SLAM, skewed −8° with a 6 px navy stroke. The speech bubble uses Plus Jakarta Sans 700. |
| Layout | Storybook tableau: the house centred slightly right, the moon top left, the SLAM word bottom left over the scene, the bubble pointing at the door. |
| Rendering | Engraving with SVG `<pattern>` hatches (lines at 0°/45°/90° in 3 densities = 3 tones), plus horizontal sky lines whose spacing increases with height. No gradients. |
| Motion | Slow log push-in 1→1.12 over the shot (`lmix`, `E.cam`). The bubble pops from its **tail point** (transform-origin at the tail) on `SPR.pop`. SLAM goes 1.6→1 in 4 f with a 6–8 px camera kick. |
| Transitions | Push into the door (C05) → black. The SLAM triplet is the only place where hard cuts are allowed. |
| Timing | Push for the whole shot; SLAM on a downbeat; bubble 10–15 f after it. |
| Audio | A spooky pizzicato or music-box bed, a door knock SFX on the bubble, and a hit on the SLAM. |

## Techniques
C05 Push-in to a door · C03 Impact kick + flash · R20 Speech bubbles · U11 Floating cards (wallet UI over the darkened world) · H03 Riso halftone (variant fill).

## Do / Don't
- **Do** build every tone from hatch density, not opacity. That is what makes it read as an engraving.
- **Do** spend the accent colour on 2–3 objects only.
- **Do** let the title exit before the push peaks.
- **Don't** add a third colour, except the black of the open door.
- **Don't** use soft drop shadows. Use cross-hatching under objects.
- **Don't** use more than one SLAM triplet per film.

## Example brief
"A 5-second seasonal promo: trick-or-treating at a wallet's door."

| Frames | Beat |
|---|---|
| 0 | Engraved sky, moon, the hatched house with glowing windows, and pumpkins. The push is already moving. |
| 18–24 | "TRICK OR TREAT!" slams in (skewed, stroked) and the camera kicks. |
| 40–55 | Bubble pops from the door: "Knock knock… scroll in!" |
| 55–150 | Slow log push toward the door. Hold. |

## Remotion starter
```tsx
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, SPR, hitPulse, lmix, mix, prog, spr} from '../lib/anim';
import {Fill} from './kit';

export const StorybookStarter: React.FC = () => {
  const f = useCurrentFrame();
  const s = lmix(1, 1.12, prog(f, 0, 150, E.cam));
  const slam = prog(f, 18, 22, E.out);
  const kick = hitPulse(f - 20, 1, 4) * 8;
  const bubble = spr(f, 40, SPR.pop);
  return (
    <Fill bg="#e9ecf4">
      <svg width={1920} height={1080} style={{transform: `scale(${s}) translateX(${kick}px)`, transformOrigin: '1180px 700px'}}>
        <defs>
          <pattern id="h1" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#16245c" strokeWidth="2" /></pattern>
        </defs>
        <rect x={900} y={460} width={560} height={440} fill="url(#h1)" stroke="#16245c" strokeWidth={6} />
        <polygon points="860,470 1180,250 1500,470" fill="#16245c" />
        <rect x={1120} y={700} width={120} height={200} fill="#16245c" />
        <circle cx={980} cy={930} r={50} fill="#ff7a1a" stroke="#16245c" strokeWidth={5} />
      </svg>
      <div style={{position: 'absolute', left: 120, top: 680, fontFamily: 'Archivo Black', fontSize: 150, color: '#ff7a1a', WebkitTextStroke: '6px #16245c',
        opacity: slam > 0 ? 1 : 0, transform: `skewX(-8deg) scale(${mix(1.6, 1, slam)})`}}>TRICK OR TREAT!</div>
      <div style={{position: 'absolute', left: 1260, top: 520, padding: '18px 28px', background: '#fff', border: '5px solid #16245c', borderRadius: 30,
        fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 36, transformOrigin: '0% 100%', transform: `scale(${bubble})`}}>Knock knock… scroll in!</div>
    </Fill>
  );
};
```
