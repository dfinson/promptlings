# Render only what the decision needs

Use existing tools in the authorized external production workspace. This
reference supplies route selection and checks, not a required script, service,
job schema or new runtime.

## Select a route

**Existing media composition.** Render selected native frames from the chosen
Motionite/Remotion or explicitly selected HyperFrames route. Reuse source,
components, bundle and prepared browser while their inputs remain unchanged.
For Remotion, use its existing configuration/CLI or public
[`renderStill`](https://www.remotion.dev/docs/renderer/render-still) API.
Keep packages version-matched and resolve assets and runtime locations
explicitly. A still does not require audio synthesis or a complete timeline.
Do not switch media routes to obtain a preview.

**Proposed interface or presentation stop.** Render static HTML/CSS or SVG
with representative content using the installed browser tooling. Use real
component-library controls as visual primitives where appropriate, without
implementing the live model or application backend. A second static state
can expose a proposed interaction without constructing it.

**Relationship, comparison or sequence.** Use Mermaid or SVG when their
notation makes the mechanism clear. Prefer the destination's supported native
format. Render to an embedded image where the destination cannot display
editable source. Inspect the resulting diagram rather than accepting valid
syntax as visual acceptance.

**Observed application behavior.** Use the established real browser/editor
capture route. Compare base and head under the same data, viewport and steps
when the claim is a before/after change. Do not compose invented results.

The existing [component catalog](../../technical-demo-production/references/components.md)
provides reusable visual sources and licensing boundaries. Static React/SVG
components can be used without adopting a library's animation workflow.
Use upstream documentation for the actual installed version instead of
inventing exports, flags or package availability.

## Keep preparation small

Build only the views needed for the decision. Reuse one prepared browser and
an unchanged bundle where supported, and render related views as a batch.
Avoid per-frame process startup, intermediate image/video assembly and
full-film setup for ordinary stills.

The caller's existing installation owns managed runtimes. Additional selected
production dependencies require a version-pinned manifest in the external
workspace before installation. Preserve notices. Do not add a renderer,
maintained script or fixture to Promptlings.

## Inspect the delivered representation

- Read the actual figure at its intended display size. Inspect readable
  excerpts and highlight bounds, not only thumbnails.
- Check that crop, scaling and annotations preserve the evidence and that
  comparisons use compatible units, context and scale.
- Check text contrast and that color is not the only carrier of meaning.
  Avoid shrinking a crowded view until labels become unreadable.
- Preserve real captures and accepted visual-design samples when a document's
  light/dark mode changes. Adapt authored explanatory graphics through their
  own palette, not blanket pixel inversion.
- Provide editable source and accessible descriptions. Check the actual
  destination's embedding, links and full-size inspection.
- Own and release only this task's render/browser processes. A process exit
  or a partial file is not proof of completed rendering.

Use a specific failed check to drive revision. Rerender affected outputs, not
every unchanged asset. Keep final motion review, audio review and rehearsal
with the workflows that actually produce those media.
