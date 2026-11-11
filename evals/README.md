# Promptlings evals

This package measures whether Promptlings agents and skills change the results of real GitHub Copilot CLI runs. Each trial runs the real `copilot` binary in an isolated home and workspace, then keeps the evidence and credit usage for scoring.

The package is private and is not published: the root `files` list leaves `evals/` out, and `node evals/scripts/check-pack.js` fails if any `evals/` path appears in `npm pack --dry-run`.

## Requirements

- Node.js 22.22.0 or later.
- GitHub Copilot CLI on `PATH`, or the path to it in `EVALS_COPILOT_BIN`.
- A Copilot credential in `COPILOT_GITHUB_TOKEN`. When it is unset, the CLI uses `gh auth token`.

Install the dependencies (Promptfoo 0.125.1 and `yaml`, pinned):

```sh
npm ci --prefix evals
```

## Running a suite

```sh
npm --prefix evals run eval -- <suite> --stage <stage>
npm --prefix evals run eval -- --list
```

| Option | Meaning |
| --- | --- |
| `--stage <name>` | Stage from the suite's `stages`, or a split name when the suite has no `stages`. |
| `--artifact-root <dir>` | Run output root. Defaults to `EVALS_ARTIFACT_ROOT`, else `C:\agent-artifacts\promptlings-evals` on Windows and `~/agent-artifacts/promptlings-evals` elsewhere. |
| `--run-id <id>` | Run identifier. Defaults to `<suite>-<stage>-<timestamp>`. |
| `--candidate-ref <ref>` | Git ref installed for arms with `ref: candidate`. Defaults to `HEAD`. |
| `--previous-ref <ref>` | Git ref installed for arms with `ref: previous`. Required when the stage includes such an arm. |
| `--engine harness\|native` | `harness` runs trials through the Promptfoo harness in `providers/harness.js` and is the default when that file exists. `native` runs them directly. |
| `--diagnostic` | Asks the suite's `scoreRun` for its diagnostic variants too. |
| `--dry-run` | Prints the planned trials without running Copilot. |

Exit codes: `0` when the run finishes and is usable, `1` on an error, `2` when the run stopped at a credit ceiling, was rejected by the suite or has nothing comparable.

### Environment

| Variable | Use |
| --- | --- |
| `COPILOT_GITHUB_TOKEN` | Copilot credential. Held in memory and passed only to the Copilot child process. |
| `EVALS_COPILOT_BIN` | Copilot binary. Default `copilot`. |
| `EVALS_ARTIFACT_ROOT` | Run and dataset cache root, passed to adapters as `ctx.artifactRoot`. |
| `EVALS_SUITES_ROOT` | Alternative suites directory. The offline checks use it for fixture suites. |

## What a trial does

1. Creates a fresh home (`HOME`, `USERPROFILE`, `COPILOT_HOME`, XDG and AppData paths, temp) and workspace under the run directory. Two trials never share either, and the user's own Copilot home is never read or written.
2. Installs the arm's Promptlings ref into that home with the repository installer. Stock arms (`ref: null` or `none`) install nothing. Promptlings arms record a SHA-256 hash of every installed file as `installedHashes` in the trial's `trial.json`.
3. Builds the child environment from an allowlist (`PATH`, system and locale variables, proxy and CA settings). Nothing else is inherited from the parent process, and `COPILOT_PROVIDER_*` variables are refused.
4. Runs `copilot -p` with JSON output, a pinned model and reasoning effort, `--max-ai-credits`, `--no-ask-user`, and the arm's tool, URL and agent settings.
5. Keeps the stdout events, `usage.json`, the shared transcript, CLI logs and the session's `events.jsonl` (subagent and skill events are only in the session log).
6. Scans every stored file for the token. A trial whose evidence contains it is redacted and marked `errored`.

Trial evidence is in `<artifactRoot>/<runId>/trials/<task>/<arm>/<repeat>/`, with `trial.json` holding the trial record. Repeats are numbered from 0. `run.json` records the suite, stage, resolved ref SHAs, CLI version, credit totals and every trial's status.

### Credits and ceilings

Credits are derived from the CLI usage total as `usage.totalNanoAiu / 1e9`; `run.json` records this as `creditDerivation`. Each trial is capped by `--max-ai-credits` (the arm's `maxAiCredits`, else `limits.maxAiCredits`, never below 30). A stage stops scheduling trials once the next one could exceed its ceiling, taken from `stages.<name>.maxAiCredits` or `limits.stageCeilings.<name>`. Stages that share a `ceilingGroup` also share a ledger under `<artifactRoot>/ceilings/<suite>/<group>.json`, capped by the largest ceiling declared in the group. When a ceiling stops scheduling, `run.json` sets `stoppedByCeiling` (the harness engine also records each unstarted trial as `stopped_by_ceiling`) and the CLI exits 2.

## Adding a suite

A suite is a directory under `evals/suites/<name>/` holding `suite.yaml` and `adapter.js`. The runner finds suites by directory, so no registry needs editing.

`suite.yaml` must declare:

| Key | Content |
| --- | --- |
| `name` | The directory name. |
| `taskSource` | Mapping with at least `type`. |
| `splits` | Mapping of split names to suite-specific selections. |
| `arms` | List of `{id, ref, model, reasoningEffort, limits, tools, agent?, maxAiCredits?}`. `model` cannot be `auto`. `ref` is `null` or `none` (stock), `candidate`, `previous` or any Git ref. |
| `prompt` | Prompt template. `{{name}}` reads `task.vars`, then task fields, then `workspace`. |
| `limits` | `{timeoutMs, maxAiCredits, stageCeilings?}`. |
| `repeats`, `concurrency` | Positive integers. |
| `scorers` | List of `{id, kind, primary?, model?, rubric?}` with at least one primary scorer. `rubric` is required for `llm-rubric`. |
| `license` | A statement, or a mapping such as `{code, data, redistribution}`. |

Optional keys pass through to adapters and the report: `stages` (`{split, arms, repeats, maxAiCredits?, ceilingGroup?, analysis?}` per stage), `analysis`, `reviewRequests` and `judge`.

`adapter.js` is an ES module exporting:

- `listTasks(split, ctx)`: the tasks for a split, each with an `id`.
- `materialize(task, workspace, ctx)`: prepares the trial workspace.
- `collect(record, task, ctx)`: returns suite-specific outputs from a finished trial.
- `buildPrompt(task, arm, suite)` (optional): replaces the `prompt` template.
- `scoreRun({runDir, suite, diagnostic})` (optional): scores the run after all trials. A failure or a non-empty `rejected` list marks the run rejected, and the report gives no verdict.

`ctx` is `{artifactRoot, runDir, suite, arm}` (`arm` is absent for `listTasks`).

## Checks

```sh
npm --prefix evals test
npm --prefix evals test -- --test-name-pattern=isolation
```

The checks run offline against a fake Copilot CLI in `checks/fixtures/fake-copilot/`. They use the `.check.mjs` suffix so the root `npm test` never collects them. CI runs them on Windows, macOS and Ubuntu without any credential.

## Datasets

`datasets.lock` records pinned dataset sources and licenses. Datasets, mirrors and run output stay under the artifact root and are never committed.
