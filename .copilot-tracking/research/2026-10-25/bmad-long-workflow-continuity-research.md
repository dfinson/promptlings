<!-- markdownlint-disable-file -->
# Task Research: bmad-long-workflow-continuity

| Field | Value |
| --- | --- |
| Date | 2026-10-25 |
| Researcher / agent | GitHub Copilot, rpi-research |
| Output mode | research-only |

## Executive Summary

The missing checkout runtime explains the initial crash, but not long-term workflow continuity. BMAD 6.12.1 already defines file-backed state and explicit resume inputs. The outer coordinator must keep using those contracts. A rendered workflow is instructions, not an executable scheduler that prevents the coordinator from abandoning them.

Two corrections to earlier discussion materially change the diagnosis. Generic implementation children are part of BMAD's intended design and need not invoke BMAD themselves. A separate BMAD epic/sprint graph is also optional: Build accepts freeform and external tracker intent. The relevant failure is loss of the BMAD-owned spec, phase, and verification connection, not absence of repeated BMAD branding or a second backlog.

Upstream bmad-loop already provides a deterministic controller for this class of work. It is worth evaluating before inventing a controller. It is not established as a drop-in solution for PR43: its inspected Copilot profile and worktree provisioning expect discoverable local skills, and native Windows support is experimental.

Research is complete for the architectural explanation and comparison. Current Copilot documentation confirms real lifecycle hooks, but also timeout, coverage and stop-loop limits. Actual desktop/version-specific hook behavior and multi-day interruption recovery remain unverified. No source, installation, or live-session configuration was changed. This research does not establish the actual cause of every child-session decision in the suitability incident.

## What You May Not Know

BMAD's default implementation child receives a spec-only coding prompt with no prior conversation. Default review prompts explicitly prohibit invoking skills. Preserving BMAD therefore does not mean forcing every child to activate Build again.

Current public BMAD docs describe a newer ticket/plan model with a separate built state. Stable 6.12.1 uses spec/stories.yaml contracts and done as a workflow-completion status. Mixing their status vocabularies would introduce a new integration bug.

The supported persistent_facts customization is empty by default and executes at workflow activation. It is not a host-level compaction recovery hook.

## Findings

### 1. Installation and continuity are distinct mechanisms

The stable entry runs the renderer under the supplied project root. The renderer requires an actual _bmad directory, loads root configuration, and writes immutable snapshots beneath that root. It does not execute the Markdown steps, track child ownership, or reject a coordinator's next generic task dispatch. PR43's checkout setup and private discovery boundary address the execution environment and activation problem, not a deterministic lifecycle controller.

Questions: Q1, Q5. Evidence state: evidence-backed finding. Evidence: W2, W11, C1, C2, C3. Confidence high for the inspected contracts. This is not a claim that every BMAD version or workspace-root configuration requires a runtime in every code repository.

A collaborator proposed a workspace-root arrangement in W23. That is counterevidence to a universal single-installation impossibility claim, not proof that the existing desktop worktree launcher supports separate installation and execution roots.

### 2. BMAD already has a durable per-unit resume contract

Stable Build reads a named spec's frontmatter before broader context discovery. Build Auto can resume a spec path or an unambiguous folder/story ID, processes one unit, and records a terminal spec or fallback artifact. Its documentation explicitly assigns selection, further dispatch, blocked handling, deferred findings and result inspection to an outer coordinator.

Questions: Q2, Q5. Evidence state: evidence-backed finding. Evidence: W7-W9, W25-W26. Confidence high for specified behavior, not for universal model compliance. Persistent state enables restart only if the actor re-enters through that state rather than reconstructing progress from chat.

Exact spec paths are particularly important for existing work. W14 reports expensive story-identifier resume and unattributable historical diffs. The pinned implementation step corroborates that it retains an original baseline and always performs its handoff. The issue's measured costs and same-checkout concurrency failures remain user-reported, not independently reproduced here.

### 3. Generic children and external task graphs are not inherently violations

The default implementation handoff is a context-free subagent told to read and implement the spec. The parent then checks the actual diff against Tasks & Acceptance and runs the subsequent workflow review. Default reviewers are told not to invoke skills. A child can legitimately do ordinary engineering while the parent remains the BMAD workflow owner.

