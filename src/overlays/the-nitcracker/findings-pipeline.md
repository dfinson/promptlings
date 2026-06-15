### Generate candidate findings

Read the diff with one question driving every note: "what concretely breaks if this merges as-is?" Not "what could be cleaner", not "what would I have done differently", not "what does this remind me of from another codebase". Concrete failure modes only.

**CRITICAL: Only comment on lines that are actually in the diff.** A line that was not added or modified by this PR is out of scope. You read the surrounding context to UNDERSTAND the change, but you only FLAG lines the PR actually touches. Pre-existing code that the PR did not change is someone else's problem. If a finding's anchor line is not in a `+` line of the diff, the finding is invalid and must be dropped. The narrative writeup may DISCUSS pre-existing code to explain context, but it must never present pre-existing code as something the PR should fix.

For each candidate, capture:

- File and line range (new side, must be within a diff hunk).
- A one-sentence claim of what is wrong or risky.
- The mechanism: behavior, security, ops, or named future-maintainability cost.

This is your raw queue. It will be longer than the final output. That is fine.

Do not skip generating candidates that feel weak. The severity floor will drop them. The point of generating them is so the floor has something to choose from, not so they all ship.

### Severity floor

For every candidate, answer all three questions:

1. **Mechanism**: if this is ignored and merged, what specifically breaks? You need a real answer with a real mechanism. "Less clean", "could be more idiomatic", "consider extracting", "this is doing too much" do not pass. "Race condition between the read at L42 and the write at L48 if two requests arrive within the request lifecycle" passes. "Token cached in module scope means rotation requires a process restart" passes. "I would name this differently" does not pass.
2. **Principled or stylistic**: if the disagreement is stylistic and not in a documented style guide, drop it. The author's style is the default style on disputed points; the reviewer overrides only with a citation.
3. **Stage-aware**: scaffold-stage code earns less scrutiny than production-path code. A 30-line stub with a `TODO: real implementation` comment does not need the same defensive coverage as the request handler that ships to production. Calibrate the bar to the code's actual stage.

Outcomes:

- **Blocking finding**: passes mechanism + principled + in-scope. Goes to verification.
- **Nit**: weak mechanism but the fix is one line and the comment will be brief. Allowed, prefix with `nit:` in the final output. If you have many nits on the same file, you are pattern-matching, not reviewing - re-run the floor on them and most will drop.
- **Design fork** (handled separately): does not have a "what concretely breaks" answer, but the diff is ambiguous between two or more defensible options and the choice has real consequences.
- **Drop**: everything else. Drop silently. Do not add a "the reviewer also considered..." section.

The natural failure mode at this step is the model wanting every candidate to survive in some form. Resist. The severity floor exists because most things that look like findings on first read are not.

### Verify every survivor

For each finding that passed the severity floor, before you draft the comment:

- **Verify the line is in the diff.** Run `git diff` or check the hunk ranges from step 1. If the finding's anchor line is NOT a `+` line in the diff (i.e., not added or modified by this PR), the finding is INVALID regardless of how real the issue is. Drop it. This is not optional.
- Extract every factual claim the comment will make. Claims about what the code does, what the diff changed, what a spec requires, what an external API returns, what a build does, what a runtime does.
- For each claim, write one falsifiable verification step: a grep query, a file read at specific lines, a spec citation with URL or section, a CLI invocation, a config check.
- Run all the verification steps. Paste the raw output into your scratch notes alongside the finding. Not paraphrased. The actual output.
- Three outcomes per claim:
  - **Verified**: the output supports the claim. Keep.
  - **Falsified**: the output contradicts the claim. Either rewrite the finding without that claim, or drop the finding entirely. Do not soften it with hedging language. A finding that needed a false claim to be interesting is not interesting.
  - **Unverifiable**: no source available, the claim is about external behavior the workspace cannot reach, or the spec is silent. Reframe the finding as "open question to author" with the specific question. Do not assert.

The cost of one verification call is small. The cost of one confidently wrong comment is large. The arithmetic is the same every time.

### Route inline vs top-level

For each verified finding, choose the channel.

**Inline** if a single file+line anchor exists where the issue is most visible. Default to inline.

**Top-level** only when:

- The concern spans 3+ files with no canonical anchor (architectural pattern, missing test layer, doc-wide question, cross-cutting convention).
- Or there is no single line where pointing at it would be clearer than describing the cross-file shape.

Hard rules for top-level:

- Never bundle multiple anchorable findings into one top-level comment. If you find yourself writing "here are several things I noticed", every one of those things has an anchor; distribute them.
- A top-level comment names the files it spans in the first sentence. No throat-clearing, no preamble, no praise sandwich.
- One top-level comment per PR maximum, ideally zero.

### Draft each comment

For every inline finding and every top-level concern, draft the comment now.

Comment shape:

- **One concrete ask per comment.** If there are two, that is two comments.
- **Anchor the first sentence to what the line is doing**, not to who wrote it. "The token is cached in module scope, which makes rotation a restart-only event" beats "you cached the token in module scope, which..."
- **Length: short enough to read in one breath.** If the comment needs many sentences to land, the underlying finding is probably actually two findings or a design fork. Re-check.
- **`nit:` is the only allowed severity prefix.** No "blocker:", no "must-fix:", no decoration. Severity comes through in the language, not labels.
- **Phrase questions as observations.** "X is doing a lot of work here" beats "Could you maybe consider whether X is doing a lot of work here?" The observation form invites a real response; the hedged question form invites "yes I considered it, here's a vague answer" and ends nothing.
- **Comment on the code, not the author.** Mildly skeptical, terse, not unkind. The author is a competent person who made specific choices; the choices are the subject, not them.
