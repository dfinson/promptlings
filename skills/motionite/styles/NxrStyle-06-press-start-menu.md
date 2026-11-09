# NxrStyle 06 · PRESS START Game Menu

> The product framed as a retro game menu: flat 8-bit colour bands, chunky pixel type with a hard drop shadow, stepped motion on whole pixels, and a blinking prompt.

![NxrStyle 06 still](../examples/stills/NxrStyle-06-press-start-menu.png)

Example comp: [`examples/src/styles/S06PressStart.tsx`](../examples/src/styles/S06PressStart.tsx) · id `NxrStyle06-PressStart` · 1920×1080 · 30 fps · 150 f

## Visual DNA
| Axis | Spec |
|---|---|
| Palette | Sweetie-16-ish: sky bands `#3b5dc9` / `#41a6f6` / `#73eff7`, grass `#38b764`, gold `#ffcd75`, ink `#1a1c2c`, white. **Every scene is one flat field.** |
| Type | "Press Start 2P" for titles (**quote the family name: `'"Press Start 2P"'`**, because names with digits otherwise fall back to a serif). Silkscreen for small UI. Hard drop shadow one step down-right in a darker shade of the field (`8px 8px 0 #1f47b8`). |
| Layout | Title in the upper third, centred. PRESS START at about 62 % of height. A sprite party standing on the ground line. Copyright line at the bottom. |
| Motion | Everything snaps to `PX = 8`: `Math.round(x / PX) * PX`. Sprites bob in 1-pixel steps. The blink is a hard on/off with an 8 f period, **never a fade**. The camera can be smooth, but sprites snap. |
| Transitions | Vertical smear wipe (X01, 6 f): the old scene goes up 260 px with scaleY 1.6 and a `stdDeviation="0 60"` blur. Alternatives: dither dissolve, iris. |
| Timing | Stat tiles hard-cut in staggered 3 f. LV steps every 3 f with a 25 % hitPulse per step, and bars fill in steps. |
| Audio | Chiptune (square + triangle + noise). A blip per menu move and a fanfare on LEVEL UP!. |

## Techniques
T08 Pixel title + PRESS START blink · X01 Vertical smear wipe · U03 Stat tiles LV tick · H04 Mosaic resolve · H06 Cadence (UI on ones, sprites on twos).

## Do / Don't
- **Do** use game-menu metaphors as the narrative: PRESS START, CHOOSE YOUR …, LEVEL 1, LEVEL UP!, stat tiles.
- **Do** draw sprites as string maps rendered with `shapeRendering="crispEdges"` (see `Sprite` in `kit.tsx`).
- **Do** keep scenes bright and flat.
- **Don't** use murky dark-green full frames with small pixel text, or a "cinematic" grade. That is the failure mode this style replaces.
- **Don't** do sub-pixel easing on sprites or pixel type.
- **Don't** fade the PRESS START prompt in and out. It blinks.

## Example brief
"A 5-second title screen for a motion-design skill, presented as a retro game."

| Frames | Beat |
|---|---|
| 0 | Sky bands, pixel clouds, the "MOTIONITE / QUEST" title and the sprite party are all on screen. |
| 0–12 | The title blurs in 16→0, already readable at frame 0 under the blur. |
| 24–62 | PRESS START blinks on an 8 f period; it turns gold at f40. |
| 62–68 | Vertical smear wipe. |
| 72–150 | LEVEL UP! on yellow, then ATK / DEF / SPD / LUCK tiles slide in from different edges, staggered, with LV ticking 1→5. |

## Remotion starter
```tsx
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {Fill, SPRITES, Sprite} from './kit';

const PX = 8;
const snap = (v: number) => Math.round(v / PX) * PX;

export const PressStartStarter: React.FC = () => {
  const f = useCurrentFrame();
  const blinkOn = f < 24 || Math.floor((f - 24) / 8) % 2 === 0;
  const bob = snap(Math.sin(f / 6) * PX); // whole-pixel steps only
  return (
    <Fill bg="linear-gradient(#3b5dc9 0 33%, #41a6f6 33% 66%, #73eff7 66% 100%)">
      <div style={{position: 'absolute', top: 220, width: '100%', textAlign: 'center', fontFamily: '"Press Start 2P"', fontSize: 120, color: '#fff', textShadow: '8px 8px 0 #1f47b8'}}>MOTIONITE</div>
      <div style={{position: 'absolute', top: 650, width: '100%', textAlign: 'center', fontFamily: '"Press Start 2P"', fontSize: 40,
        color: f > 40 ? '#ffcd75' : '#fff', visibility: blinkOn ? 'visible' : 'hidden'}}>PRESS START</div>
      <Sprite map={SPRITES.hero} pal={{k: '#1a1c2c', y: '#ffcd75', s: '#f4b183', e: '#1a1c2c', b: '#3b5dc9'}} px={PX} x={snap(880)} y={snap(820) + bob} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 160, background: '#38b764'}} />
    </Fill>
  );
};
```
