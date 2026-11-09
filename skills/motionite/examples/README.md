# Motionite examples (Remotion 4)

A working Remotion project with **48 technique demo comps** and **one example comp per NxrStyle**. Every still and sheet in this repo was rendered from it.

```bash
npm ci
npm run studio          # Remotion Studio: folders "NxrStyles" and "Techniques"
npm run typecheck
npm run stills          # re-render examples/stills/*.png (scripts/render-stills.sh)
npm run reel            # out/technique-reel.mp4: all 48 techniques, 2.5 s each, with ID labels
npx remotion still src/index.ts NxrStyle14-PaperStopMotion out/s14.png --frame=75
```

## Layout

| Path | What |
|---|---|
| `src/lib/anim.ts` | Motion tokens: easings `E`, springs `SPR`, `tw`, `prog`, `spr`, `lmix` (log scale), `track` (sum of springs), `hitPulse`, `blurIn/blurOut`, `squash`, `rand` (FNV, seeded), `stagger`, `inertia`, `onTwos`, `f60`. **Copy this file into any project.** |
| `src/lib/canvas.tsx` | `CanvasComp({draw, w, h})`, where `draw(ctx, frame)` is a pure function of the frame |
| `src/lib/ui.tsx` | `Stage`, `Center`, `Brackets` helpers used by the technique comps |
| `src/lib/fonts.ts` | Loads the local woff2 fonts in `public/fonts` |
| `src/tech/*.tsx` | The 48 technique comps, by family: `type`, `data`, `transitions`, `camera`, `ui`, `drawn` |
| `src/registry.ts` | Technique registry: ID, name, category, component |
| `src/styles/S01…S15*.tsx` | One example comp per NxrStyle |
| `src/styles/kit.tsx` | Shared style helpers: `grid(bpm)` beat grid, `Fill`, `BlurWords`, `Corners`, `Mono`, `Sprite` + pixel `SPRITES` |
| `src/styles/registry.ts` | Style registry: comp id, size, duration, still frame |
| `stills/` | One PNG per style (1280 px wide for 16:9, 720 px for 9:16 and 1:1) |

## NxrStyle comps