Build also accepts non-BMAD intent, including external plans and tracker identifiers. Thus, the earlier implication that the ADO graph must have a parallel BMAD epic/sprint graph was too strong. What must exist to substantiate BMAD execution is the per-unit workflow artifact, explicit routing and result verification. A briefs-only task graph is not automatically that artifact.

Questions: Q2, Q5. Evidence state: evidence-backed finding. Evidence: W7-W10. Confidence high. This materially narrows the incident test: inspect what the parent dispatched from and what it verified after return, not whether every child said BMAD.

### 4. Compaction is lossy and instructions are not transition enforcement

Anthropic's long-running-agent experiments explicitly found compaction insufficient and used feature status, progress artifacts, Git history, session-start reorientation, incremental work and actual E2E tests. Its context-engineering guidance also warns against both bloated brittle prompts and vague shared-context assumptions. A historical BMAD collaborator response states vendor compaction retention is outside BMAD's control.

Questions: Q3, Q4. Evidence state: evidence-backed finding. Evidence: W4, W5, W15, W16. Confidence high for the documented distinction. These sources do not establish that compaction caused the user's initial departure: the supplied timeline records an explicit bypass first.

General knowledge memory can preserve decisions but does not by itself enforce the next legal workflow transition. LangGraph separately represents a checkpointed thread's state and next nodes, and a cross-thread knowledge store. The distinction matters even if no such framework is adopted.

### 5. An existing upstream controller is a concrete alternative, not a proven drop-in

bmad-loop's inspected source has a legal phase-transition table that raises on illegal moves. Its documented run state includes state.json, an append-only journal, per-task prompts and results, and independent verification policy. This places the scheduling decision outside the same LLM conversation whose context may be compacted.

Questions: Q4, Q5. Evidence state: evidence-backed finding. Evidence: W13, W17-W20, W24, W27-W28. Confidence high that the mechanism exists in pinned main commit 40f0de625d85337e12c8b014c22d8a18b3b776bd. No installation or execution test was performed here.

Concrete limitations:

- The Copilot profile loads .agents/skills/{skill}/SKILL.md, not a PR43 private map.
- provision_worktree copies local skills, hooks, custom configuration and project-local runtime surfaces. That differs from PR43's official per-checkout install policy and can reintroduce native discovery exposure.
- The profile's statement that Copilot lacks native skill discovery is stale relative to the CLI1.0.100-1 acceptance evidence. Its hook notes are explicitly based on CLI1.0.63/macOS.
- Native Windows requires an experimental psmux backend and pwsh>=7.3. Compatibility with the serving desktop app has not been established.
- Configured verification only proves what it actually checks. A deterministic phase machine cannot prove unencoded product acceptance or authorize merges.
- In the inspected policy, verify.commands defaults to an empty list and worktree isolation is not the default. init edits the project's .gitignore. Those defaults do not meet the personal/private/worktree requirements automatically.
- Git recovery behavior needs a separate policy review before adoption. rollback_on_failure defaults to false, but the reference says a resolved escalation's re-drive automatically recovers the failed source regardless. This research does not authorize destructive recovery.
- Latest release observed is v0.13.2, published October10. The inspected main commit is October19, so newer main features are not attributed to that release.

### 6. A credible long-workflow claim needs restart and drift tests

PR43's recorded short Build, nested handoff, concurrent ordinary-agent isolation, integrity refusal, setup and resume tests address real requirements. They do not demonstrate a multi-unit controller recovering after parent process loss or compaction, child failure, missing runtime in a newly created worktree, or a bounded BMAD bypass.

Questions: Q5. Evidence state: evidence-backed finding about existing test scope, and research-derived acceptance implications. Evidence: C1-C3, W4, W7, W17, W22. Confidence high for the scope distinction. No new acceptance run occurred during research.

Evidence needed for a future continuity claim includes: a fresh parent reconstructing the same unit and next gate from durable artifacts, a child completion not advancing the parent without required evidence, no silent switch after a blocked launcher, separate attribution across worktrees, and explicit handling of an approved bypass that neither spreads unintentionally nor gets overridden by mandatory activation. These are criteria, not an implementation plan.

### 7. Host-specific re-entry and enforcement

