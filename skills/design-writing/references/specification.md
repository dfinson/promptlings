# Specification writing

The active specification or planning method owns its template, requirement vocabulary, generated files, and phase gates. Use its supported invocation to apply writing improvements.

- Lead with the intended capability or outcome, who needs it, and the problem it addresses. State scope and relevant non-goals without silently narrowing the request.
- For a human-facing specification, use connected prose and meaningful task sections. Give a guide-level explanation of the situation, change, mechanism, rationale and resulting experience, followed by reference-level detail where exact contracts matter. Connect both levels through the same examples. Do not require source-ticket or code-symbol decoding to understand the proposal, or replace its technical substance with slogans.
- Preserve specification substance in that prose: concrete requirements, named delivery lanes when applicable, what each lane owns, scope boundaries, supported dependencies, important interfaces, and observable acceptance. Keep these understandable in the specification itself, not only in a supporting artifact. Do not invent assignees, sequencing, or dependencies to fill a template.
- Use no tables in a human-facing specification unless the necessary information cannot be presented another way. Brevity, convention, parsing convenience, and tracking are not sufficient reasons. Keep agent briefs and execution metadata distinct from the explanation when needed, but do not create a supporting artifact without user authorization. Required behavior, essential technical reasoning, and material decisions still belong in the human explanation.
- Describe externally observable behavior and supported user journeys. Keep requirements distinct from proposed implementation. An implementation plan may need concrete files, interfaces, tasks, dependencies, and sequencing that a product specification deliberately defers.
- State independently assessable behaviors separately, with triggers and outcomes. Use scenarios for consequential edge cases and interactions. Preserve existing scenarios and constraints when revising, rather than shortening them to fit a word or character limit.
- Put choices that affect agreement before execution procedures. Keep technical detail in the human specification when it changes the behavior, compatibility, feasibility or tradeoff being approved. An exact interface may be essential, while an exhaustive file list is not automatically required. "Implementation-ready" alone does not change the artifact's purpose.
- Preserve requirement IDs, normative words such as MUST and SHOULD, acceptance-scenario identifiers, priorities, and traceability links. Do not soften "must" into "can" or convert an optional behavior into an obligation.
- Make requirements independently understandable and objectively verifiable. Include triggering conditions, expected results, material error paths, and relevant constraints. Retain a required end-to-end journey as end-to-end acceptance.
- Use measurable limits only when supplied or established. Record the missing threshold as an open question when it changes acceptance. Do not invent latency targets, supported volumes, or compatibility promises to sound precise.
- Keep assumptions separate from confirmed constraints and decisions. Expose open questions that affect scope, behavior, feasibility, or acceptance. Do not fill missing decisions with prose.
- Relate acceptance checks to their requirements. In a plan, relate delivery tasks to the behavior they implement and the evidence they must produce. Do not duplicate the owning method's task engine or lifecycle.
- Include interfaces, data validity, permissions, state changes, failure handling, migration, and operational constraints where they materially affect the specified outcome. Do not expand an unrelated checklist into new scope.

Check both requirement coverage and whether the reader can distinguish what is
required, what is proposed, why the mechanism fits, what remains unresolved and
how completion will be demonstrated. Passing coverage does not establish
comprehension. New requirements or important choices must not appear only in
reference detail or a later execution plan.

The [research and scope](sources.md#human-readable-specifications) distinguishes
source-backed writing principles from this repository's table and naming policy.
