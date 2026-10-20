"""Optional actual host-boundary check using a disposable Copilot configuration."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


@unittest.skipUnless(os.environ.get("PROMPTLINGS_TEST_COPILOT") == "1",
                     "Opt in to the installed Copilot integration check")
class CopilotBoundaryTests(unittest.TestCase):
    def test_native_disable_and_enable_in_fresh_host_processes(self):
        executable = shutil.which("copilot")
        self.assertIsNotNone(executable, "Copilot CLI is required for this opt-in check")
        with tempfile.TemporaryDirectory(prefix="promptlings-host-") as temp:
            home = Path(temp).resolve()
            skill = home / ".copilot" / "skills" / "bmad-fixture"
            skill.mkdir(parents=True)
            (skill / "SKILL.md").write_text(
                "---\nname: bmad-fixture\ndescription: Synthetic test skill\n---\n"
                "Return the word fixture only when explicitly invoked.\n", encoding="utf-8",
            )
            env = os.environ.copy()
            env.update({"HOME": str(home), "USERPROFILE": str(home),
                        "COPILOT_HOME": str(home / ".copilot"), "COPILOT_AUTO_UPDATE": "false"})

            def cli(*args):
                result = subprocess.run(
                    [executable, "-C", str(home), *args], env=env, text=True,
                    encoding="utf-8", capture_output=True, timeout=90,
                )
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                return result.stdout

            before = cli("skill", "list", "--json")
            self.assertIn("bmad-fixture", before)
            cli("skill", "disable", "bmad-fixture")
            disabled = json.loads(cli("skill", "list", "--json"))
            # Inspect the actual response rather than testing only command exit codes.
            found = []

            def visit(value):
                if isinstance(value, dict):
                    if value.get("name") == "bmad-fixture":
                        found.append(value)
                    for item in value.values():
                        visit(item)
                elif isinstance(value, list):
                    for item in value:
                        visit(item)

            visit(disabled)
            self.assertEqual(len(found), 1, disabled)
            self.assertTrue(found[0].get("disabled") or found[0].get("enabled") is False,
                            found[0])
            cli("skill", "enable", "bmad-fixture")
            found.clear()
            visit(json.loads(cli("skill", "list", "--json")))
            self.assertEqual(len(found), 1)
            self.assertFalse(found[0].get("disabled"))
            self.assertIsNot(found[0].get("enabled"), False)
