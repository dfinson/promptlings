---
name: review-comment-writing
description: Turn supported review findings into immediately understandable PR comments with plain reasoning, one ask and purposeful visuals, anchored to the exact diff where needed. Use whenever reviewers draft findings, inline or top-level comments, or review-thread replies.
---

# Review Comment Writing

## Goal

Every finding a reviewer returns carries a proposed comment the caller can post with little or no editing. The finding holds the evidence for the caller. The comment is for the PR author, a person who has not read the review, the agent's notes, or the conversation.

This skill owns how comments are anchored and worded. What counts as a finding, and the evidence behind it, stays with the reviewer. Drafting a comment does not authorize posting it.

## Pair each finding with a proposed comment

Return each item in two parts:

- **Finding** (for the caller): the claim, mechanism, triggering conditions, evidence, and verification status, as the reviewer's own contract requires.
- **Proposed comment** (for the author): the anchor and the comment text.

Give every verified defect a proposed comment. Give a design fork, implicit bet, or open question a proposed comment when posting it would ask the author something useful. Leave it as reviewer-only material otherwise and say so in the finding. Merge duplicate findings into one comment at the most useful anchor.

## Anchor

Use an inline anchor whenever one place in the diff shows the problem:

- `path`: file path on the side being commented on.
- `side`: `RIGHT` for added or unchanged lines on the new side, `LEFT` for a removed line.
- `line`, or `start_line` and `line` for a range covering several lines.
- The reviewed head commit, so the comment can be checked against the revision it describes.

The anchor line must be inside a diff hunk on that side. When the reviewer's contract narrows valid anchors, such as allowing only added lines, follow the contract. Prefer the line that carries the behavior over the line where a symptom appears. Use a top-level comment only when the issue spans files with no single place to point at, and name those files in its first sentence. Put coordinates in the anchor fields, never in the comment text.

## Write the comment

Load `reasoning-first-writing` and apply it. Then:

1. Start with what the code does and when it goes wrong, in concrete terms: the input, state, or sequence that triggers it and what the user or caller sees.
2. Give the ask: the change that fixes it, or the question the author needs to answer. One ask per comment.
3. When the fix is small, local, and certain, include it as a GitHub `suggestion` block (or the host's equivalent) instead of describing it.
4. Use plain words and the names in the code. Put identifiers, values, and short code in backticks.
5. Make it understandable in one reading. Two to four sentences is a useful tendency, not a pass condition. State the causal link rather than compressing it into jargon. Use a short concrete sequence or example when that helps, without overwhelming the author with the investigation.
6. Talk about the code, not the author. Do not use their name.

Leave out:

- Headings, `#` markup, bold labels such as **Issue:** or **Fix:**, and severity tags. `nit:` is allowed only when the reviewer's contract or the repository uses it.
- Internal identifiers: finding numbers, case IDs, commit hashes in the text, line coordinates, and review-process labels ("verified", "red-team", "not a finding").
- Hedges and disclaimers: might, possibly, seems, "I could be wrong", "as an AI", "feel free to ignore", "not blocking but".
- Praise sandwiches, greetings, thanks, sign-offs, and a closing recap.
- Restating what the diff obviously does before getting to the point.
- Emoji and em dashes.

Example. Instead of:

> **Issue (High):** F2 - This might potentially cause an authorization problem at L2 since the logic appears to have changed. Consider reviewing.

write:

> An owner who isn't an admin can no longer delete their own document, and neither can an admin who isn't the owner, because `and` now requires both. The contract allows either one.
>
> ```suggestion
>     return actor_id == owner_id or is_admin
> ```

## Check before returning

Read only the proposed comment and ordinary diff context, not the internal
finding or review report. Can an author unfamiliar with the investigation
immediately explain the triggering input/state/sequence, what the code does,
why that causes the unwanted result, the consequence, and the one requested
change or decision?

These are meaning checks, not mandatory headings or sentence slots. A design
question explains its choice and tradeoff instead of inventing a defect.
Preserve the finding's conditions and uncertainty. Rewrite a comment that
requires decoding jargon, inferring the consequence or reconstructing omitted
reasoning, even if it is short. Do not remove supported findings merely because
writing them clearly is difficult. Return an evidence gap to the reviewer
when the mechanism itself is unsupported.

Use visuals alongside clear prose when they make a sequence, comparison or
relationship easier to see. Invoke `technical-illustration` for a useful
source-backed figure without requiring a failed prose-only attempt or a
complexity threshold. Keep the consequence and ask in text, provide an
accessible explanation, and keep the figure consistent with the finding and
reviewed revision. A few sentences may fully explain a simple issue, and
decorative pictures should be omitted.

For example: "Search A starts first, search B finishes first, then A overwrites
B's results. The screen now shows results for the previous search. Can we check
that the response belongs to the current search before assigning it?" A small
timeline can reinforce that ordering, but it does not replace the explanation.

Use the destination's authorized media path. Drafting a figure or comment
does not authorize posting it. If upload is unavailable, return the file and
intended placement to the caller rather than publishing placeholders or local
paths. A required visual remains a delivery blocker unless the remaining text
fully communicates the finding. Never substitute an authored diagram for
required execution evidence.

Confirm the exact diff anchor at the reviewed head, source fidelity and one
clear ask. Rewrite failures before returning the findings and proposed comments.
