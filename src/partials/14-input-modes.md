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