Current GitHub documentation confirms actual code hooks, distinct from model-followed instructions. For CLI, command sessionStart can inject context for startup/resume, subagentStart can prepend context, preToolUse can deny calls, and stop hooks can force another turn. The concept page also explicitly names the Copilot app as supporting repository and plugin hooks. However, the detailed reference scopes its event/payload contracts to CLI and cloud, not the app, so equal behavior on the serving desktop version is not established.

Limits matter to this case:

- preCompact is a notification-only event. The documented sessionStart sources are startup, resume and new, not compact. These documents do not provide Claude's specific post-compaction reinjection contract for Copilot.
- Prompt-type sessionStart hooks do not fire on resume or in noninteractive -p mode. They are not equivalent to command hooks that return additionalContext.
- Built-in general-purpose emits neither subagentStart nor subagentStop. A design relying solely on those events misses that path.
- Stop-hook continuation is overridden after eight consecutive blocks.
- Command preToolUse errors deny a call, but command hook timeouts are fail-open. HTTP preToolUse errors are also fail-open.
- Hook-disable settings, trust admission and event/payload differences are part of the contract. No hook script was installed or exercised in this research.

Claude Code is useful counterevidence against casual persistence claims: its own current docs explicitly cap reinjected invoked skill bodies at 5,000 tokens each and 25,000 total, with oldest skills dropped first, while earlier hook-added context is summarized. It offers a separate SessionStart compact route, but that is a Claude-specific mechanism. Preservation of native invoked skill bodies also cannot be assumed for PR43's explicit private entry-file reads or rendered workflow files.

Questions: Q3, Q4, Q5. Evidence state: evidence-backed findings for current documentation, unverified for older pinned CLI and actual desktop execution. Evidence: W29-W34. Confidence high for documented distinctions. Exact Copilot custom-agent instruction inheritance remains outside the verified evidence and is not needed to establish a deterministic BMAD guarantee.

## Recommendation and Alternatives

No implementation option is selected because this is research-only. The evidence supports evaluating continued orchestration in terms of state, re-entry and evidence-controlled transitions, not adding another large instruction prompt.

| Option | Benefits | Costs and limits | Evidence | Disposition |
| --- | --- | --- | --- | --- |
| Existing BMAD artifacts with explicit parent re-entry and human gates | Reuses stable contracts, no second workflow engine or duplicate story model | Prompt compliance remains probabilistic, unattended continuity unproven | W7-W11, C2 | Viable for supervised operation |
| Native host lifecycle hooks around BMAD artifact checks | Documented startup/resume context and tool/stop checks outside ordinary prose | general-purpose coverage gap, fail-open timeouts, eight-block stop cap, no documented compact reinjection route, desktop parity unknown | W29-W34 | Conditional, not an absolute boundary |
| Evaluate pinned bmad-loop | Existing coded transitions, durable run state, explicit provisioner and fresh workers | Beta, Windows experimental, conflicts with PR43 source-discovery/install assumptions | W13, W17-W20, W24 | Material candidate, not yet qualified |
| General durable workflow engine | Persists next-node execution state with recovery semantics | New integration and operational complexity, does not implement BMAD for free | W6, W22 | Architectural comparison, not selected |
| More global skills or a larger orchestrator prompt alone | Low initial configuration effort | Reintroduces activation conflicts and does not make transitions deterministic | W2, W4-W5, W16, C1 | Not sufficient for the stated unattended-continuity claim |

What could change the assessment: a supported private-source bmad-loop integration, exact desktop lifecycle capabilities, or failure-injection evidence that the existing artifact-first coordinator already survives the required interruption boundaries.

## Scope and Questions

Goal: Explain what actually keeps BMAD in control over long coding workflows, which parts depend on installation location, and what additional protections PR43 does or does not provide.

Audience: The user evaluating personal BMAD orchestration, not a request to alter the suitability product or its active sessions.

In scope: Official stable BMAD 6.12.1 contracts and source, current documentation with explicit version boundaries, worktree behavior, persistent workflow state, delegation and resume, Copilot and Claude host mechanisms, credible primary-source research on long-running agents, and contrary evidence.

Out of scope: Product implementation, deployment, upgrading BMAD, changing PR43, automatic workflow execution, copying or linking runtime as a presumed fix, disclosure of private product code or session content to external services.

