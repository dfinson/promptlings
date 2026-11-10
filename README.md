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
| [Spec Master](agents/orchestration/spec-master.agent.md) | Coordinates approved delivery through concurrent lanes, scoped PRs and revision-bound handoff checks. Keeps working specs outside product history unless authorized. |
| [Experiment Director](agents/orchestration/experiment-director.agent.md) | Designs and conducts controlled comparisons of prompts, skills, agents and workflows, separating measured outcomes from preferences, cost and uncertainty. |

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

### Technical demo

Technical Demo presents an overall creative treatment first, then readable scene
descriptions with the exact narration. It keeps the older agent's storytelling
and evidence standards, using Motionite/Remotion by default, HyperFrames when
explicitly selected, and real capture for demonstrated behavior.

The [production skill](skills/technical-demo-production/SKILL.md) retains approved
inputs, selects existing components, overlaps independent preparation and reuses
unchanged media. Its version-checked renderer batches native-resolution review
frames and video jobs through one browser. Writing and narration use the
reasoning-first skills. Revisions address specific defects instead of restarting
briefing or running fixed-count review loops.

The installer fetches [Motionite](https://github.com/nxrskyaa/motionite) from the
upstream revision in [the tool pins](lib/pins.js), just like other external skills.
Its source and assets are not vendored here. Production dependencies and media
belong in an external production workspace. Measure complete draft turnaround
separately from rendering time.

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

### A/B testing

Ask your current agent to delegate a comparison:

```text
Use ab-testing to compare these two skill revisions on representative tasks.
Design the protocol first, without running trials yet.
```

The [ab-testing](skills/ab-testing/SKILL.md) routing skill decides whether an
experiment is warranted, prepares the brief and invokes Experiment Director
through the host's actual registry. It uses a subagent for a bounded comparison
or a child session for persistent work or an isolated checkout, when supported.
A protocol-only request delegates design without launching trials or judges.

Experiment Director uses
[comparative-evaluation](skills/comparative-evaluation/SKILL.md) to qualify tasks
and graders, freeze the comparison, coordinate independent trials and report
effects, hard failures, resource usage and uncertainty. Artifact quality,
native skill activation and real end-to-end outcomes are separate profiles.
An inconclusive result is valid, and passing one profile does not certify the
others.

Both the director and the calling agent use
[reasoning-first-writing](skills/reasoning-first-writing/SKILL.md) when
explaining experiment proposals and results. The writing skill makes the
reasoning readable while preserving protocol requirements, evidence, verdicts
and uncertainty. It does not change trial execution or grading.
When results cannot answer the original question at its agreed scope, the
report opens with "The experiment failed to answer the question." and the
concrete reason. Completed trials alone do not satisfy that gate.

The package supplies instructions and a protocol template, not a new runner.
Use an existing compatible executor, such as Harbor for isolated coding tasks
or an SDK runner for artifacts. No evaluation service, model account or new
runner is installed automatically. Running trials needs execution authority
and resolved resource and stopping constraints. Results do not authorize
repair, installation or promotion.

### Spec delivery

For a feature too large for one coding session, select Spec Master and describe
the feature, or ask your current agent:

```text
Use spec-delivery to build this feature.
```

The [spec-delivery](skills/spec-delivery/SKILL.md) skill writes a spec with
testable acceptance criteria and a lane graph for your approval. Working specs,
plans and evidence stay in session artifacts or your chosen external system.
Approval identifies their immutable versions or content hashes. Committing
them to the product repository requires separate authorization.

It launches independent lanes concurrently and uses PRs as the default review
and integration boundary. Genuine consumers can stack on passing producer PRs
without waiting for a merge. Each handoff checks both the lane's own changes and
the full diff against its actual PR target, plus fail-on-base tests and relevant
acceptance checks. Combined validation can use a disposable checkout, not a
local branch that accumulates every lane. Publication and merging respect your
authorization, and final acceptance stays with you.

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
In the default ensemble, Sparring Partner also applies the full
`intent-alignment` method, establishing the evidenced outcome and source
authority before judging implementation conformance. These methods form one
adaptive review, not separate reports. The invoking agent independently
verifies the alignment claims and synthesizes the ensemble's results.

You can also select Sparring Partner directly for a standalone PR, branch diff,
or local change review. For other reasoning questions it selects only the
relevant methods. The historical ensemble with built-in rubber-duck remains
available when explicitly requested, rather than as an automatic fallback.
Standalone reviews select alignment when requested or needed to reconcile
purpose or scope. Every ensemble composition needs an assigned alignment
reviewer and access to the method; otherwise it stops before dispatch.
Alignment does not add a fourth default reviewer or grant approval authority.

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

[Apache 2.0](LICENSE). External tools and skills retain their upstream licenses.