| # | Style | Comp id | File | Size | Duration | Still frame | Still |
|---|---|---|---|---|---|---|---|
| 01 | [Beat Reel](../styles/NxrStyle-01-beat-reel.md) | `NxrStyle01-BeatReel` | [`S01BeatReel.tsx`](src/styles/S01BeatReel.tsx) | 1920×1080 | 225 f | 92 | [png](stills/NxrStyle-01-beat-reel.png) |
| 02 | [Night Caption Explainer](../styles/NxrStyle-02-night-caption-explainer.md) | `NxrStyle02-NightCaption` | [`S02CaptionExplainer.tsx`](src/styles/S02CaptionExplainer.tsx) | 1080×1920 | 160 f | 72 | [png](stills/NxrStyle-02-night-caption-explainer.png) |
| 03 | [Floating Product UI](../styles/NxrStyle-03-floating-product-ui.md) | `NxrStyle03-FloatingProduct` | [`S03FloatingProduct.tsx`](src/styles/S03FloatingProduct.tsx) | 1920×1080 | 130 f | 92 | [png](stills/NxrStyle-03-floating-product-ui.png) |
| 04 | [Editorial Ink](../styles/NxrStyle-04-editorial-ink.md) | `NxrStyle04-EditorialInk` | [`S04EditorialInk.tsx`](src/styles/S04EditorialInk.tsx) | 1920×1080 | 120 f | 96 | [png](stills/NxrStyle-04-editorial-ink.png) |
| 05 | [One-Pan Flat World](../styles/NxrStyle-05-one-pan-flat-world.md) | `NxrStyle05-WorldPan` | [`S05WorldPan.tsx`](src/styles/S05WorldPan.tsx) | 1920×1080 | 150 f | 75 | [png](stills/NxrStyle-05-one-pan-flat-world.png) |
| 06 | [PRESS START Game Menu](../styles/NxrStyle-06-press-start-menu.md) | `NxrStyle06-PressStart` | [`S06PressStart.tsx`](src/styles/S06PressStart.tsx) | 1920×1080 | 150 f | 40 | [png](stills/NxrStyle-06-press-start-menu.png) |
| 07 | [Frost Collectible](../styles/NxrStyle-07-frost-collectible.md) | `NxrStyle07-FrostCollectible` | [`S07FrostCollectible.tsx`](src/styles/S07FrostCollectible.tsx) | 1920×1080 | 120 f | 62 | [png](stills/NxrStyle-07-frost-collectible.png) |
| 08 | [Duotone Storybook](../styles/NxrStyle-08-duotone-storybook.md) | `NxrStyle08-DuotoneStorybook` | [`S08DuotoneStorybook.tsx`](src/styles/S08DuotoneStorybook.tsx) | 1920×1080 | 150 f | 70 | [png](stills/NxrStyle-08-duotone-storybook.png) |
| 09 | [Live Bento Grid](../styles/NxrStyle-09-live-bento-grid.md) | `NxrStyle09-LiveGrid` | [`S09LiveGrid.tsx`](src/styles/S09LiveGrid.tsx) | 1080×1080 | 180 f | 70 | [png](stills/NxrStyle-09-live-bento-grid.png) |
| 10 | [Pixel Bar-Grid Trailer](../styles/NxrStyle-10-pixel-bar-grid-trailer.md) | `NxrStyle10-PixelTrailer` | [`S10PixelTrailer.tsx`](src/styles/S10PixelTrailer.tsx) | 1920×1080 | 120 f | 36 | [png](stills/NxrStyle-10-pixel-bar-grid-trailer.png) |
| 11 | [One-Take Portal Zoom](../styles/NxrStyle-11-one-take-portal-zoom.md) | `NxrStyle11-PortalZoom` | [`S11PortalZoom.tsx`](src/styles/S11PortalZoom.tsx) | 1920×1080 | 150 f | 22 | [png](stills/NxrStyle-11-one-take-portal-zoom.png) |
| 12 | [Console-as-Film](../styles/NxrStyle-12-console-as-film.md) | `NxrStyle12-ConsoleFilm` | [`S12ConsoleFilm.tsx`](src/styles/S12ConsoleFilm.tsx) | 1920×1080 | 150 f | 100 | [png](stills/NxrStyle-12-console-as-film.png) |
| 13 | [Clean Launch Film](../styles/NxrStyle-13-clean-launch-film.md) | `NxrStyle13-LaunchFilm` | [`S13LaunchFilm.tsx`](src/styles/S13LaunchFilm.tsx) | 1920×1080 | 160 f | 100 | [png](stills/NxrStyle-13-clean-launch-film.png) |
| 14 | [Paper Stop-Motion](../styles/NxrStyle-14-paper-stop-motion.md) | `NxrStyle14-PaperStopMotion` | [`S14PaperStopMotion.tsx`](src/styles/S14PaperStopMotion.tsx) | 1920×1080 | 150 f | 75 | [png](stills/NxrStyle-14-paper-stop-motion.png) |
| 15 | [Hand-Drawn Ink](../styles/NxrStyle-15-hand-drawn-ink.md) | `NxrStyle15-HandDrawnInk` | [`S15HandDrawnInk.tsx`](src/styles/S15HandDrawnInk.tsx) | 1920×1080 | 120 f | 76 | [png](stills/NxrStyle-15-hand-drawn-ink.png) |
## Technique comps
Each comp ID is `<ID>-<Component>`, for example `T01-BlurSwap`, `X02-IrisPunch` or `H02-PaperStopMotion`. All are 960×540 @ 30 fps and 75 f long. The full list with recipes is in [../techniques/README.md](../techniques/README.md).

## Determinism
Every comp is a pure function of the frame. `rand(key)` is a seeded FNV hash (there is no `Math.random`), and the verlet steam in S14/H02 is re-simulated from frame 0. To check it, render any frame twice and diff the images (see [../techniques/qa.md](../techniques/qa.md)).

## Note on assets
All art is drawn in code except `public/img/nxr-*.png`, which are NxrLabs image assets used by NxrStyle 12. Every brand name shown in the comps is a placeholder. In your own films, use your own real assets.
