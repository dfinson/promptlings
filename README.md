<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo-dark.png">
    <img src="logo.png" alt="promptlings" width="321">
  </picture>
</p>

Custom agents and reusable skills for coding assistants. Use them to review a
pull request, work through a technical problem, carry context between sessions,
or make a technical demo or live presentation.

Agents are Markdown files that define a role and its working rules. Skills
provide methods an agent can load for a particular task. They run in your
assistant, including GitHub Copilot CLI and Claude Code.

## Choose an agent

| Agent | What it does |
| --- | --- |
| [the-nitcracker](agents/code-review/the-nitcracker.agent.md) | Reviews a PR with inline findings and a narrative explaining the change, its design choices, and its assumptions. |
| [PR Walkthrough](agents/code-review/pr-walkthrough.agent.md) | Maps a PR's architecture and important decisions before you review the diff. Read-only, with output in conversation. |
| [Sparring Partner](agents/reasoning/sparring-partner.agent.md) | Reviews PRs and changes for correctness, design consequences, and regression protection. Also works through designs, debugging hypotheses, plans, and testing questions with you. |
| [Memory Manager](agents/context/memory-manager.agent.md) | Saves session context to Basic Memory and retrieves earlier decisions and unfinished work. |
| [Technical Demo](agents/media/technical-demo.agent.md) | Produces a technical explainer or hands-on demo, from story and script approval through recording, narration, and review. |
| [Interactive Presentation](agents/media/interactive-presentation.agent.md) | Builds a locally served interactive experience (a guided storyline of working mini-app stops, embedded demo videos and workshop data capture) and a presenter script for a human to deliver live, verified for the stage. |
| [Spec Master](agents/orchestration/spec-master.agent.md) | Coordinates approved spec-backed delivery. Implements a coherent single lane directly, or delegates independent lanes and uses revision-bound merge gates. |

[Artifact Inspector](agents/maintenance/artifact-inspector.agent.md) is a
maintainer and CI helper for inspecting agent and skill definitions.

## Install

Promptlings installs with one command on Windows, macOS, and Linux. The only
prerequisite is [Node.js](https://nodejs.org) 22.20 or later.

```bash
npx promptlings
```

The installer selects all agents and the supporting toolchain by default,
including Basic Memory, browser automation, and video tools.
It prints a plan and asks for approval before installing.

For just the three ensemble agents and bundled Promptlings skills:

```bash
npx promptlings publish --review --no-readside
```

Restart your assistant after installation. See the [installation guide](docs/installation.md)
for supported systems, component selection, installation from source, manual
installation, and the Claude Code plugin.

Memory Manager can help set up Basic Memory project routing.

## Try it

Select an agent in your assistant and give it a task:

```text
Walk me through this PR before I review it.
Help me work out why this test passes locally but fails in CI.
Save this session so I can pick it up in another worktree.
Make a demo explaining this change to a new contributor.
```

The [skills directory](skills/) also contains methods for investigation, test
analysis, writing, narration, and design documents. You can ask your current
agent to use one without switching personas.

### Spec delivery

**Draft status:** this branch proposes staged v2 after a complete 28-trial
matched comparison and native installed-agent execution. It used 3.1% more
token-weighted usage and 1.3% more observed elapsed time than Baseline.
Both multi-lane trials preserved the three approved owner sessions and ready
concurrency. A whole-spec revision still added unrequested malformed-input
requirements, so the draft does not claim complete contract qualification.
The [measured results](tests/spec-delivery/results.md) retain that defect,
the accepted cost tradeoff and the rejected approaches.

For a feature too large for one coding session, select Spec Master and describe
the feature, or ask your current agent:

```text
Use spec-delivery to build this feature.
```

The [spec-delivery](skills/spec-delivery/SKILL.md) skill writes a human-readable
specification explaining the problem, concrete proposal and rationale, with a
meaningfully named section for each lane, its responsibility, dependencies and
observable acceptance. It uses no tables unless there is no
other way to present necessary information. Writing-only requests produce that
specification alone. When delivery needs a separate execution plan holding
exact criteria, commands, file scope and dependencies, it asks permission
before creating one. You approve the specification and any authorized
execution plan at the same commit before tasks start.
One coherent lane runs directly on a delivery branch. Multiple lanes use named,
isolated child sessions, with independent ready work started together. A hard
dependency needs an unavailable producer contract or a genuine ordering
invariant. Shared files and existing generic interfaces alone do not create one.

For human-marked critical behavior, the owner writes tests and a scratch JSON
request containing proposed product contents. The bundled helper's `apply`
operation commits the tests, requires an intended failure, then writes those
contents. A rejected check leaves its evidence and revision available for repair.
It does not authorize an earlier direct edit or reconstructed test history.

Multi-lane handoffs use the bundled Python 3.9+ and Git
[gate helper](skills/spec-delivery/scripts/gate.py) to bind exact scope,
pass-on-head, intended fail-on-base, merge and immediate merged-criteria runs.
Optional `--record` saves complete evidence under authorized scratch and returns
check output, revisions, the record path and its SHA-256 without every Git
transcript. Preserve the full record, not just its compact response.
The master still reviews semantics and criterion coverage. Final acceptance
executes the actual specified E2E flow, retains unavailable review and human
judgments as unverified, and stops before main merge. Approval does not
authorize a PR automatically.

The [benchmark protocol](tests/spec-delivery/protocol.md) and
[measured results](tests/spec-delivery/results.md) preserve the matched writing,
dependency, gate, authorization and real execution cases behind this design.

### Review ensemble

To combine the reviewers, ask your current coding agent:

```text
Run the review ensemble on this branch against origin/main.
```

The [review-ensemble](skills/review-ensemble/SKILL.md) skill runs the-nitcracker,
PR Walkthrough, and Sparring Partner independently in parallel.
Your current agent investigates their findings and brings the results together.
The host must support parallel subagents and provide all three identities.

Sparring Partner is the portable successor to the built-in rubber-duck role.
For PR and change reviews it loads `technical-investigation`, `design-analysis`,
`test-analysis`, and `evidence-verification` to trace behavior, examine design
consequences, assess regression protection, and verify candidate findings.
These methods form an adaptive flow, not four separate reports. The invoking
agent still independently verifies and synthesizes the ensemble's results.

You can also select Sparring Partner directly for a standalone PR, branch diff,
or local change review. For other reasoning questions it selects only the
relevant methods. The historical ensemble with built-in rubber-duck remains
available when explicitly requested, rather than as an automatic fallback.

Review returns analysis. To have verified issues repaired too, ask for that:

```text
Run the review ensemble on my staged and unstaged changes, fix the verified in-scope issues, and verify the repairs.
```

Review does not authorize posting comments, approving, or merging.

## Example output

The [examples](examples/) contain a review and a walkthrough of the same real
pull request. They disagree about whether a code path is reachable. Read them
side by side to see what the agents produce and why findings still need checking.
The examples include reproduction instructions and disclose a wording edit.

## Contributing

Keep each agent's responsibility explicit. Put reusable methods in skills
rather than adding another persona for every task. See the
[contributor guide](docs/contributing.md) for checks, review regression cases,
and design provenance.

## License

[Apache 2.0](LICENSE).
