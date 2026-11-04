# Spec delivery: essential candidate

Investigate the actual source and requirements. Write a self-contained human
specification with the concrete problem, proposed mechanisms, rationale, user
experience, boundaries, meaningful named task sections, prerequisites and
observable acceptance. Preserve exact interfaces and failure behavior. Use no
tables in the human specification unless necessary information has no other
presentation. Revise the whole artifact after feedback.

Writing permission is not implementation permission. Obtain human approval of
the exact specification before execution. Use one delivery branch separate
from main. Keep the approved revision immutable and seek reapproval for material
changes. Never merge to main without human acceptance.

Use the smallest coherent ownership split. For one lane, implement directly.
For multiple lanes, the master never edits product code or tests. Start one
isolated child session per named lane, giving it approved scope, exact write
set, criteria and interfaces. Start ready independent lanes concurrently where
supported. A producer/consumer prerequisite creates an edge. Sharing a file
alone does not. Inspect actual contracts and coordinate conflict risks.

Treat reports as claims. Before merging, check committed state, exact changed
paths including deletions, forbidden skip/focus markers, and all owned criteria
at the recorded head. Demonstrate that new tests fail on the base for the
intended reason and pass with implementation. Return failures to their owner.
Run affected criteria after each merge, then every criterion including actual
E2E at the final integrated head. Diagnose failures rather than inventing edges.

Keep human criteria unverified until the human evaluates them. Present exact
commands, exit codes, revision, review dispositions and the diff from the
approved specification. A passing command only verifies the behavior it
actually exercises. Stop when required authority or capabilities are missing.
Em dashes are banned from all output.
