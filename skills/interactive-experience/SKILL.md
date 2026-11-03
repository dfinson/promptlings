---
name: interactive-experience
description: 'Build a served, offline, visually interactive experience that a human presents live: a guided storyline of working mini-app stops, with optional workshop data capture and video stops, presenter controls, deterministic presets, a single-file handout export and automated stage-readiness checks. Use for live talks, workshops, demos and reviews delivered from a browser.'
---

# Interactive Experience

This skill supplies the design rules, runtime contract and verification for a live-presented interactive experience. The story, approval and acceptance belong to the directing agent (`interactive-presentation`). The spoken side belongs to `presenter-script`. Recorded, narrated clips come from the `technical-demo` agent.

The experience is a guided storyline whose stops are working mini-apps, not pictures. Each stop is a small model of the subject that the presenter drives on stage: a simulation to run and break, a request to trace, a parameter to sweep, a before and after to flip. Two optional stop kinds join them only when the session needs them: a capture stop records what the room decides, and a video stop plays a recorded demo. The presenter is the narrator and the motivation layer: open sandboxes without a guiding question underperform guided ones, so every stop arrives with a question and leaves with an answer. After the talk the same stops ship as a handout the audience explores on their own.

The medium sets the rules. The audience watches a projector or a compressed screen share, cannot rewind and reads very little while someone talks. Research behind the rules is listed in [sources](references/sources.md) with its evidence strength.

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
16. **Legible from the back row and through Teams.** At the 1920x1080 stage: body text at least 32px, headings 56px or more, code at least 28px, controls at least 48px, no strokes under 2px, no thin font weights, contrast at least 4.5:1, no meaning carried only by color or a subtle gradient.

## Choose stops

Pick each stop's archetype from the [mini-app catalog](references/mini-apps.md) and record why it beats a static view, its question, its entry preset, its other presets and the beats that move between them. Pre-decide the landing values for every control the script uses; exploration beyond them is allowed and always recoverable with the reset key. Replace anything that needs a live runtime or network with a model or a replay of real captured output, and keep a recorded fallback for every live run. If a stop does not reveal something a still image cannot, make it an evidence stop or cut it.

Use a video stop when a demo step is too slow, too fragile or too busy to run live, and cut back to a mini-app for anything the presenter will want to manipulate in response to questions. Request the clip from the `technical-demo` agent or use its existing output; never record a substitute with other tools.

## Visual system

Commit to one visual direction before building any stop. Follow [visual directions](references/visual-directions.md): ground the look in the subject and the room, shortlist two directions, render the same two representative stops in each, choose from screenshots and name one signature device. Write the result as one `:root` token block (OKLCH palette in Radix-style role scales, a modular type scale, spacing, radius, stroke, easing and durations) and use nothing outside it. Take motion, type, color, diagram, control and code values from [craft](references/craft.md) rather than inventing them.

Load these design skills for the direction and critique work. The promptlings installer installs all four with this agent, regardless of opt-out flags. When one is absent, stop and tell the user to rerun the promptlings installer.

- `frontend-design`: the subject-grounded brainstorm, explore, critique loop and its restraint rules.
- `hyperframes-creative`: `references/visual-styles.md` (eight named styles with palettes and type), `references/house-style.md`, `references/typography.md`, `references/design-adherence.md` and `references/motion-principles.md`.
- `demotime-slide-theme`: its layout-role guidance for title, section and evidence stops. Write the experience's own CSS; copy nothing from its assets.
- `hyperframes-animation`: `rules-index.md`, `transitions/catalog.md`, `adapters/waapi.md` and `adapters/css-animations.md`, when choreographing beats and stop transitions.

Use these skills for design knowledge only; the experience runs on its own runtime, never on HyperFrames or Demo Time. Let one element dominate each beat and spend spectacle on the signature device and the one or two stops the story turns on. Draw diagrams and models as inline SVG, or Canvas 2D when a simulation draws more than a few hundred moving elements. Present terminals and windows in the style `cue-synced-demo` describes unless the chosen direction specifies its own frame.

