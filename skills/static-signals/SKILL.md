---
name: static-signals
description: Gather lightweight static signals and change neighborhoods for a code review, then hand them to the reviewer as leads to verify. Prefers the project's own configured linters and type checkers, falls back to ephemeral per-language tools, and always runs a small cross-language core. Use during PR, branch diff, or local change review when executing tools in the workspace is permitted.
---

# Static Signals

## Goal

Give the reviewer two kinds of help that reasoning over a diff tends to lack:

- **Tool leads**: concrete locations where a deterministic tool reports a type or nullability violation, an unresolved symbol, an unreachable or redundant condition, a misspelled identifier, or an added secret.
- **Change neighborhoods**: the callers, callees, delegates, and sibling implementations of each changed function. Many serious review misses need reasoning across calls, such as a delegate that recurses back into the changed class, or a value that a caller can pass as nil.

Tool output is a candidate to verify, never a finding by itself. The reviewer reads the code and decides.

## Scope and limits

Analyze only files the change touches. Keep only results on added or modified lines, plus results in unchanged lines that a changed line directly causes, such as a new type error at a call site. Treat everything else as pre-existing and drop it.

Keep the work lightweight. Give the whole pass a time budget, about five minutes unless the caller sets one, and about one minute per tool. Skip any tool that is unavailable, fails to start, or exceeds its share, and record the skip. Never modify product files, manifests, lockfiles, or tool configuration. Never apply autofixes. Never send source code or results to a network service; tools may be downloaded, but they run locally.

## Method

1. **Map the change.** From the diff, list the changed files, their hunks, and the changed symbols: functions, methods, overrides, and exported names. Group the files by language.

2. **Detect each ecosystem and its state.** Read the manifests and lockfiles at the repository root and near the changed files: `package.json` with its lockfile, `tsconfig.json`, `pyproject.toml`, `requirements*.txt`, `go.mod`, `Gemfile`, `pom.xml`, `build.gradle*`, `Cargo.toml`. For each one, check whether its dependencies are already installed, for example `node_modules`, an active or project-local virtual environment, a populated module cache, or `vendor/bundle`. Find the linters and type checkers the project already configures in config files, `package.json` scripts, `Makefile` or `justfile` targets, pre-commit config, and CI workflow steps.

3. **Tier 1: run what the project already has.** When dependencies are installed and a tool is configured, run the project's own copy with the project's own configuration on the changed files. Examples:
   - JavaScript and TypeScript: `eslint` from `node_modules/.bin`, and `tsc --noEmit` against the project `tsconfig`.
   - Python: `ruff check`, and `pyright` or `mypy` from the project environment.
   - Go: `go vet` on the changed packages, plus `staticcheck`, `golangci-lint`, or `nilaway` if configured.
   - Ruby: `bundle exec rubocop` on the changed files.
   - Java and Kotlin: the configured Error Prone, NullAway, SpotBugs, Checkstyle, or lint task, only when it runs without a full build.
   - Rust: `cargo clippy` when the crate builds offline.

   Compilers and type checkers are the most reliable leads available. They catch imports of names that do not exist, wrong symbols, and impossible conditions. Prefer this tier whenever it is available.

4. **Ask before installing project dependencies.** If a configured tool needs dependencies that are missing, ask the user before running `npm ci`, `pnpm install`, `pip install`, `uv sync`, `bundle install`, or a Docker pull. These take time and disk, and they execute install scripts from the repository. If the user declines, or nobody can answer, continue with tier 2.

5. **Tier 2: ephemeral per-language fallbacks.** For a language with no usable project tool, run a minimal, permissively licensed tool through the language's own ephemeral runner. Pin an explicit version and report it. Examples:
   - Python: `uvx ruff@<version> check`. For unresolved imports and type errors, use `uvx pyright@<version>`, which is useful only when the project environment resolves.
   - JavaScript and TypeScript: `npx oxlint@<version>`. It has no type information.
   - Go: `go run honnef.co/go/tools/cmd/staticcheck@<version>`, and `go run go.uber.org/nilaway/cmd/nilaway@<version>` for nil dereferences, both on the changed packages when the module's dependencies resolve.
   - Ruby: `gem exec rubocop` with only the `Lint` department enabled.
   - Java: skip. No lightweight option exists without a build.

   Restrict fallback rules to correctness. Drop style and formatting rules, because they do not reflect the project's conventions.

6. **Tier 3: cross-language core.** Run these whenever the binary or its runner is available:
   - `typos` on the changed files, for misspelled identifiers, strings, and comments.
   - `gitleaks` on the changed files with redaction, for added secrets. Never print a secret value.
   - `lizard` through `uvx lizard`, on each changed file at base and at head. Report only functions whose cyclomatic complexity now exceeds 10 or rose by 5 or more, with both values. Complexity predicts how hard code is to understand, not whether it is wrong, so treat it as a reason to read more slowly.
   - `ast-grep`, only with rules the repository or the caller supplies. Never invent rules during a review.

7. **Build change neighborhoods.** For each changed function or method, find the following through the language server when one is available, otherwise through `rg` on the symbol name, at five entries or fewer per list:
   - its callers and callees, with file and line;
   - for a changed delegation, wrapper, or override, what the delegate resolves to, and whether that target calls back into the changed class;
   - for a changed value that can be nil or null, where it is produced and where it is consumed;
   - for an interface method or override, the sibling implementations.

   Read the relevant callee bodies before judging a lead that depends on them.

8. **Normalize the leads.** Reduce each tool result to file and line, tool and rule, and a one-line message. Collapse duplicates across tools. Drop results outside scope. Keep at most ten per tool, and record how many were dropped.

9. **Hand off to review.** Form an independent reading of the change first, then consult the leads, so the leads add to the review rather than replace it. Work through leads in this order: compiler and type errors, nullability, secrets, unreachable or always-true conditions, repository rules, spelling, complexity. For each lead, read the code with its neighborhood and either confirm it or dismiss it. For a confirmed problem, write an ordinary review finding with its own reasoning, evidence, and the input or call sequence that triggers it. Never forward raw tool output, rule names, or counts as findings. A dismissed lead needs no mention in the review.

## Precision

Leads are worth reading only while they are mostly right. If most leads from one tool or rule turn out false in this change, stop reading its remaining leads. Record in the return every rule where more than one lead in ten proved false, so it can be disabled for this repository. That is the bar Google's Tricorder applies to analyzers shown in code review.

## Trust boundary

Running a project's linters, their configs, and their plugins executes code from that repository, and installing dependencies runs install scripts. That is acceptable for the user's own checkout. For a change from an untrusted fork, say so and ask before tier 1 or any installation. Tiers 2 and 3 run only pinned third-party tools and do not execute repository code.

## Return and stop

Return:
- The tools that ran, with their tier, version, and scope.
- The tools that were skipped, each with its reason.
- Any user decision about installing dependencies.
- The normalized leads with dropped counts.
- The neighborhoods.
- Any rule where more than one lead in ten proved false.

Keep this record separate from review findings, so a reader can tell tool evidence from the reviewer's conclusions. Stop when the leads and neighborhoods are delivered, or when the budget is spent.

## License policy

Use only tools under permissive licenses (MIT, Apache-2.0, BSD, ISC) as fallbacks or as the core. A project's own configured tools are the project's choice. Do not fetch rule packs whose licenses restrict use, such as the Semgrep Rules License, Commons Clause, AGPL, or Business Source License terms.