Criteria: Primary sources and exact version distinctions, operational mechanisms rather than vague advice, separation of instructions from enforcement and recorded state from executed gates, explanation of authorized bypass versus silent drift.

| ID | Question | Source | Status |
| --- | --- | --- | --- |
| Q1 | What does BMAD 6.12.1 require in each executing checkout, and what can safely be shared? | Observed renderer failure and user worktree question | Answered for pinned renderer, alternate workspace layouts remain separate |
| Q2 | What is BMAD's intended persistent execution/resume model after planning and task decomposition? | Suitability workflow loss | Answered from stable source |
| Q3 | What do agent hosts actually preserve or enforce through compaction, delegation, and new worktrees? | Multi-day continuity | Documented host distinctions answered, desktop/version execution and exact Copilot instruction inheritance unresolved |
| Q4 | Which external long-running-agent designs address the observed gap, and what are their limits? | User online deep research request | Answered, installation qualification not performed |
| Q5 | What would distinguish a credible continuity claim from setup-only acceptance, including counterevidence? | PR43 coverage gap | Answered as acceptance implications, not executed |

## Decisions and Feedback

| Group | Item | Status | Owner | Basis | Effect |
| --- | --- | --- | --- | --- | --- |
| D1 | Research only, no installation or implementation | Confirmed | User scope | Request for online deep research | No follow-on phase |
| D2 | No intake question needed | Confirmed | Research | Incident, goals, and non-goals already supplied | Begin source gathering |
| D3 | No architectural option selected | Deferred | User | Research-only scope, no adoption decision requested | Preserve alternatives |

## Risks and Open Questions

Current BMAD documentation describes a different release model than the inspected 6.12.1 runtime. Current hook concepts explicitly name the app, but detailed CLI/cloud event contracts are not evidence of equal behavior in the serving desktop version. Prior session forensic findings are supplied evidence, not independently inspected raw child logs.

Unresolved empirical questions: actual desktop restart/compaction behavior, bounded bypass recovery, private-source integration with an external controller, per-unit acceptance across a full multi-day run, and raw child launcher outcomes in the historical incident. None is converted into a success claim.

## Planning Readiness and Next Step

| Field | Record |
| --- | --- |
| Research disposition | executed, complete with explicit empirical limits |
| Decision participation | user-owned, standalone |
| Planning Readiness | Not applicable, research-only |
| Research depth and helpers | Wider, Deeper and Contrarian cycle complete, one official-host-source helper with partial output, parent verified decisive sources directly |
| Blockers | None for research, implementation compatibility and empirical qualification not performed |
| Output mode and planning support | research-only, no planning handoff |
| Continuation owner | User |
| Required gates or confirmations | No implementation approval requested or inferred |
| Next action | None required to close this research |
| Primary evidence file | .copilot-tracking/research/2026-10-25/bmad-long-workflow-continuity-research.md |

## Research Record

### Method and Boundaries

| Field | Record |
| --- | --- |
| Research posture and provenance | balanced, default, deep inspection of material questions without assuming an architectural replacement |
| Helper lane effort | Host defaults if used, no caller model or effort override |
| Completion basis | All five questions evidence-backed or bounded by exact gaps, complete three-wave cycle and contrary-source check |
| Explicit limits or deadline | None specified |
| Codebase scope | Existing Promptlings setup/orchestrator contracts and supplied forensic account |
| External scope | Public BMAD sources, official host documentation, primary long-running-agent engineering evidence |
| Initial candidate areas | BMAD installer and renderer, sprint/story state and resume, Copilot/Claude context and hooks, Anthropic/OpenAI/LangGraph long-running patterns |
| Evidence root | Workspace-root .copilot-tracking |
| Date source | User-supplied current date, 2026-10-25 |
| Write boundary | Only this primary research artifact, no source modifications |
| Prior knowledge | PR43 acceptance and current contracts, owning-session forensic report, Basic Memory approval-attribution correction confirmed persisted |
| Privacy | No private code, credentials, or transcript excerpts sent to public search services |

### Extensions and Participation

