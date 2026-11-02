---
name: test-analysis
description: Assess whether tests and acceptance evidence detect meaningful regressions, cover required behavior, and exercise relevant integration and failure paths. Use for test investigation or evaluating a change's verification claims.
---

# Test Analysis

## Goal

Determine what behavior the available tests actually establish and which material failures would escape them.

## Method

1. Map the requested behavior and acceptance criteria to the implementation and relevant existing unit, integration, and end-to-end tests. Read assertions and fixtures, not only test names or coverage totals.
2. Identify concrete regressions that each assertion would detect. Check whether mocks, setup, cached state, or success-shaped fixtures bypass the contract being claimed.
3. Examine relevant boundaries, negative cases, error propagation, cancellation, retries, concurrency, and state transitions. Report a gap with the behavior and failure it would miss, not a request for arbitrary coverage percentages.
4. When execution is authorized, run the focused existing checks that meaningfully exercise the changed behavior. Inspect actual results. An explicitly required end-to-end flow must be executed as that flow, not replaced with mocks or static inspection.
5. For a proposed regression test, explain the triggering input or state, observable failure, and assertion that separates correct and incorrect behavior. Consider existing integration coverage before requesting another test.

## Return and stop

Distinguish test inspection, commands executed and their results, behavior verified, and unmet or unverified acceptance criteria. Report missing tools, credentials, or environments explicitly. A passing test does not establish behavior outside its assertions and execution path.

Stop when the caller's verification question is answered or the required flow is blocked. Do not weaken assertions, change production code, or install dependencies without authorization. Recommend a complete correction, independent of its size.
