# NxrStyle 09 · Live Bento Grid

> A 1:1 feed post where frame 0 is already the full poster. Every tile is a live loop, price chips flip state on the beat, a strike-and-count-down payoff closes it, and the last frame equals the first.

<img src="../examples/stills/NxrStyle-09-live-bento-grid.png" width="480" alt="NxrStyle 09 still">

Example comp: [`examples/src/styles/S09LiveGrid.tsx`](../examples/src/styles/S09LiveGrid.tsx) · id `NxrStyle09-LiveGrid` · **1080×1080** · 30 fps · 180 f (seamless loop)

## Visual DNA
| Axis | Spec |
|---|---|
| Palette | stage `#0d0d10` · tiles `#17171c` with a 1 px `#26262d` border · **state colours: red `#ef4444` ($500) → green `#22c55e` ($0)** · white ink |
| Type | Inter / DM Sans 700 for the headline (60–72 px on 1080). Chips in Geist Mono 700. |
| Layout | Headline at the top (two lines, the price word in red), a PART 2 chip at the top right, then a 4×3 grid with 16 px gaps and 20 px radius. Each tile has a price chip in its bottom-left corner. |
| Motion | Every tile is its own loop of length `L` (60 f) using `f % L`, with phases staggered. Chips flip with a 5 f `E.inOut` rotateY; the face swaps at p = .5 and the angle re-bases (`ang − 180`), so text is never mirrored. |
| Transitions | None. The payoff panel pops over a 60 % dim and then closes back to the grid. |
| Timing | A chip flip every 7 f (about one per beat at 128 BPM). The payoff runs f110–160 and the loop seam at 180 = 0. |
| Audio | A tick per chip flip (pitch rising), a "ka-ching" on `$0`, music that loops cleanly at the seam. |

## Techniques
R18 Bento grid of live loops · U02 Chip-flip grid on beat · N03 Strike + count-down to $0 · H07 Particle burst (single payoff) · plus any tile techniques (H05, U04, U07, T07…).

## Do / Don't
- **Do** make frame 0 a complete, readable thumbnail, both muted and at phone size.
- **Do** make the grid alive through **state changes** (chips flipping), not only through motion.
- **Do** check the seam: render f0 and f179 and compare them.
- **Don't** pop tiles in one by one at the start. A half-empty first frame kills the post.
- **Don't** use more than one particle burst. It is a deliberate rule-break, so spend it once.
- **Don't** shrink tiles below about 200 px on a 1080 canvas. Each one has to read at phone size.

## Example brief
"A looping 6-second feed post: 12 effects that used to cost $500 each are now one prompt."

| Frames | Beat |
|---|---|
| 0 | The full poster: the headline "Motion designers charge $500 per effect.", the PART 2 chip and 12 live tiles, all with red chips. |
| 18–95 | The chips flip to green `$0` every 7 f in reading order. |
| 110–125 | The grid dims and the panel pops with "12 × $500 = $6,000". The strike draws L→R in 5 f. |
| 125–140 | A count-down every 5 f lands on a green `$0` with a pop and glow. "ONE PROMPT · MOTIONITE" follows about 15 f later. |
| 158–180 | The chips flip back to red and the panel closes, so f180 equals f0. |

## Remotion starter
```tsx
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, prog} from '../lib/anim';
import {Fill} from './kit';

const L = 60; // every tile loops on L frames; the film length is a multiple of L
const Tile: React.FC<{i: number; f: number}> = ({i, f}) => {
  const lf = (f + i * 7) % L;                 // phase-staggered seamless loop
  const flipAt = 18 + i * 7, backAt = 158 + (i % 3) * 7;
  const p = prog(f, flipAt, flipAt + 5, E.inOut) - prog(f, backAt, backAt + 5, E.inOut);
  const free = p > 0.5;
  const ang = p * 180 - (free ? 180 : 0);    // re-based angle: never mirrored
  return (
    <div style={{position: 'relative', background: '#17171c', border: '1px solid #26262d', borderRadius: 20, overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: '50%', top: '45%', width: 40, height: 40, borderRadius: 20, background: '#fff',
        transform: `translate(-50%,-50%) rotate(${(lf / L) * 360}deg) translateX(40px)`}} />
      <div style={{position: 'absolute', left: 12, bottom: 12, padding: '4px 10px', borderRadius: 8, fontFamily: 'Geist Mono', fontWeight: 700, fontSize: 22,
        background: free ? '#22c55e' : '#ef4444', color: '#fff', transform: `perspective(400px) rotateY(${ang}deg)`}}>{free ? '$0' : '$500'}</div>
    </div>
  );
};

export const LiveGridStarter: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Fill bg="#0d0d10" style={{padding: 60}}>
      <div style={{fontFamily: 'Inter', fontWeight: 700, fontSize: 64, color: '#fff', marginBottom: 30}}>
        Motion designers charge <span style={{color: '#ef4444'}}>$500</span> per effect.
      </div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', gap: 16, height: 720}}>
        {Array.from({length: 12}, (_, i) => <Tile key={i} i={i} f={f} />)}
      </div>
    </Fill>
  );
};
```
