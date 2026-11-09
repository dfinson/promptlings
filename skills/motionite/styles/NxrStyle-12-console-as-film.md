# NxrStyle 12 · Console-as-Film

> The brand's own object is the world. Here that object is a handheld console: a warm paper field, a big serif with one italic phrase, a floating real capture of the console, a cartridge parade on the beat, and a dolly into the screen.

![NxrStyle 12 still](../examples/stills/NxrStyle-12-console-as-film.png)

Example comp: [`examples/src/styles/S12ConsoleFilm.tsx`](../examples/src/styles/S12ConsoleFilm.tsx) · id `NxrStyle12-ConsoleFilm` · 1920×1080 · 30 fps · 150 f

## Visual DNA
| Axis | Spec |
|---|---|
| Palette | NxrLabs paper `#f2efe6` with a subtle dot tooth · ink `#1b1b18` · **olive `#6b7a2a`** on the italic phrase · LCD green `#adbc77` / `#344b23` inside the screen · cartridge label colours as the only other hues. |
| Type | Space Mono 22 px for the eyebrow ("01 — THE HANDHELD PORTFOLIO"), Instrument Serif at 150 px for the headline with the italic second line in olive, and VT323 on the LCD. |
| Layout | Headline block on the left 55 %, the console floating on the right (centre x ≈ 1430), and the cart parade along the bottom left. |
| Motion | The console floats (y ± 6 px on a sine, rotate −11° ± 1°). Carts enter on eighth notes from `b(0,2)` with `SPR.snap`. An A-press pulse sits on bar 2. The dolly runs log 1→9 toward the LCD centre (`lmix`, `E.cam`) with a slight roll, ending on an LCD circle cover. |
| Transitions | The dolly into the screen **is** the transition. Inside the LCD the next scene opens with VT323 "PRESS START ▶". |
| Timing | `grid(128)`. Carts every half-beat (7 f), the A-press on a downbeat, and the dolly over 34 f (f112–146). |
| Audio | A 128 BPM chip-pop track, a cartridge "clack" per cart, a button click on the A-press, and a whoosh on the dolly. |

## Techniques
C04 Log-zoom world camera · T02 Editorial ink build · U06 Cursor press (A-button variant) · N01 Scramble counter · X03 Flood (circle-wipe colour floods) · U09 Card deal (cart parade).

## Do / Don't
- **Do** use the real product capture (transparent PNG) as the hero. Annotate it in code; don't redraw it.
- **Do** carry one object (the console) through every scene, so it connects them.
- **Do** keep the serif big and calm. The motion comes from the objects, not the type.
- **Don't** let the headline overlap the console. Give them separate columns.
- **Don't** put a URL or domain on screen unless the brief asks for one.
- **Don't** dolly linearly. Use log scale, or the end of the move crawls.

## Example brief
"A 5-second portfolio intro: a handheld console that holds 7 projects as cartridges."

| Frames | Beat |
|---|---|
| 0 | The eyebrow, "Small console. / *Endless curiosity.*" and the floating console are all on screen. |
| 28–80 | "7 cartridges. Built to be played." blurs in. Carts 1–5 parade in on eighth notes. |
| 98 | A-press pulse on the console. |
| 112–146 | Log dolly 1→9 into the LCD with a slight roll. |
| 140–150 | LCD circle cover, then VT323 "PRESS START ▶". |

## Remotion starter
```tsx
import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';
import {E, SPR, lmix, mix, prog, spr} from '../lib/anim';
import {Fill, grid} from './kit';

const {b} = grid(128);
const LCD = {x: 1430, y: 420}; // dolly target in frame coordinates

export const ConsoleStarter: React.FC = () => {
  const f = useCurrentFrame();
  const d = prog(f, 112, 146, E.cam);
  const s = lmix(1, 9, d);
  return (
    <Fill bg="#f2efe6">
      <div style={{position: 'absolute', inset: 0, transformOrigin: `${LCD.x}px ${LCD.y}px`, transform: `scale(${s}) rotate(${-4 * d}deg)`}}>
        <div style={{position: 'absolute', left: 140, top: 300, fontFamily: 'Instrument Serif', fontSize: 150, lineHeight: 1, color: '#1b1b18'}}>
          Small console.<br /><i style={{color: '#6b7a2a'}}>Endless curiosity.</i>
        </div>
        <Img src={staticFile('img/nxr-console.png')} style={{position: 'absolute', left: LCD.x - 240, top: 130 + Math.sin(f / 20) * 6, width: 480,
          transform: `rotate(${-11 + Math.sin(f / 30)}deg)`}} />
        {[1, 2, 3, 4, 5].map((n, i) => {
          const p = spr(f, b(0, 2) + i * 7, SPR.snap);
          return <Img key={n} src={staticFile(`img/nxr-cart-${n}.png`)} style={{position: 'absolute', left: 140 + i * 150, top: mix(1100, 760, p), width: 130}} />;
        })}
      </div>
    </Fill>
  );
};
```
