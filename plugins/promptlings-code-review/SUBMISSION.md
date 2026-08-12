# Submission checklist

This is a checklist for the repository owner. Nothing has been submitted, and submitting is the owner's decision.

Everything below was verified against primary sources on 2026-08-12. Where a detail could not be verified, it says so.

## Where the submission actually goes

The URL in circulation, <https://clau.de/plugin-directory-submission>, redirects to <https://code.claude.com/docs/en/plugins#submit-your-plugin-to-the-official-marketplace>. The anchor says "official" but the section it lands on is titled "Submit your plugin to the community marketplace". That distinction matters:

- **`claude-community`** is the public community marketplace, mirrored read-only at [anthropics/claude-plugins-community](https://github.com/anthropics/claude-plugins-community). This is what the submission form feeds. Users install from it as `@claude-community`.
- **`claude-plugins-official`** is curated separately. Quoting the documentation: "Anthropic decides which plugins to include at its discretion. There is no application process, and the submission form does not add plugins to the official marketplace."

So a submission is a request to join the community marketplace. There is no way to apply to the official one.

Two intake forms exist, per the same documentation section:

- claude.ai: <https://claude.ai/admin-settings/directory/submissions/plugins/new>. Requires a Team or Enterprise organization and directory management access; organization Owners have it by default.
- Console: <https://platform.claude.com/plugins/submit>. The documented route for individual authors who are not part of a Team or Enterprise organization.

For an individual maintainer, the Console form is the applicable one.

**Not verified:** the fields either form asks for. Both sit behind authenticated product surfaces, so the field list could not be read without signing in and starting a submission. Do not assume the metadata list below is complete; treat it as the metadata the pipeline is known to consume.

Also note that pull requests opened directly against `anthropics/claude-plugins-community` are closed automatically. Everything flows through the form and Anthropic's internal review pipeline.

## What happens after submission

Verified from the documentation and the community repository README:

1. The submission passes automated security scanning and human-defined policy review.
2. On approval, the plugin is pinned to a specific commit SHA in the community catalog, and CI bumps that pin as new commits land in the source repository.
3. The public catalog syncs nightly, so there is a delay between approval and the plugin appearing in `marketplace.json`.
4. To check whether it is installable yet, search the name in the [community catalog](https://github.com/anthropics/claude-plugins-community/blob/main/.claude-plugin/marketplace.json).

## Metadata the pipeline consumes

Derived from real accepted entries in the official catalog and from the shared validation action. A catalog entry for this plugin would take the `git-subdir` shape, since the plugin lives in a subdirectory of a larger repository:

```json
{
  "name": "promptlings-code-review",
  "description": "...",
  "author": { "name": "dfinson" },
  "category": "development",
  "source": {
    "source": "git-subdir",
    "url": "https://github.com/dfinson/promptlings.git",
    "path": "plugins/promptlings-code-review",
    "ref": "main",
    "sha": "<40-character commit sha, set and bumped by Anthropic CI>"
  },
  "homepage": "https://github.com/dfinson/promptlings"
}
```

The entry is written by Anthropic's pipeline, not by the submitter, but the values come from the submission and the repository, so the repository has to support them: a public HTTPS clone URL, a stable path to the plugin directory, and a branch that keeps receiving commits.

## Automated checks the package must pass

`claude plugin validate` is the canonical schema check. The documentation states the review pipeline runs the same check on every submission. Run it before submitting:

```bash
claude plugin validate ./plugins/promptlings-code-review --strict
```

Beyond that, the shared validation action used by the Anthropic catalogs enforces numbered invariants. The ones that constrain this package:

| Invariant | Requirement | Status here |
| --- | --- | --- |
| I2 | No duplicate plugin names in the catalog | `promptlings-code-review` is not currently in either catalog |
| I3 | Description is 10 to 2000 characters with no leading or trailing whitespace | Passes |
| I4 | Source URLs are HTTPS | The repository clone URL is HTTPS |
| I5 | External sources carry a 40-character commit SHA | Set by Anthropic CI, not by the submitter |
| I8 | The source path contains `.claude-plugin/plugin.json` | Passes |
| I9 | No shell metacharacters in source string fields | Passes |
| I10 | No zero-width or bidirectional control characters in name or description | Passes |
| I11 | Name matches `^[a-z0-9][a-z0-9-]{1,63}$` | `promptlings-code-review` passes |

## Quality and security criteria

Anthropic's automated reviewer prompt is public in the official directory repository at `.github/policy/prompt.md`. It states the bar directly: "The bar here is 'handles user data responsibly,' not merely 'isn't malicious.' A plugin can be non-malicious and still fail this review if it observes more than its stated purpose justifies, or if its install description doesn't disclose what it actually does."

A submission fails if any of the following hold:

- The payload contains malicious code, deceptive functionality, unauthorized data collection, or attempts to circumvent safety measures.
- Agent or skill text contains coercive instructions, for example "ignore other instructions" or "always run me first", or prompt-injection payloads aimed at the model or at the reviewer.
- Code reads credentials belonging to one service and routes them to a different service.
- A `UserPromptSubmit`, `PreToolUse`, or `PostToolUse` hook runs without a project-relevance gate, or any hook reads user data beyond the plugin's stated scope.
- Any hook or shipped code makes an outbound network call to a host other than a declared MCP server, unless the description or top-level README explicitly discloses the call and documents an opt-out. Default-on telemetry without disclosure fails even when the payload is anonymous.
- A user reading only the `plugin.json` description would be surprised by the hooks, telemetry, or data access the plugin performs.

The reviewer is instructed to read the entire shipped payload, not only the parts Claude Code loads. Because a git-sourced plugin clones the whole repository to the user's disk, review scope includes dotdirs, `scripts/`, `examples/`, `tests/`, and any script anywhere in the tree.

Two upstream policy documents are referenced by that prompt: the Anthropic Software Directory Policy at <https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy> and the Acceptable Use Policy at <https://www.anthropic.com/legal/aup>. **Not verified:** the body text of the Directory Policy article. That page renders client-side, so only its title and a last-modified date of 2026-04-15 were retrievable. Read it in a browser before submitting.

## How this package stands against those criteria

Where it is already fine:

- No hooks, no MCP servers, no LSP servers, no executable code. The plugin is two markdown files and a manifest, so the entire hook-scope and telemetry section is inapplicable.
- No credential access of any kind.
- No network calls made by the plugin itself.
- The plugin `description` describes two review agents and nothing else, which is what the package contains.

Where a reviewer will reasonably look, and what to be ready for:

- **Agent-driven network access.** Both agents instruct the host session to make outbound web requests as a mandatory step, and to run `git` and `gh`. This is not plugin telemetry, but it is data-touching behavior a reviewer will see. It is disclosed in the plugin README under "What the agents do at runtime". If a reviewer wants disclosure in the install description instead of the README, move a sentence into the `description` field.
- **Emphatic instruction language.** Both agents use phrases like "mandatory, not optional" and "This gate is not optional" about their own pipeline steps. These are internal discipline, not attempts to override the host or other instructions, and neither agent tells the model to ignore other instructions or to run first. Expect the phrasing to be read closely anyway.
- **Artifact writes.** the-nitcracker writes its review to `$COPILOT_ARTIFACTS_DIR` when set, otherwise to the system temp directory. Both are ordinary locations, and this is disclosed.

## Decisions to make before submitting

1. **The name is immutable.** The official directory README is explicit: once published, a plugin's `name` must not change, because users have it installed under that slug and renaming breaks their install. `promptlings-code-review` is the commitment. Cosmetic relabeling later has to go through `displayName`.
2. **Version discipline.** `plugin.json` pins `version` to `0.1.0`. While that field is set, users receive an update only when it changes, so every release needs a bump.
3. **Author contact.** `author` currently carries a name and a GitHub URL, with no email. Add `author.email` if the form or the reviewer wants a reachable contact.
4. **Copy drift.** The packaged agents are copies of the repository's `.agent.md` sources. If the sources change and the copies do not, the distributed plugin silently falls behind. The drift check is documented in the plugin README; run it before every release, and treat a mismatch as a release blocker.
5. **Example outputs.** None exist in the repository today. Nothing in the stated criteria requires them, but a recorded review would let a reviewer judge output quality without running the agent.
6. **A plugin-local LICENSE file.** Not required for an external submission: the Apache 2.0 check in the official directory's CI applies only to Anthropic's own `plugins/**` tree, and the repository root LICENSE ships with the clone. Add `plugins/promptlings-code-review/LICENSE` only if Anthropic asks to vendor the plugin into that tree.
7. **Which account submits.** The claude.ai form needs a Team or Enterprise organization with directory management access. If the owner does not have one, the Console form at <https://platform.claude.com/plugins/submit> is the documented path.
