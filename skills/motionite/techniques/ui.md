# UI

Demo comps: [`examples/src/tech/ui.tsx`](../examples/src/tech/ui.tsx). Each one is 960×540 @ 30 fps, 75 f, and also registered as its own composition, so you can render one with `npx remotion still src/index.ts <CompId> out.png --frame=50` from `examples/`.

Timings marked **@60** are 60 fps frame counts. Halve them for 30 fps (`f60(n)` in `lib/anim.ts`).

## U01 · Tilted 3D phone + giant number + chips

- **Comp:** `U01-TiltedPhone` (`examples/src/tech/ui.tsx` → `TiltedPhone`)
- **Used in:** [NxrStyle 03](../styles/NxrStyle-03-floating-product-ui.md)
- **Build:**
  - The phone enters on SPR.soft from y+300, with rotateX 16→8 and rotateY −38→−18 (plus a ±2° breathing sine), and rotateZ 4°.
  - The number counts with E.type and sits outside the 3D context, so it stays crisp.
  - Chips pop with SPR.pop, staggered.
  - The slider knob runs 12f E.ui, and the label fades as it travels.
  - The screen turns green and the check pops.

## U02 · Chip-flip grid on beat

- **Comp:** `U02-ChipFlipGrid` (`examples/src/tech/ui.tsx` → `ChipFlipGrid`)
- **Used in:** [NxrStyle 09](../styles/NxrStyle-09-live-bento-grid.md)
- **Build:** Each tile runs a 5f E.inOut rotateY. The face content swaps at p=0.5 and the angle is re-based (`ang−180`), so the back face is never mirrored. A 10% hitPulse fires on landing.
- **Numbers:** 10f@60, swap at f5.

## U03 · Stat tiles with LV tick

- **Comp:** `U03-StatTiles` (`examples/src/tech/ui.tsx` → `StatTiles`)
- **Used in:** [NxrStyle 06](../styles/NxrStyle-06-press-start-menu.md)
- **Build:** The tiles hard-cut in, staggered 3f. LV steps every 3f with a 25% hitPulse per step, and the bar fills in steps (no tween). That is the game-UI language.

## U04 · HUD bounding box + shape morph

- **Comp:** `U04-HudShapeMorph` (`examples/src/tech/ui.tsx` → `HudShapeMorph`)
- **Used in:** [NxrStyle 01](../styles/NxrStyle-01-beat-reel.md), [NxrStyle 09](../styles/NxrStyle-09-live-bento-grid.md)
- **Build:** Every shape is a polar radius function r(a), sampled at 120 points. A morph is `mix(r_k(a), r_{k+1}(a), p)`, so the vertex count is always the same and there are no SVG path-interpolation artefacts. The colour swaps at p=.5.
  - Squircle: `1/(|cos|^4+|sin|^4)^.25`.
  - Triangle: `0.62/cos(b)`.
  - Flower: `0.75+0.25cos6a`.

## U05 · UI-state morph: button → loader → check → pill

- **Comp:** `U05-UiStateMorph` (`examples/src/tech/ui.tsx` → `UiStateMorph`)
- **Used in:** [NxrStyle 03](../styles/NxrStyle-03-floating-product-ui.md)
- **Build:**
  - Width is `track(f,260,[[10,64],[44,340]])`, a sum of springs, so a retarget mid-move never pops.
  - The label has its own blur in/out.
  - The spinner is a dashed circle rotating 24°/f.
  - The check is a stroke-dashoffset draw.
  - The colour switches on the state frame.

## U06 · Cursor glide, hover, press

- **Comp:** `U06-CursorPress` (`examples/src/tech/ui.tsx` → `CursorPress`)
- **Used in:** [NxrStyle 03](../styles/NxrStyle-03-floating-product-ui.md), [NxrStyle 12](../styles/NxrStyle-12-console-as-film.md)
- **Build:**
  - The cursor path is E.glide with a sine arc (cursors never travel straight).
  - Hover lifts the button 4px and grows its shadow.
  - On press, the button scales −7% and the cursor −15% (hitPulse).
  - A ripple ring expands and fades over 12f.

## U07 · Two-edge spring toggle

- **Comp:** `U07-TwoEdgeToggle` (`examples/src/tech/ui.tsx` → `TwoEdgeToggle`)
- **Used in:** [NxrStyle 09](../styles/NxrStyle-09-live-bento-grid.md)
- **Build:** The L and R edges are each a sum of springs. The edge in the direction of travel uses a stiff spring (420/22) and the trailing edge a soft one (140/20). The pill stretches, then catches up.

## U08 · Orbit icons with depth

- **Comp:** `U08-OrbitIcons` (`examples/src/tech/ui.tsx` → `OrbitIcons`)
- **Used in:** [NxrStyle 07](../styles/NxrStyle-07-frost-collectible.md)
- **Build:**
  - Ellipse orbit with `z=sin(a)`.
  - z drives scale (.6–1.2), blur (back only, ≤3px) and opacity.
  - Items with z<0 render *before* the wordmark and z≥0 *after* it. That draw-order split is the whole trick.

## U09 · Card deal → scatter + counter

- **Comp:** `U09-CardDealScatter` (`examples/src/tech/ui.tsx` → `CardDealScatter`)
- **Used in:** [NxrStyle 04](../styles/NxrStyle-04-editorial-ink.md), [NxrStyle 12](../styles/NxrStyle-12-console-as-film.md), [NxrStyle 13](../styles/NxrStyle-13-clean-launch-film.md)
- **Build:** Each card is `mix(mix(deck, grid, spring), scatter, sc)`. The scatter position and rotation are seeded. The counter fades in as the cloud forms.

## U10 · Card flip face swap + specular sweep

- **Comp:** `U10-FlipSpecular` (`examples/src/tech/ui.tsx` → `FlipSpecular`)
- **Used in:** [NxrStyle 07](../styles/NxrStyle-07-frost-collectible.md)
- **Build:** A flip with the face swapped at the midpoint, then a 110° linear-gradient highlight band moves −40%→140% across the card.

## U11 · Floating UI cards on a darkened world

- **Comp:** `U11-FloatingCards` (`examples/src/tech/ui.tsx` → `FloatingCards`)
- **Used in:** [NxrStyle 05](../styles/NxrStyle-05-one-pan-flat-world.md), [NxrStyle 08](../styles/NxrStyle-08-duotone-storybook.md)
- **Build:** White cards with a 30/50px shadow and slight `rotateY/rotateX`, entering on SPR.soft staggered 6f. Each bobs on its own sine phase.

