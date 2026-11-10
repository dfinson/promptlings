# Human specification template

Write the specification in session artifacts or the user's chosen external
system for the person deciding what to build and why. Use a tracked repository
path only when the user explicitly authorizes it. Content approval is separate
from permission to commit the artifact. Preserve an accessible approved
snapshot with its immutable version or exact-byte SHA-256 and approval reference.
The reader must understand and judge the proposal without the conversation,
source tickets, or execution plan. Scale detail to consequential behavior and
decisions, not a universal page limit.

Use no tables unless there is no other way to present necessary information.
Being shorter, conventional, agent-parseable, or useful for tracking is not
sufficient. This template needs no tables. Use connected prose, not a disguised
table of labelled fragments.

Give every delivery lane a meaningful task name and its own section under How. Task names
describe the work, such as "Preserve zero-valued report amounts", not lane codes
or slogans such as "Improve reliability". Explain how the tasks connect.
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
Keep lane ownership, scope boundaries, known prerequisites, concrete requirements,
observable acceptance, essential interfaces, failure behavior, exact business
constraints, and decision rationale here. A narrative without those delivery
contracts is not a sufficient specification. An unknown assignee or dependency
stays unknown rather than being invented.

```markdown
# <Meaningful outcome>

## Why

Describe the concrete current situation, who encounters it, its consequence,
and why changing it matters. Ticket links can support this explanation but
cannot replace it.

## What

Explain the intended experience and scope in ordinary language. Use concrete
examples of the normal journey and consequential failure cases. State what
changes and what remains unchanged, retaining exact business values and
constraints. Distinguish observed failures from proposals.

## Decisions

Put choices that change the proposal before the detailed work. Explain the
supported recommendation, alternatives that matter, their consequences, and
what depends on the answer. Keep recommendations distinct from agreements.
If there are no open choices, say so briefly.

## How

Explain the overall mechanism, why it addresses the problem and how the named
tasks work together. Keep the level of detail sufficient to judge feasibility
and consequential tradeoffs. Describe only established prerequisites.
When planning delivery lanes, maximize safe concurrency and keep implementation
dependencies distinct from PR merge order. PRs are the default delivery review
boundary, with stacks for consumers of passing unmerged producers.

### <Meaningful delivery lane name>

Start with current behavior, the concrete proposed change, why it addresses the
problem and what the user will experience. Keep unresolved choices conditional.

State what this lane owns and does not own, which named lanes or human decisions
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

### <Next meaningful delivery lane name>

Explain this lane's mechanism, responsibilities, boundaries, prerequisites and
acceptance, and how it connects to the preceding work. Add only as many lane
sections as the proposal actually needs.

## Validation

Explain observable success, including the complete user journey when required,
and the important failure cases. Keep planned checks distinct from results.
Do not claim that a planned check has run.

## Out of scope

State material exclusions and why the proposal does not include them.

## Changelog

Record post-approval changes with their dates, reasons, and prior approved
artifact version or content hash.
Do not invent amendment history for a new draft.
```

## Approval checks

The human specification owns intended behavior, scope, rationale, named lane
responsibilities and dependencies, observable acceptance, and human decisions.
A writing or revision request produces this artifact, not an
unsolicited execution brief.

Assess coverage and comprehension separately. Trace each material requirement,
constraint and preserved case to the proposal, and each proposed change back to
its purpose or justified support work. Check cross-requirement interactions,
not only individual acceptance statements.

Read the guide-level explanation without commands, path inventories or links.
The reader must be able to explain the problem, proposal, reason, consequential
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
