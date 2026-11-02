"""Dependency-free mechanical checks, not a semantic review or a full YAML parser."""

import argparse
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote, urlsplit


EM_DASH_BAN = re.compile(
    r"^(?=.*\bem[- ]?dash(?:es)?\b)"
    r"(?=.*\b(?:banned|ban|never|no|forbidden|prohibited)\b).*$",
    re.IGNORECASE | re.MULTILINE,
)
INLINE_LINK = re.compile(r"\[[^\]\n]*\]\(([^)\n]+)\)")


def is_artifact(path):
    return path.name.endswith(".agent.md") or path.name == "SKILL.md"


def git(root, *args):
    result = subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, check=True
    )
    return result.stdout.decode("utf-8")


def changed_artifacts(root, base):
    top = Path(git(root, "rev-parse", "--show-toplevel").strip()).resolve()
    if top != root:
        raise ValueError("--root must be the repository root when using --base")
    revision = git(
        root, "rev-parse", "--verify", "--end-of-options", f"{base}^{{commit}}"
    ).strip()
    paths = set()
    for args in (
        ("diff", "--name-only", "--diff-filter=ACMR", "-z", f"{revision}...HEAD", "--"),
        ("diff", "--name-only", "--diff-filter=ACMR", "-z", "--cached", "--"),
        ("diff", "--name-only", "--diff-filter=ACMR", "-z", "--"),
        ("ls-files", "--others", "--exclude-standard", "-z"),
    ):
        paths.update(name for name in git(root, *args).split("\0") if name)
    return sorted(
        root / name for name in paths
        if is_artifact(Path(name)) and (root / name).exists()
    )


def local_links(body):
    fenced = False
    fence = ""
    for line in body.splitlines():
        marker = re.match(r"^\s*(`{3,}|~{3,})", line)
        if marker:
            if not fenced:
                fenced, fence = True, marker[1]
            elif marker[1][0] == fence[0] and len(marker[1]) >= len(fence):
                fenced = False
            continue
        if not fenced:
            for match in INLINE_LINK.finditer(line):
                destination = match[1].strip()
                if destination.startswith("<") and ">" in destination:
                    destination = destination[1:destination.index(">")]
                else:
                    destination = destination.split(' "', 1)[0].split(" '", 1)[0]
                parts = urlsplit(destination)
                if not parts.scheme and not parts.netloc and parts.path:
                    yield unquote(parts.path)


def check_artifact(path, root):
    errors = []
    try:
        path.resolve().relative_to(root)
    except ValueError:
        return ["artifact resolves outside the inspection root"]
    text = path.read_text(encoding="utf-8-sig")
    frontmatter = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)", text, re.DOTALL)
    if not frontmatter:
        return ["missing YAML frontmatter delimiters"]
    fields = {}
    for field in ("name", "description"):
        matches = re.findall(rf"^{field}:[ \t]*([^\r\n]*)", frontmatter[1], re.MULTILINE)
        if len(matches) != 1 or not matches[0].strip().strip("'\""):
            errors.append(f"expected one nonempty scalar {field} field")
        elif matches[0].strip() in ("|", ">", "|-", ">-", "|+", ">+"):
            errors.append(f"{field} must be a single-line scalar for this checker")
        else:
            fields[field] = matches[0].strip().strip("'\"")
    body = text[frontmatter.end():]
    if not body.strip():
        errors.append("missing instruction body")
    if path.name == "SKILL.md":
        name = fields.get("name", "")
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name) or len(name) > 64:
            errors.append("skill name must be a lower-kebab-case slug of at most 64 characters")
        if name != path.parent.name:
            errors.append("skill name must match its containing directory")
    elif not EM_DASH_BAN.search(body):
        errors.append("agent must explicitly ban em dashes")
    for link in local_links(body):
        target = (path.parent / link).resolve()
        try:
            target.relative_to(root)
        except ValueError:
            errors.append(f"local resource resolves outside the inspection root: {link}")
            continue
        if not target.exists():
            errors.append(f"missing local resource: {link}")
    return errors


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--base", help="Review base revision, including local working changes")
    args = parser.parse_args(argv)
    root = args.root.resolve()
    try:
        if not root.is_dir():
            raise ValueError(f"inspection root is not a directory: {root}")
        paths = changed_artifacts(root, args.base) if args.base else sorted(
            path for directory in ("agents", "skills") for path in (root / directory).rglob("*.md")
            if is_artifact(path)
        )
        if not paths:
            if args.base:
                print("No changed agent or skill artifacts selected. No checks ran.")
                return 0
            raise ValueError("no agent or skill artifacts found under agents or skills")
        errors = []
        for path in paths:
            for message in check_artifact(path, root):
                errors.append(f"{path.relative_to(root)}: {message}")
        if errors:
            print("\n".join(errors), file=sys.stderr)
            return 1
        print(f"Mechanical checks passed for {len(paths)} artifact(s). Semantic review is separate.")
        return 0
    except (OSError, UnicodeError, ValueError, subprocess.CalledProcessError) as error:
        detail = error.stderr.decode("utf-8", errors="replace") if isinstance(
            error, subprocess.CalledProcessError
        ) else str(error)
        print(f"Artifact check failed: {detail.strip()}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
