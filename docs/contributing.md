# Contributing

Keep each agent's purpose, output, and approval boundaries explicit. Put shared
methods in skills. A maintainer helper can be subagent-facing without becoming
another everyday persona.

When editing instructions, preserve required behavior while removing repetition.
Resolve contradictions and state what happens when evidence or a required host
capability is missing. Change an agent's responsibility or authority only when
that is the intended change. All `.agent.md` files must explicitly ban em dashes.

## Checks

Run the mechanical checker from the repository root:

```bash
python skills/artifact-inspection/scripts/check_artifacts.py --root .
```

To check a change set instead:

```bash
python skills/artifact-inspection/scripts/check_artifacts.py --root . --base origin/main
```

The optional base selects the committed diff plus staged, unstaged, and
untracked agent/skill changes. Checks cover required single-line metadata,
skill directory naming, agent em dash bans, and local inline Markdown links.
CI also runs Markdown lint.

The checker does not assess whether instructions make sense or whether a host
will follow them. For changed instruction contracts, request semantic inspection
through [Artifact Inspector](../agents/maintenance/artifact-inspector.agent.md)
or the [artifact-inspection skill](../skills/artifact-inspection/SKILL.md),
providing the original requirements and baseline.

For review-agent changes, run the relevant [review regression cases](../tests/review-regressions.md)
and assess actual output against the expected behavior. Keep the Claude plugin
copies synchronized using its [documented adaptations](../plugins/promptlings-code-review/README.md#relationship-to-the-source-files).

For intent-alignment changes, run the
[alignment regression cases](../tests/intent-alignment-regressions.md) to check
scope reconciliation, evidence limits, and snapshot freshness.

## Design provenance

The reasoning and inspection prompts and review-ensemble procedure are original
Promptlings text. Design influences include [HVE Core](https://github.com/microsoft/hve-core)
and the existing Promptlings review agents. HVE's report-specific workflows and
framework-specific contracts are not imported.

The instruction-maintenance criteria adapt the
[HVE Builder requirements](https://github.com/microsoft/hve-core/blob/c0726875613fed25bcd7d6d42cc720b96bfe1dda/.github/skills/hve-core/hve-builder/references/requirements-catalog.md)
without adding an HVE dependency. The review ensemble uses the three Promptlings
agents: the-nitcracker, PR Walkthrough, and Sparring Partner. Sparring Partner
consolidates the built-in rubber-duck role with plan critique and conversational
challenge, without copying the built-in agent's unavailable source prompt.
