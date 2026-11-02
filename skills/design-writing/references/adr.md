# ADR writing

Use the active ADR template and lifecycle owner. These checks complement that contract instead of replacing its sections.

- Center the record on one significant architectural decision. If the source bundles independently decidable choices, identify the separate decisions and propose a split. Do not split files or change the approved scope without authorization. A broader design can legitimately cover several decisions.
- State the status accurately, including proposed, accepted, rejected, or superseded when those are the active schema's values. Preserve decision identifiers, dates, authorship, and supersession links. Drafting a record does not accept its decision.
- Describe the specific context and forces that made a decision necessary. Include constraints and criteria that distinguish the alternatives, rather than a generic technology introduction.
- State the chosen option unambiguously when a choice exists. Explain why it fits the criteria using established evidence. Separate recorded rationale from the writer's interpretation.
- Cover credible alternatives actually considered or supported by the investigation. Do not invent rejected options, imply consensus, or pad a fixed number of alternatives.
- Explain consequences, including costs, limitations, obligations, and conditions that would justify revisiting the decision. A tradeoff is not automatically a defect.
- Keep implementation detail that explains the decision or a consequential constraint. Link to detailed design and execution work rather than turning the ADR into their duplicate.
- Use diagrams only when they clarify the decision. No diagram quota, mandatory "we", reading-level target, or universal word budget applies.

The reader should be able to answer: What was decided, under which constraints, why this option, what was given up, and what follows?
