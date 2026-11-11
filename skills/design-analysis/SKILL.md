---
name: design-analysis
description: Examine technical designs and plans against requirements, constraints, alternatives, and integration consequences. Use when exploring an architecture or deciding between materially different approaches.
---

# Design Analysis

## Goal

Make the decision and its consequences understandable, then recommend a direction when the evidence and the caller's priorities support it.

## Method

1. Establish the intended behavior, constraints, confirmed decisions, and criteria that distinguish success from failure. Inspect existing solutions and contracts before proposing new abstractions or dependencies.
2. Identify credible alternatives when they differ materially. Trace their implications for producers and consumers, data validity, state transitions, error recovery, concurrency, operations, and migration as relevant.
3. Separate internal contradictions and demonstrated failures from tradeoffs. A documented, deliberate tradeoff is not automatically a defect. A missing requirement is an evidence gap until its applicability is established.
4. Examine costly-to-reverse decisions, hidden assumptions, and the evidence that would change the recommendation. Seek a counterexample to the favored approach.
5. Recommend a direction with its consequences when supported. When the choice depends on missing user priorities, identify the concrete decision and what would settle it.

Select the smallest coherent mechanism that addresses the observed problem,
reusing existing capabilities before adding abstractions or infrastructure.
Distinguish a complete opportunity catalogue from the selected implementation,
an experiment needed to choose, and a policy decision requiring human judgment.
Completeness of discovery does not make every possibility a delivery obligation.
Compare implementation and ongoing ownership cost with the supported benefit.
More services, coordination, persistent state or PRs for a modest objective
should trigger simplification, not automatic decomposition. Preserve essential
correctness and explicit constraints without inventing universal size limits.

## Return and stop

Return the decision under discussion, material alternatives and consequences, supported recommendation or unresolved choice, and required evidence. Scale detail to the decision rather than imposing a template or fixed number of alternatives.

Stop when the decision can be made on the available evidence or its material dependency is explicit. Do not create a plan, change source, or treat a recommendation as approval to implement unless requested.
