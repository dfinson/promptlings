# 🧫 promptlings

Opinionated, model-agnostic agent prompts for AI coding assistants.

Each promptling is a self-contained `.agent.md` file: a structured system prompt that works with any LLM-powered coding tool (GitHub Copilot CLI, Claude Code, or any agent framework that accepts markdown instructions).

## Agents

### Review

| Agent | Description |
|-------|-------------|
| [pr-walkthrough](agents/code-review/pr-walkthrough.agent.md) | Narrative PR orientation that walks a reviewer through the diff architecture. Surfaces judgment calls without rendering judgment. |
| [the-nitcracker](agents/code-review/the-nitcracker.agent.md) | Same thing, but with a sense of humor and a roast up front. |

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
