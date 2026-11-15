# Visual, standalone intent briefings

Use this reference for human-facing proposals, specifications and demo or
presentation approval packages. The active
method still owns their behavior, approval and delivery. Explicit user
destinations, tracker templates and requested formats take precedence.

## One proposal, two representations

Keep one authoritative editable source and its figure sources. Generate a
polished HTML reading copy from those inputs, binding it to their revision
or exact-byte hashes. Regenerate after changes rather than independently
editing two proposals. Approval identifies the version actually reviewed.
The reading copy is not a second plan or an execution manifest.

Make the file self-contained: inline styling, embedded images/SVG, and
embedded licensed fonts or a suitable system-font stack. It must open by
itself from disk without a server, CDN, network connection or adjacent asset
folder. Core reading must not depend on JavaScript.

Keep working sources and evidence in session artifacts or the chosen external
system. Use the host's external artifact location for renders, production
dependencies and large outputs. Content approval does not authorize committing
these artifacts to product Git history.

## Design a reading path

Start with a genuine overview before the detailed sections: purpose, outcome,
selected scope, how the main parts fit and what the reader will judge.
Use placement, typography and grouping to make that the first reading level.
A contents rail helps navigation but cannot supply the overview's argument.
Where useful, let one representative visual orient the reader to the whole.

End the substantive reading path with a shorter synthesis of the outcome,
chosen mechanism, commitment boundaries and actual open decision. It should
leave the reader able to explain and own the proposal. Keep it visually
distinct and readable, not a row of unrelated cards or an inventory of
everything already said. Reference material may follow separately.

Lead with the selected outcome, status and decision sought. Engineering
synthesis comes before presentation: preserve the complete opportunity
catalogue as reference without making it the implementation contract.
The main path explains the smallest sufficient mechanism, preserved behavior
and acceptance. Layout, figures and interactions do not justify larger scope.
Build substantial proposals
around visual explanations of the problem, mechanism, important states and
consequential choices. Invoke `technical-illustration` for these figures.
A proposed interface needs representative screens before implementation.
Nonvisual work may benefit from sequences or comparisons. A genuinely brief
change can stay brief.

Each section answers one reader question. Place its figure beside a short
explanation of what to notice and why it matters, followed by the exact
requirements or acceptance it clarifies. Keep comparable views at comparable
scales. Use several readable views instead of a crowded master diagram.

Restructure text walls rather than wrapping them in cards, shrinking fonts,
turning paragraphs into images or hiding the contract behind toggles.
Consequential constraints, failure cases, open decisions and acceptance
remain visible. Secondary citations and supporting detail can be separate.
No word limit or image quota replaces the reader's task.

A visual should remove interpretation work by exposing a consequential
relationship. Do not attach one to every catalogue entry by formula or
repeat the complete explanation in both the figure and surrounding prose.
Keep optional experiments and policy alternatives clearly outside the
selected commitment until chosen.

For media briefings, show the overall film or live experience first, then
its selected segments with exact narration separated from explanatory prose
and inspected stills beside the relevant passage. End with the bounded
production decision. Reuse an existing script rather than silently rewriting
it while changing presentation. Do not turn the sprint inventory into a
feature-by-feature film or an execution manifest.

For changes to an existing UI or workflow, follow the shared
[comparison guidance](../../technical-illustration/references/comparisons.md):
actual Current remains unannotated, Proposed carries change explanations,
and visible actions/results connect to the exact contract. Use a different
visual form when no meaningful UI comparison exists. Essential scope and
acceptance stay visible outside popovers.

## Use established components

Use a coherent, established component library for navigation, buttons,
appearance controls, disclosures and comparisons. Keep custom work focused
on the domain model and document layout. Inspect the library's real
keyboard behavior and styling instead of treating its name as an accessibility
guarantee.