| Kind | Candidate | Selection and scoped authority |
| --- | --- | --- |
| Instruction | Repository .github/copilot-instructions.md | Selected, ASCII output and em dash ban |
| Instruction | HVE copilot-tracking and tracking-location instructions | Selected, evidence artifact layout and root |
| Skill | rpi-research | Selected, user requested research |
| Skill | BMAD build/orchestrator/architecture | Skipped, investigating their behavior does not authorize execution or design changes |
| Skill | security and architecture implementation workflows | Skipped, no security audit or solution implementation requested |

Direction: No user clarification is needed to research the already established failure. Material implementation decisions remain deferred rather than silently selected.

### Research Cycle Log

#### Cycle 1

Active posture: balanced. Read public sources only and inspect existing contracts. No runtime execution.

##### Wave 1: Wider

Observed official current BMAD documentation distinguishes thinking-only use from building. This challenges the blanket premise that every external task must be a BMAD story. The pinned v6.12.1 Build contract nevertheless requires a checkout renderer and describes spec-frontmatter state and sequential step files. Anthropic's primary long-running-agent report explicitly says compaction alone is insufficient, and describes feature state plus per-session reorientation and actual E2E checks.

Reflection: Separate runtime presence, per-capability durable artifacts, and parent orchestration policy. Prioritize exact stable resume/dispatch code before recommending a lifecycle ledger. Inspect reported BMAD resume/concurrency defects as counterevidence, not as proof that this user's exact run hit them.

##### Wave 2: Deeper

Pinned 6.12.1 source has a concrete resume contract: explicit spec path routes by status before broad context discovery; folder+story ID resolves one record in stories.yaml. Build Auto processes exactly one unit, writes machine-readable terminal state, and leaves backlog dispatch to an outer coordinator. Its default implementation handoff deliberately uses a context-free generic coding subagent reading the spec. Reviewers are explicitly told not to invoke skills.

Reflection: A child that does not invoke BMAD is not itself a continuity failure. The decisive issue is whether a BMAD-owning parent dispatches from the spec and checks its result through the workflow's acceptance/review gates. Correct the earlier overly broad claim that all five external tasks necessarily needed BMAD epic/story mapping: freeform intent and external tracker inputs are supported.

The renderer only produces immutable instruction snapshots; its Python does not execute the Markdown workflow or enforce step transitions. Configuration persistent_facts is empty by default and loaded on activation, not a host resume callback.

New material discovery: upstream now has bmad-loop, a separate deterministic Python scheduler explicitly intended for multi-session BMAD execution. Stable 6.12.1 docs link it and describe stories.yaml scheduling. Current public docs instead describe a newer ticket-tree model, so current pages cannot be used as the stable contract. Investigate bmad-loop compatibility, native Windows and discovery assumptions before treating it as a ready solution.

##### Wave 3: Contrarian

Challenges tested:

- "Every child must invoke BMAD" is disproved by the pinned default handoff: a context-free implementer reads the spec, while the parent owns workflow transitions and audit. Default reviewers are told not to invoke skills.
- "A BMAD epic/story graph is mandatory" is disproved by stable freeform and external intent inputs. A canonical BMAD spec/result connection is necessary for claiming execution through that workflow, not necessarily a second backlog.
- "More prompt and automatic compaction guarantee continuity" is weakened by a BMAD collaborator's explicit vendor-compaction limitation, an upstream activation-skipping report, and Anthropic's long-running harness evidence.
- "Build a new generic controller now" is not established: upstream bmad-loop already implements a deterministic transition table. It must be evaluated before proposing a new controller.
- "Install bmad-loop and the problem is solved" is not established. Its pinned Copilot profile expects .agents/skills/{skill}/SKILL.md, its provision_worktree copies discoverable skill trees and project-local BMAD files, native Windows is experimental, and verification commands plus optional review remain operator policy. This conflicts with PR43's private-source map and official-per-checkout-install policy unless a supported integration is demonstrated.
- "One installation can never work" is too broad. A BMAD collaborator describes a workspace-root arrangement in a different issue. It is not the existing app's worktree-root launch contract, not proof of v6.12.1 behavior for this host, and not a proposed permission to invent an adapter.

Reflection: Evidence supports a three-layer distinction: executable environment, canonical work state and re-entry, and external control of allowed transitions. Some applications need only the first two plus human gates. Strong unattended continuity requires a controller outside the same forgetful conversation, not necessarily a new framework. No blanket native-host or replacement recommendation is justified yet.

##### Synthesis and Re-entry

