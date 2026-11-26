---
name: rulesync-publishing
description: Use when maintaining or reinstalling Promptlings agents, skills, or rules from this checkout with Rulesync. Preserve existing agent and rule registrations during a selective publish.
---

# Publish from a Promptlings checkout

For a repository-only skill, put `SKILL.md` under `.github/skills/<name>/` and stop there. The publisher stages skills from the top-level `skills/` tree, which is also on the npm package allowlist. Use that tree for skills intended for installed users. A repository-only change does not require a global publish or an npm release.

## Before a local reinstall

1. Confirm the revision and intended changes. From that checkout, use `npm ls rulesync --depth=0` to check the local dependency against the package pin. If it is missing, restore the locked dependencies with `npm ci`. Do not use a globally installed Rulesync.
2. Record what each affected tool currently loads. For Poolside, keep the `subagents.agents` names **and definitions**. For MiMoCode and OpenCode, keep the ordered `instructions` entries, including custom paths under `memories/`. Keep any needed recovery copies private and outside the repository. If local customizations cannot be recovered, stop before writing.
3. Preview the intended set with `node bin/promptlings.js publish --agents NAME,NAME --dry-run`. `--agents` selects agents, not individual skills. The preview prints the plan without running Rulesync or predicting file-level changes. An explicit selection containing `interactive-presentation` requires `install`, which also runs toolchain setup. Do not substitute that broader command without approval.
4. Compare the staged selection with the inventory. Poolside can drop unselected agents **and replace locally edited definitions under the same name**. MiMoCode and OpenCode rebuild references under their managed `memories/` paths from staged rules. A custom reference can disappear even with `memory-manager` selected. The Promptlings memory rule itself needs `memory-manager`, memory and read-side publication enabled. A file left on disk is not proof that the tool still loads it. Stop before an unapproved loss rather than widening the selection to `--all`.

## Publish and verify

For an authorized reinstall, repeat the agreed `publish` command without `--dry-run`. Use `--yes` only when that selection is approved. The checkout's publisher stages the inputs and invokes the pinned Rulesync dependency. Do not substitute an npm release when the requested source is a specific commit.

Read the installed artifacts in each target's native format. For skills, compare the substantive Markdown and, where emitted, the parsed name and description. YAML folding, line endings and the blank line after frontmatter can differ. TAKT writes flat Markdown without frontmatter. For rules, check the file and its settings reference where required. Claude Code discovers files in its rules directory without a separate reference. Compare agent definitions and ordered rule references with the inventory: only the agreed changes should differ.

If verification finds a loss, do not repeat the global publish. For missing Promptlings content, use `stageRulesync` in `lib/content.js` with the intended inventory of bundled components. Regenerate only the affected target and feature, for example `pool` subagents or `opencode` rules. Staging cannot reconstruct custom content. After generation, restore any displaced local definitions or references from the private copy, preserving their order and any intervening edits. Read the affected configuration back against the inventory before reporting success.
