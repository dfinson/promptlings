# Human specification template

Write the specification in session artifacts or the user's chosen external
system for the person deciding what to build and why. Use a tracked repository
path only when the user explicitly authorizes it. Content approval is separate
from permission to commit the artifact. Preserve an accessible approved
snapshot with its immutable version or exact-byte SHA-256 and approval reference.
The reader must understand and judge the proposal without the conversation,
source tickets, or execution plan. Scale detail to consequential behavior and
decisions, not a universal page limit.

First synthesize the smallest coherent mechanism using existing capabilities.
Keep the complete opportunity catalogue, selected implementation contract,
optional experiments and policy choices distinct. A request for comprehensive
understanding does not select every discovered opportunity for delivery.
The main reading path must make the referent of "implement it" unmistakable.

Use a visual-led, standalone HTML reading copy by default, following
[the document guidance](../../design-writing/references/html-specifications.md),
unless the user or owning destination specifies another format. The structure
below defines the content, not a requirement to deliver raw Markdown.
Editable source and the generated reading copy are one proposal at the same
revision, not a companion execution plan. Preserve the exact reviewed version
in the approval record.

Use representative views, comparisons and sequences to make consequential
design and mechanisms judgeable before implementation. Keep the precise
contract visible beside the explanation. Do not add a summary or decorative
images above an unchanged text wall. Bounded interactions may let the reader
change an assumption while acceptance criteria remain fixed. Provide reset,
accessible static/print equivalents and no implication of approval.

Use no tables unless there is no other way to present necessary information.
Being shorter, conventional, agent-parseable, or useful for tracking is not
sufficient. This template needs no tables. Use connected prose, not a disguised
table of labelled fragments.

Describe the selected mechanism under How. Give distinct necessary tasks their
own meaningful sections when they help explain the change, not one section
per research heading. Names describe behavior, such as "Preserve zero-valued
report amounts", not lane codes or slogans. Explain actual relationships.
Explain the experience and reasoning at guide level, then add reference-level
detail where exact contracts matter. Both can live in this artifact. A required
signature, compatibility rule or failure condition must remain precise when it
affects the decision, even if it is technical. Connect that detail to the same
examples and behavior instead of repeating an inventory.

Do not add acceptance IDs, lane keys, file inventories, or coupling bookkeeping
to explain the plan. An "implementation-ready" label does not make these fields
part of a human specification. If executable delivery needs metadata, obtain user
authorization for an [execution plan](execution-plan-template.md). Do not
create a companion document merely to move unreadable content elsewhere.
Keep mechanism responsibilities, scope boundaries, genuine prerequisites, concrete requirements,
observable acceptance, essential interfaces, failure behavior, exact business
constraints, and decision rationale here. A narrative without those delivery
contracts is not a sufficient specification. An unknown assignee or dependency
stays unknown rather than being invented.

```markdown
# <Meaningful outcome>

## Why

Describe the concrete current situation, who encounters it, its consequence,
and why changing it matters. Identify the observed problem separately from
broader optimization opportunities. Ticket links can support this explanation but
cannot replace it.

## What

Explain the intended experience and scope in ordinary language. Use concrete
examples of the normal journey and consequential failure cases. State what
changes and what remains unchanged, retaining exact business values and
constraints. State the bounded implementation being recommended and why it
is sufficient. Distinguish observed failures from proposals.

## Decisions

Put choices that change the proposal before the detailed work. Explain the
supported recommendation, alternatives that matter, their consequences, and
what depends on the answer. Keep recommendations distinct from agreements.
If there are no open choices, say so briefly.

## How

Explain the overall mechanism, why it addresses the problem and how the named
tasks work together. Keep the level of detail sufficient to judge feasibility
and consequential tradeoffs. Describe only established prerequisites.
Reuse current functionality before introducing new abstractions or services.
One coherent change normally stays in one reviewable patch. Describe a delivery
split only when its independent outcome, risk or dependency justifies it.

### <Selected mechanism or necessary task>

Start with current behavior, the concrete proposed change, why it addresses the
problem and what the user will experience. Keep unresolved choices conditional.

State what this mechanism changes and preserves, which genuine prerequisites or decisions
it depends on, and its independently verifiable completion conditions. Use
connected prose or a short acceptance list where that is easier to check.
Distinguish logical data flow from an established implementation prerequisite.

#### Contract details (only where needed)

Explain essential interfaces, exact rules, interactions and failure behavior
through the preceding examples. State one independently assessable behavior at
a time, with its trigger and outcome. Separate interacting cases instead of
packing them into a single paragraph. Preserve existing scenarios and constraints
when revising. This is a precise behavioral/design contract, not a command list
or a line-by-line implementation recipe. Omit this heading when the task's
explanation already carries the necessary precision.

### <Another necessary mechanism, only when needed>

Explain its mechanism, responsibilities, boundaries, prerequisites and
acceptance, and how it connects to the preceding work. Add only as many
sections as the proposal actually needs.

## Validation

Explain observable success, including the complete user journey when required,
and the important failure cases. Keep planned checks distinct from results.
Use existing evidence mechanisms where sufficient. Do not let acceptance
silently require a new coordination, metrics or evidence framework outside
the selected change. Do not claim that a planned check has run.

## Other opportunities (only when the request includes a catalogue)

Retain the complete opportunity inventory with concise evidence and selection
status. Distinguish unselected opportunities, experiments and policy decisions.
These entries are not implementation obligations or an implied backlog.
Do not repeat full requirements, ownership and acceptance machinery for each.

## Out of scope

State material exclusions and why the proposal does not include them.

## Changelog

Record post-approval changes with their dates, reasons, and prior approved
artifact version or content hash.
Do not invent amendment history for a new draft.
```

## Approval checks

The human specification owns selected behavior, scope, rationale, necessary
responsibilities and dependencies, observable acceptance, and human decisions.
A writing or revision request produces this artifact, not an
unsolicited execution brief.

Assess coverage and comprehension separately. Also assess proportionality.
Trace each selected requirement,
constraint and preserved case to the proposal, and each proposed change back to
its purpose or justified support work. Check cross-requirement interactions,
not only individual acceptance statements.

Read the guide-level explanation without commands, path inventories or links.
The reader must be able to explain the problem, bounded proposal, reason, consequential
constraints, task responsibilities and prerequisites, acceptance and open
decisions. Reference-level detail must clarify that explanation, not introduce
an undisclosed behavior or choice. Revise when decisions are buried, paragraphs
mix independently assessable rules, or repeated qualifications hide the point.
An executive summary above an unchanged dense body does not pass. Neither a
coverage checklist nor fewer words proves comprehension. Restructure without
dropping requirements, and retain unresolved intent rather than guessing it.

If the human authorizes an execution plan to start delivery, it owns exact
operational metadata and maps every criterion and task back to this explanation.
Resolve contradictions and approve the identified versions of both artifacts
before the affected lanes start, without requiring a product Git commit.
Use the [execution-plan rules](execution-plan-template.md#execution-plan-rules)
for criteria, write sets, dependency checks, and gates. A readability edit cannot
silently change required behavior or widen an operational contract.
