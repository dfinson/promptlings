# Human specification template

Write `specs/<slug>.md` for the person deciding what to build and why.
Aim for one or two pages without discarding the explanation to meet a size
target. The reader must understand the plan without the conversation, source
tickets, or execution plan.

Use no tables unless there is no other way to present necessary information.
Being shorter, conventional, agent-parseable, or useful for tracking is not
sufficient. This template needs no tables. Use connected prose, not a disguised
table of labelled fragments.

Give every delivery lane a meaningful task name and its own section under How. Task names
describe the work, such as "Preserve zero-valued report amounts", not lane codes
or slogans such as "Improve reliability". Explain how the tasks connect.
Do not add acceptance IDs, lane keys, file inventories, or coupling bookkeeping
to explain the plan. If executable delivery needs that metadata, obtain user
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

Explain the intended behavior and scope in ordinary language. Preserve exact
business values and constraints. Distinguish observed failures from proposals.

## How

Explain the overall approach and how the named delivery lanes work together.

### <Meaningful delivery lane name>

Connect current behavior to the concrete proposed change, why that mechanism
addresses the problem, and what the user will experience. Include consequential
interfaces and failure behavior. Keep unresolved choices visibly conditional.

State what this lane owns and does not own, which named lanes or human decisions
it depends on, and its independently verifiable completion conditions. Use
connected prose or a short acceptance list where that is easier to check.
Distinguish logical data flow from an established implementation prerequisite.

### <Next meaningful delivery lane name>

Explain this lane's mechanism, responsibilities, boundaries, prerequisites and
acceptance, and how it connects to the preceding work. Add only as many lane
sections as the proposal actually needs.

## Validation

Explain observable success, including the complete user journey when required,
and the important failure cases. Keep planned checks distinct from results.
Do not claim that a planned check has run.

## Decisions

Explain each material choice the human must make, the supported recommendation
and its rationale, and what work waits on the answer. Do not invent acceptance.
If there are no open choices, say so briefly.

## Out of scope

State material exclusions and why the proposal does not include them.

## Changelog

Record post-approval changes with their dates, reasons, and prior approval SHA.
Do not invent amendment history for a new draft.
```

## Approval checks

The human specification owns intended behavior, scope, rationale, named lane
responsibilities and dependencies, observable acceptance, and human decisions.
A writing or revision request produces this artifact, not an
unsolicited execution brief.

Read the narrative without its links or execution plan. The reader must be
able to explain the concrete problem, actual proposal, why it should address
the problem, what each named lane owns and waits on, how the tasks connect,
resulting behavior, acceptance, and open
decisions. Headings, fewer words, and preserved identifiers do not establish
this. Revise the whole artifact when the explanation fails.

If the human authorizes an execution plan to start delivery, it owns exact
operational metadata and maps every criterion and task back to this explanation.
Resolve contradictions and approve both files at the same commit before lanes
start. Use the [execution-plan rules](execution-plan-template.md#execution-plan-rules)
for criteria, write sets, dependency checks, and gates. A readability edit cannot
silently change required behavior or widen an operational contract.
