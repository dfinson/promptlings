#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# ///
"""Personal BMAD preferences, checkout binding, and reversible skill isolation."""

from __future__ import annotations

import argparse
from contextlib import contextmanager
import csv
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import tomllib

VERSION = "6.12.1"
CATEGORIES = ("planning", "implementation", "knowledge")
MODES = ("project", "central")
RULES = ("/_bmad/", "/.agents/skills/bmad-*/", "/.github/agents/bmad-*.agent.md",
         "/.claude/skills/bmad-*/")
KEYS = {"artifacts", "exclusions", "central_root", *CATEGORIES}
BEGIN = "# promptlings-bmad:start"
END = "# promptlings-bmad:end"


class SetupError(ValueError):
    pass


def digest(value):
    return hashlib.sha256(value).hexdigest()


def git(root, *args):
    result = subprocess.run(
        ["git", "-C", str(root), *args], capture_output=True, text=True,
        encoding="utf-8",
    )
    if result.returncode:
        raise SetupError(result.stderr.strip() or f"git failed: {args}")
    return result.stdout.strip()


def absolute(value):
    path = Path(value).expanduser()
    if not path.is_absolute():
        raise SetupError(f"An absolute path is required: {value}")
    return path.resolve()


def identity(checkout):
    checkout = absolute(checkout)
    if Path(git(checkout, "rev-parse", "--show-toplevel")).resolve() != checkout:
        raise SetupError("--project must name the checkout root, not a subdirectory")
    common = Path(git(checkout, "rev-parse", "--path-format=absolute", "--git-common-dir")).resolve()
    return checkout, digest(os.fsencode(common))[:20]


def load(path):
    if not path.exists():
        return {}
    return tomllib.loads(path.read_text(encoding="utf-8"))


def validate_values(values):
    if not isinstance(values, dict) or set(values) - KEYS:
        raise SetupError("Unknown preference key or invalid preference table")
    for key, value in values.items():
        allowed = ("project", "local", "global") if key == "exclusions" else MODES
        if key == "central_root":
            if not isinstance(value, str):
                raise SetupError("central_root must be an absolute path string")
            absolute(value)
        elif value not in allowed:
            raise SetupError(f"Invalid {key}: {value}. Expected one of {allowed}")


def preferences(path):
    data = load(path)
    if set(data) - {"schema", "defaults", "projects"} or data.get("schema", 1) != 1:
        raise SetupError("Unsupported preferences schema")
    validate_values(data.get("defaults", {}))
    projects = data.get("projects", {})
    if not isinstance(projects, dict):
        raise SetupError("projects must be a table")
    for key, values in projects.items():
        if not re.fullmatch(r"[a-f0-9]{20}", key):
            raise SetupError(f"Invalid project key: {key}")
        validate_values(values)
    return data


def toml_value(value):
    # JSON double-quoted strings are also TOML basic strings for these scalar settings.
    return json.dumps(value, ensure_ascii=False)


def serialize_preferences(data):
    lines = ["schema = 1"]
    for table, values in [("defaults", data.get("defaults", {})), *[
        (f"projects.{key}", values)
        for key, values in sorted(data.get("projects", {}).items())
    ]]:
        lines.extend(["", f"[{table}]"])
        lines.extend(f"{key} = {toml_value(value)}" for key, value in sorted(values.items()))
    return "\n".join(lines) + "\n"


def read_bytes(path):
    if path.is_symlink():
        raise SetupError(f"Refusing to replace a linked file: {path}")
    return path.read_bytes() if path.exists() else None