Critique before handoff: put the stop screenshots side by side, check each against the direction's tokens and the generic-tells table, and fix any stop that could belong to any other talk.

## Build to the runtime contract

Follow the [runtime contract](references/runtime.md): a self-contained served folder with the stops, the toolkit builds, fonts, videos and a `data/` directory, served by a generated `serve.mjs` that uses Node built-ins only. The contract defines the fixed 16:9 stage, the stop and beat model, deterministic mini-apps with seeded randomness and a fixed-step clock, presets and reset, presenter controls, the presenter window, video stops with WebVTT chapters, workshop data capture and the single-file handout export. Write the runtime as hand-authored HTML, CSS and JavaScript, regenerated per experience.

Build only from the experience toolkit the promptlings installer installs globally with this agent: the exact packages listed in [runtime](references/runtime.md), found under `npm root --global`. Copy fonts from the toolkit's Fontsource latin WOFF2 files and library builds into the folder, pre-render syntax highlighting and lay out diagrams at build time. Ship the license notice of every bundled library, font and icon set in the folder, as [runtime](references/runtime.md) describes. Never load from a CDN or any remote origin. When a toolkit package is absent, stop and tell the user to rerun the promptlings installer.

## Keep evidence honest

Every number, output, log line and screenshot on screen comes from a real run or source at a recorded revision. A mini-app that models behavior says so on screen, states what it simplifies, and uses parameters taken from real measurements where the talk makes quantitative claims. A terminal replay plays real captured output with its real ordering; compress waits with a visible skipped-time marker. Never fabricate output to make a stop look better.

## Verify stage readiness

Start the folder's own `serve.mjs` on a free port and drive it with the `playwright-cli` skill. Use `playwright-cli eval` for DOM measurements and `playwright-cli run-code` for checks that need the Playwright `page`, such as request interception, script injection and a second window. Run every check and fix failures before handoff:

- **Server:** `GET /` returns 200; a `Range: bytes=0-1023` request on each video returns 206 with a correct `Content-Range`; an unsatisfiable range returns 416; a path traversal attempt is refused; a data `POST` appends one line to `data/` and the matching `GET` returns it; restarting the server keeps the data.
- **Storyline:** walk every stop and beat forward with the presenter keys, then backward, then by random deep links. Screenshots of the same beat must match regardless of route.
- **Determinism:** for each mini-app, change its controls away from every preset, then apply each preset and the reset key and compare screenshots with the preset's direct deep link. Run each simulation preset twice for the same number of ticks and require identical frames.
- **Video:** every chapter key lands within 0.5 seconds of its cue start, play starts from a presenter key, captions render, and the video ends on its last frame without leaving the stop.
- **Capture:** submit a record in every capture stop, reload, and confirm the stop shows it.
- **Legibility:** capture each beat at 1920x1080 and 1280x720 and inspect them yourself for focal point, hierarchy and legibility. Fail on clipped or overflowing text (`scrollWidth > clientWidth` or `scrollHeight > clientHeight` on text containers), on text below the size floor and on controls under 48px.
- **Network and errors:** fail on any console error, page error or request to an origin other than the local server.
- **Accessibility:** inject the toolkit's `axe-core/axe.min.js` with `page.addScriptTag({ path })` through `playwright-cli run-code`, run `axe.run()` on every stop and fail on any violation. Confirm reduced-motion mode renders every final state and every control is reachable by keyboard.
- **Presenter window:** open the presenter view and confirm notes, presets, timer and next-beat preview track the audience window in both directions.
- **Handout:** export it, open it from `file://` with networking disabled (`page.context().setOffline(true)`), and confirm every stop renders its entry preset, its controls work, captured data appears and the license notices are present.

Keep the screenshots and check results with the production notes. Mechanical passes do not replace looking at every stop, and neither replaces the presenter's rehearsal.
