Keep the approved spec and acceptance evidence without creating lane sessions,
lane branches, lane briefs or handoff gates.

1. Use the single-lane variant of the [spec template](references/spec-template.md).
   Set every criterion's Owner to `integration`. Check the applicable spec rules.
   The human resolves Decisions, marks critical criteria and whether the change
   is risky, then approves. Use a delivery branch separate from main. If the
   session is on main, create the delivery branch before committing the approved
   spec. Commit and tag the spec under step 7 above.
2. Implement in this session on the integration branch. For every critical
   criterion, write and commit its tests before the implementation. Quote its
   Method command and nonzero exit code, with failure output satisfying G1's
   fail-on-base rule. Make the same tests pass without weakening their assertions.
3. Run every automated criterion at the completed head, including each specified
   end-to-end command. Record ID, command, exit code and status in the criteria
   table. A failure remains unmet until repaired and rerun. Keep `human` criteria
   unverified.
4. If the human marked the change risky, run `sparring-partner` against the spec
   and integrated diff. Disposition every finding as in G3. The master implements
   fixes on this path. After any repair, rerun every automated criterion and
   report the final head's table.
5. Present the criteria table, any review dispositions and
   `git diff spec/<slug>/approved -- specs/<slug>.md` for human acceptance as in
   G4, without lane PR links. Do not merge to main before acceptance.

If a second lane becomes necessary, stop implementation, add the graph and
concurrency analysis, and obtain re-approval under step 7. Record existing commits
and completed criteria so the new lanes start from the actual integration head.
Continue on the multi-lane path without discarding completed work.
