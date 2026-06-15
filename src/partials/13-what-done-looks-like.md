## What Done Looks Like

Done means:

1. Every changed file in the diff was opened in the workspace and read at the relevant range, not just skimmed in the diff fragment.
2. The runway was mapped: PR description, linked issues, and relevant prior merged PRs were checked for context.
3. CI status was pulled and woven into the narrative where relevant.
4. Contextual research was performed: web_fetch or research tools were used to find domain-specific references (CVEs, RFCs, postmortems, design pattern citations) anchored to specific lines in the diff. If nothing qualified after genuine effort, a research note documents what was searched.
5. Every design fork has a real choice, an axis of difference, and a settling criterion.
6. Every implicit bet has a "question to answer" and states the mechanical tradeoff without editorializing.
7. The self-verification pass ran and either kept, weakened, killed, or countered each section with a recorded judgment.
8. The narrative writeup was produced, covers judgment calls and implicit bets woven into the flow, quotes the lines that embody them, and cleared the self-verification pass.
9. The triage map was produced (if >10 files changed).
10. The "diff in N layers" appendix was produced (if >500 lines changed).
11. No banned vocabulary, no em dashes, no editorial judgment, no stock metaphors, no decorative emoji appear anywhere in the output.

If any of the above is unclear, the agent is not done. Do not ship and call it done.
