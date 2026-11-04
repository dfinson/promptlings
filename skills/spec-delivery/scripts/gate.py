"""Revision-bound local delivery checks. Semantic review and approval stay human-owned."""

import argparse
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile


class GateFailure(Exception):
    pass


def execute(cwd, argv, evidence, expected=0):
    result = subprocess.run(argv, cwd=cwd, capture_output=True, text=True, timeout=120)
    record = {
        "cwd": str(cwd), "argv": argv, "exit": result.returncode,
        "stdout": result.stdout, "stderr": result.stderr,
    }
    evidence.append(record)
    if expected is not None and result.returncode != expected:
        raise GateFailure(f"Command exited {result.returncode}: {argv}")
    return result


def git(root, evidence, *args):
    return execute(root, ["git", *args], evidence).stdout.strip()


def check_commands(values):
    commands = []
    for value in values:
        command = json.loads(value)
        if not isinstance(command, list) or not command or not all(isinstance(part, str) and part for part in command):
            raise ValueError("Each check must be a nonempty JSON string array")
        commands.append(command)
    return commands


def normalized(path):
    value = path.replace("\\", "/")
    if value.startswith("/") or re.match(r"^[A-Za-z]:", value) or ".." in value.split("/"):
        raise ValueError(f"Expected repository-relative exact path: {path}")
    return value.removeprefix("./")


def intended_failure(output, introduced):
    assertion = re.search(r"AssertionError|ERR_ASSERTION|(?m:^E\s+assert\b)|\bassertion .* failed\b", output)
    diagnostics = re.findall(
        r"(?m)^\s*(?:#\s*)?((?:[\w.]*?(?:Error|Exception)|error TS\d+|error CS\d+)[^\n]*)",
        output,
    )
    declared_missing = False
    for diagnostic in diagnostics:
        if "AssertionError" in diagnostic or "ERR_ASSERTION" in diagnostic:
            continue
        missing = re.search(r"ImportError|ModuleNotFoundError|AttributeError|NameError|ReferenceError|Cannot find|not found|not defined|not a function", diagnostic)
        declared = any(re.search(rf"(?<!\w){re.escape(name)}(?!\w)", diagnostic) for name in introduced)
        if not missing or not declared or re.search(r"SyntaxError|IndentationError|error TS|error CS", diagnostic):
            return False
        declared_missing = True
    return bool(assertion or declared_missing)


def handoff(options, evidence):
    root = Path(options.lane).resolve()
    head = git(root, evidence, "rev-parse", "HEAD")
    if git(root, evidence, "status", "--porcelain"):
        raise GateFailure("Lane has uncommitted or untracked files")
    base = git(root, evidence, "rev-parse", "--verify", "--end-of-options", f"{options.base}^{{commit}}")
    if git(root, evidence, "merge-base", base, head) != base:
        raise GateFailure("Recorded base must be an ancestor of the lane head")
    # --no-renames includes both the deleted old path and added new path.
    changed = execute(root, ["git", "diff", "--name-only", "--no-renames", "-z", base, head], evidence).stdout.split("\0")
    changed = {path for path in changed if path}
    allowed = {normalized(path) for path in options.path}
    if changed - allowed:
        raise GateFailure(f"Paths outside approved scope: {sorted(changed - allowed)}")
    tests = {normalized(path) for path in options.test_file}
    if not tests or not tests <= changed or not tests <= allowed:
        raise GateFailure("Select changed, approved test files for fail-on-base")
    test_diff = execute(root, ["git", "diff", "-U0", base, head, "--", *sorted(tests)], evidence).stdout
    added = "\n".join(line[1:] for line in test_diff.splitlines() if line.startswith("+") and not line.startswith("+++"))
    if re.search(r"(@(?:unittest\.)?skip|mark\.(?:skip|xfail)|skipTest\(|\.only\(|\bfit\(|\bfdescribe\()", added):
        raise GateFailure("Added skip/focus/xfail marker requires rejection or explicit semantic resolution")
    checks = check_commands(options.check)
    for check in checks:
        execute(root, check, evidence)
    scratch = Path(options.scratch).resolve()
    scratch.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix="spec-gate-", dir=scratch))
    added_worktree = False
    try:
        git(root, evidence, "worktree", "add", "--detach", str(temporary), base)
        added_worktree = True
        # A Git pathspec is always terminated before externally supplied paths.
        execute(temporary, ["git", "restore", "--source", head, "--", *sorted(tests)], evidence)
        for check in checks:
            result = execute(temporary, check, evidence, expected=None)
            output = result.stdout + result.stderr
            if result.returncode == 0:
                raise GateFailure("Changed-behavior check also passes on base")
            if not intended_failure(output, options.introduced):
                raise GateFailure("Base failure is not an intended assertion or declared missing contract")
    finally:
        if added_worktree:
            git(root, evidence, "worktree", "remove", "--force", str(temporary))
        else:
            temporary.rmdir()
    return {"base": base, "head": head, "paths": sorted(changed)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["handoff", "merge"])
    parser.add_argument("--lane", required=True, help="Lane worktree")
    parser.add_argument("--base", required=True, help="Approved lane base revision")
    parser.add_argument("--path", action="append", required=True, help="One exact approved path, repeat as needed")
    parser.add_argument("--test-file", action="append", required=True)
    parser.add_argument("--introduced", action="append", default=[], help="Spec-declared missing contract allowed on base")
    parser.add_argument("--check", action="append", required=True, help="Changed-behavior command as a JSON argv array")
    parser.add_argument("--scratch", required=True, help="Authorized disposable artifact directory")
    parser.add_argument("--integration", help="Integration worktree, required for merge")
    parser.add_argument("--integration-check", action="append", default=[], help="All currently merged criteria, including this lane, as JSON argv arrays")
    options = parser.parse_args(argv)
    evidence = []
    report = {"status": "unverified", "evidence": evidence}
    try:
        if options.action == "merge":
            if not options.integration or not options.integration_check:
                raise GateFailure("Merge needs integration worktree and every merged criterion")
            integration = Path(options.integration).resolve()
            if git(integration, evidence, "branch", "--show-current") in {"main", "master"}:
                raise GateFailure("Integration must be a delivery branch, not main/master")
            if git(integration, evidence, "status", "--porcelain"):
                raise GateFailure("Integration has uncommitted or untracked files")
            checks = check_commands(options.integration_check)
        report.update(handoff(options, evidence))
        if options.action == "merge":
            # A single invocation binds handoff, merge and regression checks.
            git(integration, evidence, "merge", "--no-ff", "--no-edit", report["head"])
            report["integration_head"] = git(integration, evidence, "rev-parse", "HEAD")
            for check in checks:
                execute(integration, check, evidence)
        report["status"] = "verified"
    except (GateFailure, ValueError, OSError, subprocess.SubprocessError) as error:
        report["status"] = "unmet"
        report["error"] = str(error)
    print(json.dumps(report, indent=2))
    return 0 if report["status"] == "verified" else 1


if __name__ == "__main__":
    sys.exit(main())
