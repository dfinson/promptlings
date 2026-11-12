---
name: interactive-experience
description: 'Build a served, offline, visually interactive experience that a human presents live: a guided storyline of working mini-app stops, with optional workshop data capture and video stops, presenter controls, deterministic presets, an offline handout export (one HTML file, plus clips when the experience has video stops) and automated stage-readiness checks. Use for live talks, workshops, demos and reviews delivered from a browser.'
---

# Interactive Experience

This skill supplies the design rules, runtime contract and verification for a live-presented interactive experience. The story, approval and acceptance belong to the directing agent (`interactive-presentation`). The spoken side belongs to `presenter-script`. Recorded, narrated clips come from the `technical-demo` agent.

The experience is a guided storyline whose stops are working mini-apps, not pictures. Each stop is a small model of the subject that the presenter drives on stage: a simulation to run and break, a request to trace, a parameter to sweep, a before and after to flip. Two optional stop kinds join them only when the session needs them: a capture stop records what the room decides, and a video stop plays a recorded demo. The presenter is the narrator and the motivation layer: open sandboxes without a guiding question underperform guided ones, so every stop arrives with a question and leaves with an answer. After the talk the same stops ship as a handout the audience explores on their own.

The medium sets the rules. The audience watches a projector or a compressed screen share, cannot rewind and reads very little while someone talks. Research behind the rules is listed in [sources](references/sources.md) with its evidence strength.

Select capabilities from the approved experience before building. Keep the
storyline, complete state/reset, accessible controls, fallback and offline
delivery. Add video transport, simulation clocks, persistent capture/snapshots
and synchronized windows only when the selected stops or delivery mode need
them. A simple comparison must not acquire unused infrastructure. Preserve
explicit requirements and record which optional checks are not applicable.

## Design rules

1. **One concept per stop, built as a working model.** The stop computes the behavior it shows from a state object. A picture of the behavior is an evidence stop, not a mini-app.
2. **Open on a loaded default.** Every stop enters on a named preset that already shows something interesting. Never start on an empty or degenerate configuration.
3. **One variable at a time.** Hold everything else at a sane default and expose only the control the current beat is about. Reveal further controls in later beats.
4. **Linked representations, one state.** When a stop shows the same thing several ways (diagram, chart, code, numbers), every view renders from the same state and updates together.
5. **Manipulate the object itself.** Drag the node, the request or the threshold line rather than a slider labeled with its name, wherever that is physically sensible.
6. **Build complexity across stops.** Start from the simplest working case and add one mechanism per stop, reusing the previous stop's model and visual vocabulary so the audience's mental model carries forward. Introduce the cast before the dense stop.
7. **Constrain the space.** Clamp ranges, snap to meaningful values and disable controls that lead nowhere, so exploration on stage tends toward the productive cases without on-screen instructions.
8. **Every exploration answers a question.** The script states the question before the presenter touches a control and states the answer after. Pick what the stop optimizes for (lower cognitive load, engagement or recall) before choosing its controls.
9. **Predict before reveal.** Where the result is guessable, ask the room first, then run the model. Record the room's call in a capture stop when the result is worth keeping.
10. **Isolate once the point lands.** Lock the camera, dim settled parts and reset clutter before the next concept, so the previous idea does not compete with the new one.
11. **Point at what matters.** One focal element per beat, signaled by highlight, dimming, an arrow or a zoom, and the same element the script names.
12. **Motion explains change, or it does not run.** Animate processes, flows, state transitions and morphs, under the presenter's control. Idle and decorative motion is off.
13. **Return home.** Long sessions get a home stop (for software, usually one C4 level) that the storyline map and the `H` key return to.
14. **Change state every five to eight minutes.** Alternate exploration, prediction, video and capture. Monotony, not a fixed attention timer, loses the room.
15. **Never project what the presenter will say.** Keep on-screen text to a short assertion headline, labels and real artifacts.
16. **Legible from the back row and through Teams.** At the 1920x1080 stage: body text at least 32px, assertions 48px or more, readouts and code at least 28px, nothing read below 24px, controls at least 48px, no strokes under 2px, no weights under 400, text contrast at least 4.5:1 and 7:1 where the room is lit, no meaning carried only by color or a subtle gradient.

