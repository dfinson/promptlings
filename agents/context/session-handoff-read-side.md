<!-- session-handoff-read-side-start -->
# Session Handoff: Mandatory Context Protocol

These rules apply to EVERY session in every repository. No exceptions.

## FIRST ACTION: Read environment context

On your FIRST tool-calling turn of every session, before doing anything else, run one of these commands:

Linux or macOS (bash):

    cat "$(git rev-parse --git-common-dir)/session-handoff/environment.md" 2>/dev/null

Windows (PowerShell):

    $d = git rev-parse --git-common-dir; if (Test-Path "$d/session-handoff/environment.md") { Get-Content "$d/session-handoff/environment.md" }

If this file exists, read it completely. It contains environment facts (auth methods, tool paths, encoding quirks, resource identifiers) that directly affect your ability to work correctly. If you skip this and get something wrong that the file would have told you, that failure is on you.

Do NOT grep, search the codebase, search the filesystem, search the web, or answer any question until you have read this file or confirmed it does not exist.

## DURING SESSION: Search decisions before fresh searches

Before any fresh search of the codebase, filesystem, web, or external domain references, search the decisions file first.

Linux or macOS (bash):

    grep -i "KEYWORD" "$(git rev-parse --git-common-dir)/session-handoff/decisions.md" 2>/dev/null

Windows (PowerShell):

    $d = git rev-parse --git-common-dir; $f = "$d/session-handoff/decisions.md"; if (Test-Path $f) { Select-String -Path $f -Pattern "KEYWORD" -CaseSensitive:$false }

Replace KEYWORD with terms relevant to your current subtask. If matching entries exist, consult them before doing any fresh search.
<!-- session-handoff-read-side-end -->
