# Copilot Instructions

## Markdown-Only Repository

This repository publishes agent and skill instructions, not executable implementations.
These rules apply to every contributor and agent, including future automated changes.

- Agent, skill and supporting content must be Markdown.
- The only executable files permitted are the root `install.ps1` and `install.sh`,
  used exclusively to install the Markdown content.
- Never add any other script, program, executable helper, generated code file,
  runtime dependency or dependency manifest. Python and Node.js scripts and
  dependencies are categorically forbidden. The prohibition applies to every
  language, not just Python and JavaScript.
- Never add a `scripts` directory anywhere in the repository. Do not evade this
  rule with another directory name, file extension, embedded executable template,
  downloaded helper or installer-generated program.
- Skills must explain the practice and desired outcomes. Let the consuming agent
  select suitable tools and, when needed, implement project-specific automation
  in the target project's workspace. Do not bind a skill to a shipped program.
- Never add test scripts, test suites, test directories or testing frameworks.
  Python tests are explicitly forbidden. Perform relevant checks locally before
  opening or updating a PR without shipping the checking machinery.
- Do not add evals or an eval framework. Evals require a separately designed and
  explicitly authorized approach, not speculative scaffolding.

There are no exceptions for helper scripts, examples, fixtures, CI tests or
generated files. Keep existing declarative metadata, Markdown lint configuration,
plugin metadata and static assets declarative or inert. Do not turn them into a
runtime or a workaround for these prohibitions.

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
