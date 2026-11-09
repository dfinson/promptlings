# NxrStyle 07 · Frost Collectible

> A launch for a collectible: an icy pale sky, heavy condensed caps with one word fixed and the next blur-swapping, icons orbiting in depth, a scrambling mint counter, and a glossy card flip.

![NxrStyle 07 still](../examples/stills/NxrStyle-07-frost-collectible.png)

Example comp: [`examples/src/styles/S07FrostCollectible.tsx`](../examples/src/styles/S07FrostCollectible.tsx) · id `NxrStyle07-FrostCollectible` · 1920×1080 · 30 fps · 120 f

## Visual DNA
| Axis | Spec |
|---|---|
| Palette | sky gradient `#eaf3ff` → `#c9dcf5` · ink navy `#0f1b33` · **royal blue `#3366ff`** on the swapped word · ice-white cards with a cool shadow `0 30px 60px rgba(15,27,51,.18)` |
| Type | Anton or Bebas Neue, all caps, 180–240 px. A tiny tracked caption below in Inter 22 px. |
| Layout | Anchor word on the left with the swap slot right of it, both left-aligned at x ≈ 160. Card hero on the right third. The orbit ellipse wraps the card. |
| Motion | The new word enters with blur 20→0, scale 1.25→1 and x 24→0 over 8 f; the old word exits with blur→14 and −30 px over 3 f; the anchor re-blurs 6 px for 3 f on each swap. Orbit: `z = sin(a)` drives scale (.6–1.2), back-only blur (≤ 3 px) and draw order. |
| Transitions | The card flip (U10) is the transition: the face swaps at 90°, then a specular band sweeps −40 %→140 %. |
| Timing | One swap every 15–22 f. The scramble runs about 30 f with a new value every 2 f, then lands with a pop. |
| Audio | Crisp synth plucks on swaps, a whoosh on the flip and a glassy chime on the counter landing. |

## Techniques
T01 Anchor + blur swap · U08 Orbit icons with depth · N01 Scramble counter + ghosting · U10 Card flip + specular · C04/C05 (dolly onto the hero).

## Do / Don't
- **Do** pin the transform origin of the swap slot to the left, so the gap after the anchor never jumps.
- **Do** split the orbit draw order: items with `z < 0` render before the hero and `z ≥ 0` after it.
- **Do** let the scramble values ghost (two copies above at 30 %/15 % opacity) for a fake roll blur.
- **Don't** use more than three swaps in a row. The third lands the message.
- **Don't** use rainbow icons. Tint the orbit to the palette, or use real logos at small size.
- **Don't** overshoot the type. Only the card is allowed one pop.

## Example brief
"A 4-second teaser for a 5,555-piece collectible mint."

| Frames | Beat |
|---|---|
| 0 | Snow, "EVERY STREAM." and the card are already on screen. |
| 0–66 | Swaps STREAM. → DROP. → HOLDER. every 22 f. |
| 10–120 | Six icons orbit the card in depth. |
| 30–60 | MINTED counter scrambles and lands on 2453 / 5555 with a pop. |
| 60–75 | The card flips to the NXR BOT face and the specular sweep crosses it 75–95. |
| 95–120 | Hold on the hero. |

## Remotion starter
```tsx
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, blurIn, mix, prog} from '../lib/anim';
import {Fill} from './kit';

const SWAP = ['STREAM.', 'DROP.', 'HOLDER.'];
const PER = 22;

export const FrostStarter: React.FC = () => {
  const f = useCurrentFrame();
  const k = Math.min(SWAP.length - 1, Math.floor(f / PER));
  const lf = f - k * PER;
  const pin = k === 0 ? 1 : prog(lf, 0, 8, E.out);
  const pout = k === SWAP.length - 1 ? 0 : prog(lf, PER - 3, PER, E.in);
  const anchorBlur = k > 0 && lf < 3 ? 6 : 0;
  return (
    <Fill bg="linear-gradient(#eaf3ff, #c9dcf5)">
      <div style={{position: 'absolute', left: 160, top: 360, fontFamily: 'Anton', fontSize: 220, lineHeight: 1, color: '#0f1b33'}}>
        <div style={{filter: `blur(${anchorBlur}px)`}}>EVERY</div>
        <div style={{color: '#3366ff', transformOrigin: 'left center', opacity: Math.min(1, pin * 1.5) * (1 - pout),
          transform: `translateX(${mix(24, 0, pin) - 30 * pout}px) scale(${mix(1.25, 1, pin)})`, filter: `blur(${blurIn(pin, 20) + 14 * pout}px)`}}>{SWAP[k]}</div>
      </div>
    </Fill>
  );
};
```
