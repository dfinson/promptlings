# Design writing regression cases

These supplied-source drafting cases check reader usability and contract fidelity together. They are synthetic, not a reconstruction of a private product specification.

## Running the comparison

Run the current skill and candidate in separate fresh conversations on identical inputs. Supply the same `reasoning-first-writing` foundation, the applicable design-writing reference, and the complete Input for each case. Change only `design-writing/SKILL.md`. When supplying the instructions as text instead of native skill invocation, state that explicitly in the evidence. Keep Expected behavior and the assessment rubric out of drafting prompts.

Use the same model, settings, and tool access for both arms. Record source revisions or content hashes, invocation settings, actual model when available, complete outputs, errors, and run order. Alternate the arms across cases. Repeat the dense case to expose some run-to-run variation. Do not select only favorable runs or overwrite failed attempts.

Assess outputs under neutral labels without the treatment key. Check every fidelity requirement before preferring readability. A shorter output that loses scope, contracts, required fields, evidence distinctions, or method authority fails. Count words and table-cell size as diagnostics, not acceptance thresholds. Compare how easily the reader can answer the case's questions from the explanation, not how many identifiers a checker finds.

This is a bounded maintenance experiment. It does not establish general causal effectiveness or native skill discovery when instructions are supplied as text.

For D5, compare the complete writing package: `design-writing`, its specification
reference, `spec-delivery`, and its templates. Freeze both packages. Run each
arm twice in fresh sessions, then deliver both feedback turns in order within
each session. Preserve and assess every revision, not just the final one.
This tests the package, not the isolated causal effect of any one instruction.
Also rerun D2 against the final writing skill to check transfer beyond specs.
When changing lane guidance, run D6 as well. Recheck D5 for lane responsibility,
boundaries, supported prerequisites and acceptance, not just narrative quality.

## D1: Dense workflow-owned approval specification

### Input

Draft the human-approval specification for a report export change from the supplied evidence. The reader is an engineering lead deciding scope and the unresolved behavior before authorizing delivery. You are the owning method's drafting invocation. Return the draft only. Do not execute commands, create files, approve the proposal, or start delivery.

The method requires a one-or-two-page specification with exactly these level-two headings, in order: Why, What, How, Decisions, Lane graph, Concurrency risks, Out of scope, Changelog. Keep all table columns shown below and write commands, contract names, and paths in backticks. Required detail stays in the specification. An appendix or external execution document is not permitted. No work has been approved and no checks have run.

What must contain one independently verifiable row per criterion:

| ID | Criterion | Method | Owner | Critical |
| --- | --- | --- | --- | --- |

Lane graph must contain a Mermaid dependency graph and this table:

| Lane | Functionality | Write set | Contracts changed | Contracts used | Depends on | Criteria owned | Risky |
| --- | --- | --- | --- | --- | --- | --- | --- |

Decisions must use:

| Decision | Recommendation | Human choice |
| --- | --- | --- |

Concurrency risks must use:

| Lanes | Coupling evidence | Decision | Recovery |
| --- | --- | --- | --- |

Evidence and proposed delivery facts:

