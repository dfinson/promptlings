# Craft

Concrete values for building mini-apps a presenter drives live in front of a room and through a screen share. Use them as defaults inside the chosen [visual direction](visual-directions.md) instead of inventing numbers. Sources are in [sources](sources.md).

## Controls and direct manipulation

- **Style native controls, enlarged.** `<input type="range">`, `<button>`, `<select>` and checkboxes give keyboard stepping, focus rings and touch handling for free. Restyle them for the stage (track at least 12px tall, thumb at least 28px, the whole track draggable) rather than drawing custom widgets that lose arrow keys and screen readers.
- **Scrubbable numbers** are a first-class control: a value in a sentence or readout, styled as draggable (underline plus `cursor: ew-resize`), that changes the model as the presenter drags left or right.
- **Drag with Pointer Events.** On `pointerdown`, call `setPointerCapture(e.pointerId)` so a fast drag never escapes the element and gets stuck; release on `pointerup` and `pointercancel`. Map pointer coordinates through the stage scale.
- **Build constraints into the model, not the handler.** Compose small getter and setter transforms (clamp to a range, lock to an axis, snap to meaningful values, offset from an anchor) so every handle on a stop uses the same constraint vocabulary.
- **Expand hit areas.** Give thin lines and small dots an invisible hit region of at least 48px on the stage. Never place two targets closer than one target's width; neighbors absorb slips.
- **Target size follows Fitts's law.** Controls at least 48px on the 1920x1080 stage, the primary control of a stop the largest, and the next control the presenter needs placed near the last one.
- **Affordance is redundant.** Every interactive element changes cursor and shows a visible outline or glow on hover and focus. Color alone disappears in screen-share compression.
- **Keyboard equivalents for every control** through native focus and arrow stepping, so the stop survives a dead trackpad. Presenter keys never fire while a text field has focus.
- **Exercise the real gesture.** Check slow continuous movement both ways,
  release, re-grab, cancellation and reset, not just endpoint jumps. Prevent
  native image dragging/selection from stealing reveal-slider input while
  retaining pointer capture and keyboard equivalents.

## Feedback and timing

- **Response budget:** answer input within 100ms (handler work under 50ms) and keep animation frames under 10ms of JavaScript. Throttle or precompute anything heavier off the drag path.
- **Continuous feedback during the drag,** not on release. Every linked view updates as the value moves.
- **Never move a target while the pointer converges on it.** Freeze list reorders and layout reflows until the interaction ends.
- **Ghost trails.** Leave a fading trail behind moving objects and a faint copy of the previous curve when a parameter changes, so the audience sees the change, not only the new frame.
- **Draw the prediction before the run.** On predict-then-run stops, render the expected path or value as a ghost, then run the model and let the real result replace it.
- **Encode state on an orthogonal channel.** Highlight new arrivals briefly; draw timed-out or failed items hollow rather than in a new hue; shrink an in-flight item like a clock face to show remaining work.
- **Over one second, show progress.** Anything that takes longer than one second shows that it is working; over ten seconds, show how far along it is.
- **Overview, then zoom and filter, then details on demand.** Open on the whole system; the presenter narrows to the part they narrate; a click reveals the numbers for one element.

## Representing a running system

Transport and clocks apply to time-based stops, not to static comparisons.

- **One global pause** stops every animation and simulation on the stage at once, with the state kept.
- **A fixed transport strip** (play, pause, step, speed, reset) in the same place on every stop, separate from the parameters. Speed covers at least 0.25x to 4x.
- **Build one mechanism at a time in the same frame.** Each stop adds to the previous stop's geometry and colors instead of redrawing the system.
- **Semantic color, capped.** One hue per recurring entity, identical in the model, code and labels. At most three or four live hues on screen; a fifth state uses shape or motion.
- **Reveal labels and colors in the beat that needs them.** Hide state that is irrelevant to the current beat rather than pre-labeling everything.
- **One focal point per beat.** Exactly one element moves, brightens or grows to claim attention; everything else holds still or dims.
- **Place content where reading begins.** Align a sparse opening with its
  intended entry point. Correct accidental empty regions through composition,
  not decorative filler that competes with the subject.
- **Borders by intent.** Draw cell or node borders when edges matter, omit them when the nodes matter.

## Rendering

| Scene | Renderer |
| --- | --- |
| Up to a few hundred elements, crisp labels, per-element hit testing | Inline SVG |
| Hundreds to a few thousand moving items | Canvas 2D, with an SVG layer on top for labels and handles |
| Beyond a few thousand items | WebGL, only when the stop's point needs that density |

