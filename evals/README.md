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
| `--concurrency <n>` | Trials run at once. Overrides `stages.<name>.concurrency`, which overrides the suite's `concurrency`. |
| `--dry-run` | Prints the planned trials without running Copilot. The installer selection check still runs. |

Exit codes: `0` when the run finishes and is usable, `1` on an error, `2` when the run stopped at a credit ceiling, was rejected by the suite or has nothing comparable.

### Environment

| Variable | Use |
| --- | --- |
| `COPILOT_GITHUB_TOKEN` | Copilot credential. Held in memory and passed only to the Copilot child process. |
| `EVALS_COPILOT_BIN` | Copilot binary. Default `copilot`. |
| `EVALS_ARTIFACT_ROOT` | Run and dataset cache root, passed to adapters as `ctx.artifactRoot`. |
| `EVALS_SUITES_ROOT` | Alternative suites directory. The offline checks use it for fixture suites. |
| `EVALS_PANEL_MODULE` | Path to the module exporting `runPanelAnalysis`. Default: `evals/report/panel.js`, then `evals/scoring/panel.js`, whichever exists. The offline checks point it at a fake panel. |
| `EVALS_PLUGIN_GIT_BASE` | Git URL prefix for pinned plugin repositories. Default `https://github.com/`; the source is `<base><owner>/<name>.git`. The offline checks point it at a local repository. |

## What a trial does

1. Creates a fresh home (`HOME`, `USERPROFILE`, `COPILOT_HOME`, XDG and AppData paths, temp) and workspace under the run directory. Two trials never share either, and the user's own Copilot home is never read or written.
2. Installs the arm's Promptlings ref into that home with the repository installer (`promptlings publish <selection> --no-readside --yes`). Stock arms (`ref: null` or `none`) install nothing. Promptlings arms record a SHA-256 hash of every installed file as `installedHashes` in the trial's `trial.json`. Before any trial starts, each installing arm's selection runs through `promptlings publish --dry-run` from its ref, so a selection the installer rejects stops the stage once instead of erroring every trial. `run.json` records the installer arguments as `installArgs`.
3. Builds the child environment from an allowlist (`PATH`, system and locale variables, proxy and CA settings). Nothing else is inherited from the parent process, and `COPILOT_PROVIDER_*` variables are refused. `GIT_CONFIG_NOSYSTEM=1` is set because Copilot's bundled git keeps its system config under the real `%LOCALAPPDATA%`, which `--sandbox` cannot read. On Windows, the trial's `AppData\Local\Packages` is a junction to the real folder, where Windows creates the sandbox's AppContainer temp directory.
4. Runs `copilot -p` with JSON output, a pinned model and reasoning effort, `--max-ai-credits`, `--no-ask-user`, and the arm's tool, URL and agent settings. An arm with a pinned `plugin` also gets `--plugin-dir <checkout>`. `--plugin-dir` loads the plugin but does not let `--sandbox` tools read its files, so the trial home's `settings.json` grants read-only access to the checkout (`sandbox.userPolicy.filesystem.readonlyPaths`, recorded as `sandboxReadonlyPaths`). `--add-dir` is not used because it would load the plugin's skills a second time. A `sandbox: true` arm runs with `--sandbox --allow-all-tools --allow-all-paths`. In `-p` mode the CLI denies every tool call no allow rule approves, and its PowerShell parser cannot match commands with `--flag=value` arguments (`git log --format=oneline`) against any rule, so even a broad `shell` allowance lost read-only git evidence. The arm's `--deny-tool` and URL rules still apply. Because `--allow-all-tools` also approves commands the CLI cannot parse, the trial home's `settings.json` sets `sandbox.userPolicy.network.allowOutbound: false` and `sandbox.allowBypass: false`, so no shell command can reach the network or leave the sandbox. `trial.json` records this as `sandboxPolicy`.
5. Writes Copilot's stdout and stderr straight to `stdout.txt` and `stderr.txt` through file descriptors, so the CLI never waits on the runner to drain a pipe. With pipes, synchronous runner work in one trial (token scans, workspace snapshots, installs) stalled the other concurrent CLIs long enough to trip their session-host delivery timeouts. Keeps the stdout events, `usage.json`, the shared transcript, CLI logs and the session's `events.jsonl` (subagent and skill events are only in the session log).
6. Marks the trial `invalidated` when the sandbox or the operating system refused a tool call the CLI had permitted and the refused target is inside the trial's workspace or home, is a location the tool needed for itself (such as git's system config), or cannot be resolved (for example, a shell command). Such a trial measures the environment, so the report excludes it. A refusal of a path the agent chose outside the workspace and home, such as an ancestor `AGENTS.md`, is the intended confinement: the trial is scored and the refusal is listed in `environmentWarnings`. A final answer or subagent result that reports a sandbox denial invalidates the trial unless every observed refusal is such a warning, in which case the report is a warning too. `trial.json` lists invalidating matches in `environmentDenials` (with `tool` and `target`) and the first one in `reason`. A refusal by a `--deny-tool` rule (error "denied due to the following rules") is agent behaviour and is scored. A tool call denied because no interactive user response was available (no allow rule approved it in `-p` mode) cost the agent evidence it asked for, so it invalidates the trial with `source: "approval"`. An unapproved `web_fetch` or `web_search` is the arm's network confinement and is a warning. Under the Promptfoo harness this invalidation is provisional: an agent that loses one tool call usually moves on, so the three-model panel reads the denied calls, the tool calls that followed and the final answer, and rules whether the denial materially changed the outcome. Two "not material" votes restore the trial to `completed` before collection. Only a trial whose status before the denial was `completed` (kept in `trial.json` as `preDenialStatus`) is reviewed, so a capped, timed-out or errored run keeps its failure. Otherwise it stays invalidated. The verdict and each vote are kept in `trial.json` as `denialReview`, with the panel's raw answers under `<trialDir>/denial-review/`.
7. Retries infrastructure failures. A nonzero exit whose output contains `session event delivery failed`, `Failed to load models` or `Model catalog request timed out` (the CLI could not reach the Copilot API before any model call), or whose events include a `session.error` with `errorType: query`, is an infrastructure error. The trial is rerun in a fresh home and workspace up to 2 more times (`limits.infraRetries` overrides the count). A retry is not started when the failed attempt changed the workspace or its git state, or when charging it could exceed a credit ceiling; `retryStopped` records why. Each failed attempt's evidence moves to `attempts/<n>/`, and `trial.json` lists every attempt in `attempts` with its status, reason and `creditsCharged`. Other failures are agent behaviour and are not retried.
8. Scans every stored file for the token. A trial whose evidence contains it is redacted and marked `errored`.

