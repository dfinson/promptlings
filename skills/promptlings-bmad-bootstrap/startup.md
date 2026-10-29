<!-- promptlings-bmad-bootstrap-start -->
## BMAD checkout readiness

This readiness step belongs to the session that owns a checkout and dispatches
its workflows. It does not apply to in-process reviewers, researchers or generic
coding subagents using that same prepared checkout. Respect an installed
handoff's prohibition on invoking skills. Those subagents follow their assigned
contract and report missing inputs to the parent rather than running bootstrap.

Before that owning session invokes a BMAD workflow or begins work in its own
assigned child checkout, load `promptlings-bmad-bootstrap`.
If native skill loading is unavailable, read its
installed SKILL.md under the current host's skills directory.
This bootstrap uses ordinary tools and does not need BMAD already installed.
It validates the current checkout or provisions from the explicitly supplied
parent session checkout, with an authorized primary-checkout fallback only.
Do not guess parentage, overwrite child work, or run a missing renderer first.
Complete child-local output and readiness checks before proceeding.
This instruction does not authorize installation or copying without scoped
approval and does not activate BMAD for unrelated non-BMAD requests.
<!-- promptlings-bmad-bootstrap-end -->