- **Scale Canvas for the display.** Set the backing store to the stage size times `devicePixelRatio`, call `ctx.scale(devicePixelRatio, devicePixelRatio)` and redo it when the ratio changes, or the canvas blurs on the projector.
- **Fixed timestep.** Step the simulation at a fixed `dt` from an accumulator and clamp the elapsed time fed in per frame (for example to 250ms), so a laptop stall or a dropped screen-share frame never makes the model jump.
- **Seeded randomness** for jitter, arrivals and failure injection, so a preset and its reset reproduce the same run on every machine.
- **Budget for a degraded machine.** Screen-share capture competes for the GPU. Rehearse with a Teams share running and treat 10ms of script per frame as the ceiling.
- **Lay out from stage units.** The stage is fixed at 1920x1080 and scaled as a whole, so models never reflow on another projector.

## Motion that explains

- **Animate the change, not the arrival.** Staged, animated transitions between two states of the same model preserve object constancy and measurably improve how well viewers track elements, compared with a cut. Move positions first, then change form, then update labels.
- **Two speeds.** Changes the presenter causes by dragging or clicking are immediate. Changes the system makes on its own (a request completing, a queue draining, a stop's entry state settling) animate over one to two seconds so the room can follow them.
- **Easing:** for system changes use a decelerating curve such as `cubic-bezier(0.2, 0, 0, 1)`; for physical models use the model's own physics; for quantized instruments use steps or a small overshoot.
- **Interruptible.** A new key press or drag jumps any running transition to its end state.
- **Pause and reduced motion in the app.** Ship the global pause and the `M` reduced-motion toggle on stage, independent of the venue laptop's OS setting. Reduced motion cuts transitions to their final state; simulations keep running because their motion is the content, at the presenter's chosen speed.
- **No idle motion.** Nothing loops, floats or shimmers while the model is unchanged. Avoid sustained rotation, parallax and full-stage zooms.

## Modes and arming

- **Presenter and explore modes.** Presenter mode shows only the controls the current beat uses, at stage size. The handout's explore mode shows every control at a denser size for a reader on their own screen.
- **Arm controls per stop.** A stop's controls and canvas ignore pointer input until the stop is entered, and unrevealed controls stay disabled, so a stray click never triggers the next stop.
- **Reset to preset** in one key (`0`) or one visible button, reproducing the exact entry state.
- **Large readouts.** Values the script names render at 28px or more in tabular figures, next to the control that changes them, never as tooltips.
- **Visible pointer for Teams.** Show a cursor ring and a click ripple at 2px or more stroke, so a compressed share still shows where the presenter is pointing and what they pressed.

## Capture

- **One field at a time,** large and keyboard-operable, with a default value already filled when the room usually picks it.
- **Echo within one second.** The submitted value appears in the shared view immediately, marked as the latest entry.
- **Aggregate live.** The chart or tally updates in place with each record and briefly highlights the change.
- **Explicit empty state.** Before any record exists, the stop says what will appear and how to add it, instead of showing blank axes.

## Typography

- Choose a modular ratio (1.25 for dense model stops, 1.333 for sparse ones) on a 32px body base and derive every size from it.
- Display type at 80px and above takes about -0.02em tracking; all-caps labels take +0.04 to +0.08em.
- Use `font-optical-sizing: auto` with variable fonts that have an `opsz` axis.
- Every changing or compared number uses `font-variant-numeric: tabular-nums`, so readouts do not jitter while they update.
- Reading text stays under about 60 characters per line on the stage.
- Pairings come from the chosen direction; further guidance is in `hyperframes` `references/look.md`.

## Color

- Build each hue as a role-labeled scale in the [Radix Colors](https://www.radix-ui.com/colors/docs/overview/usage) convention: steps 1 to 2 backgrounds, 3 to 5 surfaces, 6 to 8 borders, 9 to 10 solid, 11 to 12 text.
- Define colors in OKLCH and derive states with relative color syntax, for example `oklch(from var(--signal) calc(l + 0.08) c h)`. Keep values inside sRGB.
- Keep each entity's hue identical in models, code highlights and labels for the whole experience.
- WCAG 2.2 contrast is the binding floor; the projection rules in [visual directions](visual-directions.md) raise it for the room.

## Diagrams

- One C4 level per diagram. Fill by element type and keep that mapping fixed.
- One stroke token for boxes, one for connectors, one radius per element type.
- Orthogonal connectors with rounded turns; labels at the midpoint with a background knockout.
- Size nodes to their labels; never clip or shrink a label to fit.
- Lay out larger graphs at build time, then draw with the experience tokens.
- Focus by dimming the rest (`opacity: 0.25; filter: saturate(0.3)`) and thickening the focal element's stroke.
- One icon set per experience, at the direction's stroke weight, with a text label beside every icon.

## Code

- At most about 15 lines on screen at 28px or larger; cut the snippet rather than shrink it.
- Pre-highlight at build time with a high-contrast theme matched to the direction, and recolor comments that fail 4.5:1.
- Link code to the model: highlight the line that is executing while the model runs, and let a click on a model element highlight the code responsible.
- Step through code with line focus: dim inactive lines and advance the active range per beat.
