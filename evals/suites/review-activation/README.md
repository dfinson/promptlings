# review-activation suite

Checks that the review agents and the ensemble activate natively under a real `copilot -p`. Each check reads the trial's event evidence deterministically, so no model grader is involved.

```
npm --prefix evals run eval -- review-activation --stage live
npm --prefix evals test -- --test-name-pattern=activation
```

The first command is AC-13's live run. The second runs the offline checks in `evals/checks/review-activation/` against recorded transcript fixtures, without spending Copilot credits.

## Tasks

The fixtures come from `tests/review-regressions.md`. Every task includes a `REQUIREMENTS.md` and is materialized as a local git repository: `main` holds the base commit, and the checked-out `review` branch holds the change.

| Split | Task | Seed | Change |
| --- | --- | --- | --- |
| live | `r1-authorization` | R1 | `or` becomes `and` in `permissions.py` (a real defect on line 2) |
| live | `r3-reachability` | R3 | An empty-list guard makes division by zero unreachable |
| heldout | `r2-cache-window` | R2 | A 30-second cache, which is a tradeoff rather than a defect |

R4 and R5 are not separate tasks. R4 (an ensemble seat applies intent-alignment without being asked) is asserted natively by the `ensemble` arm's `sparring-methods` check on every task. R5 needs a required method to be unavailable, and a native `--review` install cannot reproduce that.

## Arms

All arms install the candidate with `--review`, which installs the-nitcracker, pr-walkthrough and sparring-partner, and use the same model and effort.

| Arm | Agent | Prompt |
| --- | --- | --- |
| `nitcracker` | `--agent the-nitcracker` | Suite prompt |
| `sparring-partner` | `--agent sparring-partner` | Suite prompt |
| `ensemble` | Default agent | The README request "Run the review ensemble on this branch against main ..." via `buildPrompt` |

## Checks

Every arm must pass these checks: the trial status is `completed`, there is top-level final output, the expected file is mentioned, no em dash appears, and no `rubber-duck` dispatch occurred.

| Arm | Additional checks |
| --- | --- |
| `nitcracker` | `subagent.selected` names the-nitcracker. The output has an H1 title before a `---` appendix and includes a `**Anchor:** <file>, RIGHT, line N` that covers each expected defect line. |
| `sparring-partner` | `subagent.selected` names sparring-partner. The top-level agent loaded `technical-investigation`, `design-analysis`, `test-analysis` and `evidence-verification`. |
| `ensemble` | No `--agent` was selected. The top-level agent loaded `review-ensemble`. the-nitcracker, pr-walkthrough and sparring-partner each started and completed, and every worker started before any worker completed. The sparring worker (attributed by `agentId`) loaded `intent-alignment` and the four methods. |

The primary score is `activation`: 1 when every check passes, otherwise 0.

## Event evidence

The `--output-format json` stdout stream does not include `subagent.selected` or `skill.invoked`. Those events appear only in the persisted session log, `<COPILOT_HOME>/session-state/<sessionId>/events.jsonl`. `collect` merges both sources and deduplicates them by event id. It finds the session log in one of three places: `trialRecord.sessionEventsPath`, `trialRecord.copilotHome`, or a search under the trial directory that uses the `sessionId` from the stream's final `result` event. If the session log is missing, the agent-selection check fails rather than passing on incomplete evidence.

Events inside a subagent carry a top-level `agentId` equal to the dispatching `task` tool call id. Top-level events carry no `agentId`. Skill loads count from `skill.invoked`, from `skill.invoked_ref`, or from a successful `skill` tool call whose telemetry does not report `found: "false"`.
