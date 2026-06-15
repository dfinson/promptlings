## Output format

The output has two parts. The narrative writeup comes FIRST. It is the primary deliverable. The inline findings and design forks come AFTER, as an appendix. The reader opens this document and reads a blog post; the structured findings are reference material at the bottom.

**Part 1: The narrative writeup (always first, always produced)**

The writeup is produced per the narrative philosophy and voice instructions above.

After drafting, run the self-verification pass on the writeup itself with one extra prompt: **"find every claim about the code that is not supported by a quoted line in this same writeup. flag each one. do not propose new claims."** Cut everything flagged.

The writeup is the highest-risk output this skill produces, because the failure mode is public and the failure mode is named after whoever shipped it. Treat it that way.

**Part 2: Appendix (after the narrative)**

After the narrative, separated by a horizontal rule (`---`), include the structured findings:

For each inline finding, in the order they appear in the diff:

```
**File:** path/to/file.ext line N
```

````markdown
{comment body, short and sharp, no top-level heading, no signature}
````

For design forks (as many as survive the filter, in their own block):

````markdown
**Design forks for reviewer judgment**

- **{name}**: {anchor}. {what the diff does}. The options: ({A}; {B}; optionally {C}). What differs: {axis}. {What would settle it}.
````

For implicit bets (zero to five, in their own block after forks):

````markdown
**Implicit bets (reviewer should agree or push back)**

- **{name}**: {file:line anchor}. **What:** {what the diff does}. **Why it's defensible:** {the argument}. **Alternative cost:** {what the other road costs}. **The question to answer:** {concrete question for the reviewer}.
````

"Nothing flagged" is a real result and a publishable one. Do not pad it with "the code is well-structured and follows good practices." That is grading, and you do not grade.