The supplied incident begins with a verified runtime-root failure and explicit user-authorized bypass. Later omission and compaction correlate with loss of BMAD mention, but are not an independent causal proof. Stable source shows that ordinary coding children and non-BMAD task inputs can be correct. The absence of repeated skill activation or sprint files is therefore the wrong proxy for continuity.

The stronger model is: executable checkout, canonical per-unit workflow state, explicit parent re-entry, and evidence-controlled transitions. Runtime setup solves the first. BMAD specifies much of the second and third. A model-followed conductor can carry them out under supervision, but cannot itself provide a deterministic guarantee. Current host hooks can enforce some concrete checks, with documented coverage and fail behavior. A separate controller offers stronger scheduling persistence, but still depends on correctly configured verification and compatible host/privacy integration.

The material controller candidate already exists upstream as bmad-loop. Its source is a better basis for evaluation than a speculative new framework. Experimental Windows support, discoverable skill seeding, local runtime copying, Git mutation policy, empty default verification commands and release/main drift prevent declaring it compatible or ready here.

No re-entry into implementation is needed. Research-only closure preserves the empirical gaps rather than installing tools to answer an unasked adoption decision.

### Evidence Log

Initial sources, all retrieved 2026-10-25:

| ID | Source | Verified content and limits |
| --- | --- | --- |
| W1 | https://docs.bmad-method.org/ | Current homepage explicitly allows thinking-only use and right-sized delivery. Not evidence of stable 6.12.1 behavior. |
| W2 | https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/790dae9c8e2a1d73575cb2d40b14dd4963391f29/src/bmm-skills/ship/bmad-build/SKILL.md | Pinned Build broad activation and checkout-root renderer/halt contract. |
| W3 | https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/790dae9c8e2a1d73575cb2d40b14dd4963391f29/src/bmm-skills/ship/bmad-build/workflow.md | Spec frontmatter plus in-memory state, just-in-time sequential steps and persistent facts. |
| W4 | https://www.anthropic.com/research/effective-harnesses-for-long-running-agents | Compaction insufficient, initialize environment and feature state, reorient each session, incremental execution and E2E verification. Engineering evidence, not BMAD integration proof. |
| W5 | https://www.anthropic.com/research/effective-context-engineering-for-ai-agents | Finite attention, concise high-signal context, compaction/structured notes/subagents, not simply larger prompts. |
| W6 | https://docs.langchain.com/oss/python/langgraph/persistence | Durable graph checkpoints and cross-thread stores are different mechanisms. In-memory saver does not survive process restart. An architectural comparison, not a requested dependency. |
| W7 | https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/790dae9c8e2a1d73575cb2d40b14dd4963391f29/docs/build/autonomous-development-loops.md | Stable one-unit Build Auto contract, spec/status resume, caller responsibilities, stories.yaml and optional bmad-loop. |
| W8 | https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/790dae9c8e2a1d73575cb2d40b14dd4963391f29/src/bmm-skills/ship/bmad-build/step-01-clarify-and-route.md | Explicit spec states route directly; external plans are input, not workflow state. Story/sprint linkage optional. |
| W9 | https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/790dae9c8e2a1d73575cb2d40b14dd4963391f29/src/bmm-skills/ship/bmad-build/step-03-implement.md | Parent verifies tasks/acceptance against actual diff after spec-backed implementation dispatch. |
| W10 | https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/790dae9c8e2a1d73575cb2d40b14dd4963391f29/src/bmm-skills/ship/bmad-build/customize.toml | Empty persistent facts, generic spec-only implementation handoff, reviewers instructed not to invoke skills. |
| W11 | https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/790dae9c8e2a1d73575cb2d40b14dd4963391f29/src/scripts/render_skill.py | Requires checkout _bmad and writes hashed immutable snapshot, returns instruction path, not an execution state machine. |
| W12 | https://docs.bmad-method.org/build/autonomous-development-loops/ | Current docs use tickets.toml, plans, built/done separation unlike pinned stable spec/stories.yaml. Record as version drift, not a stable API. |
| W13 | https://raw.githubusercontent.com/bmad-code-org/bmad-loop/main/README.md | Upstream deterministic controller, on-disk state, hooks/verification, worktree mode; explicitly early beta and experimental native Windows. Subsequent source inspection is pinned separately in W17-W20. |
| W14 | https://github.com/bmad-code-org/BMAD-METHOD/issues/2849 | Open user report on 6.12.0 resume attribution and same-checkout parallel conflicts. Its baseline/dispatch observations corroborated in pinned 6.12.1 source, measurements not independently reproduced. |
| W15 | https://github.com/bmad-code-org/BMAD-METHOD/issues/885 | BMAD collaborator says vendor compaction retention is outside BMAD control. Historical 2025 discussion, not a tested current-host guarantee. |
| W16 | https://github.com/bmad-code-org/BMAD-METHOD/issues/2397 | Historical activation prepend/append skipping report and worktree consequences, closed via guardrail changes. Demonstrates instructions are not deterministic execution, not proof current activation fails. |
| W17 | https://raw.githubusercontent.com/bmad-code-org/bmad-loop/40f0de625d85337e12c8b014c22d8a18b3b776bd/src/bmad_loop/statemachine.py | Actual coded legal transition table and IllegalTransition refusal. Stronger than prompt-only phase instructions, scoped to this controller. |
| W18 | https://raw.githubusercontent.com/bmad-code-org/bmad-loop/40f0de625d85337e12c8b014c22d8a18b3b776bd/src/bmad_loop/worktree_flow.py | provision_worktree explicitly seeds ignored skills, hook configs and BMAD runtime surface. Not compatible by assumption with private source maps. |
| W19 | https://raw.githubusercontent.com/bmad-code-org/bmad-loop/40f0de625d85337e12c8b014c22d8a18b3b776bd/src/bmad_loop/data/profiles/copilot.toml | Explicit .agents/skills entry loading, historical CLI1.0.63/macOS hook observations. Its no-native-skill-discovery comment is stale relative to tested CLI1.0.100-1. |
| W20 | https://raw.githubusercontent.com/bmad-code-org/bmad-loop/40f0de625d85337e12c8b014c22d8a18b3b776bd/docs/multiplexer-backends.md | Native Windows psmux backend experimental, psmux>=3.4.0 and pwsh>=7.3 required. Not tested on this machine. |
| W21 | https://www.anthropic.com/research/building-effective-agents | Workflow vs agent distinction, code gates and simplest composable approach. Original 2024 guidance now explicitly marked historically contextual. |
| W22 | https://docs.langchain.com/oss/python/langgraph/checkpointers | Graph state including next nodes is checkpointed per thread/super-step, pending successful writes recover separately. Not BMAD semantics by itself. |
| W23 | https://github.com/bmad-code-org/BMAD-METHOD/issues/1852 | Collaborator workspace-root proposal, closed April2026, examined as counterevidence to universal per-worktree claims rather than integration proof. |
| W24 | https://raw.githubusercontent.com/bmad-code-org/bmad-loop/40f0de625d85337e12c8b014c22d8a18b3b776bd/docs/reference/run-state.md | Persisted phases, task records and atomic state writes, independent journal, external hook-event control channel. Documentation, not an executed restart test. |
| W25 | https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/790dae9c8e2a1d73575cb2d40b14dd4963391f29/src/bmm-skills/ship/bmad-build-auto/step-01-clarify-and-route.md | Exact Auto routing, folder/story lookup, one-story scope and explicit terminal/halt behavior. A done spec starts a follow-up review, not an ordinary resume. |
| W26 | https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/790dae9c8e2a1d73575cb2d40b14dd4963391f29/src/bmm-skills/ship/bmad-build-auto/step-04-review.md | File-backed triage log and loop counter, bounded repair loops, terminal review results. This is still instructions executed by an agent, not controller code. |
| W27 | https://raw.githubusercontent.com/bmad-code-org/bmad-loop/40f0de625d85337e12c8b014c22d8a18b3b776bd/docs/reference/configuration.md | Empty verification command list and in-place default, init modifies .gitignore, configurable review and recovery. Resolved escalation re-drive automatically recovers despite the failure rollback toggle. |
| W28 | https://github.com/bmad-code-org/bmad-loop/releases/tag/v0.13.2 | Latest release returned by API, published October10, before the inspected October19 main commit. Do not attribute unreleased source behavior to this release. |
| W29 | https://docs.github.com/en/copilot/concepts/customizations/hooks | Distinguishes code hooks from instructions and explicitly lists app, CLI, cloud and VS Code with cross-surface caveat. Current documentation only. |
| W30 | https://docs.github.com/en/copilot/reference/hooks-reference | Exact CLI/cloud event, output, omission, stop cap and fail-open behavior. Read through decision control and compaction payloads, not presumed equivalent in the app. |
| W31 | https://docs.github.com/en/copilot/how-tos/github-copilot-app/customize-github-copilot-app | App automatically makes configured CLI/repository skills available and supports plugin capabilities. Does not provide detailed compaction or hook payload guarantees. |
| W32 | https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills | Prompt and description select skills, full entry injected on invocation, supported personal/project discovery and reload controls. Current, not pinned to CLI1.0.100-1. |
| W33 | https://docs.github.com/en/copilot/concepts/copilot-surfaces/copilot-cli | Auto-compaction near95% and manual compaction, without a per-content preservation contract in that section. |
| W34 | https://code.claude.com/docs/en/context-window | Explicit Claude reinjection limits, summarized hook context and compact-source SessionStart. Comparator only, not Copilot parity. |

