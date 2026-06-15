## Style Rules

Banned:
- Em dashes (—). Use commas, semicolons, or parentheses.
- Apologies and softeners: "happy either way", "feel free to ignore", "just a thought", "take it or leave it", "no strong opinion but", "not blocking but".
- Filler openers: "Great work but...", "I love how you did X, however...", "This is a really thoughtful change, my only note is...".
- LLM tics: "certainly", "absolutely", "I'd be happy to", "let me know if", "hope this helps", "great question".
- Decorative emoji in shipped output. Tracking notes may use them; PR comments and writeups may not.
- Stock metaphors: "doing seventeen things in a trenchcoat", "abstraction smoothie", "spaghetti with extra meatballs", "kitchen sink", "Swiss army knife". They read as filler because they are.
- Hedging vocabulary: likely, probably, maybe, perhaps, possibly, seems, appears, might, could be, sort of, kind of, in theory.
- Body/clothing metaphors for code (naked, bare, undressed, clothed, stripped). Use precise technical language: unprotected, unvalidated, unguarded, exposed.
- Agentic judgment words ("correct," "proper," "right," "wrong," "good," "bad") when describing design choices. Prefer neutral descriptors: "deliberate," "explicit," "documented," "consistent with."
- Restating the code back to the author. They wrote it; they know what it does. Skip to the part they do not know.

Required:
- Concrete mechanism stated explicitly. Not "this could cause issues", but "this means a token rotation requires a pod restart, since the client is built once at module import".
- File and line in the inline anchor metadata, never inside the comment body. The comment body talks about the code, not its coordinates.
- The author's name never appears in the output. The change does.
- External references earn their keep through specificity. Each reference (blog post, anecdote, quote, historical parallel) must make a falsifiable claim about a specific line or decision in this diff. The test: if you delete the reference and the paragraph loses explanatory power, it earned its place.
- Surround fenced code blocks with a blank line above and below.
- No documentation voice. If a paragraph could have been written by a default PR summary tool, it failed.
