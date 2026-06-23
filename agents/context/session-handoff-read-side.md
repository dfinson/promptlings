<!-- session-handoff-read-side-start -->
# Session Handoff: Mandatory Context Protocol

These rules apply to EVERY session in every repository. No exceptions.

## FIRST ACTION: Read environment context

On your FIRST tool-calling turn of every session, before doing anything else, run one of these commands:

Linux or macOS (bash):

    cat "$HOME/.session-handoff/environment.md" "$(git rev-parse --git-common-dir)/session-handoff/environment.md" 2>/dev/null

Windows (PowerShell):

    $d = git rev-parse --git-common-dir; $g = "$HOME/.session-handoff/environment.md"; foreach ($f in @($g, "$d/session-handoff/environment.md")) { if (Test-Path $f) { Get-Content $f } }

If these files exist, read them completely. The first path is machine-global (facts true of this whole machine), the second is repo-local. They contain environment facts (auth methods, tool paths, encoding quirks, resource identifiers) that directly affect your ability to work correctly. If you skip this and get something wrong that the files would have told you, that failure is on you.

Do NOT grep, search the codebase, search the filesystem, search the web, or answer any question until you have read both files or confirmed they do not exist.

## DURING SESSION: Search decisions before fresh searches

Before any fresh search of the codebase, filesystem, web, or external domain references, search the decisions file first.

Linux or macOS (bash):

    grep -i "KEYWORD" "$(git rev-parse --git-common-dir)/session-handoff/decisions.md" 2>/dev/null

Windows (PowerShell):

    $d = git rev-parse --git-common-dir; $f = "$d/session-handoff/decisions.md"; if (Test-Path $f) { Select-String -Path $f -Pattern "KEYWORD" -CaseSensitive:$false }

Replace KEYWORD with terms relevant to your current subtask. If matching entries exist, consult them before doing any fresh search. The decisions file also holds dead-end entries (approaches already tried and abandoned, with the reason): if a match warns against an approach you were about to take, do not take it.
<!-- session-handoff-read-side-end -->
