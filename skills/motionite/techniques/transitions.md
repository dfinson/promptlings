# Transitions

Demo comps: [`examples/src/tech/transitions.tsx`](../examples/src/tech/transitions.tsx). Each one is 960×540 @ 30 fps, 75 f, and also registered as its own composition, so you can render one with `npx remotion still src/index.ts <CompId> out.png --frame=50` from `examples/`.

Timings marked **@60** are 60 fps frame counts. Halve them for 30 fps (`f60(n)` in `lib/anim.ts`).

## X01 · Vertical smear wipe

- **Comp:** `X01-SmearWipe` (`examples/src/tech/transitions.tsx` → `SmearWipe`)
- **Used in:** [NxrStyle 06](../styles/NxrStyle-06-press-start-menu.md)
- **Build:**
  - The outgoing scene translates up 260px, scaleY 1→1.6, with a vertical-only gaussian blur (`feGaussianBlur stdDeviation="0 60"`) over 3f E.in.
  - The incoming scene arrives smeared from below over 3–4f E.out.
  - The total device is 6f@30 (0.2s).
- **Recipe:** Precompute 11 SVG filters `vb0..vb10` and pick one per frame (CSS `blur()` can't be directional).

## X02 · Iris punch-through with glyph knockout

- **Comp:** `X02-IrisPunch` (`examples/src/tech/transitions.tsx` → `IrisPunch`)
- **Used in:** [NxrStyle 01](../styles/NxrStyle-01-beat-reel.md), [NxrStyle 10](../styles/NxrStyle-10-pixel-bar-grid-trailer.md), [NxrStyle 11](../styles/NxrStyle-11-one-take-portal-zoom.md)
- **Build:**
  1. Eight red dots expand into a ring (14f E.out) while rotating.
  2. They gather to the centre (E.in).
  3. A circle seeds and grows **geometrically**, `r=30·1.27^(f−26)`, with an SVG mask knocking out a giant "E".
  4. The mask is dropped once r > 700, and "EVERY" slams in on the new field.
- **Why geometric:** constant ratio per frame = constant perceived speed (the log law).

## X03 · Flood from a button, then contract

- **Comp:** `X03-FloodContract` (`examples/src/tech/transitions.tsx` → `FloodContract`)
- **Used in:** [NxrStyle 03](../styles/NxrStyle-03-floating-product-ui.md), [NxrStyle 12](../styles/NxrStyle-12-console-as-film.md)
- **Build:**
  1. The button press is 1→0.92 (hitPulse).
  2. A disc from the button centre grows to `hypot(480,270)·1.15` in 11f E.in.
  3. The next message holds, then the disc contracts with E.out into the next object (a check pill).
- **Gotcha:** text inside a morphing container needs its own in/out timing (here opacity 24–30, 38–42).

## X04 · Scale-through cut

- **Comp:** `X04-ScaleThroughCut` (`examples/src/tech/transitions.tsx` → `ScaleThroughCut`)
- **Used in:** [NxrStyle 13](../styles/NxrStyle-13-clean-launch-film.md)
- **Build:** The exit scales 1→0.75 with blur 0→6 over 10f E.in. Hard cut. The entry scales 1.85→1 in **log space** with blur 8→0 over 18f E.out.
- **Numbers:** exit 16–24f@60 to .7–.8; entry 1.7–2→1 over 30–40f@60.

## X05 · Polarity flip + rubber stamp

- **Comp:** `X05-PolarityStamp` (`examples/src/tech/transitions.tsx` → `PolarityStamp`)
- **Used in:** [NxrStyle 02](../styles/NxrStyle-02-night-caption-explainer.md)
- **Build:**
  - A hard cut from #0a0a0a to #ecebe6, then the card rises (SPR.snap) and rows check in, staggered 4f.
  - The stamp drops from 2.2× to 1 with SPR.land, rotated −12°, `mix-blend-mode:multiply`, opacity 0.9 so the card shows through like ink.

## X06 · Strobe sting

- **Comp:** `X06-StrobeSting` (`examples/src/tech/transitions.tsx` → `StrobeSting`)
- **Used in:** [NxrStyle 01](../styles/NxrStyle-01-beat-reel.md)
- **Build:** Each hold swaps both the field colour and the word. The ink flips to stay legible. The device ends on a resolved card.
- **Rule:** it's a sting, so use it once.

## X07 · Ink-blot reveal

- **Comp:** `X07-InkBlot` (`examples/src/tech/transitions.tsx` → `InkBlot`)
- **Used in:** [NxrStyle 10](../styles/NxrStyle-10-pixel-bar-grid-trailer.md), [NxrStyle 15](../styles/NxrStyle-15-hand-drawn-ink.md)
- **Build:** An SVG `clipPath` polygon of 90 points with radius `R·(1+0.18·rand + 0.06·sin(7a+floor(f/2)))`. The edge redraws on twos (boil). It reveals a blueprint layer.
- **Rule:** transitions are *drawn* (blot, iris, ripple, torn edge), never cross-dissolved.

## X08 · Whip pan

- **Comp:** `X08-WhipPan` (`examples/src/tech/transitions.tsx` → `WhipPan`)
- **Used in:** —
- **Build:** A two-panel strip translates −960px over 20f with E.whip. Horizontal blur = `min(10, round(v/12))` picks `hb0..hb10` (stdDeviation `x 0`). So the blur exists only while it moves.
- **Pro variant**: real motion blur. Render 4–8 subframes per frame and blend with ffmpeg `tmix` (4 ghosts, 8 recommended).