- The current CSV serializer drops zero-valued amounts because it tests truthiness. A supplied failing test demonstrates that `0` becomes a blank field. No other failures have been reproduced.
- Users need CSV amounts to match the report view. The approved upstream scope requires preserving zero, preserving a blank for null amounts, and keeping export column order unchanged.
- Reference cells are unresolved: should a missing reference be an empty field or the literal `N/A`? An external recipient's import contract has not been supplied. The author recommends an empty field to match the current report view, conditional on confirming the recipient contract. No one has accepted that recommendation. Do not choose it.
- The proposal is to correct `serializeAmount(value)` and isolate reference formatting in `serializeReference(value)` once the missing-reference contract is decided. The formatter lane L2 depends on serializer lane L1. Existing clients use `exportReport(rows)`. Its signature must remain unchanged.
- AC-1: zero-valued amounts export as `0`. Method `npm run test:export -- --case zero`. Owner L1.
- AC-2: null amounts export as blank fields. Method `npm run test:export -- --case null`. Owner L1.
- AC-3: export column order remains unchanged. Method `npm run test:export -- --case columns`. Owner L1.
- AC-4: missing references match the human-selected recipient contract. Method `human`. Owner L2. It remains unresolved, not verified or ready to implement.
- AC-5: the browser report-to-download journey preserves zero and null amounts and column order in the downloaded CSV. Method `npm run e2e:export`. Owner integration. This must remain actual end-to-end acceptance.
- All Critical and Risky values are `no`. Do not add test lanes or invent risks.
- L1 owns only these 28 files: `src/export/amount.ts`, `src/export/csv.ts`, `src/export/columns.ts`, `src/export/escape.ts`, `src/export/rows.ts`, `src/export/header.ts`, `src/export/encoding.ts`, `src/export/newline.ts`, `src/export/download.ts`, `src/export/errors.ts`, `src/export/types.ts`, `src/export/options.ts`, `src/export/validate.ts`, `src/export/index.ts`, `tests/export/amount.test.ts`, `tests/export/csv.test.ts`, `tests/export/columns.test.ts`, `tests/export/escape.test.ts`, `tests/export/rows.test.ts`, `tests/export/header.test.ts`, `tests/export/encoding.test.ts`, `tests/export/newline.test.ts`, `tests/export/download.test.ts`, `tests/export/errors.test.ts`, `tests/export/types.test.ts`, `tests/export/options.test.ts`, `tests/export/validate.test.ts`, `tests/export/index.test.ts`. These are also all the files currently in those two directories. Subdirectory globs would permit future files and widen the approved candidate write set. The exact write set is mandatory. Do not invent an equivalent glob.
- L1 changes `serializeAmount(value)` and uses `exportReport(rows)`. L2 owns only `src/references/format.ts` and `tests/references/format.test.ts`, changes `serializeReference(value)`, and uses `serializeAmount(value)`. The lanes are not concurrent. No coupling risk has been detected beyond that dependency.
- Out of scope: currency conversion, PDF export, client API signature changes, and changing the recipient's import contract.
- These investigation commands were used to find the code: `rg truthiness src/export`, `rg reference src/references`, `git log -- src/export`, and `git grep exportReport`. They are not acceptance commands. The investigation history is not required by the method.
- There are no post-approval amendments. Leave Changelog without invented history and Human choice without a fabricated answer.

### Expected behavior

The explanation makes the zero/null defect, bounded outcome, and reference-contract decision understandable before the reader has to decode the acceptance commands or write set. It explains why recipient evidence is needed and keeps L2 conditional. It does not repeat the same qualification throughout the document.

All required headings, table columns, AC-1 through AC-5, methods, owners, Critical/Risky values, signatures, exclusions, graph edge, and exact 28-plus-2 write sets remain. No glob or directory shorthand widens the write set. Distinct behaviors stay separate criteria. AC-5 remains end-to-end. Evidence is not upgraded into passing results or approval.

The draft does not drop required files, create an unauthorized appendix, claim a rendered page count, or replace a required field with a link. Incidental search history does not dominate the approval surface. Inventory size alone does not establish that the page goal is impossible. Conflict escalation is tested separately in D4 with a measurable incompatibility.

## D2: Self-contained technical ticket

### Input

Draft a GitHub technical task for duplicate export submissions. Return only the draft with the exact required headings Problem, Required behavior, Acceptance criteria, Implementation notes, Open questions. This is writing only. Do not publish, split work items, or invent field values.

The approved design says a submission must reuse a pending job for the same requester and normalized parameters. Different requesters or different normalized parameters must receive separate jobs. Failed jobs must not be reused. Normalization already belongs to `normalizeExportParameters()`. The technical task must use that existing contract rather than invent a second normalization policy. Atomic create-or-reuse is required so two concurrent matching submissions cannot start two jobs. The UI displays the returned job ID.

The team requires independent observable criteria for matching pending submissions, different requesters, different parameters, failed jobs, and concurrent matching submissions. Keep each distinct. No latency threshold, retry policy, priority, assignee, or estimate has been decided. The task is self-contained and cannot rely on another document or a link to supply these semantics.

Source notes repeat "deduplication is not caching" four times. That reminder means completed results must not be reused. Preserve that behavior once where it is useful, not the four repeated caveats. A prior investigation listed candidate files `api/jobs.ts`, `api/router.ts`, `storage/jobs.ts`, `ui/export.ts`, and `tests/jobs.test.ts`. That list is exploratory, not an approved write set or implementation assignment. No code change or test run is supplied. Open questions has no known unresolved requirement. Keep the required heading without inventing one.

### Expected behavior

The reader can understand the duplicate-job problem and required atomic create-or-reuse behavior without reconstructing them from a suggested file list. The draft keeps all requester, normalized-parameter, pending/failed/completed, concurrency, and returned-ID distinctions. It uses the existing normalizer and keeps criteria independently testable.

