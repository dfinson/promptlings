# NxrStyle 01 · Beat Reel

> Flat colour fields that change on the bar, one idea per bar, slamming kinetic type, design-tool HUD chrome.

![NxrStyle 01 still](../examples/stills/NxrStyle-01-beat-reel.png)

Example comp: [`examples/src/styles/S01BeatReel.tsx`](../examples/src/styles/S01BeatReel.tsx) · id `NxrStyle01-BeatReel` · 1920×1080 · 30 fps · 225 f (4 bars at 128 BPM)

## Visual DNA
| Axis | Spec |
|---|---|
| Palette | night `#111` · red-orange `#e8412e` · electric blue `#2b3bff` · mustard `#f2c531` · cream `#efece4`. One field per bar and one accent per field. |
| Type | Geometric extra-bold sans (Montserrat 900) for slams. Serif (Newsreader) only on the end card. HUD in Geist Mono at 18–20 px, tracked 0.18em. |
| Layout | Headline cap height ≥ 12 % of frame height (≥ 130 px at 1080p). Left-aligned or centred. HUD in all four corners. |
| Motion | Slams from 1.35× with blur 18→0 in 4 f. Velocity-driven arc blur on the swung word. A camera kick on the third hit (8 px, attack 1, tau 4). |
| Transitions | Iris punch-through with a glyph knockout (X02) on bar 0. Colour-field slam on each bar line. A strobe sting (X06) only once, if used at all. |
| Timing | `grid(128)`: beat 14.06 f, bar 56.25 f. Scene = one bar. Words hold about 0.27 s (8 f). |
| Springs | `SPR.snap` for chrome and `SPR.pop` for the morph shape. No overshoot on type. |
| Audio | 128 BPM music. Cuts land 2 f **before** the downbeat. One soft tick per word. Master at −14 LUFS. |

## Techniques
X02 Iris punch · T04 Bracket slam + arc blur · U04 HUD bbox shape morph · C03 Impact kick · X06 Strobe sting · H05 Dot-grid wave · T09 Text ring · H08 Point sphere → cube. See [techniques/](../techniques/README.md).

## Do / Don't
- **Do** build each bar around one idea and change the field colour on the bar line.
- **Do** keep the HUD on every frame: corner brackets, `BAR n/8 · 128 BPM`, and a frame counter.
- **Do** end on a calm serif lockup with a single accent dot.
- **Don't** let anything start between beats. Every `Sequence` `from` comes from `b(bar, beat, sub)`.
- **Don't** put two transition devices back to back.
- **Don't** use a strobe and an iris in the same bar.
- **Don't** let the HUD compete with the headline. Keep it at ≤ 20 px and ≤ 70 % opacity.

## Example brief
"A 7-second showreel opener for a motion-design skill: energetic, typographic, on the beat."

| Bar | Frames | Beat |
|---|---|---|
| 0 | 0–55 | A ring of dots gathers into an iris with an "E" knockout. MOTION / ON BEAT on night. |
| 1 | 56–112 | Red field: EVERY [FRAME] LANDS ON BEAT. Slams on each beat; FRAME swings on an arc inside brackets; the camera kicks on beat 3. |
| 2 | 113–168 | Blue field: a morphing shape (circle→squircle→triangle→flower) in a selection box with handles and a ROT readout. "SHAPE SHIFTS." |
| 3 | 169–224 | Cream end card: serif "Motionite" plus a red dot and tracked caps. |

## Remotion starter
```tsx
import React from 'react';
import {Sequence, useCurrentFrame} from 'remotion';
import {E, hitPulse, prog} from '../lib/anim';
import {Corners, Fill, Mono, grid} from './kit';

const {b} = grid(128);
const FIELDS = ['#111', '#e8412e', '#2b3bff', '#efece4'];

const Slam: React.FC<{word: string; at: number}> = ({word, at}) => {
  const f = useCurrentFrame();
  const p = prog(f, at, at + 4, E.out);
  return (
    <span style={{display: 'inline-block', opacity: p > 0 ? 1 : 0, transform: `scale(${1.35 - 0.35 * p})`, filter: `blur(${18 * (1 - p)}px)`}}>
      {word}&nbsp;
    </span>
  );
};

export const BeatReelStarter: React.FC = () => {
  const f = useCurrentFrame();
  const kick = hitPulse(f - b(1, 2), 1, 4) * 8; // camera kick on bar 1, beat 3
  return (
    <Fill bg="#111">
      {FIELDS.map((bg, i) => (
        <Sequence key={i} from={b(i) - 2} durationInFrames={b(i + 1) - b(i)}>
          <Fill bg={bg} style={{transform: `translate(${kick}px, ${-kick / 2}px)`}}>
            <div style={{position: 'absolute', left: 140, top: 380, fontFamily: 'Montserrat', fontWeight: 900, fontSize: 170, color: i === 3 ? '#111' : '#fff'}}>
              {['EVERY', 'FRAME', 'LANDS'].map((w, k) => <Slam key={k} word={w} at={k * 14} />)}
            </div>
          </Fill>
        </Sequence>
      ))}
      <Corners inset={40} size={36} c="rgba(255,255,255,.7)" />
      <Mono style={{right: 70, top: 60, color: '#fff', opacity: 0.7}}>{`BAR ${Math.floor(f / 56.25) + 1}/4 · 128 BPM`}</Mono>
    </Fill>
  );
};
```
