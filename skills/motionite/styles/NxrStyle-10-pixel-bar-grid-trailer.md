# NxrStyle 10 · Pixel Bar-Grid Trailer

> A footage-led pixel game trailer. The game world is the hero, cuts land on bar lines, the parallax plates are separated by value and temperature, transitions are dithered, and it moves from silence to a slam.

![NxrStyle 10 still](../examples/stills/NxrStyle-10-pixel-bar-grid-trailer.png)

Example comp: [`examples/src/styles/S10PixelTrailer.tsx`](../examples/src/styles/S10PixelTrailer.tsx) · id `NxrStyle10-PixelTrailer` · 1920×1080 (a 320×180 canvas ×6, nearest-neighbour) · 30 fps · 120 f (2 bars at 120 BPM)

## Visual DNA
| Axis | Spec |
|---|---|
| Palette | A 16–24 colour limited palette. The sunset sky is Bayer-dithered between bands (`#1a1c2c` → `#5d275d` → `#b13e53` → `#ef7d57` → `#ffcd75`). Far ridges are cool and flat, foreground warm and saturated. Lanterns are the hot accent. |
| Type | A classic RPG lower-third is small italic serif. Inside a pixel world, use Pixelify Sans for the "~ place line ~" and Pixelify Sans Bold caps for the place name and the title slam. Keep Silkscreen for tiny labels (CHAPTER II) only: **its "M" reads as "H" at display sizes** (e.g. "MEMO" → "HEHO"). |
| Layout | A letterbox (bars about 8 % of the height each). Lower-third at the lower right, clear of the hero. Chapter label at the top left. |
| Motion | Draw at native resolution (320×180) and upscale with `imageRendering: 'pixelated'`. Sprites move in whole pixels, the camera may be smooth, the hero bobs 1 px, and lanterns flicker on a seeded schedule. |
| Transitions | **One language per film.** Here it is the ordered-dither dissolve `covered = p > bayer4(x,y)`, plus a white flash stutter capped at 65–85 % (never a blank frame), used at most twice. |
| Timing | 120 BPM: beat 15 f, bar 60 f. Every cut on a beat, stutters at 3–4 f. Tempo contrast: one slow bar, one stop (6 f of near-silence), one burst. |
| Audio | A score written to the edit (intro/build/stop/burst/title), not a loop. Flashes **are** the hits. Measure onset vs event in ms. |

## Techniques
H04 Mosaic resolve · X02/X07 (iris, drawn in pixel steps) · C02 Parallax truck · C03 Impact kick + capped flash · T08 Pixel title · R09 Subframe motion blur (for camera moves only).

## Do / Don't
- **Do** use real game capture as the hero when it exists. Code-built plates are the fallback, built as 4–6 layers.
- **Do** let a single lower-third template repeat on rhythm.
- **Do** round sprite positions: `Math.round(x / px) * px`.
- **Don't** Ken Burns flat screenshots. A zoom on a flat image has no depth cue, so it reads as a slideshow.
- **Don't** loop 8 s of chiptune under everything. The score has to have structure.
- **Don't** smooth the vector boil inside the pixel world. Quantise any jitter to whole pixels.

## Example brief
"A 4-second chapter teaser for a pixel RPG: a lantern road at sunset, then the title."

| Frames | Beat |
|---|---|
| 0 | The sunset plaza, already panning, with the hero mid-bob and the letterbox in place. |
| 6–50 | Lower-third: "~ a road of lanterns ~" / "TEMPLE PLAZA". "CHAPTER II" sits at the top left. |
| 50–60 | Dither-out on the last beat of bar 1. |
| 60–66 | 6 f of silence (near-black). |
| 66 | The title slams in with 2 flash stutters at 0.7 opacity, 3 f apart. |
| 80–120 | "coming 2027 · wishlist now". Hold. |

## Remotion starter
```tsx
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {CanvasComp} from '../lib/canvas';

const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer4 = (x: number, y: number) => (B4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
const BANDS = ['#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75'];

const draw = (c: CanvasRenderingContext2D, f: number) => {
  for (let y = 0; y < 180; y++) {
    const t = (y / 120) * (BANDS.length - 1);
    const i = Math.min(BANDS.length - 2, Math.floor(t));
    for (let x = 0; x < 320; x++) {
      c.fillStyle = t - i > bayer4(x, y) ? BANDS[i + 1] : BANDS[i]; // ordered dither between bands
      c.fillRect(x, y, 1, 1);
    }
  }
  const camX = Math.round(f * 0.5); // whole-pixel camera on this plate
  c.fillStyle = '#29366f';
  for (let x = 0; x < 320; x++) c.fillRect(x, 120 + Math.round(8 * Math.sin((x + camX) / 23)), 1, 60);
  const p = Math.min(1, Math.max(0, (f - 50) / 10)); // dither-out on the last beat of the bar
  c.fillStyle = '#000';
  for (let y = 0; y < 180; y++) for (let x = 0; x < 320; x++) if (p > bayer4(x, y)) c.fillRect(x, y, 1, 1);
};

export const PixelTrailerStarter: React.FC = () => {
  useCurrentFrame();
  return (
    // image-rendering is inherited, so the 320x180 canvas stretched to 100% stays crisp
    <div style={{position: 'relative', width: 1920, height: 1080, imageRendering: 'pixelated'}}>
      <CanvasComp draw={draw} w={320} h={180} />
    </div>
  );
};
```
