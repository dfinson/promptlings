# Specification writing

The active specification or planning method owns its template, requirement vocabulary, generated files, and phase gates. Use its supported invocation to apply writing improvements.

- Lead with the intended capability or outcome, who needs it, and the problem it addresses. State scope and relevant non-goals without silently narrowing the request.
- For a human-facing specification, use connected prose and meaningful task sections. Explain the concrete situation, proposed change, causal rationale, and resulting experience without requiring the reader to decode identifiers or open source tickets. Do not replace an execution manifest with terse outcome slogans.
- Preserve specification substance in that prose: concrete requirements, named delivery lanes when applicable, what each lane owns, scope boundaries, supported dependencies, important interfaces, and observable acceptance. Keep these understandable in the specification itself, not only in a supporting artifact. Do not invent assignees, sequencing, or dependencies to fill a template.
- Use no tables in a human-facing specification unless the necessary information cannot be presented another way. Brevity, convention, parsing convenience, and tracking are not sufficient reasons. Keep agent briefs and execution metadata distinct from the explanation when needed, but do not create a supporting artifact without user authorization. Required behavior, essential technical reasoning, and material decisions still belong in the human explanation.
- Describe externally observable behavior and supported user journeys. Keep requirements distinct from proposed implementation. An implementation plan may need concrete files, interfaces, tasks, dependencies, and sequencing that a product specification deliberately defers.
- Preserve requirement IDs, normative words such as MUST and SHOULD, acceptance-scenario identifiers, priorities, and traceability links. Do not soften "must" into "can" or convert an optional behavior into an obligation.
- Make requirements independently understandable and objectively verifiable. Include triggering conditions, expected results, material error paths, and relevant constraints. Retain a required end-to-end journey as end-to-end acceptance.
- Use measurable limits only when supplied or established. Record the missing threshold as an open question when it changes acceptance. Do not invent latency targets, supported volumes, or compatibility promises to sound precise.
- Keep assumptions separate from confirmed constraints and decisions. Expose open questions that affect scope, behavior, feasibility, or acceptance. Do not fill missing decisions with prose.
- Relate acceptance checks to their requirements. In a plan, relate delivery tasks to the behavior they implement and the evidence they must produce. Do not duplicate the owning method's task engine or lifecycle.
- Include interfaces, data validity, permissions, state changes, failure handling, migration, and operational constraints where they materially affect the specified outcome. Do not expand an unrelated checklist into new scope.

The reader should be able to distinguish what is required, what is proposed, what remains unresolved, and how completion will be demonstrated.

The [research and scope](sources.md#human-readable-specifications) distinguishes
source-backed writing principles from this repository's table and naming policy.