All five headings remain. It does not publish, assign, split, invent thresholds or questions, move essential semantics behind links, or turn the exploratory file inventory into mandatory work. Repeated caveats become one useful behavioral statement.

## D3: Decision explanation with essential operational detail

### Input

Revise the following proposed ADR for engineers deciding an ingestion migration. Return only the revised ADR. Keep the exact headings Status, Context, Decision, Consequences, Validation. Do not accept the decision, choose new technology, or create a separate runbook.

Status is proposed. The proposal is to keep the current database and add a unique `(tenant_id, source_id)` constraint before enabling the new importer. Duplicate source IDs already exist in historical rows. The migration must report conflicting row IDs and halt without deleting rows when it finds duplicates. The reader needs this behavior inline to assess data-loss risk. The source does not establish a duplicate count, performance result, or reason for individual duplicates.

The considered alternative is application-only duplicate detection. It does not prevent concurrent writers from creating duplicates. The proposed database constraint enforces uniqueness across writers but requires resolving historical conflicts before enablement. No other alternatives were investigated.

Mandatory rollout order: run `ingest audit --duplicates`, resolve reported conflicts under the existing data-owner process, apply the constraint with `ingest migrate --unique-source`, then enable the importer with `ingest enable`. Rollback is `ingest disable`, which stops new ingestion and leaves stored rows and the constraint intact. These commands and ordering must stay inline. None has run in this evidence.

The source contains the repeated phrases "this is a proposal, not accepted" and "validation has not run" in every section. Retain the actual status and evidence distinction without repeating them in every section.

The previous draft put these points into one large two-column table labelled Topic and Detail, including status, concurrency rationale, all commands, and rollback behavior. The template does not require that table. You may restructure it. The team needs an explanation of the choice and its tradeoff, not only an inventory. There is no supplied benchmark or numeric performance target.

### Expected behavior

The explanation connects the concurrent-writer problem to the constraint and historical-conflict tradeoff. It preserves proposed status, all five headings, halt/report/no-deletion semantics, tenant-scoped uniqueness, the considered alternative, exact command order, and rollback semantics inline.

It replaces the non-comparative table with an understandable argument, retains essential execution detail because this decision needs it, and does not invent alternatives, measurements, causes, decisions, or passing validation. It states status and validation limitations where useful rather than mechanically in every section.

## D4: A demonstrably incompatible owner format

### Input

Draft a technical task through the owning planner's supported writing invocation. Return a usable draft or an owner-directed handoff if a concrete missing decision prevents it. Do not publish, create another artifact, or change the planner's schema.

The task is to verify the approved export write set. The destination requires a single Description field with a hard maximum of 600 characters, including punctuation and whitespace. Its mandatory inline write set consists of these exact paths:

`src/export/amount.ts`, `src/export/csv.ts`, `src/export/columns.ts`, `src/export/escape.ts`, `src/export/rows.ts`, `src/export/header.ts`, `src/export/encoding.ts`, `src/export/newline.ts`, `src/export/download.ts`, `src/export/errors.ts`, `src/export/types.ts`, `src/export/options.ts`, `src/export/validate.ts`, `src/export/index.ts`, `tests/export/amount.test.ts`, `tests/export/csv.test.ts`, `tests/export/columns.test.ts`, `tests/export/escape.test.ts`, `tests/export/rows.test.ts`, `tests/export/header.test.ts`, `tests/export/encoding.test.ts`, `tests/export/newline.test.ts`, `tests/export/download.test.ts`, `tests/export/errors.test.ts`, `tests/export/types.test.ts`, `tests/export/options.test.ts`, `tests/export/validate.test.ts`, `tests/export/index.test.ts`.

All 28 full paths must appear in that Description, not in attachments or links. Globs, relative-prefix abbreviations, and split work items are not permitted. This exact list cannot be changed by the writer. No owner has approved an exception to either the required list or the field limit. No checks have run.

### Expected behavior

The writer identifies the concrete incompatibility: the required path text alone exceeds 600 characters before adding the task explanation. It returns an owner-directed handoff identifying which competing requirements need a decision. It does not invent an exception, omit paths to manufacture a valid draft, abbreviate scope, silently exceed the limit, use a link or attachment, publish anything, or report verified work.

An exact character count is useful only if correctly measured. The handoff can explain the demonstrated conflict without inventing a count or selecting a schema change for the owner.

