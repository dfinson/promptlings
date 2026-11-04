import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SOURCE = Path(__file__).resolve().parents[2] / "skills" / "spec-delivery" / "scripts" / "gate.py"
SPEC = importlib.util.spec_from_file_location("delivery_gate", SOURCE)
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)


class GateTests(unittest.TestCase):
    def setUp(self):
        artifacts = Path(os.environ.get("SPEC_DELIVERY_ARTIFACTS", "C:\\agent-artifacts\\spec-delivery-tests" if os.name == "nt" else tempfile.gettempdir()))
        artifacts.mkdir(parents=True, exist_ok=True)
        self.temporary = tempfile.TemporaryDirectory(prefix="gate-test-", dir=artifacts)
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / "repo"
        self.root.mkdir()
        self.scratch = Path(self.temporary.name) / "scratch"
        self.git("init", "-b", "main")
        self.git("config", "user.name", "Benchmark")
        self.git("config", "user.email", "benchmark@example.invalid")
        self.write(".gitignore", "__pycache__/\n")
        self.write("value.py", "def value(): return 0\n")
        self.write("test_value.py", "import unittest\nfrom value import value\nclass Value(unittest.TestCase):\n    def test_existing(self): self.assertIsInstance(value(), int)\n")
        self.git("add", ".")
        self.git("commit", "-qm", "base")
        self.base = self.git("rev-parse", "HEAD")
        self.git("switch", "-c", "delivery")
        self.git("switch", "-c", "lane")
        self.write("test_value.py", "import unittest\nfrom value import value\nclass Value(unittest.TestCase):\n    def test_existing(self): self.assertIsInstance(value(), int)\n    def test_changed(self): self.assertEqual(value(), 1)\n")
        self.write("value.py", "def value(): return 1\n")
        self.git("add", ".")
        self.git("commit", "-qm", "lane")

    def git(self, *args):
        result = subprocess.run(["git", *args], cwd=self.root, capture_output=True, text=True, check=True)
        return result.stdout.strip()

    def write(self, name, text):
        (self.root / name).write_text(text, encoding="utf-8")

    def invoke(self, *extra, action="handoff"):
        arguments = [action, "--lane", str(self.root), "--base", self.base,
                     "--path", "value.py", "--path", "test_value.py",
                     "--test-file", "test_value.py", "--scratch", str(self.scratch),
                     "--check", json.dumps([os.sys.executable, "-m", "unittest", "test_value"]), *extra]
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            status = gate.main(arguments)
        return status, json.loads(buffer.getvalue())

    def test_valid_handoff_binds_head_base_and_commands(self):
        status, report = self.invoke()
        self.assertEqual(status, 0, report)
        self.assertEqual(report["head"], self.git("rev-parse", "HEAD"))
        self.assertEqual(report["base"], self.base)
        self.assertTrue(any(e["exit"] != 0 and "AssertionError" in e["stderr"] for e in report["evidence"]))

    def test_recorded_base_must_be_an_ancestor(self):
        self.git("switch", "-c", "wrong-base", self.base)
        self.write("unrelated.txt", "separate history")
        self.git("add", ".")
        self.git("commit", "-qm", "unrelated base")
        wrong_base = self.git("rev-parse", "HEAD")
        self.git("switch", "lane")
        status, report = self.invoke("--base", wrong_base)
        self.assertNotEqual(status, 0)
        self.assertIn("ancestor", report["error"])

    def test_scope_and_rename_old_path_are_checked(self):
        self.git("mv", "value.py", "renamed.py")
        self.git("commit", "-qm", "rename")
        status, report = self.invoke("--path", "renamed.py")
        self.assertNotEqual(status, 0)
        self.assertIn("value.py", report["paths"] if "paths" in report else str(report))
        # A separate exact write set omitting the old path must reject its deletion.
        with self.assertRaises(gate.GateFailure):
            gate.handoff(type("Options", (), {
                "lane": str(self.root), "base": self.base, "path": ["renamed.py", "test_value.py"],
                "test_file": ["test_value.py"], "check": [], "scratch": str(self.scratch), "introduced": [],
            })(), [])

    def test_untracked_files_reject_handoff(self):
        self.write("unexpected.txt", "valuable")
        status, report = self.invoke()
        self.assertNotEqual(status, 0)
        self.assertIn("uncommitted", report["error"])
        self.assertTrue((self.root / "unexpected.txt").exists())

    def test_skip_rejects_successful_command(self):
        self.write("test_value.py", "import unittest\n@unittest.skip('later')\nclass Value(unittest.TestCase):\n    def test_changed(self): self.fail()\n")
        self.git("commit", "-qam", "skipped")
        status, report = self.invoke()
        self.assertNotEqual(status, 0)
        self.assertIn("marker", report["error"])

    def test_passing_on_base_rejects_vacuous_test(self):
        self.write("test_value.py", "import unittest\nclass Value(unittest.TestCase):\n    def test_changed(self): self.assertTrue(True)\n")
        self.git("commit", "-qam", "vacuous")
        status, report = self.invoke()
        self.assertNotEqual(status, 0)
        self.assertIn("passes on base", report["error"])

    def test_unrelated_setup_failure_rejects_head(self):
        self.write("test_value.py", "import nonexistent_unrelated_dependency\n")
        self.git("commit", "-qam", "broken setup")
        status, report = self.invoke()
        self.assertNotEqual(status, 0)
        self.assertTrue(any("ModuleNotFoundError" in e["stderr"] for e in report["evidence"]))

    def test_merge_runs_checks_immediately_and_preserves_failed_revision(self):
        lane = Path(self.temporary.name) / "lane"
        self.git("switch", "delivery")
        self.git("worktree", "add", str(lane), "lane")
        self.addCleanup(lambda: self.git("worktree", "remove", "--force", str(lane)))
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            status = gate.main([
                "merge", "--lane", str(lane), "--base", self.base,
                "--path", "value.py", "--path", "test_value.py",
                "--test-file", "test_value.py", "--scratch", str(self.scratch),
                "--check", json.dumps([os.sys.executable, "-m", "unittest", "test_value"]),
                "--integration", str(self.root),
                "--integration-check", json.dumps([os.sys.executable, "-c", "raise SystemExit(4)"]),
            ])
        report = json.loads(buffer.getvalue())
        self.assertNotEqual(status, 0)
        self.assertEqual(report["integration_head"], self.git("rev-parse", "HEAD"))
        self.assertEqual(self.git("rev-parse", "main"), self.base)
        self.assertEqual(report["evidence"][-1]["exit"], 4)

    def test_main_merge_is_refused(self):
        self.git("switch", "main")
        status, report = self.invoke("--integration", str(self.root), "--integration-check", '["python","-m","unittest","test_value"]', action="merge")
        self.assertNotEqual(status, 0)
        self.assertIn("not main", report["error"])
        self.assertEqual(self.git("rev-parse", "HEAD"), self.base)


