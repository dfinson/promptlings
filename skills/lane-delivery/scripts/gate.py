#!/usr/bin/env python3
"""Stateless lane-delivery gates. Reads the spec tables and git. Prints PASS, FAIL or NOTE lines.

spec-lint     G0: criteria, lanes, dependency graph and concurrency risks are complete.
lane-gate     G1: a lane's diff stays in its write set, adds no skip markers, passes its criteria,
              and its new criterion tests fail on the base.
run-criteria  G2 and G3: run the criterion commands for the given owners and print the criteria table.
"""
import argparse
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

LOCKFILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "uv.lock",
             "Pipfile.lock", "Cargo.lock", "go.sum", "Gemfile.lock", "composer.lock"}
TEST_PATH = re.compile(r"(^|/)(tests?|__tests__)/|(^|/)test_[^/]+\.py$|_test\.(py|go)$|\.(test|spec)\.[cm]?[jt]sx?$")
SKIP_MARK = re.compile(r"@pytest\.mark\.(skip|skipif|xfail)\b|\bpytest\.(skip|xfail)\(|@unittest\.(skip|skipIf|skipUnless|expectedFailure)\b"
                       r"|\.(only|skip)\(|\b(fit|fdescribe|xit|xdescribe|xtest)\(|\bt\.Skip(Now|f)?\(|#\[ignore\]|@(Disabled|Ignore)\b")
DEFINITION = re.compile(r"^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:def|class|function|func|interface|type|struct|enum)"
                        r"\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)")
NONE_VALUES = {"", "none", "-", "n/a"}


class Spec:
    def __init__(self, path):
        sections, name = {}, None
        for line in Path(path).read_text(encoding="utf-8").splitlines():
            heading = re.match(r"^##\s+(.+?)\s*$", line)
            if heading:
                name = heading.group(1).lower()
                sections[name] = []
            elif name is not None:
                sections[name].append(line)
        self.criteria = table(sections, "what")
        self.lanes = table(sections, "lane graph")
        self.risks = table(sections, "concurrency risks")
        self.lane_ids = [cell(r, "lane") for r in self.lanes]
        self.deps = {cell(r, "lane"): items(cell(r, "depends")) for r in self.lanes}

    def lane(self, lane_id):
        return next(r for r in self.lanes if cell(r, "lane") == lane_id)

    def reach(self, lane_id, seen=None):
        seen = set() if seen is None else seen
        for dep in self.deps.get(lane_id, []):
            if dep not in seen:
                seen.add(dep)
                self.reach(dep, seen)
        return seen

    def concurrent(self, a, b):
        return b not in self.reach(a) and a not in self.reach(b)


def table(sections, prefix):
    lines = next((v for k, v in sections.items() if k.startswith(prefix)), [])
    rows, started = [], False
    for line in lines:
        if line.strip().startswith("|"):
            started = True
            rows.append([c.strip().replace("\\|", "|") for c in re.split(r"(?<!\\)\|", line.strip())[1:-1]])
        elif started:
            break
    rows = [r for r in rows if not all(re.fullmatch(r":?-+:?", c) for c in r)]
    if not rows:
        return []
    header = [h.lower() for h in rows[0]]
    return [dict(zip(header, r)) for r in rows[1:]]


def cell(row, name):
    value = next((v for k, v in row.items() if name in k), "")
    return value.strip("` ").strip() if name in ("lane", "id", "owner") else value


def items(value):
    found = re.findall(r"`([^`]+)`", value) if "`" in value else value.split(",")
    return [v.strip() for v in found if v.strip().lower() not in NONE_VALUES]


def method(row):
    value = cell(row, "method").strip()
    if value.strip("` ").lower() == "human":
        return "human"
    commands = re.findall(r"`([^`]+)`", value)
    return commands[0] if len(commands) == 1 else None


def contract_key(token):
    return re.split(r"\.|::|#", token.split("(")[0].strip())[-1].lower() if "(" in token else token.strip().lower()


