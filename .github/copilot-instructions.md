# Copilot Instructions

## No Scripts or Tests Without an Explicit Request

**Do not create or add scripts unless the user explicitly requests scripts. Do not create or add tests unless the user explicitly requests tests.**

This repository delivers agents and skills through Markdown instructions. Requests to improve a flow, fix a problem, verify behavior, or review a change are not permission to add scripts, test suites, test fixtures, or CI testing infrastructure. Do not turn a prompt-based workflow into a maintained execution framework.

Preserve useful procedures, measured settings, failure handling and verification guidance in the relevant agent or skill. Use existing tools for execution. Task-specific production code belongs to the producing agent's authorized workspace, not automatically in this repository.

## Em Dash Ban

**Never use em dashes in any generated content.** This is a hard, non-negotiable rule.

Use these alternatives instead:
- **Colons** for explanations or elaboration
- **Commas** for parenthetical asides
- **Periods** for emphasis (start a new sentence)
- **Parentheses** for supplementary information
- **Semicolons** for joining related independent clauses

Every em dash in output is a lint failure. No exceptions.

The only context where an em dash character may appear is inside agent instruction files (`.agent.md`) when the purpose of that text is to explicitly ban agents from using em dashes. Even in that narrow case, prefer spelling out "em dash" rather than using the character itself where possible.

## Agent Authoring

All `.agent.md` files in this repository **must** include an explicit em dash ban in their instructions. If an agent file does not contain a rule prohibiting em dashes in its output, it is incomplete. The ban should be stated clearly and unambiguously, for example:

> Em dashes are banned from all output. Use commas, colons, semicolons, periods, or parentheses instead.
