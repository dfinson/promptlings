# NxrStyle 04 · Editorial Ink

> An off-white page where serif type inks from grey to black word by word, a yellow highlighter swipes across it, and product UI shows up as a printed document.

![NxrStyle 04 still](../examples/stills/NxrStyle-04-editorial-ink.png)

Example comp: [`examples/src/styles/S04EditorialInk.tsx`](../examples/src/styles/S04EditorialInk.tsx) · id `NxrStyle04-EditorialInk` · 1920×1080 · 30 fps · 120 f

## Visual DNA
| Axis | Spec |
|---|---|
| Palette | paper `#f3f2ee` · ink `#111` · grey start `#bebebe` · **highlighter `#f5f53a`** (the only colour) · a small red `#e5484d` allowed on one glyph (the `+`) |
| Type | Newsreader (or EB Garamond) for statements at 96–120 px; the italic carries the emotional half. Tiny grey sans for captions (Inter 20 px). |
| Layout | Magazine grid: a masthead rule at the top, the headline at the top left, a document card on the right, and a big counter at the bottom left. Generous margins (≥ 120 px). |
| Motion | Each word rises 14 px from a 6 px blur, then its colour settles grey→ink over 6 f `E.smooth`. The highlighter scales X 0→1 from the left over 10 f `E.ui` on its **own layer under the text**. |
| Transitions | Continuous. Use a slow push or a document scroll, and the card deal → scatter (U09) for scale changes. No colour slams. |
| Timing | A word every 5 f (fast) or 8 f (calm editorial). Calmer pieces run at 0.25–0.35 s per word. |
| Audio | A pencil or paper tick per word, a soft marker squeak on the highlighter, and a calm piano or ambient bed. |

## Techniques
T02 Editorial ink build + highlighter · N02 Digit reel detent · U09 Card deal → scatter · T05 Masked baseline rise · R10 Halftone portraits (for real photography).

## Do / Don't
- **Do** let one italic phrase carry the emotion; the highlighter goes on that phrase only.
- **Do** present UI as a printed document: rows, rules, check chips.
- **Do** use real photography where the brief has it (dash-cam stills, street scenes).
- **Don't** add a second colour. The highlighter yellow is the brand moment.
- **Don't** let the highlighter reflow the text. It sits on an absolutely positioned layer.
- **Don't** use gradients, glows or drop shadows heavier than `0 2px 0 rgba(0,0,0,.06)`.

## Example brief
"A 4-second editorial card for a data-network launch: human-made receipts, 250M+ records."

| Frames | Beat |
|---|---|
| 0 | The masthead "The Receipt Journal" and its rule are on screen, with grey ghost words already placed. |
| 4–40 | "Every receipt is" inks word by word. |
| 40–60 | "*written by people.*" inks in, then the highlighter swipes across 52–62. |
| 50–90 | A video-receipt card builds rows; the payout row gets highlighted and check chips pop. |
| 80–120 | "250,000,000+" rolls on detent reels, then the red italic `+` lands. Hold. |

## Remotion starter
```tsx
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, blurIn, mix, prog} from '../lib/anim';
import {Fill} from './kit';

const ink = (p: number) => Math.round(mix(190, 17, p));

export const EditorialStarter: React.FC = () => {
  const f = useCurrentFrame();
  const words = 'Every receipt is written by people.'.split(' ');
  const hl = prog(f, 52, 62, E.ui);
  return (
    <Fill bg="#f3f2ee">
      <div style={{position: 'absolute', left: 140, top: 300, fontFamily: 'Newsreader', fontSize: 110, lineHeight: 1.1, width: 1100}}>
        <div style={{position: 'absolute', left: 0, top: 128, width: 770, height: 100, background: '#f5f53a', transformOrigin: 'left', transform: `scaleX(${hl})`}} />
        {words.map((w, i) => {
          const t0 = 4 + i * 6;
          const p = prog(f, t0, t0 + 6, E.out);
          const c = ink(prog(f, t0 + 2, t0 + 8, E.smooth));
          return (
            <span key={i} style={{position: 'relative', display: 'inline-block', marginRight: '0.25em', fontStyle: i >= 3 ? 'italic' : 'normal',
              opacity: Math.min(1, p * 1.5), color: `rgb(${c},${c},${c})`, transform: `translateY(${mix(14, 0, p)}px)`, filter: `blur(${blurIn(p, 6)}px)`}}>{w}</span>
          );
        })}
      </div>
    </Fill>
  );
};
```
