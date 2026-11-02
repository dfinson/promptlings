"""Focused mechanical checker and companion contract checks."""

import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
CHECKER = ROOT / "skills/artifact-inspection/scripts/check_artifacts.py"
SPEC = importlib.util.spec_from_file_location("check_artifacts", CHECKER)
checker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checker)
VALID_AGENT = (
    "---\nname: Fixture\ndescription: Inspect a fixture.\n---\n"
    "# Fixture\n\nEm dashes are banned from all output.\n"
)


class ArtifactTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="promptlings-artifacts-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()

    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return path

    def test_repository_artifacts(self):
        self.assertEqual(checker.main(["--root", str(ROOT)]), 0)

    def test_plugin_review_agents_match_canonical_sources(self):
        source = ROOT / "agents/code-review"
        plugin = ROOT / "plugins/promptlings-code-review/agents"
        self.assertEqual((source / "the-nitcracker.agent.md").read_bytes(),
                         (plugin / "the-nitcracker.md").read_bytes())
        expected = (source / "pr-walkthrough.agent.md").read_text(encoding="utf-8").replace(
            "name: PR Walkthrough\n", "name: pr-walkthrough\n", 1
        ).replace(
            "* ${input:baseBranch:origin/main}: (Optional) Comparison base branch. Defaults to `origin/main`.",
            "* Comparison base branch: (Optional) taken from the user's request. Defaults to `origin/main`.",
            1,
        )
        self.assertEqual(expected, (plugin / "pr-walkthrough.md").read_text(encoding="utf-8"))

    def test_walkthrough_is_read_only_in_all_modes(self):
        source = (ROOT / "agents/code-review/pr-walkthrough.agent.md").read_text(encoding="utf-8")
        self.assertIn("Read-only in every mode.", source)
        self.assertIn("without saving a separate artifact", source)
        self.assertIn("Do not invoke file-editing, todo or tracking-mutation, or publication tools", source)
        self.assertIn("including host-managed task-list updates", source)
        self.assertIn("Do not fetch or update refs", source)
        self.assertNotIn("git fetch origin", source)
        self.assertNotIn(".copilot-tracking/pr/review", source)
        self.assertNotIn("Save a report only", source)
        self.assertNotIn("existing scratch notes or walkthrough artifacts", source)
        self.assertNotIn("Post only with user authorization", source)

    def test_required_metadata_and_agent_ban(self):
        for content, expected in (
            ("# No metadata\n", "frontmatter"),
            (VALID_AGENT.replace("name: Fixture", 'name: ""'), "name"),
            (VALID_AGENT.replace("description: Inspect a fixture.", "description:"), "description"),
            (VALID_AGENT.replace("name: Fixture", "name: One\nname: Two"), "name"),
            (VALID_AGENT.replace("Em dashes are banned from all output.", ""), "em dashes"),
        ):
            with self.subTest(expected=expected):
                path = self.write("agents/fixture.agent.md", content)
                self.assertTrue(any(expected in e for e in checker.check_artifact(path, self.root)))

    def test_skill_slug_and_directory(self):
        for name in ("Wrong Name", "other", "x" * 65):
            with self.subTest(name=name):
                path = self.write("skills/fixture/SKILL.md", VALID_AGENT.replace("Fixture", name))
                self.assertTrue(checker.check_artifact(path, self.root))
        path = self.write("skills/fixture/SKILL.md", VALID_AGENT.replace("Fixture", "fixture"))
        self.assertEqual(checker.check_artifact(path, self.root), [])

    def test_links_and_fenced_examples(self):
        body = (
            "\n[missing](missing.md)\n[escape](../../outside.md)\n"
            "[remote](https://example.com/doc)\n[anchor](#fixture)\n"
            "```markdown\n[example](example.md)\n```\n"
        )
        path = self.write("agents/fixture.agent.md", VALID_AGENT + body)
        errors = checker.check_artifact(path, self.root)
        self.assertEqual(len(errors), 2, errors)
        self.assertIn("missing local resource", errors[0])
        self.assertIn("outside", errors[1])
        self.write("agents/resource with space.md", "# Resource")
        path.write_text(VALID_AGENT + "\n[real](resource%20with%20space.md)\n", encoding="utf-8")
        self.assertEqual(checker.check_artifact(path, self.root), [])

    def test_changed_selection_includes_working_files_but_not_deleted_paths(self):
        def git(*args):
            return subprocess.run(
                ["git", "-C", str(self.root), *args],
                capture_output=True, text=True, check=True,
            ).stdout.strip()

        git("init", "--quiet")
        self.write("agents/old.agent.md", VALID_AGENT)
        self.write("agents/modified.agent.md", VALID_AGENT)
        git("add", ".")
        git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
            "commit", "--quiet", "-m", "Fixture baseline")
        base = git("rev-parse", "HEAD")
        committed = self.write("agents/removed-locally.agent.md", VALID_AGENT)
        git("add", ".")
        git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
            "commit", "--quiet", "-m", "Add then remove a candidate")
        committed.unlink()
        (self.root / "agents/old.agent.md").unlink()
        self.write("agents/modified.agent.md", VALID_AGENT + "\nModified.\n")
        self.write("agents/untracked.agent.md", VALID_AGENT)
        staged = self.write("skills/staged/SKILL.md", VALID_AGENT.replace("Fixture", "staged"))
        git("add", str(staged))
        selected = {p.relative_to(self.root).as_posix()
                    for p in checker.changed_artifacts(self.root, base)}
        self.assertEqual(selected, {
            "agents/modified.agent.md", "agents/untracked.agent.md", "skills/staged/SKILL.md",
        })
        self.assertEqual(checker.main(["--root", str(self.root), "--base", "missing-ref"]), 1)

    def test_absent_root_and_empty_discovery_fail(self):
        self.assertEqual(checker.main(["--root", str(self.root / "absent")]), 1)
        self.assertEqual(checker.main(["--root", str(self.root)]), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
