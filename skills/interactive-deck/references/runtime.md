# Runtime contract

The deck is one HTML file that opens from `file://` on the presenter's machine with networking off. Write it as a small set of source files in the production workspace and assemble it with a project-local build script that inlines styles, scripts, fonts and images into `deck.html`. The promptlings repository holds no runtime code.

## Stage

- Author everything on a fixed 1920x1080 logical stage. Scale the stage to the window with one CSS `transform: scale()` on a wrapper and letterbox the remainder, so projectors at other sizes or aspect ratios never reflow the layout.
- Animate only `transform`, `opacity` and filters that composite on the GPU. Do not animate layout properties.
- Honor `prefers-reduced-motion` and expose a manual toggle (`M`). Reduced motion swaps transitions for instant cuts to the same final state.

## Step model

- Describe the talk as an ordered list of steps. Each step has a stable identifier (for example `arch-03`), the section it belongs to, presenter notes and a title for the presenter's next-step preview.
- Render through one pure function, `renderStep(index)`, that sets the complete visual state for that step from the step list alone. Transitions may animate from the current state to the target, but the target state never depends on which step came before. Going backward, jumping by deep link and reloading must produce the same frame as walking forward.
- Interactive widgets (sliders, scrubbers, toggles) expose their state as part of the step or as presenter-controlled sub-steps, so a landing value is reproducible.
- Update the URL hash on every step with `history.replaceState` (for example `#arch-03`) and restore from it on load.

## Controls

| Key | Action |
| --- | --- |
| `ArrowRight`, `PageDown`, `Space` | Next step |
| `ArrowLeft`, `PageUp` | Previous step |
| `Home`, `End` | First, last step |
| `B`, `.` | Toggle blackout |
| `F` | Fullscreen through the Fullscreen API |
| `P` | Toggle presenter mode |
| `M` | Toggle reduced motion |
| `G` | Go to step by identifier or number |
| `R` | Cut the current live step to its recorded fallback |

Most clickers send `PageUp`, `PageDown` and `B`, so these bindings work without vendor software. Ignore key repeat during a running transition by jumping straight to its end state rather than queueing.

## Presenter mode

- **Default, single document:** `P` switches the same page into a presenter layout with the current step scaled down, the next-step preview, the notes for the current step, elapsed time, wall-clock time and the section time budget. This needs no cross-window messaging and works from `file://`. Use it with a mirrored display, or on the laptop while the audience sees a screen share of a second window opened in audience mode.
- **Two windows:** for an extended display with audience and presenter windows, serve the folder from localhost (for example `python -m http.server 8000 --bind 127.0.0.1`) and sync the windows with `BroadcastChannel`. Two `file://` documents are not reliably same-origin, so never depend on cross-window sync from `file://`. Document both launch commands in the handoff.
- Notes come from the same step list the deck renders, so the script cues and on-screen state cannot drift.

## Self-contained assets

- **Fonts:** subset to the glyphs used, convert to WOFF2 and inline as base64 `@font-face` sources. Keep to two families and a few weights.
- **Code:** pre-highlight with Shiki at build time into static HTML. For animated code changes use `@shikijs/magic-move` (MIT), vendored at an exact version.
- **Diagrams:** author as inline SVG, or pre-render Mermaid to SVG at build time and inline the result. Do not ship the Mermaid runtime.
- **Motion:** CSS transitions and the Web Animations API cover most needs. When timelines justify a library, vendor one at an exact version: GSAP (free under the GSAP Standard License, including former bonus plugins), Motion (MIT) or Anime.js (MIT). Use the View Transitions API only with a fallback.
- **Data visuals:** D3 (ISC), Rough.js (MIT) for a sketched style, Three.js (MIT) only for genuinely three-dimensional subjects.
- **Raster evidence:** screenshots as compressed WebP or PNG inlined; long video fallbacks as sibling files in the same folder.

Record each vendored library's name, version and license in the production notes.