def glob_regex(pattern):
    pattern = pattern.strip()
    pattern = pattern[2:] if pattern.startswith("./") else pattern
    pattern = pattern + "**" if pattern.endswith("/") else pattern
    out, i = "", 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out, i = out + "(?:.*/)?", i + 3
        elif pattern.startswith("**", i):
            out, i = out + ".*", i + 2
        elif pattern[i] in "*?":
            out, i = out + ("[^/]*" if pattern[i] == "*" else "[^/]"), i + 1
        else:
            out, i = out + re.escape(pattern[i]), i + 1
    return re.compile(out + ("" if re.search(r"[*?]", pattern) else "(?:/.*)?") + "$")


def overlaps(p, q):
    if not re.search(r"[*?]", p) or not re.search(r"[*?]", q):
        return bool(glob_regex(p).match(q.rstrip("/")) or glob_regex(q).match(p.rstrip("/")))
    a, b = re.split(r"[*?]", p)[0], re.split(r"[*?]", q)[0]
    return a.startswith(b) or b.startswith(a)


def hotspots(paths):
    keys = set()
    for path in paths:
        name = path.rstrip("/").split("/")[-1]
        if name in LOCKFILES:
            keys.add(name)
        migration = re.search(r"(^|.*/)migrations/", path)
        if migration:
            keys.add(migration.group(0))
    return keys


def spec_lint(spec, flags):
    errors = []
    lanes = set(spec.lane_ids)
    if not spec.criteria:
        errors.append("No acceptance criteria table under '## What'.")
    if not spec.lanes:
        errors.append("No lane table under '## Lane graph'.")
    seen = set()
    for row in spec.criteria:
        cid = cell(row, "id")
        if not re.fullmatch(r"AC-\d+", cid) or cid in seen:
            errors.append(f"Criterion id '{cid}' must be unique and look like AC-1.")
        seen.add(cid)
        if method(row) is None:
            errors.append(f"{cid}: method must be one exact command in backticks or `human`.")
        if cell(row, "owner") not in lanes | {"integration"}:
            errors.append(f"{cid}: owner '{cell(row, 'owner')}' is not a lane or 'integration'.")
    for lane_id in spec.lane_ids:
        row = spec.lane(lane_id)
        owned = {cell(c, "id") for c in spec.criteria if cell(c, "owner") == lane_id}
        if not owned:
            errors.append(f"{lane_id}: owns no acceptance criterion.")
        listed = set(items(cell(row, "criteria")))
        if listed != owned:
            errors.append(f"{lane_id}: criteria column {sorted(listed)} differs from the criteria it owns {sorted(owned)}.")
        if not items(cell(row, "write set")):
            errors.append(f"{lane_id}: empty write set.")
        for dep in spec.deps[lane_id]:
            if dep not in lanes:
                errors.append(f"{lane_id}: depends on unknown lane '{dep}'.")
        if lane_id in spec.reach(lane_id):
            errors.append(f"{lane_id}: dependency cycle.")
    flagged = {}
    for i, a in enumerate(spec.lane_ids):
        for b in spec.lane_ids[i + 1:]:
            if not spec.concurrent(a, b):
                continue
            rows = {a: spec.lane(a), b: spec.lane(b)}
            changed = {x: {contract_key(t) for t in items(cell(r, "contracts changed"))} for x, r in rows.items()}
            used = {x: {contract_key(t) for t in items(cell(r, "contracts used"))} for x, r in rows.items()}
            writes = {x: items(cell(r, "write set")) for x, r in rows.items()}
            reasons = []
            if changed[a] & (changed[b] | used[b]) or changed[b] & used[a]:
                reasons.append("shared contract")
            if any(overlaps(p, q) for p in writes[a] for q in writes[b]):
                reasons.append("overlapping write sets")
            if hotspots(writes[a]) & hotspots(writes[b]):
                reasons.append("shared hotspot")
            if frozenset((a, b)) in flags:
                reasons.append("coupling check")
            if reasons:
                flagged[frozenset((a, b))] = reasons
    covered = set()
    for row in spec.risks:
        pair = frozenset(t for t in re.findall(r"[\w.-]+", cell(row, "lanes")) if t in lanes)
        decision = cell(row, "decision").strip("` ").lower()
        if len(pair) != 2:
            errors.append(f"Risk row '{cell(row, 'lanes')}' must name exactly two known lanes.")
            continue
        covered.add(pair)
        a, b = sorted(pair)
        if decision.startswith("edge"):
            if spec.concurrent(a, b):
                errors.append(f"Risk {a}/{b}: decision is edge but the lane graph has no dependency path between them.")
        elif decision.startswith("accept"):
            if cell(row, "recovery").strip().lower() in NONE_VALUES:
                errors.append(f"Risk {a}/{b}: an accepted risk needs a recovery.")
        else:
            errors.append(f"Risk {a}/{b}: decision must start with 'edge' or 'accept'.")
    for pair, reasons in flagged.items():
        if pair not in covered:
            a, b = sorted(pair)
            errors.append(f"Concurrent lanes {a} and {b} are coupled ({', '.join(reasons)}) with no Concurrency risks row.")
    for error in errors:
        print(f"FAIL {error}")
    print("FAIL spec-lint" if errors else
          f"PASS spec-lint: {len(spec.criteria)} criteria, {len(spec.lanes)} lanes, {len(flagged)} coupled pairs covered.")
    return not errors


