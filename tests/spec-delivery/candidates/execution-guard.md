## Execution fidelity

Before coding, distinguish approved behavior changes from incidental validation
or interface changes. Preserve existing accepted inputs and return contracts
unless the human explicitly authorizes a change. A new type check can reject
previously accepted input even when the main E2E passes. Record discovered
validation gaps as decisions, not permission to implement them. Never
self-approve a new requirement by adding it to a spec and tagging that spec.
Apply the source-fidelity check to the final implementation as well as writing.