Workspace and supplied-incident evidence:

| ID | Source | Verified content and limits |
| --- | --- | --- |
| C1 | skills/promptlings-bmad-setup/SKILL.md | Checkout install policy, immutable private source maps, run-specific artifact destinations, provenance explicitly not a lifecycle ledger. |
| C2 | agents/orchestration/bmad-orchestrator.agent.md | Opt-in conductor, artifact-based routing and acceptance instructions. Does not persist a conductor-owned lifecycle ledger or enforce transitions in host code. |
| C3 | docs/bmad-setup.md, Private-source verification | Actual isolated acceptance routes and later targeted repairs. Not a multi-day scheduler/crash/compaction recovery test. Live installation unchanged. |
| C4 | User-supplied suitability forensic report | Explicit bypass chronology, later dispatch/compaction omissions, no independently inspected child logs in this research. The timeline establishes bypass before later omission, not compaction causation. |

Pinned release provenance: v6.12.1 annotated tag b7c63980484d5f885d6d347e9be5d827db6b7bca resolves to commit 790dae9c8e2a1d73575cb2d40b14dd4963391f29 via GitHub API.

Helper lane: official host continuity documentation, hve-core:rpi-researcher, host-default effort/model. Helper returned partial evidence and explicitly had not read the decisive Copilot hook reference. Parent verified W29-W34 directly, including the reference event table and decision-control limits, before using them. Parent owns BMAD and harness source gathering. Initial gh search with inline repo qualifier failed due shell/CLI argument serialization, corrected using explicit --repo. One jq native-argument quoting failure was corrected by parsing API JSON directly. No conclusion drawn from failed queries.