Trial evidence is in `<artifactRoot>/<runId>/trials/<task>/<arm>/<repeat>/`, with `trial.json` holding the trial record. Repeats are numbered from 0. `run.json` records the suite, stage, resolved ref SHAs, pinned plugins (`plugins`, by arm), CLI version, credit totals and every trial's status. A plugin arm's `trial.json` records `plugin` as `{repo, commit, name, version, extensions, path}`, with `name`, `version` and the declared `extensions` read from the checkout's `plugin.json`. On CLI 1.0.106 a `-p` run with `--plugin-dir` loads the plugin's agents and skills but starts none of its extensions, so `extensions` is the declared list only.

### Pinned plugins

An arm can load an external Copilot plugin pinned to a commit: `plugin: {repo: <owner>/<name>, commit: <40-hex SHA>}`. Before the first trial, the runner fetches each distinct repo and commit once into `<artifactRoot>/plugins/<owner>__<name>@<commit>`, outside every trial workspace and home, and checks that `HEAD` is the pinned commit and the tree is unmodified. A cached checkout that fails that check is fetched again. A commit that is not 40 lowercase hexadecimal characters fails manifest validation, and a commit the source does not have stops the stage before any trial. The checkout must have `plugin.json` at its root. Dry runs fetch too. An agent the plugin marks `disable-model-invocation: true` runs only when the arm names it in `agent`.

### Credits and ceilings

