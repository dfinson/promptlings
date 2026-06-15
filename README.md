# 🧫 promptlings

Opinionated, model-agnostic agent prompts for AI coding assistants.

Each promptling is a self-contained `.agent.md` file: a structured system prompt that works with any LLM-powered coding tool (GitHub Copilot CLI, Claude Code, or any agent framework that accepts markdown instructions).

## Agents

### Code Review

| Agent | What it does |
| --- | --- |
| [pr-walkthrough](agents/code-review/pr-walkthrough.agent.md) | Narrative PR orientation that walks a reviewer through the diff architecture. Surfaces judgment calls without rendering judgment. |
| [the-nitcracker](agents/code-review/the-nitcracker.agent.md) | Same thing, but with a sense of humor and a roast up front. |

#### In their own words

> **PR Walkthrough:** I turn a diff into a map. Before you open a single file, I tell you what changed, why it changed, which files actually matter, and how the moving parts lock together. I am not here to swat bugs or litigate style; I build the mental model so your attention lands where judgment is expensive.

> **the-nitcracker:** Ah yes, another PR that definitely seemed simpler in someone's head. I walk you through the diff first, so you understand what changed and how the pieces fit before the review turns into random line-by-line flailing. Then I separate the actual bugs from the decisions someone is quietly asking you to bless, and I do it with enough precision that nobody gets to hide behind vagueness.

## Installation

### GitHub Copilot CLI

Copy agent files to your user agents directory:

```bash
cp agents/code-review/*.agent.md ~/.copilot/agents/
```

Or for a specific project:

```bash
cp agents/code-review/*.agent.md .github/agents/
```

### Claude Code

Copy agent files to your commands directory:

```bash
mkdir -p .claude/commands
cp agents/code-review/*.agent.md .claude/commands/
```

### Other Frameworks

These are plain markdown files with YAML frontmatter. Parse the `name` and `description` from the frontmatter, use the body as the system prompt.

## Building

Agents are assembled from shared modules and per-agent overlays. The `promptlings.yml` manifest declares each agent's source list. To rebuild:

```bash
pip install pyyaml
python build.py
```

### Project structure

```javascript
promptlings.yml          # Single manifest: all agents, sources, outputs
build.py                 # Reads manifest, concatenates sources, writes agents
src/
  shared/                # Modules used by all agents
    pipeline.md          # What to do (diff mapping, input modes, structured observations)
    standards.md         # How to do it (voice, style, scope, verification)
  overlays/              # Per-agent customizations
    the-nitcracker/      # Frontmatter, intro, findings pipeline, snark voice, output format
    pr-walkthrough/      # Frontmatter, intro, voice, output format
agents/
  code-review/           # Built output (committed, verified by CI)
```

## Philosophy

- **High bar, low noise.** A finding that doesn't change a tired senior engineer's mind doesn't ship.
- **Narrative over checklist.** The reviewer needs a mental model, not a bullet list.
- **Model-agnostic.** No vendor lock-in. If it can follow instructions, it can run these.
- **Opinionated.** These agents have a point of view. Fork them if yours differs.
- **No em dashes.** Ever. Use colons, commas, parentheses, or restructure the sentence.

## Contributing

PRs welcome. The bar for inclusion is: "would I actually use this agent every day?"

## License

Apache 2.0. See [LICENSE](LICENSE).