@contextmanager
def lock(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    lease = path.with_name(path.name + ".lock")
    try:
        fd = os.open(lease, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as error:
        raise SetupError(f"Another operation or stale lease exists: {lease}") from error
    try:
        os.close(fd)
        yield
    finally:
        lease.unlink()


def write(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(dir=path.parent, prefix=".bmad-")
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def change(path, content):
    before = read_bytes(path)
    return {
        "path": str(path), "before": digest(before) if before is not None else None,
        "content": content,
    }


def plan_token(plan):
    return digest(json.dumps(plan, sort_keys=True).encode("utf-8"))


def commit_changes(plan, approved, lease):
    if approved != plan_token(plan):
        raise SetupError("Approval token is missing or stale. Preview again and approve its token.")
    with lock(lease):
        for item in plan["writes"]:
            path = Path(item["path"])
            before = read_bytes(path)
            if (digest(before) if before is not None else None) != item["before"]:
                raise SetupError(f"File changed after preview: {path}")
        completed = []
        try:
            for item in plan["writes"]:
                path = Path(item["path"])
                original = read_bytes(path)
                if item["content"] is None:
                    path.unlink()
                else:
                    write(path, item["content"].encode("utf-8"))
                completed.append((path, original))
        except OSError:
            for path, original in reversed(completed):
                if original is None:
                    path.unlink()
                else:
                    write(path, original)
            raise


def configure(args, config):
    data = preferences(config)
    if args.scope == "defaults":
        target = data.setdefault("defaults", {})
    else:
        _, key = identity(args.project)
        target = data.setdefault("projects", {}).setdefault(key, {})
    for assignment in args.set:
        key, separator, value = assignment.partition("=")
        if not separator:
            raise SetupError("--set requires key=value")
        validate_values({key: value})
        target[key] = value
    for key in args.unset:
        if key not in KEYS:
            raise SetupError(f"Unknown preference key: {key}")
        target.pop(key, None)
    plan = {"action": "configure", "writes": [change(config, serialize_preferences(data))]}
    if args.approve:
        commit_changes(plan, args.approve, config)
    return plan


def effective(args, config):
    checkout, key = identity(args.project)
    data = preferences(config)
    values = {"artifacts": "project", "exclusions": "project"}
    values.update(data.get("defaults", {}))
    values.update(data.get("projects", {}).get(key, {}))
    for field in KEYS:
        value = getattr(args, field, None)
        if value is not None:
            values[field] = value
    validate_values(values)
    choices = {category: values.get(category, values["artifacts"]) for category in CATEGORIES}
    central = None
    if "central" in choices.values() or values["artifacts"] == "central":
        if not values.get("central_root"):
            raise SetupError("central_root is required for central artifacts")
        if not args.run or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,79}", args.run):
            raise SetupError("Central artifacts require --run with a unique session/run identifier")
        checkout_id = digest(os.fsencode(checkout))[:12]
        central = (absolute(values["central_root"]) / "projects" / key
                   / "checkouts" / checkout_id / "runs" / args.run)
        if central.is_relative_to(checkout):
            raise SetupError("Central artifacts must be outside the code checkout")
    return checkout, key, values, choices, central


def runtime(checkout):
    root = checkout / "_bmad"
    if root.resolve() != root:
        raise SetupError("The runtime must be checkout-local, not a linked central installation")
    manifest = root / "_config" / "manifest.yaml"
    if not manifest.is_file():
        raise SetupError(f"Missing checkout-local BMAD runtime: {manifest}. Install before binding.")
    # This compatibility adapter supports one observed stable layout, not arbitrary YAML.
    match = re.search(r"(?m)^installation:\s*\n\s+version:\s*['\"]?([0-9.]+)['\"]?\s*$",
                      manifest.read_text(encoding="utf-8"))
    if not match or match[1] != VERSION:
        raise SetupError(f"Unsupported BMAD installation. Binding is tested only for {VERSION}.")
    for name in ("config.toml", "scripts/render_skill.py", "scripts/resolve_config.py",
                 "_config/skill-manifest.csv"):
        if not root.joinpath(*name.split("/")).is_file():
            raise SetupError(f"Incomplete BMAD runtime: {name}")
    return root


def managed_text(path, body):
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    if text.count(BEGIN) != text.count(END) or text.count(BEGIN) > 1:
        raise SetupError(f"Invalid managed markers: {path}")
    if BEGIN in text:
        start, end = text.index(BEGIN), text.index(END)
        if end < start:
            raise SetupError(f"Invalid managed markers: {path}")
        text = text[:start] + text[end + len(END):].lstrip("\r\n")
    if body:
        text = text.rstrip("\r\n") + ("\n\n" if text.strip() else "")
        text += f"{BEGIN}\n{body}\n{END}\n"
    return text


def build_binding(args, config):
    checkout, key, values, choices, central = effective(args, config)
    root = runtime(checkout)
    marker = root / "custom" / "promptlings-binding.json"
    previous = json.loads(marker.read_text(encoding="utf-8")) if marker.exists() else None
    own = root / "custom" / "config.user.toml"
    current = load(own)
    if own.parent.resolve() != own.parent:
        raise SetupError("Linked configuration directories are unsupported")
    if previous:
        for dotted, expected in previous["outputs"].items():
            node = current
            for part in dotted.split("."):
                node = node.get(part, {}) if isinstance(node, dict) else {}
            if node != expected:
                raise SetupError(f"Managed setting changed externally: {dotted}. Reconcile before binding.")
        if previous.get("exclusions") != values["exclusions"]:
            raise SetupError("Exclusion policy changed. Unbind before applying a different policy.")
    elif BEGIN in (own.read_text(encoding="utf-8") if own.exists() else ""):
        raise SetupError("Managed configuration has no ownership record. Reconcile before binding.")
    outputs = {}
    if values["artifacts"] == "central":
        outputs["core.output_folder"] = str(central)
    for category, mode in choices.items():
        if mode == "central":
            field = "project_knowledge" if category == "knowledge" else f"{category}_artifacts"
            outputs[f"modules.bmm.{field}"] = str(central / category)
    if previous and previous.get("outputs") != outputs:
        raise SetupError(
            "Existing artifact binding differs. Resume with its original --run or explicitly "
            "retire it using unbind after checking active work. No files were moved."
        )
    if not previous:
        for dotted in outputs:
            table, field = dotted.rsplit(".", 1)
            node = current
            for part in table.split("."):
                node = node.get(part, {})
            if field in node:
                raise SetupError(f"Existing personal setting conflicts: {dotted}. Reconcile before binding.")
    body = []
    for dotted, value in outputs.items():
        # TOML dotted keys avoid reopening tables already present in the user's file.
        body.append(f"{dotted} = {toml_value(value)}")
    original_text = own.read_text(encoding="utf-8") if own.exists() else ""
    # Prepending a managed block ensures dotted assignments start at the TOML root.
    unmanaged = managed_text(own, "")
    managed = f"{BEGIN}\n" + "\n".join(body) + f"\n{END}\n" if body else ""
    content = managed + unmanaged
    tomllib.loads(content)
    writes = []
    if content != original_text:
        writes.append(change(own, content))
    paths = {"configuration": str(own), **outputs}
    if previous is None:
        writes.append(change(marker, json.dumps({
            "schema": 1, "outputs": outputs, "exclusions": values["exclusions"],
        }, indent=2) + "\n"))
    exclusions = values["exclusions"]
    if exclusions != "project":
        tracked = git(checkout, "ls-files", "--", "_bmad", ".agents/skills", ".github/agents",
                      ".claude/skills")
        if any(line.startswith(("_bmad/", ".agents/skills/bmad-", ".github/agents/bmad-",
                                ".claude/skills/bmad-")) for line in tracked.splitlines()):
            raise SetupError("BMAD paths are already tracked. Ignore rules cannot hide tracked files.")
        if exclusions == "local":
            exclude = Path(git(checkout, "rev-parse", "--path-format=absolute", "--git-path", "info/exclude"))
        else:
            configured = subprocess.run(
                ["git", "-C", str(checkout), "config", "--path", "--get", "core.excludesFile"],
                text=True, capture_output=True, encoding="utf-8",
            )
            if configured.returncode not in (0, 1):
                raise SetupError(configured.stderr.strip())
            if not configured.stdout.strip():
                raise SetupError("Global exclusions require an existing core.excludesFile. Configure it explicitly first.")
            exclude = absolute(configured.stdout.strip())
        writes.append(change(exclude, managed_text(exclude, "\n".join(RULES))))
        paths["exclude_file"] = str(exclude)
    return {
        "action": "bind", "project": str(checkout), "project_id": key,
        "preferences": values, "paths": paths, "writes": writes,
        "notice": "No artifact migration, installation, commits, or skill activation is performed.",
    }


def tree_hash(path):
    if path.is_symlink() or not path.is_dir():
        raise SetupError(f"Linked skill directories are unsupported: {path}")
    records = []
    for file in sorted(path.rglob("*")):
        if file.is_symlink():
            raise SetupError(f"Linked skill content is unsupported: {file}")
        if file.is_file():
            records.append((file.relative_to(path).as_posix(), digest(file.read_bytes())))
    return digest(json.dumps(records).encode("utf-8"))


def skill_plan(args, config):
    root = absolute(args.skill_root)
    state = config.parent / "skill-isolation" / digest(os.fsencode(root))[:20]
    if state.is_relative_to(root):
        raise SetupError("Isolation storage must be outside the skill discovery root")
    record = state / "manifest.json"
    if args.action == "isolate":
        if record.exists():
            raise SetupError(f"An isolation record already exists: {record}. Restore it first.")
        with absolute(args.inventory).open(encoding="utf-8", newline="") as stream:
            rows = list(csv.DictReader(stream))
        ids = [row.get("canonicalId", "") for row in rows]
        if not ids or any(not re.fullmatch(r"bmad-[A-Za-z0-9_-]+", name) for name in ids):
            raise SetupError("Inventory must contain safe bmad-* canonicalId values only")
        moves = []
        for name in sorted(set(ids)):
            source = root / name
            target = state / "skills" / name
            if source.exists():
                if not (source / "SKILL.md").is_file() or target.exists():
                    raise SetupError(f"Invalid skill or occupied isolation destination: {source}")
                moves.append({"source": str(source), "target": str(target), "hash": tree_hash(source)})
        if not moves:
            raise SetupError(f"No inventoried BMAD skills found in {root}")
    else:
        saved = json.loads(record.read_text(encoding="utf-8"))
        if saved.get("root") != str(root):
            raise SetupError("Isolation record root mismatch")
        for item in saved["moves"]:
            name = Path(item["source"]).name
            if (not re.fullmatch(r"bmad-[A-Za-z0-9_-]+", name)
                    or Path(item["source"]) != root / name
                    or Path(item["target"]) != state / "skills" / name):
                raise SetupError("Invalid isolation record paths")
        moves = [{"source": item["target"], "target": item["source"], "hash": item["hash"]}
                 for item in saved["moves"]]
        for item in moves:
            if Path(item["target"]).exists() or tree_hash(Path(item["source"])) != item["hash"]:
                raise SetupError("Restore conflict or modified isolated skill. Nothing was restored.")
    plan = {"action": args.action, "root": str(root), "moves": moves,
            "record": str(record), "writes": [],
            "notice": "Restart the host after changes. Isolation affects every session using this skill root."}
    if args.approve:
        if args.approve != plan_token(plan):
            raise SetupError("Approval token is missing or stale")
        with lock(config):
            if record.exists() != (args.action == "restore"):
                raise SetupError("Isolation state changed")
            for item in moves:
                if Path(item["target"]).exists() or tree_hash(Path(item["source"])) != item["hash"]:
                    raise SetupError("Skill changed after preview")
            completed = []
            try:
                for item in moves:
                    source, target = Path(item["source"]), Path(item["target"])
                    target.parent.mkdir(parents=True, exist_ok=True)
                    source.rename(target)
                    completed.append((source, target))
                if args.action == "isolate":
                    write(record, json.dumps({"root": str(root), "moves": moves}, indent=2).encode())
                else:
                    record.unlink()
            except OSError:
                for source, target in reversed(completed):
                    target.rename(source)
                raise
    return plan


def unbind(args, config):
    checkout, _ = identity(args.project)
    root = checkout / "_bmad"
    marker = root / "custom" / "promptlings-binding.json"
    json.loads(marker.read_text(encoding="utf-8"))
    own = root / "custom" / "config.user.toml"
    plan = {
        "action": "unbind", "writes": [
            change(own, managed_text(own, "")),
            change(marker, None),
        ],
        "notice": "Destinations revert to underlying BMAD configuration. Old artifacts and exclusion rules remain in place.",
    }
    if args.approve:
        commit_changes(plan, args.approve, config)
    return plan


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=Path.home() / ".config" / "promptlings" / "bmad.toml")
    sub = parser.add_subparsers(dest="command", required=True)
    conf = sub.add_parser("configure", help="Preview preference changes. Apply with its approval token.")
    conf.add_argument("--scope", choices=("defaults", "project"), required=True)
    conf.add_argument("--project")
    conf.add_argument("--set", action="append", default=[])
    conf.add_argument("--unset", action="append", default=[])
    conf.add_argument("--approve")
    for command in ("status", "bind", "unbind"):
        item = sub.add_parser(command)
        item.add_argument("--project", required=True)
        item.add_argument("--run")
        item.add_argument("--artifacts", choices=MODES)
        item.add_argument("--exclusions", choices=("project", "local", "global"))
        item.add_argument("--central-root")
        for category in CATEGORIES:
            item.add_argument(f"--{category}", choices=MODES)
        item.add_argument("--approve")
    skills = sub.add_parser("skills", help="Reversibly remove inventoried skills from host discovery.")
    skills.add_argument("action", choices=("isolate", "restore"))
    skills.add_argument("--skill-root", required=True)
    skills.add_argument("--inventory")
    skills.add_argument("--approve")
    args = parser.parse_args()
    try:
        config = absolute(str(args.config))
        if args.command == "configure":
            if args.scope == "project" and not args.project:
                raise SetupError("--project is required for project preferences")
            plan = configure(args, config)
        elif args.command == "skills":
            if args.action == "isolate" and not args.inventory:
                raise SetupError("--inventory is required to isolate BMAD skills")
            plan = skill_plan(args, config)
        elif args.command == "unbind":
            plan = unbind(args, config)
        else:
            plan = build_binding(args, config)
            if args.command == "bind" and args.approve:
                commit_changes(plan, args.approve, config)
        plan["approval"] = plan_token(plan)
        plan["applied"] = bool(args.approve and args.command != "status")
        print(json.dumps(plan, indent=2))
        return 0
    except (SetupError, OSError, ValueError, TypeError, KeyError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