daisyUI with Tailwind is a suitable low-runtime option: its documented
[theme controller](https://daisyui.com/components/theme-controller/) and
[radio comparisons](https://daisyui.com/components/tab/) work through CSS.
Its [native-details disclosures](https://daisyui.com/components/collapse/)
can keep supporting content available without an application framework.
Use actual components, not handwritten substitutes with borrowed class names.

Select and pin available versions for the production. Compile the required
styles and embed them in the HTML, retaining licenses. Build dependencies stay
in the external workspace. Prefer an already suitable library over adding a
second competing component system. These instructions do not require a
maintained exporter, new app or repository-owned scripts.

## Apply researched layout principles

- Use descriptive, visually distinct headings and predictable grouping.
  [NN/g's heading-led scanning research](https://www.nngroup.com/articles/layer-cake-pattern-scanning/)
  supports a readable hierarchy, not a particular decorative theme.
- Provide stable in-page links and a contents list for long documents. A
  desktop contents rail can become an in-flow list on narrow screens.
  This is a layout choice, not a universal research requirement.
- [USWDS typography guidance](https://designsystem.digital.gov/components/typography/)
  recommends at least an effective 16px for body text, at least 1.5 line
  height for long passages and a good long-text target of 66 characters.
  Start around 18-20px and 60-70 characters, then inspect the chosen typeface.
  These starting values are not universal conformance thresholds.
- Use a bounded prose column within a responsive layout, as described in
  [GOV.UK's layout guidance](https://design-system.service.gov.uk/styles/layout/).
  Figures may extend beyond it. Keep captions and their images together.
- Use deliberate type roles, spacing, surfaces and semantic emphasis. Let
  them fit the subject rather than enforcing one house palette. Pair color
  with labels or shape. Avoid decorative card grids and oversized openings.
- Distinguish primary and secondary information using
  [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/).
  Never hide conditions of approval behind collapsed panels. Distill's
  [t-SNE explanation](https://distill.pub/2016/misread-tsne/) is an example of
  reasoning through visual comparisons, not proof that every spec needs an
  interactive article.

## Support both appearances and accessible reading

Provide a visible Light/Dark control with an accessible name, keyboard
operation and clear selected state. Preserve reading position and content
when switching. Keep both appearances legible across text, links, focus
indicators, callouts and figures. A light initial appearance is a reasonable
default; cross-visit persistence is not required.

Preserve actual capture colors and accepted visual-design samples. Adapt
authored explanatory graphics through theme-aware source or paired assets.
Do not invert pixels indiscriminately. Print in a readable light palette
regardless of the current screen theme.

Use semantic headings, landmarks, meaningful links, a skip link and visible
keyboard focus. Meet [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html):
4.5:1 for ordinary text and 3:1 for qualifying large text. Check actual library
states, including inactive comparison controls.

Reading content must [reflow at 320 CSS pixels](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
For diagrams that genuinely require two dimensions, provide bounded full-size
inspection and an accessible account instead of unreadably shrinking labels.
[Complex figures](https://www.w3.org/WAI/tutorials/images/complex/) need a short
identifying alternative plus accessible essential relationships or values.
Adjacent prose can supply that account without duplicating whole sections in
alt text.

Respect reduced motion. Printing must preserve requirements, figures,
explanations and all illustrated branches, with navigation chrome removed
and no clipped content.

## Make a rule explorable when that helps

Use small deterministic interactions, not a second full presentation. Keep
the same scenario and acceptance criteria while the reader changes a
consequential choice or assumption. Show the resulting state and its reason.
Expose a counterexample when another assumption favors a different option.
Do not rig a demonstration to guarantee the author's preferred conclusion.

Provide named states, a clear reset and links to the relevant contract.
Keep exact requirements and acceptance outside interactive panels. A
printable account must preserve all branches. State model simplifications
where they affect the conclusion. Illustrative counters are not measured
time, cost or performance.

Scenario controls neither record human approval nor launch work. A persistent
decision journal, backend or collaboration service needs its own authorized
scope. Use existing components and tools for bounded, task-specific behavior.

## Check the actual reading copy

Open only the HTML from a different directory with networking disabled.
Check every embedded figure, internal link, keyboard control, theme and
required interaction. Inspect dense sections and representative figures at
desktop and narrow widths, including 320px, and inspect print output.
For an example, exercise every named branch and reset against its written
rule. Preserve usable static content when optional interaction is unavailable.

Check source-to-copy agreement and image evidence, not just styling. Ask
whether a reader can explain the outcome, mechanism, constraints, choices and
acceptance from the artifact itself. Mechanical checks do not establish human
understanding or approval.
