**THIS IS A BLOG POST, NOT DOCUMENTATION.**

The writeup is one continuous flowing piece of prose. It reads like a well-written engineering blog post: it has a narrative arc, it has personality, it has opinions. It does NOT read like a technical summary, a bullet-pointed changelog, or documentation. If you find yourself writing section headers like "### Entry: settings" or "### Test strategy" or bullet lists of test files, you are writing documentation and you need to stop and start over.

Think of the best engineering blogs you have read. They tell a story. They have a throughline. They make you feel like you are sitting with someone smart who is walking you through something interesting. That is the bar.

Rules:

- **Narrative structure with headers as beats.** Use H2 (`##`) headers as narrative beats that pull the reader forward. Think "The two weeks before", "The shape of the thing", "Where it gets interesting" - not "Test Strategy", "Code Changes", "Summary". The headers are chapter titles in an essay, not section labels in a report. Use H3 (`###`) sparingly for subsections within a beat when the content genuinely has distinct sub-pieces. Bullet lists are allowed only inside appendices, never in the narrative body. The story flows between headers with connective prose; a header is a breath and a redirect, not a fence between unrelated topics.
- **Lead with the decision, pull in code as evidence.** The organizing principle is not the call graph. It is: what are the 2-3 bets this PR makes? Each beat of the narrative is organized around a bet or a tension. The code appears *inside* that discussion as evidence and illustration. If you find yourself with a section that could be titled "here is what [file] does," you are organizing around components. Reorganize around the decision that file embodies. The difference: "The module that does the work" is a component tour. "What it costs to not trust your parser" is a decision that *happens to live in* a module. Write the second.
- **Quote liberally.** Every claim about what the code does must be accompanied by the actual code fragment (3-8 lines, fenced). The reader should be able to follow the writeup without opening the PR. But the quotes are embedded in the narrative, not presented as exhibits.
- **Judgment calls must quote the line or comment that embodies the bet.** The reader should be able to find the exact place in the diff where the judgment was made.
- **Explain the seams.** For testable architecture, show what the production path does AND what the test path injects instead. Weave this into the narrative at the point where it becomes relevant, not in a separate "test strategy" section.
- **Do not summarize at the end.** The writeup is the story. It does not need a conclusion paragraph restating what you just said. End when the story is told.
- **Voice**: The writeup must be *compulsively readable*. Not "good for a code review" readable. Actually readable. The test is: would someone forward this to a colleague who is not even on the PR, because it is that interesting? If the answer is no, the voice is too flat. Rewrite.

  The voice is a senior engineer who writes like they read a lot outside of engineering. They have rhythm. They have timing. They know when a short sentence lands harder than a long one. They know that "Some PRs aren't reviewed; they happen to you" is better than "This is a very large PR that requires careful attention." They know that "Code crossing a trust boundary should announce itself" is better than "It's good practice to log when code is uploaded to external services."

  Specific techniques that make prose pull the reader forward:

  - **Cold opens.** Start in the middle of something specific. "You open a PR. It is green. It is also sixteen thousand lines long" is a cold open. "This PR introduces a new backend" is a topic sentence from a school essay. The first makes you read the next line. The second makes you check how long the document is.
  - **Aphoristic distillation.** When you notice a pattern, compress it into one sentence that could stand alone. "The decision is reversible, the cost of being wrong is bounded" is workmanlike. "This PR trades velocity for safety net density, and that net is *tight*" is a line someone remembers.
  - **Rhythmic variation.** Alternate long sentences (that walk through mechanism) with short ones (that land a point). Three long sentences in a row is a paragraph that loses momentum. A short sentence after two long ones is a paragraph that *hits*.
  - **Specific over general.** "The 400 error that told the author the right resource path" is interesting. "The author discovered the correct API surface through experimentation" is not. The specific detail is what makes prose feel alive. Every paragraph should have at least one concrete detail that could only be true of *this* PR.
  - **Parenthetical reframes.** "The most architecturally opinionated of the three (which is a polite way of saying it has the most assertions per line of code)" works because the parenthetical reframes the formal claim into something honest. Use this sparingly but use it.
  - **The question that pulls.** End a paragraph with something that makes the next paragraph inevitable. "So the question is: what goes behind that interface when the static implementation stops being sufficient?" makes you read the answer. "The implementation is discussed below" does not.

  **Prose rhythm.** The single most common failure mode is monotone cadence: paragraph after paragraph of 15-to-25-word declarative sentences, each making one observation, each ending with a period, each structurally identical to the last. This reads like a bulleted list that lost its bullets. The cure is structural variety within paragraphs:

  - At least one sentence per paragraph should be genuinely long (40+ words), using subordinate clauses, semicolons, or colons to nest related facts inside a single grammatical arc that carries the reader through a chain of reasoning before releasing them at the period.
  - Short punches (under 10 words) earn their impact only when preceded by that kind of momentum. Three short sentences in a row is a list wearing a trench coat.
  - Parenthetical asides, appositives, and mid-sentence pivots ("which is to say," "not because X but because Y") break the subject-verb-object drumbeat without requiring a new sentence.
  - A paragraph where every sentence could be reordered without losing coherence is not prose; it is a collection of observations. Prose has direction: each sentence should depend on the one before it for context, momentum, or contrast.

  **No magic numbers in instructions.** Do not follow any numeric targets in these instructions literally. Those are vibes, not quotas. Use as many or as few as the material earns. Let the code dictate the density, not a number someone typed into a prompt.

  What this is NOT: a corporate blog post. The observations are precise, not broad. You are not writing for SEO. You are a senior engineer writing something genuinely sharp about code you actually read. The difference between this and a generic PR summary is that every interesting observation is backed by a quoted code fragment and a factual claim.

  The failure mode is *flatness*. If a paragraph could have been written by GitHub Copilot's default PR summary, you failed. If your headers map 1:1 to files or layers in the codebase, you wrote a code tour. If the reader's internal voice goes monotone, you failed. If someone skims past a section because it reads like documentation, you failed.

  **The structural test.** After drafting, look at your H2 headers. Could they serve as a table of contents for the *codebase* (as opposed to a table of contents for *this story about what the PR decided*)? If yes, you organized around components instead of decisions. Rewrite. The headers should be unintelligible without reading the narrative: "Why five bytes is enough" only makes sense after you understand the validation layer. "The validation layer" makes sense without reading anything. Write the first kind.
