# Typography

Demo comps: [`examples/src/tech/type.tsx`](../examples/src/tech/type.tsx). Each one is 960×540 @ 30 fps, 75 f, and also registered as its own composition, so you can render one with `npx remotion still src/index.ts <CompId> out.png --frame=50` from `examples/`.

Timings marked **@60** are 60 fps frame counts. Halve them for 30 fps (`f60(n)` in `lib/anim.ts`).

## T01 · Anchor + blur swap

- **Comp:** `T01-BlurSwap` (`examples/src/tech/type.tsx` → `BlurSwap`)
- **Used in:** [NxrStyle 02](../styles/NxrStyle-02-night-caption-explainer.md), [NxrStyle 07](../styles/NxrStyle-07-frost-collectible.md)
- **Build:** The anchor word is static. The swap slot holds one word at a time:
  - The new word enters with blur 12–20px→0, scale 1.25→1 and an x drift of 24px→0.
  - The old word exits with blur→14px and a −30px drift.
  - The anchor re-blurs about 6px for 3f on each swap, so the whole line feels hit.
- **Numbers:**
  - Fast: old 6f@60 E.in, new 14f@60 E.out.
  - Calm: about 0.13–0.2s in, 0.5s per phrase.
  - `blurIn(p,px)` reaches 0 at 60% progress, so the word is sharp before it stops moving.
- **Recipe:** `k=floor(f/per)`, `lf=f-k*per`, `pin=prog(lf,1,8,E.out)`, `pout=prog(lf,per-3,per,E.in)`. Pin the transform origin to the left so the anchor gap doesn't jump.

## T02 · Editorial grey→ink word build + highlighter

- **Comp:** `T02-EditorialHighlighter` (`examples/src/tech/type.tsx` → `EditorialHighlighter`)
- **Used in:** [NxrStyle 04](../styles/NxrStyle-04-editorial-ink.md), [NxrStyle 12](../styles/NxrStyle-12-console-as-film.md)
- **Build:** Words appear grey, rise 14px from a 6px blur, then their colour settles from grey 190 to ink 17 over about 6f. After the italic line lands, a yellow #f5f53a rectangle scales X from 0→1 behind it, origin left.
- **Numbers:** a word every 5f@30; ink 6f E.smooth; highlighter 10f E.ui.
- **Recipe:** Per word, `t0=start+i*5`. The highlighter is a separate absolutely positioned layer under the text, so the swipe never reflows type.

## T03 · Karaoke caption + count-up

- **Comp:** `T03-KaraokeCaption` (`examples/src/tech/type.tsx` → `KaraokeCaption`)
- **Used in:** [NxrStyle 02](../styles/NxrStyle-02-night-caption-explainer.md)
- **Build:** The sentence builds word by word. The newest word is white/800 and older ones fall to grey/600. A giant red number counts up above it ($1,803,192→$3,200,000).
- **Numbers:** a word every 0.27–0.4s (VO-synced); count-up E.type.
- **Recipe:** `n=floor(f/every)+1`, `newest=i===n-1`. Use `fontVariantNumeric:'tabular-nums'` on every counter, or the digits jitter sideways.

## T04 · Bracket word slam + arc blur

- **Comp:** `T04-BracketSlam` (`examples/src/tech/type.tsx` → `BracketSlam`)
- **Used in:** [NxrStyle 01](../styles/NxrStyle-01-beat-reel.md)
- **Build:**
  - Each word slams from 1.35× and blur 18→0 in 4f.
  - "FRAME" swings in on an arc: it rotates −28°→0 about a pivot far below (transform-origin 50% 600%). Its blur is proportional to angular velocity, so it is sharp at rest.
  - On the third slam the camera kicks with `hitPulse` (8px, attack 1, tau 4).
- **Numbers:** words hold about 0.27s; slam 4f E.out.
- **Recipe:** `vel=|θ(f)-θ(f-1)|`, `blur=min(14, vel*1.4)`. Velocity-driven blur is the cheap per-element motion blur.

## T05 · Masked baseline rise

- **Comp:** `T05-MaskRise` (`examples/src/tech/type.tsx` → `MaskRise`)
- **Used in:** [NxrStyle 04](../styles/NxrStyle-04-editorial-ink.md), [NxrStyle 13](../styles/NxrStyle-13-clean-launch-film.md)
- **Build:** Each line sits in an `overflow:hidden` box of exactly one line-height. The inner text translates Y 110%→0, and the exit goes 0→−110% with E.in.
- **Numbers:** 12f@60 E.out, travel 110%, stagger 6f@60.
- **Recipe:** Use percentages of the line box so it scales with font size.

## T06 · Type-on with human rhythm

- **Comp:** `T06-TypeOn` (`examples/src/tech/type.tsx` → `TypeOn`)
- **Used in:** —
- **Build:** A schedule array `at[i]` advances 1 char per frame, with a 1f hold every 2–3 chars (seeded). The caret is a solid bar with no blink while typing. The send button pulses when typing ends.
- **Numbers:** about 1 char/frame@30; holds every 2–3 chars.
- **Recipe:** Precompute the schedule from `rand(i)`, then `n=at.filter(x=>x<=f).length`. Never `floor(f*speed)`, which looks robotic.

## T07 · Scramble decode

- **Comp:** `T07-ScrambleDecode` (`examples/src/tech/type.tsx` → `ScrambleDecode`)
- **Used in:** [NxrStyle 09](../styles/NxrStyle-09-live-bento-grid.md), [NxrStyle 13](../styles/NxrStyle-13-clean-launch-film.md)
- **Build:** Each glyph cycles random characters until its lock frame. Locked glyphs turn white and unlocked ones stay grey. Punctuation never scrambles.
- **Numbers:** lock 1 glyph per 5f@60 (2.5f@30); glyph changes every 2f.
- **Recipe:** `rand(`${i}:${floor(f/2)}`)` picks the glyph. Seeding on `floor(f/2)` makes the scramble on twos.

## T08 · Pixel title blur-in + PRESS START blink

- **Comp:** `T08-PixelTitleBlink` (`examples/src/tech/type.tsx` → `PixelTitleBlink`)
- **Used in:** [NxrStyle 06](../styles/NxrStyle-06-press-start-menu.md), [NxrStyle 10](../styles/NxrStyle-10-pixel-bar-grid-trailer.md)
- **Build:**
  - A pixel display face with a 1-step hard drop shadow in a darker shade of the bg (`textShadow: 8px 8px 0 #1f47b8`).
  - The title blurs in 16px→0.
  - "PRESS START" blinks with an 8f period, then switches white→gold at about 1.6s.
- **Recipe:** `blinkOn = floor((f-24)/8)%2===0`. Use hard on/off, never a fade (game UI).

## T09 · 3D text ring

- **Comp:** `T09-TextRing` (`examples/src/tech/type.tsx` → `TextRing`)
- **Used in:** [NxrStyle 01](../styles/NxrStyle-01-beat-reel.md)
- **Build:** Each character is absolutely positioned with `rotateY(i/n·360°) translateZ(R)` inside a `preserve-3d` parent. The parent rotates Y at 2.2°/f, and its X tilt eases 70°→18°.
- **Gotcha**: never put opacity or filter on the `preserve-3d` element itself, or it flattens. Fade a wrapper instead.

