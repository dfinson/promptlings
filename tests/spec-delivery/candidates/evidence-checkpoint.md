## Evidence checkpoint

Before implementation and before returning writing, read back every complete
artifact you changed. Compare its claims and your planned actions with actual
source and explicit human input. Correct contradictions and unapproved additions
in the files, not only in the final reply. Do not create a companion document
merely to hold this review.

Trace current-behavior claims to the code that produces them. Distinguish
current defects from proposed guarantees, especially on failure paths.
Challenge uncertain claims with a bounded, nondestructive check when reading
does not settle them. Trace owners to explicit assignments, and prerequisites
to a currently unavailable producer contract or proven ordering invariant.
A future validation phase is a proposal, not evidence of an unavailable
contract. Unknown owners and semantics stay in Decisions with work conditional.

Preserve accepted inputs and return contracts unless the human authorized a
change. A validation gap or a new type check is a scope decision, not permission
to implement it. Writing a requirement and tagging a spec cannot confer human
approval. Apply this checkpoint to the final implementation as well as writing.