Credits are derived from the CLI usage total as `usage.totalNanoAiu / 1e9`; `run.json` records this as `creditDerivation`. Each trial is capped by `--max-ai-credits` (the arm's `maxAiCredits`, else `limits.maxAiCredits`, never below 30). Each trial reserves its cap when it starts. When it finishes, the reservation is released and the trial is charged its derived credits. A trial whose Copilot process never launched (for example, a failed install) is charged 0. A trial that launched but left no usage data is charged its full cap and flagged with `creditsEstimated: true`; `run.json` counts these as `budget.estimatedTrials`. Each retried attempt is charged its own derived credits, and the trial's `creditsCharged` is the sum over attempts. Each trial entry in `run.json` records `creditsCharged` and `attempts`. A stage stops scheduling trials once the next one could exceed its ceiling, taken from `stages.<name>.maxAiCredits` or `limits.stageCeilings.<name>`. Stages that share a `ceilingGroup` also share a ledger under `<artifactRoot>/ceilings/<suite>/<group>.json`, capped by the largest ceiling declared in the group. When a ceiling stops scheduling, `run.json` sets `stoppedByCeiling` (the harness engine also records each unstarted trial as `stopped_by_ceiling`) and the CLI exits 2.

## Adding a suite

A suite is a directory under `evals/suites/<name>/` holding `suite.yaml` and `adapter.js`. The runner finds suites by directory, so no registry needs editing.

`suite.yaml` must declare:

| Key | Content |
| --- | --- |
| `name` | The directory name. |
| `taskSource` | Mapping with at least `type`. |
| `splits` | Mapping of split names to suite-specific selections. |
| `arms` | List of `{id, ref, model, reasoningEffort, limits, tools, selection?, agent?, plugin?, maxAiCredits?}`. `plugin` pins an external plugin (see Pinned plugins). `model` cannot be `auto`. `ref` is `null` or `none` (stock), `candidate`, `previous` or any Git ref. `selection` picks the installed agents: absent, `null` or `all` installs every agent `publish` can install; `review` or any string starting with `--` passes installer flags (split on whitespace, for example `--review`); an array passes raw installer arguments; any other string is a comma-separated agent list for `--agents`. `seedFrom: <arm id>` makes a second-pass arm: its trial waits for the named arm's trial on the same task and repeat, and the adapter receives that trial as `ctx.seed` (`{trialDir, sourceArm, collected, record}`) in `materialize`. The source arm must be declared earlier, must not itself be seeded, and must run in every stage that runs the seeded arm. A source trial that did not complete errors the seeded trial with the source's reason. |
| `prompt` | Prompt template. `{{name}}` reads `task.vars`, then task fields, then `workspace`. |
| `limits` | `{timeoutMs, maxAiCredits, stageCeilings?}`. |
| `repeats`, `concurrency` | Positive integers. A stage may set its own `concurrency`. |
| `scorers` | List of `{id, kind, primary?, model?, rubric?}` with at least one primary scorer. `rubric` is required for `llm-rubric`. |
| `license` | A statement, or a mapping such as `{code, data, redistribution}`. |

Optional keys pass through to adapters and the report: `stages` (`{split, arms, repeats, maxAiCredits?, ceilingGroup?, concurrency?, analysis?}` per stage), `analysis`, `reviewRequests` and `judge`.

`analysis.declaredDifferences` lists arm fields (for example `plugin` or `external`) that a comparison may differ in without being reported as confounded. A stage's `analysis.declaredDifferences` replaces the suite's list. The CLI passes the report's `DEFAULT_DECLARED_DIFFERENCES` followed by that list, and records the effective list as `run.json` `declaredDifferences`.

`adapter.js` is an ES module exporting:

- `listTasks(split, ctx)`: the tasks for a split, each with an `id`.
- `materialize(task, workspace, ctx)`: prepares the trial workspace.
- `collect(record, task, ctx)`: returns suite-specific outputs from a finished trial.
- `buildPrompt(task, arm, suite)` (optional): replaces the `prompt` template.
- `preflight(suite, {runDir, artifactRoot, env})` (optional): runs after the dry-run point and before a stage's first trial, with `env` holding only `COPILOT_GITHUB_TOKEN`. A rejection aborts the stage with its error, no trial runs, and `<runDir>/preflight.json` records `{ok: false, error}`.
- `scoreRun({runDir, suite, diagnostic})` (optional): scores the run after all trials. A failure or a non-empty `rejected` list marks the run rejected, and the report gives no verdict.
- `panelInputs(runDir, suite, {artifactRoot})` (optional): returns `{goldenDir, diffFilesFor, taxonomy, taxonomyPath, namedInAdvance, requireFrozen(stage), contextFor?, judgeRoot?, cluster?, clusterModel?, designTextFor?}` for the analysis panel. `contextFor(item)` returns the diff context panelists see for a finding, and `judgeRoot` overrides where the judge's per-candidate match records are read. `cluster: true` groups each PR's findings by the problem they describe, across arms, before the panel labels them, so every arm that raised the same problem gets the same label and a finding grouped with a golden-matched finding counts as verified. `designTextFor({task, arm, repeat})` returns `{text, findings}` for a trial; when present, design forks and implicit bets are extracted from the review prose, grouped per PR and labelled on the design rubric in a separate report section. `clusterModel` picks the grouping and extraction model (default: the first panelist). It is called only when the suite declares `panel:`. After `scoreRun` and before the report, the CLI calls `runPanelAnalysis` with the run directory, the arm ids, the stage comparisons as `[baseline, treatment]`, `requireFrozen(stage)` and the other fields unchanged (the suite's `panel:` block supplies `taxonomy`, `namedInAdvance` and `requireFrozen` when `panelInputs` omits them). A panel failure, including `diffFilesFor` throwing for a task without a materialized diff, is recorded as `run.json` `panel: {ok: false, error}` and in the report, and does not fail the stage. A rejected run or a missing panel module records `panel: {skipped}`. When the panel returns `trialMetrics` (the panel rules on every finding outside the reference review), each trial's `verified`, `verified_precision`, `wrong`, `unverifiable` and `unverifiable_rate` join its primary `scoreRun` entry before `scores.json` is written, so the report compares them like judged metrics (`verified_precision` is verified over verified plus wrong; unverifiable findings are reported, not counted as wrong); `run.json` `panel.mergedTrials` counts the entries that received them.

`ctx` is `{artifactRoot, runDir, suite, arm}` (`arm` is absent for `listTasks`), plus `seed` in `materialize` for a seeded arm. The Martian adapter writes a seed's final answer to `.review/previous-review.md` and its findings to `.review/previous-findings.json`.

## Checks

```sh
npm --prefix evals test
npm --prefix evals test -- --test-name-pattern=isolation
```

The checks run offline against a fake Copilot CLI in `checks/fixtures/fake-copilot/`. They use the `.check.mjs` suffix so the root `npm test` never collects them. CI runs them on Windows, macOS and Ubuntu without any credential.

## Datasets

`datasets.lock` records pinned dataset sources and licenses. Datasets, mirrors and run output stay under the artifact root and are never committed.