Keep one scenario and acceptance target while exposing a consequential choice
or assumption. Show the resulting path and its reason, including a different
case that favors another approach when supported. Do not rig the model to
reward a preferred answer or substitute superficial gamification for a
meaningful interaction. The opening orients the audience to the whole, and
the close synthesizes the understanding built through the stops.

## Choose stops

Pick each stop's archetype from the [mini-app catalog](references/mini-apps.md) and record why it beats a static view, its question, its entry preset, its other presets and the beats that move between them. Pre-decide the landing values for every control the script uses; exploration beyond them is allowed and always recoverable with the reset key. Replace anything that needs a live runtime or network with a model or a replay of real captured output, and keep a recorded fallback for every live run. If a stop does not reveal something a still image cannot, make it an evidence stop or cut it.

Use a video stop only when the step cannot run live in the room, following [when to use video](references/mini-apps.md#when-to-use-video): an unreliable dependency, physical-world evidence, proof of a real run, an authentic voice, a slow process to compress or a sequence that must be exact. Keep clips to 15 to 45 seconds, muted under the presenter's voice unless an authentic voice or evidential sound is the point, and cut back to a mini-app for anything the presenter will manipulate in response to questions. Never put a clip on a capture stop. Request the clip from the `technical-demo` agent or use its existing output; never record a substitute with other tools.

For product UI or matched before/after stops, use technical-illustration's
[comparison guidance](../technical-illustration/references/comparisons.md).
Actual Current stays unannotated. Proposed may have functional change
annotations. Keep claims and consequential constraints readable without
opening a popover. On stage, annotation detail supports the presenter rather
than competing with speech. Requested paired recordings need a deliberate
moving reveal, not a substitution of unrelated stills.

## Visual system

Commit to one visual direction before building functional stops. Follow [visual directions](references/visual-directions.md) and invoke `technical-illustration`: ground the look in the subject and room, render representative static designs with realistic content and consequential states, and name one signature device. Explore alternative directions when there is a real choice, without implementing multiple mini-apps first. Present the samples with the director's storyline for approval. Carry the accepted palette, typography and layout into one `:root` token block (including state colors, spacing, radius, stroke, control sizes, easing and durations). After approval, build each model before its working view. The model takes most of the stage, the assertion sits in a short band, controls dock to one edge and readouts sit beside it. Take control, feedback, rendering, motion, type, color, diagram and code values from [craft](references/craft.md).

Load these design skills for the direction and critique work. The promptlings installer installs both with this agent, regardless of opt-out flags. When one is absent, stop and tell the user to rerun the promptlings installer.

- `frontend-design`: the subject-grounded brainstorm, explore, critique loop and its restraint rules.
- `hyperframes`: the design presets in `assets/frame-presets/*/FRAME.md` (named palettes, type scales and structural devices) as a source for deriving a direction outside the catalog, and `references/look.md` for choosing and holding one look. Fonts still come from the toolkit.

Use these skills for design knowledge only; the experience runs on its own runtime, never on HyperFrames. Keep upstream exploration inside the pre-production static-sample boundary until the director obtains approval. Static samples establish appearance, not functioning controls or measured behavior. Let the model dominate each stop and spend spectacle on the signature device and the one or two stops the story turns on. Present terminals and windows in the style `cue-synced-demo` describes unless the chosen direction specifies its own frame.

Critique before handoff: put the stop screenshots side by side, check each against the direction's tokens, the projection rules and the generic-tells table, and fix any stop that could belong to any other talk.

## Build to the runtime contract

Follow the [runtime contract](references/runtime.md): a self-contained served folder with the selected stops, toolkit output and assets. It defines the fixed 16:9 stage, complete beat/preset state and reset, presenter controls and offline handout. Its capability-specific sections apply only when the selected experience uses simulations, video, persistent data or two-window presentation. Use the existing toolkit and native components rather than building a general runtime product.

Build only from the experience toolkit the promptlings installer installs globally with this agent: the exact packages listed in [runtime](references/runtime.md), found under `npm root --global`. Write the runtime and stops as ES modules in `src/` and bundle them into `app.js` with the toolkit's esbuild, as [runtime](references/runtime.md) describes. Copy fonts from the toolkit's Fontsource latin WOFF2 files into the folder, pre-render syntax highlighting and lay out diagrams at build time. Ship the license notice of every bundled library, font and icon set in the folder. Never load from a CDN or any remote origin. When a toolkit package is absent, stop and tell the user to rerun the promptlings installer.

## Keep evidence honest

Every number, output, log line and screenshot on screen comes from a real run or source at a recorded revision. A mini-app that models behavior says so on screen, states what it simplifies, and uses parameters taken from real measurements where the talk makes quantitative claims. A terminal replay plays real captured output with its real ordering; compress waits with a visible skipped-time marker. Never fabricate output to make a stop look better.

## Verify stage readiness

Start the folder's own `serve.mjs` on a free port and drive it with the `playwright-cli` skill. Use `playwright-cli eval` for DOM measurements and `playwright-cli run-code` for checks that need the Playwright `page`. Run every applicable check and fix failures before handoff. Mark an unselected capability not applicable with its scope basis, never as passed:

- **Server:** `GET /` returns 200, `HEAD` has the corresponding headers without a body, and traversal is refused. When video is selected, check bounded/suffix/clamped ranges and unsatisfiable/zero-suffix refusal. When persistence is selected, a data `POST` appends one line, `GET` returns it and server restart preserves it.
- **Storyline:** walk every stop and beat forward with the presenter keys, then backward, then by random deep links. Screenshots of the same beat must match regardless of route.
- **Determinism:** for each mini-app, change its controls away from every preset, then apply each preset and the reset key and compare screenshots with the preset's direct deep link. Run each simulation preset twice for the same number of ticks and require identical frames.
- **Comparisons and annotations:** check matching subject/state/scale, an unannotated Current and correct Proposed explanations. Exercise slow continuous drag in both directions, release, re-grab, cancellation, reset and keyboard input. Check intermediate reveal positions, not only endpoints. Verify popover dismissal/focus, removal on view changes, narrow layouts and offline behavior.
- **Video:** every chapter key lands within 0.5 seconds of its cue start, play starts from a presenter key, captions render, and the video ends on its last frame without leaving the stop.
- **Capture:** submit a record in every capture stop, reload, and confirm the stop shows it.
- **Legibility:** capture each beat at 1920x1080 and 1280x720 and inspect them yourself for focal point, hierarchy and legibility. Fail on clipped or overflowing text (`scrollWidth > clientWidth` or `scrollHeight > clientHeight` on text containers), on text below the size floor and on controls under 48px.
- **Network and errors:** fail on any console error, page error or request to an origin other than the local server.
- **Accessibility:** inject the toolkit's `axe-core/axe.min.js` with `page.addScriptTag({ path })` through `playwright-cli run-code`, run `axe.run()` on every stop and fail on any violation. Confirm reduced-motion mode renders every final state and every control is reachable by keyboard.
- **Presenter view:** confirm notes, presets and next-beat context agree with the audience state. When two windows are selected, verify synchronization in both directions.
- **Handout:** export it, open it from `file://` with networking disabled (`page.context().setOffline(true)`), and confirm every stop renders its entry preset, its controls work, captured data appears and the license notices are present.

Keep the screenshots and check results with the production notes. Mechanical passes do not replace looking at every stop, and neither replaces the presenter's rehearsal.
