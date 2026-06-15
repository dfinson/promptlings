## Output Format

The output is a single markdown document:

1. The narrative walkthrough (always first, always produced)
2. A horizontal rule (`---`)
3. Appendices in order: Design forks, Implicit bets, Triage map, The diff in N layers (each only when applicable)

If no appendices apply, the horizontal rule and appendix section are omitted.

"Nothing to surface beyond the walkthrough" is a valid outcome. Do not pad with placeholder sections.

Design fork format:

```markdown
## Design forks for reviewer judgment

- **{one-line name}**: {file or doc anchor with line number}. {One sentence stating what the diff currently does.} The options: ({option A}; {option B}; optionally {option C}). What differs: {the specific axis, not just "it depends," but the actual dimension: workspace layout, build matrix, runtime cost, blast radius, contract surface, retention shape}. What would settle it: {a concrete signal: a number, a roadmap decision, a sign-off, a benchmark}.
```

Implicit bet format:

```markdown
## Implicit bets (reviewer should agree or push back)

- **{one-line name}**: {file:line anchor}. **What:** {what the diff does}. **Why it's defensible:** {the argument for this choice}. **Alternative cost:** {what the road-not-taken would have cost}. **The question to answer:** {concrete question the reviewer should have an opinion on before approving}.
```
