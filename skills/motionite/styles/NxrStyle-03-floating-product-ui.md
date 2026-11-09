# NxrStyle 03 · Floating Product UI

> The real app UI is the hero: a phone tilted in 3D, a giant number overlapping the device, and chips that detach and float.

![NxrStyle 03 still](../examples/stills/NxrStyle-03-floating-product-ui.png)

Example comp: [`examples/src/styles/S03FloatingProduct.tsx`](../examples/src/styles/S03FloatingProduct.tsx) · id `NxrStyle03-FloatingProduct` · 1920×1080 · 30 fps · 130 f

## Visual DNA
| Axis | Spec |
|---|---|
| Palette | stage `#0b1a1f` with a radial teal glow `#0f3a40` · white UI · **cyan `#3ee6e0`** for the key words in the caption · success green `#22c55e` |
| Type | Rounded geometric sans (DM Sans 700) for UI and captions. The giant number is at least 1.4× the phone's height in visual weight, with the unit (`IDR`) in grey at about 40 % size. |
| Layout | A persistent header chip ("› Kopi Wallet") at the top left, the phone left of centre, the number overlapping the phone's right edge, and a 2-line caption at the bottom centre. |
| Motion | The phone enters on `SPR.soft` from y+300 with rotateX 16→8, rotateY −38→−18 (±2° breathing) and rotateZ 4°. Chips pop on `SPR.pop` to 1.12–1.15× and then return. The slide-to-pay knob takes 12 f `E.ui`. |
| Transitions | None needed. One continuous shot with a success **circle reveal** from the button (X03 flood → contract). |
| Timing | The number counts with `E.type` over about 30 f. A chip detaches every 15–20 f. |
| Shadows | `0 30px 60px rgba(0,0,0,.25)` on cards. The number sits **outside** the 3D context so it stays crisp. |
| Audio | A soft UI click on each chip pop, a riser into "Paid", and a coin chime on the cashback. |

## Techniques
U01 Tilted phone + giant number + chips · X03 Flood/contract · U05 UI-state morph · U06 Cursor press · R21 Real UI flying forward · R19 Logo chain with chevron · R03 Frosted glass (for glass cards).

## Do / Don't
- **Do** use real screens or faithful rebuilds of the actual app. Never invent features.
- **Do** let the number be bigger than the product. It is the headline.
- **Do** keep text inside morphing containers on its own in/out timing.
- **Don't** put `opacity` or `filter` on a `preserve-3d` element. Fade a wrapper instead.
- **Don't** put `will-change` on camera-scaled text; it rasterises blurry.
- **Don't** use `backdrop-filter` in headless renders. Fake glass with a blurred copy of the backdrop.

## Example brief
"A 4-second clip: paying for coffee with a crypto wallet QR, showing IDR→USDC and the cashback."

| Frames | Beat |
|---|---|
| 0 | The header chip, the phone (already tilted) and the QR screen are all visible, so frame 0 works as the poster. |
| 8–40 | "54.000 IDR" counts up over the phone. "≈ 3.0312 USDC · fee 0" blurs in below it. |
| 30–50 | The "Scan Pay" chip detaches and floats at 1.12×. |
| 50–80 | Caption: "Scan, slide, done. No cash, no change." (key words in cyan). |
| 80–94 | The slide-to-pay knob runs. |
| 94–110 | A green circle reveals "Paid" from the knob. |
| 100–130 | The "+1 PTS cashback" chip pops. Hold. |

## Remotion starter
```tsx
import React from 'react';
import {useCurrentFrame} from 'remotion';
import {E, SPR, mix, spr, tw} from '../lib/anim';
import {Fill} from './kit';

export const FloatingProductStarter: React.FC = () => {
  const f = useCurrentFrame();
  const enter = spr(f, 0, SPR.soft);
  const breathe = Math.sin(f / 18) * 2;
  const amount = Math.round(tw(f, 8, 40, 0, 54000, E.type));
  const chip = spr(f, 30, SPR.pop);
  return (
    <Fill bg="radial-gradient(circle at 40% 50%, #0f3a40 0%, #0b1a1f 60%)">
      <div style={{position: 'absolute', left: 420, top: 140, perspective: 1600}}>
        <div style={{width: 380, height: 780, borderRadius: 56, background: '#fff', boxShadow: '0 30px 60px rgba(0,0,0,.25)',
          transform: `translateY(${mix(300, 0, enter)}px) rotateX(${mix(16, 8, enter)}deg) rotateY(${mix(-38, -18, enter) + breathe}deg) rotateZ(4deg)`}} />
      </div>
      {/* outside the 3D context: stays crisp */}
      <div style={{position: 'absolute', left: 700, top: 380, fontFamily: 'DM Sans', fontWeight: 700, fontSize: 190, color: '#fff', fontVariantNumeric: 'tabular-nums'}}>
        {amount.toLocaleString('id-ID')} <span style={{fontSize: 80, color: '#7f9a9e'}}>IDR</span>
      </div>
      <div style={{position: 'absolute', left: 860, top: 260, padding: '14px 26px', borderRadius: 40, background: '#fff', fontFamily: 'DM Sans', fontWeight: 700, fontSize: 34,
        transform: `scale(${mix(0.6, 1.12, chip)})`, opacity: Math.min(1, chip * 2)}}>Scan Pay</div>
    </Fill>
  );
};
```
