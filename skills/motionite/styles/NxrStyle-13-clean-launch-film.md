# NxrStyle 13 · Clean Launch Film

> A restrained product launch: a near-white stage, one sans, ink plus **one** accent that carries a meaning, copy in fragments, scale-through cuts, and numbers that are the product. No glow, no gradient, no overshoot on type.

![NxrStyle 13 still](../examples/stills/NxrStyle-13-clean-launch-film.png)

Example comp: [`examples/src/styles/S13LaunchFilm.tsx`](../examples/src/styles/S13LaunchFilm.tsx) · id `NxrStyle13-LaunchFilm` · 1920×1080 · 30 fps · 160 f

## Visual DNA
| Axis | Spec |
|---|---|
| Palette | paper `#fafaf9` · ink `#111` · grey `#a1a1aa` · **one accent red `#e5484d` that means something** (here: "needs a rebuild"). |
| Type | One sans (Inter / Geist) at 600–700. Code in Geist Mono. Copy in fragments: "One changed line." / "494 targets." / "N from cache." |
| Layout | Big left-aligned statements with lots of air. Data visualisations are the hero (the 494-square wall). The wall-time readout sits at the top right. |
| Motion | Enter with `E.out` (.16, 1, .3, 1), exit with `E.in` (.7, 0, .84, 0). The secondary move starts at 55–75 % of the primary. Speed ≤ 25 px/frame@60. **Overshoot budget: at most 2 per film, never on type.** |
| Transitions | Scale-through cut (X04): the exit goes 1→0.75 with blur 0→6 over 10 f, a hard cut, then the entry goes 1.85→1 in log space with blur 8→0 over 18 f. Masked baseline rise (T05) for lines. |
| Timing | A `timeline.ts` beat grid. Token timings are at 60 fps, so halve every number at 30 fps. |
| Audio | Minimal: soft ticks, one low hit on the resolve, room tone. −14 LUFS. |

## Techniques
X04 Scale-through cut · T05 Masked baseline rise · N02 Digit reel detent · U09 Card deal · T07 Scramble decode · C04 (macro → world).

## Bans (defaults that a supplied brand overrides)
The default bans are serif/italic, orange/cream, neon/glow, purple gradients, glass, emoji, particles and overshoot on type. **Treat these as defaults for generic product films, not laws.** If the client's brand or mood board uses a serif, cream or a glow, the brand wins. Keep the *physics* in every style: log scale, asymmetry, overlap, speed limit, and the overshoot budget.

## Do / Don't
- **Do** give the accent a meaning and keep it there. Red = needs a rebuild, and nothing else is red.
- **Do** let numbers be the product ("494 targets", "0:09 wall time").
- **Do** write the copy as fragments, at most 4 words on screen.
- **Don't** use a gradient, glow, glass or particle anywhere.
- **Don't** fade. Every change is a move, a mask or a scale-through.
- **Don't** overshoot the type.

## Example brief
"A 5-second launch film for a build cache called cachet: change one line, rebuild almost nothing."

| Frames | Beat |
|---|---|
| 0 | Code diff on paper, "One changed line." already set. |
| 0–40 | The changed line highlights, then a scale-through cut into its red marker. |
| 40–100 | A wall of 494 squares turns red (invalidated) in a radial wave. "494 targets." |
| 100–130 | Squares resolve to ink from the cache in a seeded order, except 3. "491 from cache." and the wall time reads 0:09. |
| 130–160 | End card: "cachet." plus "Builds that remember." |

## Remotion starter
```tsx
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, blurIn, lmix, prog, rand} from '../lib/anim';
import {Fill} from './kit';

const N = 494, COLS = 38;
const STAY_RED = new Set([71, 260, 433]);

export const LaunchStarter: React.FC = () => {
  const f = useCurrentFrame();
  const enter = prog(f, 40, 58, E.out);
  const s = lmix(1.85, 1, enter); // scale-through entry, log space
  return (
    <Fill bg="#fafaf9">
      <div style={{position: 'absolute', left: 140, top: 200, transform: `scale(${s})`, filter: `blur(${blurIn(enter, 8)}px)`, transformOrigin: '0 0'}}>
        {Array.from({length: N}, (_, i) => {
          const x = i % COLS, y = Math.floor(i / COLS);
          const inval = f > 50 + Math.hypot(x - 19, y - 6) * 1.2;
          const cached = !STAY_RED.has(i) && f > 100 + rand(i) * 25;
          return <div key={i} style={{position: 'absolute', left: x * 32, top: y * 32, width: 26, height: 26, borderRadius: 4,
            background: inval && !cached ? '#e5484d' : '#111'}} />;
        })}
      </div>
      <div style={{position: 'absolute', left: 140, top: 80, fontFamily: 'Inter', fontWeight: 650, fontSize: 64, color: '#111'}}>
        {f < 100 ? '494 targets.' : `${N - STAY_RED.size} from cache.`}
      </div>
    </Fill>
  );
};
```
