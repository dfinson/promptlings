## Appendices

```markdown
## Triage map

**Must-read** (architectural risk lives here):
| File   | Read it because |
|--------|-----------------|
| {path} | {one sentence}  |

**Skim** (mechanical, low risk):
- {path}: {one phrase reason}

**Trust the tests** (generated, mirrored, or CI-gated):
- {path}: {what gates correctness}
```

#### The diff in N layers (when >500 lines changed)

One sentence per architectural layer, nested in dependency order:

```markdown
## The diff in N layers

**Layer 1: {name}.** {One sentence: what exists after this PR that did not before.}
**Layer 2: {name}.** {One sentence: what this layer adds on top of layer 1.}
...
```

Stop at the layer where the explanation is complete.