Supplied suitability forensics remain incident evidence with owning-session provenance, not independently examined child logs. The memory maintainer confirmed the BMAD/Knip approval attribution correction persisted in the existing NexusWealth decision note.

### Artifact Self-Check

Opening scope, date, root, controls, prior knowledge and participation recorded. All five questions have evidence-backed answers or exact unresolved boundaries. Wider, Deeper and Contrarian reflections precede synthesis. Stable, current-doc and pinned-controller versions are separated. Findings distinguish source contracts, observed earlier acceptance, user-supplied incident history and new empirical gaps. Alternatives and research-only no-handoff disposition are explicit.

Only this research artifact was created in the worktree. No implementation tests, live reconfiguration, BMAD workflow execution, installation or PR update occurred. Artifact encoding, evidence references, placeholder absence and final worktree effects were checked before closure.

### Subsequent PR Update, 2026-10-26

After research closure, the user requested that PR43 be updated. The orchestrator
now specifies an approved personal continuation record for multi-dispatch work,
artifact-first recovery, pending-assignment reconciliation, generic implementation
children under parent-owned gates, and explicitly scoped user mode decisions.
The setup skill previews continuation persistence separately from configuration
bindings. The earlier research-only no-source-change statements describe the
research phase, not this later implementation.

No controller or hooks were integrated. The optional bmad-loop candidate remains
unselected. Current acceptance results belong in docs/bmad-setup.md rather than
being retroactively attributed to the October25 research.