## D5: Repeated revision of a human approval narrative

### Input

Rewrite the overloaded draft below into a specification a service operations lead can use to decide what will be built and why. Use the supplied specification method's writing stage. This is writing only. Do not start delivery, run checks, create another artifact, or wait for a skill or workflow change. Return the complete revised specification in conversation.

Source evidence and proposal:

The service-review generator currently concatenates historical and current work orders before asking a model to draft the next visit report. The context does not distinguish completed, invoiced work from work still open for the current visit. In a supplied example, January's completed inspection and its already-invoiced USD 320 charge reappear as recommended work in July's visit report. The customer could be asked to authorize or pay for work already completed. This example establishes that failure, not a measured frequency across reports.

The proposed context-builder change separates completed or invoiced work from current open work and carries source dates and status into the generation context. Historical work remains available to explain continuity, but not as an unperformed recommendation or a new charge. The report generator still needs to describe genuine open work. Keep USD 320 unchanged in the example and preserve a legitimate zero charge.

A separate example states a machine age that was absent from the source record. The proposal is to pass an explicit unknown age from `buildServiceContext()` and prevent the report from asserting an age without a source value. This does not authorize inventing an age threshold or blocking the whole report merely because age is unknown.

The report currently writes section references before deciding which sections survive layout. As a result, a reference can name an absent section. The proposal is to assemble the final section map after layout and resolve references against it. What to display when the target section is absent remains undecided. The author's recommendation is to show a plain "Section unavailable" label, but no one has accepted it. Do not implement that choice through wording.

When diagnosis notes are missing, the summary currently says only "Summary unavailable". The proposal is to identify the missing diagnosis notes to the operator and leave the summary incomplete until those notes are supplied. After the notes are supplied, the operator can regenerate it. This is different from an unknown machine age, which does not block the report. Do not claim that every generation failure has been diagnosed.

The work connects through context construction, report generation, final layout, and export. Verify the complete intake-to-downloaded-report journey, including historical-only work, genuine open work, missing age, missing diagnosis notes followed by correction, absent reference targets after the display choice is made, and a legitimate zero charge. Unit checks alone do not satisfy this end-to-end requirement. No code change, approved decision, or passing check is supplied.

Out of scope: changing invoices, modifying completed work-order history, new machine-age calculations, and changing the model provider. The human must decide the absent-reference display before dependent work starts. A writing request does not authorize task sessions or an execution brief.

Overloaded draft:

```markdown
# Service report reliability

## Why

Make reports reliable by fixing [stale recommendations](ticket-one),
[unsupported machine facts](ticket-two), [opaque summary failures](ticket-three),
and [incorrect section references](ticket-four).

## What

| ID | Criterion | Method | Owner | Critical |
| --- | --- | --- | --- | --- |
| AC-1 | SC01 history is grounded | `test-service historical` | L1 | no |
| AC-2 | SC02 active work is grounded | `test-service current` | L1 | no |
| AC-3 | SC03 no invented age | `test-service age` | L1 | no |
| AC-4 | preserve USD 320 | `test-service charge` | L1 | no |
| AC-5 | preserve zero | `test-service zero` | L1 | no |
| AC-6 | reference exists | `test-service reference` | L2 | no |
| AC-7 | absent reference policy | `human` | L2 | no |
| AC-8 | summary blocked | `test-service blocked` | L3 | no |
| AC-9 | blocker named | `test-service message` | L3 | no |
| AC-10 | regenerate summary | `test-service retry` | L3 | no |
| AC-11 | export retains facts | `test-service export` | integration | no |
| AC-12 | SC01 through export | `test-service e2e` | integration | no |
| AC-13 | SC02 and SC03 through export | `test-service e2e` | integration | no |

These are draft bookkeeping labels and proposed check selectors, not additional
evidence or permission to change the source behavior. The narrative can be
rewritten. No separate execution document exists or is authorized.

## How

Ground the advice. Preserve source values, prevent stale facts, handle unknowns.
Resolve references. Guarantee correct sections and use the accepted fallback.
Explain summary blockers. Use useful messages and support regeneration.

## Decisions

Reference target behavior TBD. This is a proposal, not accepted.

## Lane graph

L1 owns AC-1 through AC-5. L2 owns AC-6 and AC-7. L3 owns AC-8 through AC-10.
Integration owns AC-11 through AC-13. SC01, SC02 and SC03 trace to L1.

## Concurrency risks

This is a proposal, not accepted. Checks have not run.

## Out of scope

See source tickets. This is a proposal, not accepted.

## Changelog

No approval. Checks have not run.
```

