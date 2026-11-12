# Comparisons that expose the change

Use the visual form that makes a material difference easiest to understand.
For changes to an existing interface or workflow, actual-current/proposed
views often provide the most useful context. For nonvisual behavior, a
sequence, input/output example or state diagram may be clearer. A small
specification does not require a functional prototype or a new application.

## Establish a comparable subject

Use the same subject, data, viewport, framing and relevant starting state
where the claim depends on a controlled comparison. Preserve recognizable
context and comparable scale. Identify the specific difference being shown.
A slider blending different documents, values or layouts can create a
meaningless hybrid. Use aligned views or a sequential explanation instead
when the states cannot be meaningfully superimposed.

Bind actual captures to their source revision and scenario. For a proposed
view, reuse available product components or a clearly identified browser-local
mockup of the real surface. State what is proposed or fixture-derived where
that affects the conclusion. A plausible screen does not prove that its
backend contract exists.

Capture read-only with safe, authorized data. Do not create real jobs, change
records or submit product actions merely to stage an illustration without
the caller's authorization. Exclude secrets and unrelated personal data.

## Keep Current and Proposed distinct

Current is the untouched baseline capture: no change-marker overlays,
annotation toggle or clickable change annotations. Adjacent plain text can
explain the proposed differences. Keep capture provenance available without
modifying the evidence pixels.

Proposed carries the change markers and their explanations. A marker should
explain a material change, its consequence or a relevant constraint, not
simply highlight a region. The same explanation should be reachable through
an accessible adjacent list, without requiring precise pointer targeting.
Preserve this distinction in full-size views and exported copies.

When annotations are interactive, activation must display the actual
explanation beside its point with clear current/proposed context. Another
marker switches the explanation. Repeated activation, Close, outside click
and Escape dismiss it. Return keyboard focus appropriately and remove stale
annotations when changing views. Keep popovers inside the viewport, targets
separate and labels readable on small screens.

State the user action, resulting behavior and important preserved behavior
beside the screen. Keep consequential decisions and requirements visible
outside popovers. Link the visible change to exact contracts and acceptance,
without hiding new backend semantics behind attractive UI.

## Respect the requested medium

Stills suit appearance and state comparisons. Use paired real recordings
when the request calls for video or motion/timing is the evidence. A still
or permanent side-by-side image cannot satisfy an expressly requested moving
reveal. Keep playback states and temporal anchors comparable and make
intentional back-and-forth reveals show the difference rather than decorate
it. Do not record video by default for ordinary PR communication.

Document themes style the surrounding presentation, not the pixels of actual
captures or already approved visual designs. Proposed mockups remain distinct
from observed execution. Do not add blanket production-origin warnings in
place of precise attribution.

## Verify the interaction people will perform

Exercise continuous human-speed pointer movement in both directions, release,
re-grab, movement beyond the handle, cancellation and reset. An endpoint jump
can pass while dragging fails midway. Verify the reveal tracks intermediate
positions and settles at the intended value. Test keyboard operation too.

For custom pointer controls, prevent incidental native image dragging and
selection from stealing the gesture. Use non-draggable images, avoid images
intercepting handle input, and prevent default drag behavior where appropriate.
Retain pointer capture and explicit cancellation recovery without disabling
keyboard or assistive access. Prefer an established accessible control or
native range input over inventing one.

Check annotation content, dismissal, focus return and view changes, not just
whether a marker receives a selected style. Inspect normal and full-size views,
light/dark surrounds, narrow screens and the actual offline export. Preserve
readable explanations for static reading and print. A working comparison is
not implementation acceptance of the proposed product change.
