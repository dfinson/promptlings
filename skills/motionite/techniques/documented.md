# Documented techniques (R01–R22)

These recipes have no demo comp. Each recipe is specific enough to build. When you build one, add it to `examples/src/tech/` and `registry.ts` and keep its R-ID.

| ID | Technique | Recipe | Used in |
|---|---|---|---|
| R01 | Goo / metaball merge | SVG `feGaussianBlur` 10 → `feColorMatrix` alpha `0 0 0 18 −7` (threshold); blobs are plain circles | — |
| R02 | Liquid glass with chromatic edge | 3 × `feDisplacementMap` (R/G/B offset scales) on a backdrop copy; glass = 14px body blur + a 1.06× magnified 12px edge band | — |
| R03 | Frosted glass | blurred + lightened copy of the backdrop, clipped to the card shape (never `backdrop-filter` in headless renders) | [03](../styles/NxrStyle-03-floating-product-ui.md) |
| R04 | Variable-font squeeze | animate `font-variation-settings: 'wdth'` on the wordmark instead of scaleX, so stems keep their weight | — |
| R05 | 6-blade iris | 6 rotated rectangles around a hexagonal aperture; blade angle drives the aperture radius | — |
| R06 | Zoom smear wordmark | 20–30 scaled, faded copies (width 1650→1350→1110→1049→734…) | [11](../styles/NxrStyle-11-one-take-portal-zoom.md) |
| R07 | 3D page fly-over | camera 56° tilt, focal 1880; speed integrated into position (cruise ≈770 px/s, 0→.5 by 0.6s, →1 by 1.6s, ease to .12); shadow offset (0.10z, 4+0.36z), blur 7+0.5z, 26% | — |
| R08 | Ribbon tube loop | sweep a circle cross-section along a closed Lissajous curve; shade by normal·light | — |
| R09 | Subframe motion blur | render N subframes (f+i/N), `ffmpeg -vf tmix=frames=8` | [10](../styles/NxrStyle-10-pixel-bar-grid-trailer.md) |
| R10 | Halftone portraits | dot radius from image luminance sampled per cell; dots also react to the hero object | [04](../styles/NxrStyle-04-editorial-ink.md) |
| R11 | Ripple ring | a new ring every 4 drawn frames, expanding ~260 px/s, alpha falls with radius | [15](../styles/NxrStyle-15-hand-drawn-ink.md) |
| R12 | Tally marks | one stroke every 3 drawn frames; the 5th is the diagonal | [15](../styles/NxrStyle-15-hand-drawn-ink.md) |
| R13 | Torn-paper edge wipe | noise-displaced edge swept across the frame | [14](../styles/NxrStyle-14-paper-stop-motion.md) |
| R14 | Doodle-on-photos | 5 misreadings: shape rhyme, scale flip, literal function, extend emission, carry it | [15](../styles/NxrStyle-15-hand-drawn-ink.md) |
| R15 | Found motion | rotoscope public-domain motion-study photo plates into line drawings | [15](../styles/NxrStyle-15-hand-drawn-ink.md) |
| R16 | Sand animation | a stateful sand bed rebuilt deterministically at 1/48s steps; dark = sand, light = glass | [15](../styles/NxrStyle-15-hand-drawn-ink.md) |
| R17 | Paper 3D book | `book3` page turns, shade by angle, `shadow3` | [14](../styles/NxrStyle-14-paper-stop-motion.md) |
| R18 | Bento grid of live loops | every tile is its own `<Sequence>` looping with `f % len`; all live at frame 0 | [09](../styles/NxrStyle-09-live-bento-grid.md) |
| R19 | Logo chain with chevron | logos slide in on a shared baseline joined by `›`; the last one gets the brand colour | [03](../styles/NxrStyle-03-floating-product-ui.md), [05](../styles/NxrStyle-05-one-pan-flat-world.md) |
| R20 | Speech bubbles | bubble scales from its tail point (transform-origin at the tail), SPR.pop | [08](../styles/NxrStyle-08-duotone-storybook.md) |
| R21 | Real UI flying forward | the success card translates Z +400 with scale-up and a growing shadow, E.out 14f | [03](../styles/NxrStyle-03-floating-product-ui.md) |
| R22 | Lyric-sync type | every sung word on screen at its time; a single `calm` knob scales motion amplitude | — |

