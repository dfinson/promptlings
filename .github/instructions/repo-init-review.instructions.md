---
applyTo: "skills/promptlings-repo-init/**,install.ps1,install.sh,agents/orchestration/bmad-orchestrator.agent.md,agents/orchestration/speckit-flow.agent.md"
excludeAgent: "cloud-agent"
---

# Repository initialization review

Coaches run `promptlings-repo-init` without asking in every new worktree, so a regression here blocks delivery everywhere. When a change touches these files, check:

- **Version pins agree.** BMAD and Spec Kit versions appear in `install.ps1`, `install.sh`, `scripts/init.ps1` and `scripts/init.sh`. A bump that misses one makes every coach-run init fail with a version mismatch that rerunning the installer cannot fix.
- **Script parity.** `init.ps1` and `init.sh` must accept the same bindings and options and fail on the same states with the same remedy.
- **Trigger and skip conditions match.** Coaches trigger on the marker file (`_bmad/config.toml`, `.specify/integration.json`). The scripts skip installation when the directory exists. A directory without its marker must fail with an explicit removal instruction, never loop.
- **No software installation.** Init calls only installed `bmad-method`, `specify` and `git`. No `npm`, `npx`, `uv`, `pip` or package manager.
- **No Git changes.** Init writes only the shared `info/exclude`, never the index, history or tracked files. Shared mode requires the explicit flag.
- **Exclusions precede framework files.** Blocks are written before any install, and malformed blocks are refused without edits.
- **Coach contracts stay consistent.** Every prohibition on installing, bootstrapping or adding workflows in the coaches carries the `promptlings-repo-init` exception, so a literal reading cannot recreate the deadlock.
- **Bundled paths resolve.** Scripts find `workflows/promptlings-delivery.yml` one directory above `scripts/`, both in the published skill and in the installer's staged copy. New skill files must be listed in both installers' skill file lists.
