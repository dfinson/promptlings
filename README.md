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

## Walkthrough

<https://github.com/user-attachments/assets/4d0d159a-39b8-4f21-b310-acf665c9ef8a>

## Choose an agent

| Agent | What it does |
| --- | --- |
| [the-nitcracker](agents/code-review/the-nitcracker.agent.md) | Reviews a PR with inline findings and a narrative explaining the change, its design choices, and its assumptions. |
| [PR Walkthrough](agents/code-review/pr-walkthrough.agent.md) | Maps a PR's architecture and important decisions before you review the diff. Read-only, with output in conversation. |
| [Sparring Partner](agents/reasoning/sparring-partner.agent.md) | Reviews PRs and changes for correctness, design consequences, and regression protection. Also checks intent and scope alignment or works through designs, debugging hypotheses, plans, and testing questions with you. |
| [Memory Manager](agents/context/memory-manager.agent.md) | Saves session context to Basic Memory and retrieves earlier decisions and unfinished work. |
| [Technical Demo](agents/media/technical-demo.agent.md) | Produces technical videos, including explainers and recorded demonstrations, from story and script approval through production and final review. |
| [Interactive Presentation](agents/media/interactive-presentation.agent.md) | Builds a locally served interactive experience (a guided storyline of working mini-app stops, embedded demo videos and workshop data capture) and a presenter script for a human to deliver live, verified for the stage. |
| [Spec Master](agents/orchestration/spec-master.agent.md) | Runs spec-backed delivery for a feature too large for one session: a spec and lane graph you approve, one session per lane, and mechanical gates on every handoff. Never writes product code. |

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

### Intent alignment

Ask your current agent or Sparring Partner:

```text
Use intent-alignment to check this plan against the PBI, parent feature, and linked decisions.
Use intent-alignment to check this branch against the spec and intended outcome.
```

The [intent-alignment](skills/intent-alignment/SKILL.md) skill checks whether the
work addresses the right problem within agreed scope. It follows relevant,
accessible context, traces requirements to work and material changes back to
their justification, and distinguishes demonstrated mismatches from unresolved
intent or missing evidence. It assesses plans and implementations without
editing them or approving delivery. A supplied snapshot works without a tracker
connection. Spec Master uses it before presenting a specification, and
spec-delivery uses it before approval and at final integration.

### Spec delivery

For a feature too large for one coding session, select Spec Master and describe
the feature, or ask your current agent:

```text
Use spec-delivery to build this feature.
```

The [spec-delivery](skills/spec-delivery/SKILL.md) skill writes a spec with
testable acceptance criteria and a lane graph for your approval. It then runs
each lane as its own session and checks every handoff with git and test
commands: a write-set check, a fail-on-base test check, merged acceptance runs,
and a final review before you accept. Coupling risks between concurrent lanes
are recorded and accepted explicitly rather than hidden.

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
