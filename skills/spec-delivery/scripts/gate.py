"""Revision-bound local delivery checks. Semantic review and approval stay human-owned."""

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile


class GateFailure(Exception):
    pass


def execute(cwd, argv, evidence, expected=0):
    started = datetime.now(timezone.utc).isoformat()
    result = subprocess.run(argv, cwd=cwd, capture_output=True, text=True, timeout=120)
    record = {
        "cwd": str(cwd), "argv": argv, "exit": result.returncode,
        "stdout": result.stdout, "stderr": result.stderr,
        "started_at": started, "finished_at": datetime.now(timezone.utc).isoformat(),
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


def check_test_diff(root, base, tests, evidence):
    diff = execute(root, ["git", "diff", "-U0", base, "--", *sorted(tests)], evidence).stdout
    added = "\n".join(line[1:] for line in diff.splitlines() if line.startswith("+") and not line.startswith("+++"))
    if re.search(r"(@(?:unittest\.)?skip|mark\.(?:skip|xfail)|skipTest\(|\.only\(|\bfit\(|\bfdescribe\()", added):
        raise GateFailure("Added skip/focus/xfail marker requires rejection or explicit semantic resolution")


def apply_after_red(options, evidence):
    root = Path(options.lane).resolve()
    if git(root, evidence, "branch", "--show-current") in {"main", "master"}:
        raise GateFailure("Implementation requires a delivery branch, not main/master")
    if not options.proposal or not options.message:
        raise GateFailure("Apply needs a proposal JSON file and a test commit message")
    scratch = Path(options.scratch).resolve()
    proposal = Path(options.proposal).resolve()
    if not proposal.is_relative_to(scratch):
        raise GateFailure("Proposal must be data in the authorized scratch directory")
    files = getattr(options, "files", None)
    if files is None:
        files = json.loads(proposal.read_text(encoding="utf-8"))
    if not isinstance(files, dict) or not files:
        raise GateFailure("Proposal must map exact product paths to complete UTF-8 contents")
    allowed = {normalized(path) for path in options.path}
    tests = {normalized(path) for path in options.test_file}
    if not tests <= allowed:
        raise GateFailure("Critical tests must be approved paths")
    changes = {}
    for path, content in files.items():
        path = normalized(path)
        target = root / path
        if path not in allowed or path in tests or ".git" in Path(path).parts or not target.resolve().is_relative_to(root):
            raise GateFailure(f"Proposal path is not an approved product file: {path}")
        if not isinstance(content, str) or path in changes:
            raise GateFailure("Proposal paths must be unique and contents must be strings")
        changes[path] = content
    base = git(root, evidence, "rev-parse", "--verify", "--end-of-options", f"{options.base}^{{commit}}")
    head = git(root, evidence, "rev-parse", "HEAD")
    if git(root, evidence, "merge-base", base, head) != base:
        raise GateFailure("Recorded base must be an ancestor")
    observed = set()
    for argv in [
        ["git", "diff", "--name-only", "--no-renames", base, "HEAD"],
        ["git", "diff", "--name-only", "--no-renames", base],
        ["git", "diff", "--cached", "--name-only", "--no-renames"],
        ["git", "ls-files", "--others", "--exclude-standard"],
    ]:
        observed.update(execute(root, argv, evidence).stdout.splitlines())
    if observed - tests or not tests <= observed:
        raise GateFailure("Before apply, only the selected critical tests may differ from base")
    checks = check_commands(options.check)
    pending = git(root, evidence, "status", "--porcelain")
    if pending:
        git(root, evidence, "add", "--", *sorted(tests))
    check_test_diff(root, base, tests, evidence)
    if pending:
        git(root, evidence, "commit", "-m", options.message)
    tests_head = git(root, evidence, "rev-parse", "HEAD")
    if git(root, evidence, "status", "--porcelain"):
        raise GateFailure("Test commit left uncommitted changes")
    for check in checks:
        result = execute(root, check, evidence, expected=None)
        if result.returncode == 0 or not intended_failure(result.stdout + result.stderr, options.introduced):
            raise GateFailure("Critical check must fail for an intended assertion or declared missing contract")
    if git(root, evidence, "rev-parse", "HEAD") != tests_head or git(root, evidence, "status", "--porcelain"):
        raise GateFailure("Critical checks changed the test revision or worktree")
    applied_at = datetime.now(timezone.utc).isoformat()
    for path, content in changes.items():
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return {"base": base, "tests_head": tests_head, "applied_at": applied_at, "product_paths": sorted(changes)}


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
    check_test_diff(root, base, tests, evidence)
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


def finish(report, options):
    output = report
    if options.record and options.scratch:
        try:
            scratch = Path(options.scratch).resolve()
            scratch.mkdir(parents=True, exist_ok=True)
            data = json.dumps(report, indent=2).encode("utf-8")
            with tempfile.NamedTemporaryFile(prefix=f"gate-{options.action}-", suffix=".json", dir=scratch, delete=False) as record:
                record.write(data)
                path = record.name
            output = {**report, "record": path, "record_sha256": hashlib.sha256(data).hexdigest(),
                      "evidence": [item for item in report["evidence"] if item["argv"][0] != "git"]}
        except OSError as error:
            report["status"] = "unmet"
            report["record_error"] = str(error)
    print(json.dumps(output, indent=2))
    return 0 if report["status"] == "verified" else 1


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["handoff", "merge", "apply"])
    parser.add_argument("--lane", help="Lane worktree")
    parser.add_argument("--base", help="Approved lane base revision")
    parser.add_argument("--path", action="append", help="One exact approved path, repeat as needed")
    parser.add_argument("--test-file", action="append")
    parser.add_argument("--introduced", action="append", default=[], help="Spec-declared missing contract allowed on base")
    parser.add_argument("--check", action="append", help="Changed-behavior command as a JSON argv array")
    parser.add_argument("--scratch", help="Authorized disposable artifact directory")
    parser.add_argument("--integration", help="Integration worktree, required for merge")
    parser.add_argument("--integration-check", action="append", default=[], help="All currently merged criteria, including this lane, as JSON argv arrays")
    parser.add_argument("--proposal", help="For apply: JSON mapping approved product paths to contents, stored under scratch")
    parser.add_argument("--message", help="For apply: critical-test commit message")
    parser.add_argument("--request", help="For apply: one scratch JSON object with base, paths, tests, checks, files, message; optional lane and introduced")
    parser.add_argument("--record", action="store_true", help="Save full evidence under scratch and print revisions, check outputs and its content hash")
    options = parser.parse_args(argv)
    evidence = []
    report = {"status": "unverified", "evidence": evidence}
    try:
        if options.request:
            if options.action != "apply":
                raise GateFailure("Request files are supported only for apply")
            request = Path(options.request).resolve()
            data = json.loads(request.read_text(encoding="utf-8"))
            required = {"base", "paths", "tests", "checks", "files", "message"}
            if not isinstance(data, dict) or not required <= data.keys() or data.keys() - required - {"lane", "introduced"}:
                raise GateFailure("Apply request needs base, paths, tests, checks, files and message")
            for key in ["paths", "tests", "introduced"]:
                value = data.get(key, [])
                if not isinstance(value, list) or not all(isinstance(item, str) and item for item in value):
                    raise GateFailure(f"Request {key} must be a string array")
            if not all(isinstance(data.get(key, "."), str) and data.get(key, ".") for key in ["base", "message", "lane"]):
                raise GateFailure("Request base, message and lane must be nonempty strings")
            if not isinstance(data["checks"], list) or not data["checks"]:
                raise GateFailure("Request checks must be nonempty argv arrays")
            options.lane, options.base = data.get("lane", "."), data["base"]
            options.path, options.test_file = data["paths"], data["tests"]
            options.check = [json.dumps(check) for check in data["checks"]]
            options.introduced = data.get("introduced", [])
            options.scratch, options.proposal = str(request.parent), str(request)
            options.message, options.files = data["message"], data["files"]
        if not all([options.lane, options.base, options.path, options.test_file, options.check, options.scratch]):
            raise GateFailure("Supply lane, base, paths, tests, checks and scratch, or an apply request")
        if options.action == "apply":
            report.update(apply_after_red(options, evidence))
            report["status"] = "verified"
            return finish(report, options)
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
    return finish(report, options)


if __name__ == "__main__":
    sys.exit(main())
