---
name: interactive-deck
description: 'Build a standalone, offline, visually interactive HTML presentation that a human presents live, with presenter mode, deterministic steps and automated stage-readiness checks. Use for live talks, demos and reviews delivered from a browser.'
---

# Interactive Deck

This skill supplies the design rules, runtime contract and verification for a live-presented HTML deck. The story, approval and acceptance belong to the directing agent (`interactive-presentation` when installed). The spoken side belongs to `presenter-script`.

The medium sets the rules. The presenter is the narrator and the only person with input. The audience watches a projector or a compressed screen share, cannot rewind and reads very little while someone talks. Every rule below follows from that. Research behind them is listed in [sources](references/sources.md) with its evidence strength.

## Design rules

1. **One assertion per step, shown with evidence.** Each step carries a short full-sentence headline that states the point and one piece of visual evidence: a diagram, real output, a focused code region or a measurement. No bullet-topic slides. Assertion-evidence slides measurably improve comprehension over topic-and-bullet slides.
2. **Never project what the presenter will say.** On-screen text that duplicates speech hurts understanding. Keep text to the headline, labels and real artifacts. The script carries the explanation.
3. **Point at what matters.** Signal the focal element with highlight, dimming of the rest, an arrow or a zoom, and make it the same element the script names on that step. One focal point per step.
4. **Build, do not dump.** Reveal complex views in presenter-advanced steps, one layer or component per click. Keep labels on the graphic, not in a legend.
5. **Introduce the cast first.** Before a dense diagram or demo, show the few components or terms it depends on.
6. **Motion explains change, or it does not run.** Animate only processes, flows, state transitions and before/after morphs, always stepped by the presenter, never autoplaying ahead of speech. Use static sequences for conceptual relationships. Idle and decorative motion is off.
7. **Return home.** Give long talks a home diagram (for software, usually one C4 level) that each deep dive zooms out of and back into.
8. **Change state every five to eight minutes.** A question, a predict-then-reveal, a demo or a layout change. Attention does not expire on a fixed timer; monotony is the problem.
9. **Legible from the back row and through Teams.** At the 1920x1080 stage: body text at least 32px, headings 56px or more, code at least 28px, no strokes under 2px, no thin font weights, contrast at least 4.5:1, no meaning carried only by a subtle gradient or by color alone.

## Choose interactions

Pick each interaction from the [pattern catalog](references/interaction-patterns.md) and record why it beats a static view. The presenter triggers every interaction with a key or clicker at a scripted moment; never require audience input, precise hovering or free typing. Pre-decide the values a slider or scrubber lands on. Replace anything that needs a live runtime or network with a replay of real captured output, and keep the live version optional. If an interaction does not reveal something a still image cannot, cut it.

## Visual system

Commit to one visual direction before building any step. Follow [visual directions](references/visual-directions.md): ground the look in the subject and the room, shortlist two directions, render the same two representative steps in each, choose from screenshots and name one signature device. Write the result as one `:root` token block (OKLCH palette in Radix-style role scales, a modular type scale, spacing, radius, stroke, easing and durations) and use nothing outside it. Take motion, type, color, diagram and code values from [craft](references/craft.md) rather than inventing them.

Load these design skills for the direction and critique work:

- `frontend-design`: the subject-grounded brainstorm, explore, critique loop and its restraint rules. Required.
- `hyperframes-creative`: `references/visual-styles.md` (eight named styles with palettes and type), `references/house-style.md`, `references/typography.md`, `references/design-adherence.md` and `references/motion-principles.md`. Required.
- `demotime-slide-theme`: its slide-role and layout guidance. Write the deck's own CSS; copy nothing from its assets.
- `hyperframes-animation`: `rules-index.md`, `transitions/catalog.md`, `adapters/waapi.md` and `adapters/css-animations.md`, when choreographing steps.
- `mermaid-architecture-diagrams` for diagram semantics and `no-ai-slop` for headlines and labels, when installed.

Use these skills for design knowledge only; the deck runs on its own runtime, never on HyperFrames or Demo Time. Let one element dominate each step and spend spectacle on the signature device and the one or two moments the story turns on. Draw diagrams as inline SVG so they stay sharp, styleable and animatable. Present terminals and windows in the style `cue-synced-demo` describes unless the chosen direction specifies its own frame.

Critique before handoff: put the step screenshots side by side, check each against the direction's tokens and the generic-tells table, and fix any step that could belong to any other deck.

## Build to the runtime contract

Follow the [runtime contract](references/runtime.md): one self-contained HTML file on a fixed 16:9 stage, a pure `renderStep` state model with hash deep links, clicker-compatible keys, blackout, an in-document presenter mode with notes, timer and next-step preview, and an optional two-window mode served from localhost. Default to hand-authored HTML, CSS and JavaScript. Use reveal.js only when the presenter specifically wants its feature set and accepts serving from localhost for speaker view. Do not use Slidev, Spectacle or other build-pipeline frameworks for a single-file deliverable.

Inline everything: fonts as base64 WOFF2 subsets, vendored libraries pinned to exact versions, pre-rendered syntax highlighting and pre-rendered diagrams. Never load from a CDN at show time. Keep large video fallbacks as sibling files in a self-contained folder rather than base64.

## Keep evidence honest

Every number, output, log line and screenshot on screen comes from a real run or source at a recorded revision. Label illustrative data, simulations and reconstructions on screen. A terminal replay plays real captured output with its real ordering; compress waits with a visible skipped-time marker. Never fabricate output to make a step look better.

## Verify stage readiness

Drive the deck with the `playwright-cli` skill, or a project-local Playwright script when a check needs assertions it cannot express. Run every check and fix failures before handoff:

- Walk every step forward with the presenter keys, then backward, then by random deep links. Screenshots of the same step must match regardless of route.
- Capture each step at 1920x1080 and 1280x720, and inspect them yourself for focal point, hierarchy and legibility.
- Fail on any console error, page error or network request other than the deck file and its sibling assets.
- Fail on clipped or overflowing text (`scrollWidth > clientWidth` or `scrollHeight > clientHeight` on text containers) and on text below the size floor.
- Run an accessibility scan (for example `@axe-core/playwright`) for contrast and naming, and confirm reduced-motion mode renders every final state.
- Open presenter mode and confirm notes, timer and next-step preview track the current step; in two-window mode confirm both windows stay in sync.
- Confirm the file opens from `file://` with networking disabled.

Keep the screenshots and check results with the production notes. Mechanical passes do not replace looking at every step, and neither replaces the presenter's rehearsal.
