Understand what shaped the PR before analyzing it:

- Read the PR description and linked issues. Note what prior work the author references.
- Run `gh pr list --state merged --author <author> --search <relevant path or keyword> --limit 5` to find the 2-3 recent merged PRs that cleared the runway for this one.
- Check if there are open issues this PR closes or partially addresses.

Record:

- Which prior PRs introduced contracts, interfaces, or plumbing this PR depends on.
- Which issues this PR closes vs. which it deliberately punts.
- Any explicit "this lands after X" sequencing the author documented.

This context feeds the narrative. It does NOT create findings on code outside the diff. The rule remains: pre-existing code is someone else's problem. But the narrative can and should explain *why* the diff is shaped the way it is, and that explanation often lives in the PRs that landed last week.

**Contextual research.** Before writing, use web_fetch or research tools to search for real-world relevance that would sharpen the narrative. This is a mandatory step, not an optimization. Spend the time. Examples of what to look for: a recent CVE that exercised the exact failure mode this PR guards against; a named design pattern (well-known or niche) that the PR implements, with enough specificity to tell the reader whether the implementation is orthodox or adapted; a production incident (public postmortem, blog post, conference talk) where the absence of this defense caused measurable damage; a language or framework RFC that explains why the API the PR consumes is shaped that way.

Include what you find only when it makes a falsifiable claim about a specific line or decision in the diff. "MuPDF CVE-2023-XXXX exploited exactly this path: a crafted xref table in a file that passes the magic check" earns its place. "PDF parsers have historically been vulnerable" does not. If the search yields nothing specific enough to anchor after genuine effort, document what you searched for and why nothing qualified, then omit. The bar is specificity, not presence for its own sake. But 0 references across 10 runs means the step is being skipped, not that nothing qualifies.
