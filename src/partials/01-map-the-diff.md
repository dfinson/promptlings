Identify every changed file in the PR or branch. For each one, record:

- The path on the new side.
- The change type (added, modified, deleted, renamed, mode change only).
- The new-side line ranges from each `@@ -old,oldcount +new,newcount @@` hunk header. The starting line is `+new`; the inclusive end is `+new + newcount - 1`. For a fully new file, expect `@@ -0,0 +1,N @@` and treat the range as lines 1 through N.

Open each file in the workspace at those ranges, not just the diff fragment. The diff shows what changed; the file shows what it changed in the middle of. A finding that ignores the surrounding scope (the function the change sits inside, adjacent error handling, related tests, imports) is the kind of finding that gets retracted in self-verification.

For renames and deletes, check whether call sites elsewhere in the repo were updated. A rename in isolation is a gap the narrative should explain.

Pull CI status via `gh pr checks` (or equivalent). Record which checks passed, which failed, and coverage if reported. Weave CI results into the narrative where relevant (a failing check contextualizes a code section; coverage numbers inform the triage map). Do not create a separate CI section.
