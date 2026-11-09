# NxrStyle 14 · Paper Stop-Motion

> Cut-paper puppets posed 12 times a second while the camera moves on every frame, with noisy cut edges, contact shadows, a riso palette, verlet steam, grain, and exposure flicker.

![NxrStyle 14 still](../examples/stills/NxrStyle-14-paper-stop-motion.png)

Example comp: [`examples/src/styles/S14PaperStopMotion.tsx`](../examples/src/styles/S14PaperStopMotion.tsx) · id `NxrStyle14-PaperStopMotion` · 1920×1080 (960×540 logic drawn ×2) · 30 fps · 150 f

## Visual DNA
| Axis | Spec |
|---|---|
| Palette | Riso-limited: cream paper `#efe6d2`, teal `#2f6f73`, red `#d04b40`, mustard `#e0a93b`, ink `#1f2a2c`. Each piece is one flat colour. |
| Type | Minimal: a paper label ("slow morning") cut out like the puppets, set in a humanist serif or a hand font. |
| Layout | A theatre set: sky plate, hill plates (parallax 0.3 / 0.6 / 1), the hero prop (kettle) in the centre third, and birds and sun as secondary puppets. |
| Motion | **Mixed cadence:** exposure `e = floor(f·12/30)` drives poses and boil, while the camera moves on ones. Boil is ±1.1 px and ±.003 rad per exposure, seeded by `e`. Squash sy .88 on each beat (96 BPM = 0.625 s). |
| Transitions | Camera moves between set-ups, or a torn-paper edge wipe (R13). Never a dissolve. |
| Timing | 96 BPM, one shot per bar (2.5 s = 75 f at 30 fps). |
| Physics | Steam is a verlet rope **re-simulated from frame 0 at a fixed step on every render**. That costs more, but it is deterministic and render order doesn't matter. |
| Post | Grain re-offset per exposure, flicker `(hash(e) − .5)·.05`, and a warm vignette. |
| Audio | Plucked strings (Karplus–Strong) where each note triggers a visual event: a squash, a puff or a bird hop. |

## Techniques
H02 Paper cut-out stop-motion · H06 Cadence compare · C02 Parallax truck · R13 Torn-paper edge wipe · R17 Paper 3D book · H03 Riso halftone (as a texture variant).

## Do / Don't
- **Do** keep the camera on ones while puppets hold for 2–3 frames. That mismatch is what sells "real stop-motion on a moving rig".
- **Do** give every piece a contact shadow and a slightly irregular edge.
- **Do** seed **everything** by exposure index, never by frame, so the boil holds still between exposures.
- **Don't** boil the paper texture or the background fills. Only edges and puppets move.
- **Don't** use digital gradients or blur-based depth of field. Paper is flat and lit.
- **Don't** mix this style into a pixel or flat-vector film for more than about 1 s. If you do, enter it on a hard cut.

## Example brief
"A 5-second cosy morning: a kettle sings, steam curls, birds pass."

| Frames | Beat |
|---|---|
| 0 | The set (sun, hills, kettle) is already lit, and the camera is pulling out. |
| 0–150 | The camera drifts and pulls out on ones; puppets pose on 12s. |
| every 18.75 f | The kettle squashes on the beat and the lid hops. |
| 20–150 | The steam rope rises from the spout; birds cross. |
| 40–150 | The "slow morning" paper label settles. |

## Remotion starter
```tsx
import React from 'react';
import {CanvasComp} from '../lib/canvas';
import {rand} from '../lib/anim';

const expo = (f: number) => Math.floor((f * 12) / 30); // 12 poses per second

const cutPath = (c: CanvasRenderingContext2D, pts: [number, number][], e: number, seed: string) => {
  c.beginPath();
  pts.forEach(([x, y], i) => {
    const jx = (rand(`${seed}:${e}:${i}x`) - 0.5) * 2.2, jy = (rand(`${seed}:${e}:${i}y`) - 0.5) * 2.2; // ±1.1 px boil
    if (i === 0) c.moveTo(x + jx, y + jy); else c.lineTo(x + jx, y + jy);
  });
  c.closePath();
};

const draw = (c: CanvasRenderingContext2D, f: number) => {
  const e = expo(f);
  const cam = 1.1 + 0.42 * Math.pow(1 - Math.min(1, f / 75), 2.1); // pull-out on ones
  c.fillStyle = '#efe6d2'; c.fillRect(0, 0, 960, 540);
  c.save(); c.translate(480, 270); c.scale(cam, cam); c.translate(-480, -270);
  c.save(); c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowOffsetX = 6; c.shadowOffsetY = 9; c.shadowBlur = 11;
  const beat = (f / 30) % 0.625 < 0.1 ? 0.88 : 1; // squash on 96 BPM
  c.translate(480, 400); c.scale(1, beat); c.translate(-480, -400);
  cutPath(c, [[400, 400], [560, 400], [580, 300], [380, 300]], e, 'kettle');
  c.fillStyle = '#d04b40'; c.fill(); c.restore(); c.restore();
  c.globalAlpha = 0.05 + (rand(`fl${e}`) - 0.5) * 0.05; c.fillStyle = '#000'; c.fillRect(0, 0, 960, 540); c.globalAlpha = 1; // exposure flicker
};

export const PaperStarter: React.FC = () => <CanvasComp draw={draw} w={960} h={540} />;
```
