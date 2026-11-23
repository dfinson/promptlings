# Library-backed specifications and intent briefings

Use this reference for human-facing proposals, specifications and demo or
presentation approval packages. The active
method still owns their behavior, approval and delivery. Explicit user
destinations, tracker templates and requested formats take precedence.

## One proposal, two representations

Keep one authoritative editable source set and its figure sources. Generate a
reading copy from those inputs, binding it to their revision
or exact-byte hashes. Regenerate after changes rather than independently
editing two proposals. Approval identifies the version actually reviewed.
The reading copy is not a second plan or an execution manifest.

Specifications default to MDX on Astro Starlight, built as a static site and
served locally. Use bundled assets and installed, version-pinned libraries,
not runtime CDNs. Static HTTP serving is not a feedback backend and root-relative
site paths do not imply that the output opens through `file://`.

Explicit formats and destinations win. Non-specification proposals and media
approval briefings retain their standalone HTML default: embed library styles, images/SVG and licensed fonts
or use a system-font stack. That file must open from disk without a server,
network connection or adjacent assets. An explicitly required offline spec
copy follows this same contract.

Preserve complete static and printable reading at the same source revision.
Core requirements, decisions, figures and all illustrated branches must remain
readable without interactive controls. Use a supported library export or
ordinary static pages rather than promising that a hidden player prints.
Verify an offline copy separately when offline delivery is required.

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

Lead with the selected outcome and actual decision sought. Omit redundant
"not implemented or approved" disclaimers and internal investigation labels.
Engineering
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

Use one navigation hierarchy, with page groups and only the headings useful
for orientation. Do not duplicate it in a second contents rail or list every
subheading. Use meaningful requirement and question names, not machine indexes.
Structure must explain the content without a color legend.

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

Use a coherent, established component library for layout, styling, navigation,
buttons, appearance controls, disclosures and comparisons. For specification
sites, use documented components, props, configuration and theme plugins,
not custom component CSS, JavaScript, timers or presentation repair scripts.
Keep authored work in the content, figures and domain scenarios. Inspect the library's real
keyboard behavior and styling instead of treating its name as an accessibility
guarantee.

Starlight provides document navigation, native chrome and content components.
Use its native configuration first, adding a compatible theme plugin only for
an identified unmet requirement. Use supported components for disclosures,
sequences and image inspection. A framework's presence does
not make a hand-built widget library-owned. Check the installed version's
actual exports and behavior before selecting an integration.

For standalone briefings, daisyUI with Tailwind is a suitable low-runtime option: its documented
[theme controller](https://daisyui.com/components/theme-controller/) and
[radio comparisons](https://daisyui.com/components/tab/) work through CSS.
Its [native-details disclosures](https://daisyui.com/components/collapse/)
can keep supporting content available without an application framework.
Use actual components, not handwritten substitutes with borrowed class names.

Select and pin available versions for the production. Bundle the required
styles and assets, embedding them for a standalone copy and retaining licenses. Build dependencies stay
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
indicators, callouts and figures. Use a dark initial appearance for HTML
specifications unless the user explicitly requests otherwise. For other
briefings, a light initial appearance remains a reasonable default.
Cross-visit persistence is not required.

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

Show one journey screen at a time with its explanation and consequential
questions beside it. Use a real library player or carousel when needed, not
tabs styled as one. Provide named states, a clear reset and links to the relevant contract.
Keep exact requirements and acceptance outside interactive panels. A
printable account must preserve all branches. State model simplifications
where they affect the conclusion. Illustrative counters are not measured
time, cost or performance.

If timed playback is selected, it is finite and reader-started, with automatic
state highlighting, pause and reset. Switching scenarios stops the prior run.
A static diagram is not timed playback. Qualify the actual library integration,
including completion and reduced-motion reading, rather than hand-rolling it
or silently replacing a requested player.

Scenario controls neither record human approval nor launch work. Requested
collaboration follows [contextual review](../../spec-delivery/references/collaborative-review.md).
Use its separate feedback backend, reviewer attribution and version-bound
incorporation contract. Do not treat illustrative screen markers as
reviewer-created annotations or option picks as approval.

## Check the actual reading copy

For a site, serve the exact build and inspect all pages through HTTP. For a
standalone or required offline copy, open it from a different directory with
networking disabled.
Check every embedded figure, internal link, keyboard control, theme and
required interaction. Inspect dense sections and representative figures at
desktop and narrow widths, including 320px, and inspect print output.
For an example, exercise every named branch and reset against its written
rule. Preserve usable static content when optional interaction is unavailable.

Recheck hidden panels, theme-swapped figures and print content after any
library or theme change. A build, a library name or a previous successful
export is not evidence that the current reading copy preserves every branch.
Keep a prior source baseline when revising and compare required content,
decisions and source evidence semantically. Word counts or word-multiset
comparisons can flag loss, but cannot establish meaning or comprehension.

Check source-to-copy agreement and image evidence, not just styling. Ask
whether a reader can explain the outcome, mechanism, constraints, choices and
acceptance from the artifact itself. Mechanical checks do not establish human
understanding or approval.
