---
name: ab-testing
description: Route empirical comparisons of prompts, skills, agents, or workflows to Experiment Director. Use for A/B tests, competing revisions, behavioral regressions, or ablations when deciding between alternatives needs experimental evidence, not for routine fixes or deterministic test execution.
---

# A/B Testing

## Decide whether to delegate

Use this routing method when the caller requests a controlled comparison,
needs evidence for a material improvement claim, or needs to isolate which
instruction or workflow change explains a regression. Inspect existing
results first. Reuse applicable evidence instead of automatically rerunning it.

Ordinary bugs with a deterministic reproduction belong with investigation
and focused tests. Merely editing an agent or considering two implementations
does not require an experiment. If the evidence already answers the question,
return that answer and its scope.

## Bind the assignment

Resolve `experiment-director` through the host's actual agent registry,
including namespaces when present. Ensure its worker can load the installed
`comparative-evaluation` skill. If either is unavailable, report the exact
missing capability. Do not substitute a generic agent or simulate the role.
Check availability without loading the full experimental method into the parent
merely to prepare the brief. The director loads and applies that method.

Choose the smallest supported execution surface:

- **Subagent:** a bounded assignment that can finish within the current task,
  such as qualifying a comparison or evaluating supplied artifact variants.
- **Child session:** work needing its own persistent conversation or isolated
  checkout, longer execution, resumable rounds, or direct user decisions.
  Supply the director identity through the host's supported agent selection.

A separate context is not filesystem isolation. Verify workspace and data
access when required. If the appropriate surface is unavailable, return the
blocker. A supported alternative needs equivalent boundaries and must fit the
caller's authority. Do not silently downgrade an isolated or persistent task.
For a protocol-only request, delegate protocol design only. Do not launch
target trials or judges.

Give the director one self-contained brief:

- The user's relevant request verbatim, the comparison question and decision
  it should inform.
- Baseline and candidate identities or paths, existing results and source
  access. Mark unknowns instead of inventing revisions or models.
- Required outcomes, preserved behavior and any known hard failure conditions.
- Requested stage: protocol only, bounded pilot, or confirmation.
- Permitted tools, data exposure, filesystem writes, side effects and
  authorized artifact destination.
- Existing spending, concurrency and stopping constraints, including any
  unresolved execution permission.
- Required return: execution status, scoped verdict, evidence references,
  failures, resource accounting and uncertainty.

Distinguish confirmed requirements from suggestions. The director resolves
experimental details, qualifies the tasks and graders, and proposes missing
limits before costly execution. Do not make the parent design the whole study
or turn an open question into a presupposed improvement.

## Consume the result

Before presenting the director's proposal or final results to the user, invoke
`reasoning-first-writing` through the host's skill mechanism. If invocation is
unavailable, read its `SKILL.md` through the host's documented discovery
location. If it cannot be loaded, report the missing dependency and stop the
writing task without installing or substituting another skill.

Explain the decision, the comparison's rationale, the evidence and its
consequences for the recommendation. Preserve the director's protocol fields,
evidence attribution, verdict scope, hard failures, accounting gaps and
uncertainty. The writing skill governs expression, not experimental design,
execution or grading. Apply it to these user-facing deliverables rather than
routine progress updates.

Check that the result answers the original question at the reported revision
and agreed scope. If the experiment's results cannot answer it, open the
user-facing report with **The experiment failed to answer the question.**
Immediately explain the concrete evidence gap and unsupported conclusion,
even if the director buried them. Do not present completed trials or a
narrower post-hoc question as success. Preserve the actual execution status
and comparison verdict. A supported negative or equivalence result answers
the question, and a protocol-only proposal remains Planned.

Preserve `Partial`, `Blocked` and `Inconclusive` results. A failed hard
requirement cannot be traded for style or lower cost.

Keep the parent responsible for the final recommendation. Verify consequential
claims against returned evidence with `evidence-verification` when needed.
Report missing evidence rather than accepting a worker's confidence as proof.
The assignment does not authorize candidate repair, installation, promotion,
publication or further rounds beyond its boundary.