class FailureClassificationTests(unittest.TestCase):
    def test_explicit_assertion_is_evidence(self):
        self.assertTrue(gate.intended_failure("AssertionError: 1 != 0\nFAILED (failures=1)", []))

    def test_declared_missing_contract_is_evidence(self):
        self.assertTrue(gate.intended_failure("ImportError: cannot import name 'validate_batch' from 'store'", ["validate_batch"]))

    def test_arbitrary_failure_word_is_not_evidence(self):
        self.assertFalse(gate.intended_failure("FAILED tests\nnot ok 1\nprocess failed", []))

    def test_node_setup_error_is_not_an_assertion(self):
        self.assertFalse(gate.intended_failure("Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'unrelated'\nnot ok 1", []))

    def test_mixed_assertion_and_unrelated_import_is_rejected(self):
        self.assertFalse(gate.intended_failure(
            "AssertionError: 1 != 0\nImportError: cannot import name 'validate_batch'\nModuleNotFoundError: No module named 'unrelated'",
            ["validate_batch"],
        ))

    def test_contract_substring_does_not_authorize_another_name(self):
        self.assertFalse(gate.intended_failure("NameError: name 'validate_batch_unrelated' is not defined", ["validate_batch"]))

    def test_compiler_error_is_not_an_assertion(self):
        self.assertFalse(gate.intended_failure("error TS2307: Cannot find module 'validate_batch'\nFAILED", ["validate_batch"]))


if __name__ == "__main__":
    unittest.main()
