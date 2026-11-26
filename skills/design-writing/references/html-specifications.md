# Visual specifications and intent briefings

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

## Design a lean reading path

People read many specifications a day. A spec exists to give a human the
context to judge a proposal quickly. Judge every heading, paragraph, figure
and component by whether it shortens that path.

- State each fact once, where the reader needs it. Link to it instead of
  restating it in an overview, a closing summary, a caption and a card.
  Repetition is a defect, not reinforcement. Leanness removes duplicates,
  bookkeeping and padding. It never removes a required constraint, decision,
  failure case or acceptance condition.
- Show before telling. Use a screen, stepped diagram, comparison, option card,
  state explorer or checklist whenever it conveys the point faster than prose.
  Prose says what to notice and why it matters. A wall of text is the last
  resort, not the first.
- Use one table of contents, on the right only. In Starlight, limit the
  in-page contents to h2 with
  `tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 2 }`. Hide the
  left sidebar on a single-page spec, for example with route middleware that
  sets `starlightRoute.hasSidebar = false`. A multi-page spec may keep a left
  list of page links only, without heading sublists. Never show a nested
  outline, and never show the same headings on both sides.
- Use few headings. An h2 marks a reader question worth jumping to. Most
  content needs no h3, and h4 is never used to subdivide. An option, rule,
  screen or appendix entry does not get its own heading: use a card, a
  labeled step or a disclosure.
- Put status, version, owner and review round in a one-line header, not a
  metadata block, badge row or color legend.

The opening screen carries the whole picture: a title, a one-sentence outcome,
a framed key visual of the proposed screen or mechanism with its caption, the
selected change in three steps or fewer, the decision sought, and a compact
in-scope and out-of-scope pair. Nothing later repeats it. Avoid oversized hero
banners, decorative card grids and marketing copy.

End with the open decision or the next action in one line. Do not add a
closing synthesis that restates the opening. Reference material follows as
cards or disclosures.

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

Use meaningful requirement and question names, not machine indexes.
Structure must explain the content without a color legend.

Each section answers one reader question. Place its figure beside a short
explanation of what to notice and why it matters, followed by the exact
requirements or acceptance it clarifies. Keep comparable views at comparable
scales. Use several readable views, or one diagram revealed step by step,
instead of a crowded master diagram.

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

## Design the page deliberately

A spec is a product people use, not a word-processor document rendered to
HTML. Decide how the reader will absorb each part, then choose the element
that serves it.

Start from Starlight, its documented configuration and a coherent theme
plugin. Add purpose-built components where library components do not present
the content well. Build them in the spec's external workspace, style them with
the site's design tokens and reuse them across pages. They are designed parts
of the page. Do not patch library output with ad hoc CSS overrides, rehype
fixes or scripts that hide defects. Check the installed version's actual
exports and behavior before selecting an integration, and inspect real keyboard
behavior instead of treating a library's name as an accessibility guarantee.

Define a small token set for both appearances: page surface, raised surface,
text, muted text, accent, focus and one status set. Check the contrast of every
text and background pairing that appears, including diagram labels, inactive
controls, captions and callouts. Never ship default library or diagram colors
without checking them against the theme.

Choose components by content, not by formula:

- **Screen journey:** one screen at a time, framed, with its caption and
  consequential questions beside it. The reader advances by clicking the
  highlighted control on the screen, with arrow keys or through a thumbnail
  filmstrip. Show the position and allow zoom. Never auto-advance.
- **Image set:** a manual gallery with captions, visible position, keyboard
  arrows, thumbnails and zoom (for example `starlight-image-zoom`). Use it for
  unordered views. An ordered journey uses the screen journey instead.
- **Stepped diagram:** Next reveals one stage at a time and highlights what
  changed, with Previous, Reset and Show all. Use it when a mechanism is easier
  to follow as a sequence than as one finished picture.
- **Decision cards:** options inline beside the affected behavior, with the
  recommendation marked, the consequence on each card and the answer control
  from [contextual review](../../spec-delivery/references/collaborative-review.md).
- **State explorer:** selectable states and transitions for a lifecycle whose
  rules matter.
- **Acceptance checklist:** each item linked to the requirement it proves.
- **Reference cards or disclosures:** appendix entries, citations and supporting
  detail, instead of tables.

Every component has keyboard operation, visible focus, accessible names and a
reduced-motion mode. Print and no-JS rendering show every step, branch, screen
and option expanded.

### Diagrams

Naive Mermaid is not acceptable: the default theme, automatic layout with
crossing edges, dozens of nodes, unlabeled arrows and low-contrast labels.
Invoke `technical-illustration` for consequential figures and prefer authored
SVG when spatial layout carries meaning. If Mermaid is used, map its theme to
the site tokens in both appearances, label edges with their meaning and keep
each view readable at delivery size. Split or step-reveal a diagram rather than
adding nodes. Inspect the rendered result, not the source. A diagram that needs
a color legend is redesigned.

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
- Provide stable in-page links. The single right-hand h2 contents list can
  become an in-flow list on narrow screens.
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

Show a journey through the screen journey component, not tabs styled as one.
Provide named states, a clear reset and links to the relevant contract.
Keep exact requirements and acceptance outside interactive panels. A
printable account must preserve all branches. State model simplifications
where they affect the conclusion. Illustrative counters are not measured
time, cost or performance.

If timed playback is selected, it is finite and reader-started, with automatic
state highlighting, pause and reset. Switching scenarios stops the prior run.
A static diagram is not timed playback. Verify the chosen component's
completion and reduced-motion reading rather than silently replacing a
requested player.

Scenario controls neither record human approval nor launch work. Every
specification site is commentable through
[contextual review](../../spec-delivery/references/collaborative-review.md).
Use its feedback backend, reviewer attribution and version-bound
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

Check the page as a reader would. There is exactly one contents list, on the
right, with h2 entries only. No fact, requirement or rationale is stated twice.
The opening carries the whole picture and nothing restates it. Each rendered
diagram is legible with sufficient contrast in both appearances. Every
component works by keyboard and prints expanded. Commenting works on the
served build.

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