def git(repo, *args):
    return subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True, encoding="utf-8", check=True).stdout


def run_command(command, cwd):
    result = subprocess.run(command, cwd=cwd, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return result.returncode, (result.stdout + result.stderr).strip()


def id_pattern(cid):
    return re.compile(rf"(?i)(?<![a-z0-9])ac[-_]?{cid.split('-')[1]}(?!\d)")


def diff_lines(repo, base, head):
    added, removed, old, new = {}, {}, None, None
    for line in git(repo, "diff", "-U0", "--no-renames", base, head).splitlines():
        if line.startswith("--- "):
            old = None if line == "--- /dev/null" else line[6:]
        elif line.startswith("+++ "):
            new = None if line == "+++ /dev/null" else line[6:]
        elif line.startswith("+") and new:
            added.setdefault(new, []).append(line[1:])
        elif line.startswith("-") and old:
            removed.setdefault(old, []).append(line[1:])
    return added, removed


def lane_gate(spec, spec_path, lane_id, repo, base, head):
    if lane_id not in spec.lane_ids:
        print(f"FAIL Unknown lane '{lane_id}'.")
        return False
    row, ok = spec.lane(lane_id), True
    head_sha = git(repo, "rev-parse", head).strip()
    if git(repo, "rev-parse", "HEAD").strip() != head_sha or git(repo, "status", "--porcelain").strip():
        print(f"FAIL The checkout must be at {head} with no uncommitted or untracked changes, so results match the commit.")
        return False
    merge_base = git(repo, "merge-base", base, head_sha).strip()
    changed = [p for p in git(repo, "diff", "--name-only", "--no-renames", merge_base, head_sha).splitlines() if p]
    try:
        spec_rel = Path(spec_path).resolve().relative_to(Path(repo).resolve()).as_posix()
    except ValueError:
        spec_rel = None
    patterns = [glob_regex(p) for p in items(cell(row, "write set"))]
    outside = [p for p in changed if p == spec_rel or not any(r.match(p) for r in patterns)]
    for path in outside:
        kind = "the spec" if path == spec_rel else "a test file" if TEST_PATH.search(path) else "a file"
        print(f"FAIL {lane_id} changed {kind} outside its write set: {path}")
    ok &= not outside
    added, removed = diff_lines(repo, merge_base, head_sha)
    for path, lines in added.items():
        for line in lines:
            if TEST_PATH.search(path) and SKIP_MARK.search(line):
                print(f"FAIL Skip, xfail or focus marker added in {path}: {line.strip()}")
                ok = False
    owned = [c for c in spec.criteria if cell(c, "owner") == lane_id]
    automated = [(cell(c, "id"), method(c)) for c in owned if method(c) not in (None, "human")]
    for cid, command in automated:
        code, output = run_command(command, repo)
        print(f"{'PASS' if code == 0 else 'FAIL'} {cid} on head: `{command}` exited {code}")
        if code:
            print(output)
            ok = False
    test_files = [p for p in changed if TEST_PATH.search(p) and p in added]
    tagged = [(cid, command) for cid, command in automated
              if any(id_pattern(cid).search(line) for p in test_files for line in added[p])]
    for cid, _ in automated:
        if cid not in {t for t, _ in tagged}:
            print(f"NOTE {cid}: no new test names this criterion, so the fail-on-base check does not apply.")
    if tagged:
        temp = Path(tempfile.mkdtemp(prefix="lane-gate-"))
        tree = temp / "base"
        git(repo, "worktree", "add", "--detach", "--quiet", str(tree), merge_base)
        try:
            for path in test_files:
                target = tree / path
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(subprocess.run(["git", "show", f"{head_sha}:{path}"], cwd=repo,
                                                  capture_output=True, check=True).stdout)
            for cid, command in tagged:
                code, _ = run_command(command, tree)
                note = " (a new criterion test must fail without the lane's implementation)" if code == 0 else ""
                print(f"{'FAIL' if code == 0 else 'PASS'} {cid} with new tests on base: `{command}` exited {code}{note}")
                ok &= code != 0
        finally:
            git(repo, "worktree", "remove", "--force", str(tree))
            shutil.rmtree(temp, ignore_errors=True)
    actual = {m.group(1).lower() for lines in removed.values() for line in lines for m in [DEFINITION.match(line)] if m}
    actual |= {h.lower() for h in hotspots(changed)}
    declared = {contract_key(t) for t in items(cell(row, "contracts changed"))}
    undeclared = sorted(actual - declared)
    if undeclared:
        print(f"NOTE RECHECK {lane_id} changed undeclared contracts: {', '.join(undeclared)}. "
              "Rerun the coupling check against running lanes.")
    print(f"{'PASS' if ok else 'FAIL'} lane-gate {lane_id}: {len(changed)} changed files, "
          f"base {merge_base[:12]}, head {head_sha[:12]}")
    return ok


def run_criteria(spec, repo, owners):
    ok = True
    print("| Criterion | Owner | Status | Evidence |\n| --- | --- | --- | --- |")
    for row in spec.criteria:
        cid, owner, command = cell(row, "id"), cell(row, "owner"), method(row)
        if owners and owner not in owners:
            continue
        if command == "human":
            print(f"| {cid} | {owner} | unverified | human, at G4 |")
            continue
        code, output = run_command(command, repo) if command else (1, "invalid method")
        print(f"| {cid} | {owner} | {'verified' if code == 0 else 'unmet'} | `{command}` exited {code} |")
        if code:
            print(output, file=sys.stderr)
            ok = False
    return ok


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    lint = sub.add_parser("spec-lint")
    lint.add_argument("spec")
    lint.add_argument("--flag", action="append", default=[], metavar="A,B",
                      help="A concurrent lane pair the coupling check flagged. Repeatable.")
    gate = sub.add_parser("lane-gate")
    gate.add_argument("spec")
    gate.add_argument("--lane", required=True)
    gate.add_argument("--base", required=True, help="Integration branch or commit the lane was cut from.")
    gate.add_argument("--head", default="HEAD")
    gate.add_argument("--repo", default=".")
    crit = sub.add_parser("run-criteria")
    crit.add_argument("spec")
    crit.add_argument("--owners", default="", help="Comma-separated lane ids and 'integration'. Omit for all.")
    crit.add_argument("--repo", default=".")
    args = parser.parse_args(argv)
    spec = Spec(args.spec)
    if args.command == "spec-lint":
        ok = spec_lint(spec, {frozenset(f.split(",")) for f in args.flag})
    elif args.command == "lane-gate":
        ok = lane_gate(spec, args.spec, args.lane, args.repo, args.base, args.head)
    else:
        ok = run_criteria(spec, args.repo, set(items(args.owners)))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
