# NxrStyle 15 · Hand-Drawn Ink

> Lines that draw themselves and boil on twos, marker notes in a hand font, and an ink-blot transition into a riso halftone panel.

![NxrStyle 15 still](../examples/stills/NxrStyle-15-hand-drawn-ink.png)

Example comp: [`examples/src/styles/S15HandDrawnInk.tsx`](../examples/src/styles/S15HandDrawnInk.tsx) · id `NxrStyle15-HandDrawnInk` · 1920×1080 · 30 fps · 120 f

## Visual DNA
| Axis | Spec |
|---|---|
| Palette | Lined paper `#f7f4ec` with blue rules `#c9d6ea` and a red margin · graphite ink `#2b2b2b` · marker red `#e5484d`. The riso plate after the blot is blue `#3255a4`, pink `#ff6fa3` and yellow `#ffd23f`. |
| Type | Caveat for marker notes, stroked first and then filled at 70 %. Archivo Black for the riso punch line ("made by / hand."). |
| Layout | Journal page: a header note at the top left ("day 3 · summit log"), the drawing in the centre, and annotations with arrows pointing at it. |
| Motion | The drawing index is `d = onTwos(f) / 2`. Every vertex jitters by `rand(`${d}:${i}`)`, so lines boil at 15 drawings/s. The draw-on uses `pathLength = 1`, dashoffset `1 − p`, and its progress also advances on twos. A pencil displacement filter (`feTurbulence` + `feDisplacementMap`, seed = drawing index) roughens the strokes. |
| Transitions | Ink-blot reveal (X07): a 90-point clip polygon with radius `R·(1 + 0.18·rand + 0.06·sin(7a + floor(f/2)))`, boiling on twos, R 0→1000+ over about 0.8–1 s. |
| Timing | Cue grid 1/12 s (2.5 f at 30 fps). A new idea every 1.5–2 s. |
| Audio | Pencil scratches synced to the draw-on, a wet "bloop" on the blot, and a light ukulele or whistle bed. |

## Techniques
H01 Self-draw + boil + marker note · X07 Ink-blot reveal · H03 Riso halftone misregistration · H06 Cadence · R11 Ripple ring · R12 Tally marks · R14 Doodle-on-photos · R15 Found motion · R16 Sand animation.

## Do / Don't
- **Do** boil the lines and characters only. Keep paper, fills and halftone dots still (frame diff of about 1/255).
- **Do** keep one anchor (the summit, a character) alive across the blot.
- **Do** draw transitions by hand: blot, iris, ripple or torn edge.
- **Don't** cross-dissolve. Ever.
- **Don't** boil on ones. It reads as noise, not as drawing.
- **Don't** stack two transition devices. A look change lands on a hard cut and lasts ≥ 1 s.

## Example brief
"A 4-second hiking-log sting: the route draws itself, a note marks the peak, then a riso card says 'made by hand.'"

| Frames | Beat |
|---|---|
| 0 | Lined paper, the header note and the first ridge stroke are already partly drawn. |
| 0–40 | The ridge draws on (boiling on twos), the flag pops, and a red marker circle draws around the peak. |
| 30–55 | Arrow plus Caveat "the peak!" (stroke, then fill). |
| 56–86 | An ink blot grows from the peak and reveals the riso plate (blue bg, pink dots, yellow halftone circle). |
| 76–120 | "made by / hand." in Archivo Black with riso misregistration. Hold. |

## Remotion starter
```tsx
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, onTwos, prog, rand} from '../lib/anim';
import {Fill} from './kit';

const RIDGE: [number, number][] = [[200, 760], [420, 620], [560, 690], [760, 420], [960, 560], [1180, 470], [1400, 700], [1720, 640]];

export const HandDrawnStarter: React.FC = () => {
  const f = useCurrentFrame();
  const d = onTwos(f) / 2; // drawing index: new drawing every 2 frames
  const pts = RIDGE.map(([x, y], i) => `${x + (rand(`${d}:${i}x`) - 0.5) * 4},${y + (rand(`${d}:${i}y`) - 0.5) * 4}`).join(' ');
  const p = prog(onTwos(f), 0, 40, E.out); // draw-on also advances on twos
  const R = prog(f, 56, 86, E.out) * 1400;
  const blot = Array.from({length: 90}, (_, k) => {
    const a = (k / 90) * Math.PI * 2;
    const r = R * (1 + 0.18 * rand(`b${k}`) + 0.06 * Math.sin(7 * a + Math.floor(f / 2)));
    return `${760 + Math.cos(a) * r},${420 + Math.sin(a) * r}`;
  }).join(' ');
  return (
    <Fill bg="repeating-linear-gradient(#f7f4ec 0 46px, #c9d6ea 46px 48px)">
      <svg width={1920} height={1080} style={{position: 'absolute'}}>
        <polyline points={pts} fill="none" stroke="#2b2b2b" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} />
        <clipPath id="blot"><polygon points={blot} /></clipPath>
        <g clipPath="url(#blot)"><rect width={1920} height={1080} fill="#3255a4" /></g>
      </svg>
    </Fill>
  );
};
```
