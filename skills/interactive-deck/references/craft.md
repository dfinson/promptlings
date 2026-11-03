# Craft

Concrete values from established design systems and design-engineering practice. Use them as defaults inside the chosen [visual direction](visual-directions.md) instead of inventing numbers.

## Motion

### Easing tokens

| Use | Value | Source |
| --- | --- | --- |
| Standard step change (reversible) | `cubic-bezier(0.2, 0, 0, 1)` | Material 3 standard |
| Entrance, settles into place | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Material 3 emphasized decelerate |
| Permanent exit | `cubic-bezier(0.3, 0, 0.8, 0.15)` | Material 3 emphasized accelerate |
| Productive (most reveals) | `cubic-bezier(0.2, 0, 0.38, 0.9)` | IBM Carbon productive standard |
| Expressive (section breaks, signature moment) | `cubic-bezier(0.4, 0.14, 0.3, 1)` | IBM Carbon expressive standard |

### Durations

- Highlight, dim, color change: 150 to 200ms.
- Element enters or moves within a region: 250 to 350ms.
- Structural change, diagram morph, zoom between levels: 400 to 600ms.
- Section break or signature moment: up to 700ms. Nothing longer.
- Stagger groups at 40 to 80ms per item, at most six items; longer lists reveal as one group.
- Exits run faster than entrances, roughly two thirds of the entrance duration.

### Choreography

- Structure first, then content, then emphasis: container settles, primary element arrives, labels and annotations follow.
- Entrances decelerate into rest; exits accelerate away. Elements that may return use the standard curve on exit.
- A changed element morphs from where it was (shared element), so the audience never re-finds it.
- Every animation is interruptible: the next key press jumps the running transition to its end state.
- Avoid sustained rotation, parallax and large continuous zooms on the full stage; they cause discomfort in a seated audience.
- Reduced motion replaces every transition with an instant cut to the same final state.

### Library by job

| Job | Tool | Why |
| --- | --- | --- |
| Multi-element step choreography that must seek and reverse | Motion (MIT) sequence per step from `animate([...])`; set `controls.time` for jumps, `controls.speed = -1` to reverse | Deterministic seek and reversal |
| Simple per-step transitions | CSS transitions driven by state classes set in `renderStep`, or WAAPI with `fill: "both"` and a settable `currentTime` | Zero dependency, seekable |
| Shared-element morph on a single forward or back step | View Transitions API with `view-transition-name`; direct render on jump or when unsupported | Automatic morph, no FLIP math |
| Shared-element morph that must scrub | FLIP into a WAAPI or Motion transform animation | Seekable like any tween |
| Path draw-on | `stroke-dasharray` and `stroke-dashoffset`, or Motion `pathLength` | Standard technique |
| Shape morph | Flubber (MIT) interpolator driven by the step's animation progress | Handles differing point counts |
| Code change | `@shikijs/magic-move` precompiled tokens | Token-level morph without the Shiki runtime |

Transferable motion patterns: `hyperframes-animation` `rules-index.md`, `transitions/catalog.md`, `adapters/waapi.md` and `adapters/css-animations.md`. Take the patterns, not the HyperFrames runtime.

Every inlined library, font and icon set comes from the installed deck toolkit listed in [runtime](runtime.md), each under an OSI-approved open source license or the SIL OFL with no paid tier or field-of-use restriction.

## Typography

- Fixed stage, fixed sizes: choose a modular ratio (1.25 for dense technical steps, 1.333 to 1.5 for sparse display-led talks) on a 32px body base and derive every size from it.
- Display type at 80px and above takes negative tracking, about -0.02em; all-caps labels take +0.04 to +0.08em.
- Use `font-optical-sizing: auto` with variable fonts that have an `opsz` axis.
- Numbers that change or compare use `font-variant-numeric: tabular-nums`.
- Line length for any reading text stays under about 60 characters on the stage.
- Proven OFL pairings: Space Grotesk with Inter and JetBrains Mono; Geist with Geist Mono; IBM Plex Sans with IBM Plex Mono; Source Serif 4 with Source Sans 3 and IBM Plex Mono; Fraunces or Instrument Serif with Inter.
- Further pairing guidance: `hyperframes-creative` `references/typography.md`.

## Color

- Build each hue as a role-labeled scale in the [Radix Colors](https://www.radix-ui.com/colors/docs/overview/usage) convention: steps 1 to 2 backgrounds, 3 to 5 surfaces, 6 to 8 borders, 9 to 10 solid accent, 11 to 12 text. Every color then has a known contrasting text step.
- Define colors in OKLCH and derive states with relative color syntax, for example `oklch(from var(--accent) calc(l + 0.08) c h)`. Keep values inside sRGB; check with [oklch.com](https://oklch.com/).
- Assign one hue per recurring entity (service, actor, data type) and keep it identical in diagrams, code highlights and captions for the whole deck.
- Semantic colors (added, removed, error, active) come from the same scales, never from library defaults.
- WCAG 2.2 contrast is the binding floor; APCA is a useful cross-check for large display type.
- Palette and composition guidance: `hyperframes-creative` `references/house-style.md` and `references/design-adherence.md`.

## Diagrams

- One C4 level per diagram. Fill by element type (person, system in scope, external system) and keep that mapping fixed.
- One stroke token for boxes, one for connectors, one radius per element type.
- Orthogonal connectors with rounded turns; labels at the midpoint with a background knockout.
- Size nodes to their labels; never clip or shrink a label to fit a box.
- Lay out with dagre at build time, or hand-author SVG for small diagrams, then draw with the deck tokens.
- Focus by dimming the rest (`opacity: 0.25; filter: saturate(0.3)`) and thickening the focal element's stroke.
- Icons: [Lucide](https://lucide.dev/) (ISC) or [Tabler](https://tabler.io/icons) (MIT), one set per deck. Represent cloud services with these sets and a text label.

## Code

- At most about 15 lines on screen at 28px or larger; cut the snippet rather than shrink it.
- Pre-highlight with Shiki using a high-contrast dark or light theme matched to the direction, and recolor comments that fail 4.5:1.
- Step through code with line focus: dim inactive lines and advance the active range per step.
- Show diffs with Shiki diff notation, recolored from the deck's added and removed scales.
- Morph code between steps with `@shikijs/magic-move` using precompiled tokens.

## Toolkit components and effects

| Package | Use |
| --- | --- |
| [Open Props](https://open-props.style/) | Easing, spring `linear()` curves, shadow and radius tokens to inline as CSS |
| [Motion](https://motion.dev/) | Seekable sequences, stagger, path draw |
| [Flubber](https://github.com/veltman/flubber) | SVG shape interpolation |
| [Rough.js](https://roughjs.com/) | Sketch-direction shapes |

Build signature effects (beams, text reveals, animated borders) from these packages, CSS and SVG. Every effect needs a job on its step: marking a section, revealing a change or directing attention. Effects without a job are cut.
