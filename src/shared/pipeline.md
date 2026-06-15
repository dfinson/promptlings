## Map the Diff

Identify every changed file in the PR or branch. For each one, record:

- The path on the new side.
- The change type (added, modified, deleted, renamed, mode change only).
- The new-side line ranges from each `@@ -old,oldcount +new,newcount @@` hunk header. The starting line is `+new`; the inclusive end is `+new + newcount - 1`. For a fully new file, expect `@@ -0,0 +1,N @@` and treat the range as lines 1 through N.

Open each file in the workspace at those ranges, not just the diff fragment. The diff shows what changed; the file shows what it changed in the middle of. A finding that ignores the surrounding scope (the function the change sits inside, adjacent error handling, related tests, imports) is the kind of finding that gets retracted in self-verification.

For renames and deletes, check whether call sites elsewhere in the repo were updated. A rename in isolation is a gap the narrative should explain.

Pull CI status via `gh pr checks` (or equivalent). Record which checks passed, which failed, and coverage if reported. Weave CI results into the narrative where relevant (a failing check contextualizes a code section; coverage numbers inform the triage map). Do not create a separate CI section.

## Map the Runway

Understand what shaped the PR before analyzing it:

- Read the PR description and linked issues. Note what prior work the author references.
- Run `gh pr list --state merged --author <author> --search <relevant path or keyword> --limit 5` to find the 2-3 recent merged PRs that cleared the runway for this one.
- Check if there are open issues this PR closes or partially addresses.

Record:

- Which prior PRs introduced contracts, interfaces, or plumbing this PR depends on.
- Which issues this PR closes vs. which it deliberately punts.
- Any explicit "this lands after X" sequencing the author documented.

This context feeds the narrative. It does NOT create findings on code outside the diff. The rule remains: pre-existing code is someone else's problem. But the narrative can and should explain *why* the diff is shaped the way it is, and that explanation often lives in the PRs that landed last week.

**Contextual research.** Before writing, use web_fetch or research tools to search for real-world relevance that would sharpen the narrative. This is a mandatory step, not an optimization. Spend the time. Examples of what to look for: a recent CVE that exercised the exact failure mode this PR guards against; a named design pattern (well-known or niche) that the PR implements, with enough specificity to tell the reader whether the implementation is orthodox or adapted; a production incident (public postmortem, blog post, conference talk) where the absence of this defense caused measurable damage; a language or framework RFC that explains why the API the PR consumes is shaped that way.

Include what you find only when it makes a falsifiable claim about a specific line or decision in the diff. "MuPDF CVE-2023-XXXX exploited exactly this path: a crafted xref table in a file that passes the magic check" earns its place. "PDF parsers have historically been vulnerable" does not. If the search yields nothing specific enough to anchor after genuine effort, document what you searched for and why nothing qualified, then omit. The bar is specificity, not presence for its own sake. But 0 references across 10 runs means the step is being skipped, not that nothing qualifies.

## Orchestrated Input

When a `diff-state.json` path is provided in the input by an orchestrator:

1. Read `diff-state.json` once to obtain `branch`, `base`, `files`, `untrackedFiles`, `extensions`, `tshirtSize`, `diffPatchPath`, and `findingsFolder`.
2. Issue a single parallel tool-call block to read all files needed by subsequent steps:
   * The diff at `diffPatchPath` (full file, single read). Do not re-read the diff for any reason: no partial re-reads, range extensions, or verification reads. If the first read returns truncated output, work with what was returned.
   * Source files referenced in the `files` array, at the hunk ranges identified in the diff.
   * For files in `untrackedFiles` (no committed diff exists), read the full file content.
