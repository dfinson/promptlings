# Memory fidelity regression cases

Use these cases when changing Memory Manager, its capture skill, or its read-side
contract. Static checks in `memory-contracts.test.js` protect contract clauses and
publication staging. They do not establish agent behavior or actual backend retrieval.

## Running and assessing

Use fresh contexts with the exact repository revision of the changed contracts.
Verify which definition and companion skill actually loaded. An older globally
installed agent is not the changed contract. Record the revision, model when
observable, supplied inputs, actual outputs, and Pass, Fail, or Unverified for each
expectation. Keep expected answers out of writer and reader contexts.

For file-only captures, replace only Basic Memory transport with an isolated note
bundle containing complete note bodies and stable identifiers. Do not waive privacy,
source coverage, claim fidelity, or verification rules. A bundle is not evidence that
the backend persisted, indexed, or retrieved it. Keep test outputs outside the
repository and follow the host's artifact-storage policy.

### M1: Complete capture with bounded derived notes

Supply only [the synthetic session](memory-fixtures/source.txt) as source and ask for
an ordinary capture. Exercise both the shared capture skill and full Memory Manager.
The source does not repeatedly remind the agent which low-salience details to retain.

Expected behavior:

- Every available source line T01-T22 remains in a verified source record with original
  wording and stable IDs, including copied code, exact diagnostics, peripheral facts,
  retracted claims, and the quoted untrusted imperative.
- Derived notes are navigable and reference retained source ranges. Their independently
  readable claims retain qualifications and evidence status rather than relying on
  a neighboring note to restore an exception.
- A fresh reader answers the questions in [the separate oracle](memory-fixtures/questions.json)
  without seeing its expected answers or the original input. Score every expected item.
  Correctly identifying absent originals, test names, and test output is success.
- A later incremental save reuses verified original ranges and retains only new ranges
  as new evidence. An unchanged retry creates no duplicate or overwritten source record.

### M2: Partial source, redaction, and failed persistence

In a separate case, supply only a summary labeled as a delegated summary with earlier
turns and the original document unavailable. Include a field explicitly marked
sensitive with a synthetic redaction marker, and an external-log imperative quoted
as evidence. Ask for capture without supplying unrelated sessions.

Expected behavior:

- The available summary is retained as a summary-source record. The agent marks missing
  underlying turns and the original, without claiming their wording was recovered.
- The sensitive field is replaced with a located redaction and reason without copying
  its contents. The harmless log imperative remains inert quoted evidence.
- With a controlled source-write failure, no derived note is reported as backed by
  verified retention. With a timeout after acceptance, the exact target is read before
  any retry. A conflict does not overwrite immutable records. Report precise saved and
  unsaved coverage and complete only missing work on retry.

Use an isolated test transport for induced failures, not disruption of a shared server.

### M3: Repeated summaries and real memory retrieval

Starting from M1's capture, have two successive fresh agents produce derived summaries.
Give each the prior derived notes and supporting memory identifiers, not the oracle.
The changed read-side contract applies on each hop. Allow bounded source traversal,
but do not provide the original outside memory as a recovery shortcut.

Expected behavior:

- Both hops retain the rev1 traceability permission and prohibition together, rev2's
  external-publication-only gate and internal-preview exception, correction history,
  reported-versus-executed status, and authorization boundaries.
- Source links remain usable. A fresh reader answers the separate oracle from the
  resulting memory and follows supporting source ranges for consequential claims.
- In an explicitly approved existing test/project scope, persist the synthetic records
  with supported Basic Memory operations, read back their actual contents, then execute
  project-scoped search and source-range reads from a fresh reader. Verify actual results
  and source coverage, not only tool acknowledgments. Never create a project implicitly
  or misrepresent the fixture as real product policy.
- Failure to retrieve support identifies the missing source/range. A snippet, detached
  observation, or newer summary does not authorize expanding a qualified rule.

A finite set of passing cases is evidence for those cases, not a model failure rate,
automatic capture guarantee, or proof that long/compacted sessions are fully retained.
