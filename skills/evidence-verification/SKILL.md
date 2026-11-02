---
name: evidence-verification
description: Verify technical claims and review findings against source, contracts, tests, and runtime evidence while seeking counterevidence. Use when deciding whether an assertion is supported or reconciling conflicting findings.
---

# Evidence Verification

## Goal

Determine which claims the evidence supports, contradicts, or leaves unresolved. Agreement between reviewers is provenance, not proof.

## Method

1. Extract the material factual claims, target revision, claimed triggering conditions, and asserted consequence. Resolve the cited source and surrounding context, including affected producers and consumers.
2. Identify a falsifiable check for each claim: source inspection, a contract reference, a focused test, or a bounded runtime observation. Perform only authorized checks and record what actually ran.
3. Search for counterevidence, such as a guard, alternate caller, rollback, schema constraint, or test path that invalidates the proposed mechanism. Check applicability rather than accepting a matching pattern.
4. Classify the claim as supported, contradicted, or unresolved. Keep missing evidence distinct from evidence of failure. Revise or reject an objection when its mechanism is disproved.
5. Reconcile conflicting observations using the target and underlying evidence. Preserve a supported singleton finding. Deduplicate the same root cause without discarding distinct triggering conditions or consequences.

## Return and stop

Return the claim, evidence and counterevidence locations, check results, disposition, and material limitations. For defects, explain what fails, under what conditions, and why. Recommend what fully addresses the problem rather than optimizing for fix size.

Stop when material claims are resolved or the next useful check is unavailable. State what is missing and which conclusion it prevents. Never certify a revision different from the one examined or infer global correctness from a finite set of checks.
