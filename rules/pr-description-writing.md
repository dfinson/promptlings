<!-- promptlings-pr-description-writing-start -->
# Pull request titles and descriptions

Before creating a pull request or changing its title or description by any route (`gh pr create`, `gh pr edit`, `--title`, `--body`, `--body-file`, `create_pull_request`, `update_pull_request`, another PR tool, or an API call), load the `pr-description-writing` skill in that same turn and follow it. This applies to every session, lane, and subagent, and to small patches such as appending one paragraph or correcting one sentence. Reload the skill after any context compaction before the next edit. For user-visible changes, also use a PR media skill such as `github-pr-media` when one is available. A coordinator relaying a PR text change must name `pr-description-writing` in the relay.
<!-- promptlings-pr-description-writing-end -->
