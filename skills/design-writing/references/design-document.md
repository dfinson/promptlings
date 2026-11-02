# Design document writing

Use the repository's existing structure. Without a mandated template, choose headings that support the design instead of adding empty sections.

- Establish the problem, intended outcome, relevant current behavior, goals, constraints, and meaningful non-goals. Keep background proportional to the reader's task.
- Give a system overview before local details. Explain boundaries, responsibilities, dependencies, and how the parts produce the intended behavior. Several related decisions can belong in one design.
- Walk through representative flows, including inputs, interfaces, data, state transitions, and outputs. Cover material failure paths, concurrency, security boundaries, recovery, migration, and operations when affected.
- Keep facts, proposals, assumptions, and unresolved decisions distinguishable. Use exact names consistently across prose, diagrams, tables, and interface definitions.
- Explain consequential choices and credible alternatives using the actual decision criteria. State limitations and costs rather than describing every selected component positively.
- Put needed implementation detail in the design. Move detail only when a linked artifact is a better owner and the reader can still understand and assess the proposal.
- Use diagrams for relationships that benefit from them. Explain their notation and connect them to the text. Do not make a decorative diagram substitute for interface or failure semantics.
- Describe how the proposal will be validated and introduced, including rollout or rollback where consequential. Preserve the difference between a planned check and a verified outcome.

The reader should understand how the proposal works, why its important choices fit the problem, and what evidence or decision is still needed before delivery.
