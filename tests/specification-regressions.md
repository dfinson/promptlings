# Specification regression cases

Run each case in a fresh native context with the candidate Spec Master and its
skills registered. Supply only Input. Keep Expected behavior outside the target
context. S1 requires a coordinator to delegate to the real custom agent, not a
replay of its instructions. Record the actual handoff and loaded resource
revisions so global installed copies cannot masquerade as the candidate.
Verify the recorded user input matches the complete frozen request, including
destination and authority. A truncated prompt or delegation outside the frozen
design invalidates the run rather than establishing candidate success or failure.

Keep complete inputs, traces, output, revision hashes, actual model identity,
resource accounting where available and results in the authorized external
artifact location. Distinguish registration, successful execution, requirement
coverage and comprehension. A shorter output or a self-reported readability
pass does not establish comprehension. These cases are behavioral regressions,
not evidence of superiority to other frameworks or broad statistical improvement.
Use Experiment Director through ab-testing for controlled comparisons.

## S1: Specification before implementation, with dense operational evidence

### Input

Have Spec Master spec retry-safe report exports before implementation. Return
the specification in conversation only. This is the complete synthetic source
snapshot, with no live repository or tracker access.

Problem: a user retries an export after a lost response and gets two export jobs.
Today every authorized POST /exports creates a new job. Existing clients omit
Idempotency-Key. The worker produces CSV files and records queued, running,
completed or failed jobs.

Agreed behavior:

- Clients may send Idempotency-Key. The key is scoped to the authenticated tenant.
- The same key and filter values within 24 hours of initial creation return the
  original job ID and its current status, without creating another job.
- The same key with different filter values within that interval returns HTTP
  409. It must not replace the first request or create another job.
- Authorization runs on every request, including replay. A tenant cannot access
  another tenant's jobs by guessing its keys.
- Simultaneous identical requests create exactly one job. A lost response must
  not cause blind creation on retry.
- At exactly 24 hours the key has expired. A subsequent request may create a
  new job. Replays do not extend the retention interval.
- Replaying a failed job returns that failed job. It does not restart the worker.
- Requests without a key keep existing behavior. CSV contents remain unchanged.

Investigation notes, not an approved delivery plan:

- Possible touched files: export_handler.py, export_store.py, export_worker.py,
  export_client.ts, export_status.ts, schema.sql, test_exports.py,
  test_export_store.py, test_export_worker.py and export_retry.spec.ts.
- Candidate checks: python -m pytest test_exports.py, python -m pytest
  test_export_store.py, python -m pytest test_export_worker.py, and a browser
  export_retry scenario.
- A prior planning sketch used API-1, STORE-2, UI-3 and E2E-4 lane IDs, command
  fields, critical markings, write sets and a stacked PR graph. None has approval.
- Atomic storage is available, but no particular schema or library is selected.
  No implementation, check or browser flow has run.

### Expected behavior

The coordinator preserves the specification-only scope instead of adding
mandatory write sets, commands or gate inventories. Spec Master loads the actual
candidate writing method and human template. It explains the timeout/retry
experience, why atomic replay prevents duplicate work and meaningful task
responsibilities. It retains all eight agreed behavioral constraints, including
the exact expiry boundary, failed-job replay, tenant scoping, every-request
authorization, different-filter rejection and unchanged unkeyed behavior.

Operational notes do not become the main reading path or a companion artifact.
The exact HTTP contract can remain where it informs the decision. Proposed
storage design is distinguished from existing source facts and approval.
It neither claims executed checks nor starts implementation.

Assess comprehension by explaining from the output alone what the user does
after a timeout, what happens for a failed job or changed filters, why duplicates
are prevented and what remains unchanged. Cite passages, not word counts.
Check coverage independently against every agreed constraint and their
interactions. Fail if a fluent summary conceals missing or contradictory detail,
or if understanding depends on decoding the operational inventory.

## S2: Precision and an unresolved consequential choice

### Input

Use Spec Master to revise this proposal for human review, in conversation only.
This supplied snapshot is complete. There is no live repository or execution.

Purpose: let users undo an accidental archive without revealing another
workspace's records. Archive changes active to archived. Restore changes
archived to active, and restoring an already active record is a successful
no-op. Both operations require current workspace membership every time.
A concurrent permanent deletion must never be reversed by a restore.
Existing clients depend on HTTP 404 for both missing and unauthorized records
so they cannot distinguish existence. Preserve that response contract.

Two unresolved proposals disagree on the undo period: 7 days or 30 days.
Neither is approved or supersedes the other. The UI deadline, retention job
and boundary acceptance examples depend on that choice. Permanent deletion
requires the selected period to have elapsed and must not remove active records.
Audit events distinguish a state change from a no-op. Audit retention is already
approved at 90 days. No implementation or test has run.

### Expected behavior

The reader can explain the archive/undo journey and the reason for the
authorization, response and concurrency constraints. Preserve exact HTTP 404
behavior, current membership checks, successful no-op, deletion protection,
audit distinctions and approved 90-day audit retention.

Expose the 7-day/30-day choice with consequences before dependent procedures.
Do not silently pick a value, confuse it with audit retention or claim deadline
behavior is agreed. Conditional design may explain the required mechanism and
acceptance once the choice is made. Neither brevity nor a reference-detail
section may hide this decision. Keep coverage and comprehension results separate.

## S3: Explicit delivery planning still needs operational precision

### Input

Use Spec Master and spec-delivery to prepare an execution plan for approval,
in conversation only. The human behavior proposal is agreed. Implementation
has not been authorized. No live repository or execution is available.

Approved scope: add the greeting "Hello" to an existing empty page. The only
product path is page.html and the only test path is greeting.test.mjs. The
single lane is Greeting. Its criterion is that the page visibly shows Hello.
The supplied validation command is node --test greeting.test.mjs. Mark the
criterion critical. The lane owns both paths and has no prerequisites.
The supplied baseline is 1111111111111111111111111111111111111111.
This snapshot is proposed-plan-v1, not an approval record or executed result.

### Expected behavior

Retain the exact paths, lane ownership, command, critical marking and supplied
baseline in the requested operational plan. Do not remove them as unreadable
execution detail. Distinguish agreement on behavior from revision-bound
implementation approval. No generated hash or self-assessment can invent that
approval. Explain the critical test-first gate, scoped PR boundary and relevant
acceptance without claiming checks ran. Surface any required evidence still
missing without inventing target revisions, results, approvals or live access.
Create no unsolicited companion and perform no implementation.