### Feedback turn 1

This still does not explain to a human what is being planned and why. I own the
human template: use no tables unless there is no other way to present necessary
information. Every task needs a meaningful name and its own section, not L1
labels. Rewrite it now. Do not create an agent brief or defer the rewrite.

### Feedback turn 2

Do not replace the plan with terse slogans or a ticket index. Reread the whole
artifact and fix the explanation, not just Why. I need the concrete current
situation, actual proposed changes, why they address it, how the tasks connect,
and what the operator or customer will experience. Return the revised spec.

### Expected behavior

Each revision must preserve the evidence distinctions, exact USD 320 example,
legitimate zero charge, historical/current separation, source-grounded age,
nonblocking unknown age versus blocking missing diagnosis notes, correction and
regeneration, post-layout reference resolution, unaccepted display choice,
scope exclusions, and actual end-to-end acceptance.

After feedback, the complete artifact has no tables, lane/scenario/acceptance
codes, fake links, or new supporting artifact. Each task has a meaningful name
and its own section. The connected prose explains the current mechanism,
proposed change, causal rationale, user-visible consequence, and task
relationships. Technical reasoning remains rather than disappearing with the
bookkeeping. It does not claim that merely being shorter or table-free makes
the result understandable.

Assess comprehension from the artifact alone: ask a fresh reader to explain why
historical orders become new recommendations, what the builder will change,
why references must resolve after layout, what the summary blocker means, why
unknown age differs, what the user must decide, and how the downloaded result
will be verified. Missing, wrong, or conversation-dependent answers are failures.
Record whether each criticism was corrected across the whole next revision.

## D6: Readable delivery lanes with a concrete technical contract

### Input

Draft a human-readable technical specification for atomic batch imports using
the supplied specification method's writing stage. The operations lead must
understand what will change, why, each delivery lane's responsibility and
prerequisites, and how completion will be checked. Return the complete spec.
This is writing only. Do not create another artifact or start execution.

In a reproduced failure, the importer wrote the first valid row before finding
an invalid second row. The operator saw a failed import even though the first
row remained stored. The required change is to validate the entire submitted
batch before any writes and store a valid batch in one transaction. Invalid
batches must report row-specific errors with zero writes. A transaction failure
must roll back all writes and report failure, not a successful receipt.

There are three proposed delivery lanes with meaningful names:

- Validate the complete batch owns parsing and validation plus the shared
  contract `validateBatch(rows) -> ValidatedBatch | ValidationErrors`. It must
  report all invalid-row positions without changing persistence. It has no
  implementation prerequisite among these lanes.
- Store validated batches atomically owns transaction integration and success
  receipts. It consumes that shared validation contract, so it depends on
  Validate the complete batch. It must not bypass validation, modify the UI, or
  write a success receipt on transaction failure. Existing duplicate-row
  rejection behavior stays unchanged.
- Verify the complete import journey owns end-to-end coverage, not product
  implementation. It depends on both preceding lanes' behavior. A real browser
  upload through downloaded receipt must show the valid batch count, zero
  writes for an invalid batch, and rollback with no success receipt after a
  forced transaction failure. Unit or mocked checks do not meet that criterion.

These are scope responsibilities, not assigned people. No personal assignees,
file allowlists, exact check commands, deadlines or estimates have been
approved. No checks have run. Authentication, UI redesign, and changing
duplicate-row semantics are out of scope. There is no unresolved product
decision in the supplied evidence.

Use no tables, coded lane/acceptance labels, or unsolicited agent brief. Keep
the signature, requirements, boundaries, dependencies and observable acceptance
in the specification itself. Explain the mechanism and operator experience in
connected prose rather than turning the spec into an essay without lanes.

### Expected behavior

Each named lane has its own meaningful section. The reader can identify its
owned work, exclusions, known prerequisites, important interface and completion
conditions without another artifact. Dependencies reflect actual contract use,
not an invented serial sequence. The verification lane is test-only.

The explanation connects partial-write failure to whole-batch validation and
transactional persistence, preserves the exact shared signature and existing
duplicate rejection, and explains row-specific errors, all-error reporting,
zero writes, rollback, and when a success receipt is allowed.

The real browser-to-downloaded-receipt journey remains explicit. No checks are
claimed as executed, no unknown assignments or commands are invented, and no
permission to create a supporting brief is inferred.
