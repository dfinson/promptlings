"""Opt-in real BMAD install and agent delivery. Uses disposable repositories."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

HELPER = Path(__file__).resolve().parents[1] / "scripts" / "bmad_setup.py"


@unittest.skipUnless(os.environ.get("PROMPTLINGS_TEST_DELIVERY") == "1",
                     "Opt in to the networked, AI-credit-consuming delivery check")
class DeliveryTests(unittest.TestCase):
    def test_official_install_central_binding_and_actual_agent_delivery(self):
        copilot = shutil.which("copilot")
        npx = shutil.which("npx")
        self.assertTrue(copilot and npx, "Copilot, authentication, Node, and uv are required")
        copilot_command = [copilot]
        if os.name == "nt" and Path(copilot).suffix.lower() == ".cmd":
            loader = Path(copilot).parent / "node_modules" / "@github" / "copilot" / "npm-loader.js"
            self.assertTrue(loader.is_file(), "Use the npm Copilot launcher or a native executable")
            copilot_command = ["node", str(loader)]
        with tempfile.TemporaryDirectory(prefix="promptlings-delivery-") as temp:
            root = Path(temp).resolve()
            code = root / "code"
            code.mkdir()
            personal = root / "personal"
            personal.mkdir()
            config = root / "preferences" / "bmad.toml"
            env = os.environ.copy()
            env.update({
                "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_SYSTEM": os.devnull,
                "GIT_AUTHOR_NAME": "Fixture", "GIT_AUTHOR_EMAIL": "fixture@example.invalid",
                "GIT_COMMITTER_NAME": "Fixture", "GIT_COMMITTER_EMAIL": "fixture@example.invalid",
            })

            def run(*args, timeout=180, environment=None):
                result = subprocess.run(
                    list(map(str, args)), cwd=code, env=environment or env, text=True,
                    encoding="utf-8", errors="replace", capture_output=True, timeout=timeout,
                )
                self.assertEqual(result.returncode, 0, f"{args!r}\n{result.stdout}{result.stderr}")
                return result.stdout

            def helper(*args):
                command = (sys.executable, "-B", HELPER, "--config", config, *args)
                preview = json.loads(run(*command))
                return json.loads(run(*command, "--approve", preview["approval"]))

            run("git", "init", "--quiet", "--initial-branch=feature-trim-name")
            run("git", "config", "commit.gpgsign", "false")
            run("git", "config", "core.autocrlf", "false")
            run("git", "config", "core.hooksPath", ".git/fixture-no-hooks")
            run("git", "config", "user.name", "Fixture")
            run("git", "config", "user.email", "fixture@example.invalid")
            (code / "greeting.py").write_text(
                'def greet(name):\n    return "Hello, " + name\n', encoding="utf-8",
            )
            (code / "test_greeting.py").write_text(
                'import unittest\nfrom greeting import greet\n\n'
                'class GreetingTests(unittest.TestCase):\n'
                '    def test_normal_name(self):\n'
                '        self.assertEqual(greet("Ada"), "Hello, Ada")\n',
                encoding="utf-8",
            )
            (code / "REQUEST.md").write_text(
                "Update greeting.greet to strip surrounding whitespace from the supplied name, "
                "preserving existing behavior for ordinary names. Add a regression test for "
                "greet('  Ada  ') == 'Hello, Ada'. No dependencies, no remote operations. "
                "Run python -B -m unittest test_greeting.py. Complete bmad-build-auto using "
                "the configured external artifact paths, including review and a local code commit. "
                "This is an approved unattended task in an isolated disposable checkout. "
                "All fixture implementation, tests, and configured external artifact writes "
                "are approved. Do not change global configuration or files outside this "
                "checkout and its configured external artifact directory.\n", encoding="utf-8",
            )
            # Personal exclusions precede install; no committed ignore rules are needed.
            exclude = code / ".git" / "info" / "exclude"
            with exclude.open("a", encoding="utf-8") as stream:
                stream.write("\n/_bmad/\n/.agents/skills/bmad-*/\n/.github/agents/bmad-*.agent.md\n__pycache__/\n")
            run("git", "add", ".")
            run("git", "commit", "--quiet", "-m", "Initial greeting")
            run(npx, "--yes", "bmad-method@6.12.1", "install", "--yes",
                "--directory", code, "--modules", "bmm", "--tools", "github-copilot",
                "--no-shims", timeout=240)
            helper("configure", "--scope", "defaults", "--set", "artifacts=central",
                   "--set", "exclusions=local", "--set", f"central_root={personal}")
            binding = helper("bind", "--project", code, "--run", "delivery-check")
            self.assertEqual(run("git", "status", "--porcelain").strip(), "")
            prompt = "Explicitly invoke bmad-build-auto for the approved unattended task in REQUEST.md."
            # Let the host resolve its normal environment; fixture Git settings are local.
            host_env = os.environ.copy()
            output = run(*copilot_command, "-C", code, "--trust-folder", "--allow-all-tools",
                         "--add-dir", personal, "--no-ask-user", "-p", prompt, timeout=900,
                         environment=host_env)
            self.assertIn("Ada", output)
            run(sys.executable, "-B", "-m", "unittest", "test_greeting.py")
            value = run(sys.executable, "-B", "-c",
                        "from greeting import greet; assert greet('  Ada  ') == 'Hello, Ada'")
            self.assertEqual(value, "")
            self.assertEqual(run("git", "status", "--porcelain").strip(), "")
            artifacts = Path(binding["paths"]["modules.bmm.implementation_artifacts"])
            specs = list(artifacts.rglob("*.md"))
            self.assertTrue(specs, "No external workflow artifacts were produced")
            self.assertTrue(any("status: done" in p.read_text(encoding="utf-8")
                                or "status: 'done'" in p.read_text(encoding="utf-8")
                                for p in specs), "No terminal done artifact")
            tracked = run("git", "ls-files")
            self.assertNotIn("_bmad", tracked)
            self.assertNotIn("personal", tracked)