3. Skip all git diff commands (diff computation is already complete), but still perform the map-the-diff analysis: map the hunks, identify changed files/ranges, and read surrounding file context using the provided diff and file list. Then proceed to map the runway.
4. After producing output, write it to `<findingsFolder>/<output-filename>` (the agent's designated output file).
5. Skip standalone mode steps.

### diff-state.json contract

```json
{
  "branch": "<branch-name>",
  "base": "<base-branch>",
  "files": ["path/to/file1.ts", "path/to/file2.py"],
  "untrackedFiles": ["path/to/new-file.ts"],
  "extensions": [".ts", ".py"],
  "tshirtSize": "M",
  "diffPatchPath": ".copilot-tracking/pr/pr-reference.xml",
  "findingsFolder": ".copilot-tracking/reviews/code-reviews/<sanitized-branch>/"
}
```

Fields:
- `branch` / `base`: source and target branches
- `files`: all committed changed file paths
- `untrackedFiles`: paths with no committed diff (read in full)
- `extensions`: unique file extensions in the changeset
- `tshirtSize`: XS/S/M/L/XL classification (orchestrator hint for dispatch strategy)
- `diffPatchPath`: path to the full diff output
- `findingsFolder`: where this agent writes its output

## Standalone Mode

When no `diff-state.json` is provided:

1. Check the current branch and working tree status:

   ```bash
   git status --short
   git branch --show-current
   ```

   If the current branch is the base branch or HEAD is detached, ask the user which branch or PR to analyze before proceeding.

2. Compute the diff using the pr-reference skill when available:

   ```bash
   generate.sh --base-branch auto --merge-base --exclude-ext min.js,min.css,map
   list-changed-files.sh --exclude-type deleted --format plain
   ```

   If the pr-reference skill is unavailable, fall back to manual diff computation:

   ```bash
   git fetch origin
   MERGE_BASE=$(git merge-base origin/${input:baseBranch} HEAD)
   git diff ${MERGE_BASE}...HEAD
   git diff ${MERGE_BASE}...HEAD --name-only
   ```

3. Filter the file list to exclude non-source artifacts: lock files (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`), minified bundles (`.min.js`, `.min.css`), source maps (`.map`), binaries, and build output directories (`/bin/`, `/obj/`, `/node_modules/`, `/dist/`, `/out/`, `/coverage/`).

4. Execute the full pipeline.

5. Write output to `.copilot-tracking/pr/review/<sanitized-branch>/<output-filename>` (create the directory if needed, sanitize branch name by replacing `/` with `-`).

6. Present the output in the conversation response.

## Large Diff Handling

When running standalone and the diff exceeds manageable size:

| Changed Files | Strategy                                                                                                                 |
|---------------|--------------------------------------------------------------------------------------------------------------------------|
| Fewer than 20 | Analyze all files with full diffs.                                                                                       |
| 20 to 50      | Group files by directory and analyze each group.                                                                         |
| More than 50  | Progressive batched analysis; prioritize must-read files for the narrative, skim-categorize the rest for the triage map. |

When a diff exceeds 2000 lines of combined changes, use `read-diff.sh --info` and `read-diff.sh --chunk N` for chunked analysis when the pr-reference skill is available.

## Required Protocol

* Use the `timeout` parameter on terminal commands to prevent hanging on large repositories.
* When a terminal command times out or fails, fall back to `git diff --stat` for an overview and targeted file reads for critical sections.
* Do not enumerate or read source files before obtaining the diff.
* Read full file contents only for contextual understanding of diff lines, never as a source of judgment calls outside the diff scope.

## Design Forks

Some choices in the diff do not fit the "what concretely breaks" frame. The diff makes a choice among defensible alternatives, the code is internally consistent, and the right answer depends on context the agent does not have. These are design forks. They are observations for the reviewer, not asks for the author.

A candidate qualifies as a design fork only if all three hold:

1. **The choice is real.** At least two named, defensible options exist with different consequences. "Use a helper or inline it" is not a fork; that is a preference. "One container image multiplexed across N services vs. N directories with separate builds vs. one image deployed N times with different env" is a fork: three named architectures, each with different consequences for build matrix, deployment shape, and observability.
2. **The diff does not disambiguate.** The code is consistent with multiple options, or different parts imply different options. If the diff makes the choice cleanly and the only open question is whether you would have made the same call, that is a preference. Drop it.
3. **The right answer depends on context the agent does not have.** Roadmap, scale targets, team shape, regulatory constraints, prior decisions in unseen code. If one more grep or one more file read would settle it, do the grep instead and either resolve the question or note the answer in the narrative.

Forks are observations for the reviewer, not asks for the author. The author may already know the answer; the point is to surface to the reviewer that a judgment call is sitting in the diff.

Hard rules:

- **Keep forks tight.** If you found many, most are preferences in disguise. Re-evaluate and drop until only genuine forks remain.
- **A fork the diff's own docs already answer is not a fork.** Re-read the relevant section and either convert to a narrative observation or drop it.
- **"What would settle it" is mandatory.** A fork without a settling criterion is the model narrating its own uncertainty.
- **Phrase as observation, not ask.** "The diff is consistent with X or Y; here is the axis they differ on" over "you should consider whether..."
- **Forks are not findings in disguise.** If the candidate has a "what concretely breaks" answer, it belongs in the findings pipeline (or with a functional reviewer if this agent does not produce findings), not in design forks.

## Implicit Bets

Separate from open forks, some choices in the diff are resolved (the code picks one option cleanly) but the choice implies a subjective position the reviewer should consciously agree with. These are not bugs (nothing breaks). They are not forks (only one option is in the diff). They are bets: technically sound decisions that trade one failure mode for another, or commit the codebase to a direction that is expensive to reverse.

A candidate qualifies as an implicit bet if:

1. The code is internally consistent and correct.
2. A defensible alternative exists that the author did not take.
3. The choice has real consequences (cost to reverse, failure mode shape, who bears the operational burden).

Hard rules:

- **Keep bets tight.** If you found many, most are obvious-good decisions you are second-guessing. Ask "would a reviewer actually push back on this?" If no, drop it.
- **Do not editorialize.** State the mechanical tradeoff. Do not say "this is a good bet" or "this is defensible." The reviewer decides.
- **Every bet must have a "question to answer."** This is what separates a bet from narration. The question forces the reviewer to form an opinion.
- **Bets the diff's own docs already defend with citations are still bets.** Include the defense in "why it's defensible" and let the reviewer decide if they agree.

## Appendices

```markdown
## Triage map

**Must-read** (architectural risk lives here):
| File   | Read it because |
|--------|-----------------|
| {path} | {one sentence}  |

**Skim** (mechanical, low risk):
- {path}: {one phrase reason}

**Trust the tests** (generated, mirrored, or CI-gated):
- {path}: {what gates correctness}
```

#### The diff in N layers (when >500 lines changed)

One sentence per architectural layer, nested in dependency order:

```markdown
## The diff in N layers

**Layer 1: {name}.** {One sentence: what exists after this PR that did not before.}
**Layer 2: {name}.** {One sentence: what this layer adds on top of layer 1.}
...
```

Stop at the layer where the explanation is complete.
