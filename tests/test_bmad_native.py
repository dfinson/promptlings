"""Opt-in native Copilot discovery check: PROMPTLINGS_NATIVE_TESTS=1."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(
    os.environ.get("PROMPTLINGS_NATIVE_TESTS") == "1",
    "Set PROMPTLINGS_NATIVE_TESTS=1 to exercise installed Copilot discovery",
)
class NativeDiscoveryTests(unittest.TestCase):
    def run_command(self, command, **kwargs):
        result = subprocess.run(
            command, env=self.env, capture_output=True, text=True, timeout=60, **kwargs
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result.stdout

    def skills(self, checkout):
        return json.loads(self.run_command([
            self.copilot, "-C", str(checkout), "skill", "list", "--json",
        ]))

    def test_new_install_keeps_procedures_private_and_child_skills_local(self):
        self.copilot = shutil.which("copilot")
        self.assertIsNotNone(self.copilot, "Copilot CLI is required for native verification")
        with tempfile.TemporaryDirectory(prefix="bmad-native-") as directory:
            root = Path(directory)
            home = root / "home"
            profile = home / ".copilot"
            profile.mkdir(parents=True)
            self.env = os.environ.copy()
            self.env.update(HOME=str(home), USERPROFILE=str(home), COPILOT_HOME=str(profile))
            base = root / "base"
            self.run_command(["git", "init", "-q", str(base)])
            self.run_command([
                "git", "-C", str(base), "-c", "user.name=Fixture",
                "-c", "user.email=fixture@example.invalid", "commit", "-q",
                "--allow-empty", "-m",
                "Discovery fixture\n\nCo-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>",
            ])
            ordinary, child = root / "ordinary", root / "bmad-child"
            for checkout in (ordinary, child):
                self.run_command([
                    "git", "-C", str(base), "worktree", "add", "-q", "--detach", str(checkout),
                ])
            payload = (
                "---\nname: bmad-build\n"
                "description: Use when the user delegates a feature or bug fix.\n"
                "---\nFixture for native discovery, not a delivery workflow.\n"
            )
            private = profile / "promptlings/bmad"
            private.mkdir(parents=True)
            for name in ("setup", "bootstrap"):
                shutil.copyfile(ROOT / f"agents/orchestration/bmad/{name}.md", private / f"{name}.md")
            unrelated = home / ".agents/skills/unrelated"
            unrelated.mkdir(parents=True)
            (unrelated / "SKILL.md").write_text(
                "---\nname: unrelated\ndescription: An unrelated skill.\n---\nKeep.\n",
                encoding="utf-8",
            )
            ordinary_skills = self.skills(ordinary)
            self.assertFalse([s for s in ordinary_skills if "bmad" in s["name"]])
            self.assertIn("unrelated", [s["name"] for s in ordinary_skills])
            local = child / ".github/skills/bmad-build"
            local.mkdir(parents=True)
            (local / "SKILL.md").write_text(payload, encoding="utf-8")
            child_skills = self.skills(child)
            entries = [s for s in child_skills if s["name"] == "bmad-build"]
            self.assertEqual(len(entries), 1)
            self.assertEqual(Path(entries[0]["path"]).resolve(), local.resolve())
            self.assertNotEqual(entries[0]["source"], "personal-agents")
            self.assertFalse([s for s in self.skills(ordinary) if "bmad" in s["name"]])


if __name__ == "__main__":
    unittest.main()
