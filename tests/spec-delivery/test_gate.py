import contextlib
import hashlib
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

    def test_record_preserves_complete_evidence_and_returns_check_results(self):
        status, report = self.invoke("--record")
        self.assertEqual(status, 0, report)
        data = Path(report["record"]).read_bytes()
        self.assertEqual(hashlib.sha256(data).hexdigest(), report["record_sha256"])
        complete = json.loads(data)
        self.assertEqual(complete["head"], report["head"])
        self.assertTrue(any(item["argv"][0] == "git" for item in complete["evidence"]))
        self.assertTrue(report["evidence"])
        self.assertTrue(all(item["argv"][0] != "git" for item in report["evidence"]))
        self.assertTrue(any(item["exit"] != 0 for item in report["evidence"]))
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

    def prepare_apply(self, proposal=None):
        self.git("switch", "-c", "critical-apply", self.base)
        self.write("test_value.py", "import unittest\nfrom value import value\nclass Value(unittest.TestCase):\n    def test_existing(self): self.assertIsInstance(value(), int)\n    def test_changed(self): self.assertEqual(value(), 1)\n")
        self.scratch.mkdir()
        payload = self.scratch / "proposal.json"
        payload.write_text(json.dumps(proposal or {"value.py": "def value(): return 1\n"}), encoding="utf-8")
        return ["apply", "--lane", str(self.root), "--base", self.base,
                "--path", "value.py", "--path", "test_value.py",
                "--test-file", "test_value.py", "--scratch", str(self.scratch),
                "--check", json.dumps([os.sys.executable, "-m", "unittest", "test_value"]),
                "--proposal", str(payload), "--message", "Commit critical tests"]

    def apply_report(self, arguments):
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            status = gate.main(arguments)
        return status, json.loads(buffer.getvalue())

    def test_apply_commits_and_proves_red_before_product_write(self):
        status, report = self.apply_report(self.prepare_apply())
        self.assertEqual(status, 0, report)
        self.assertEqual(self.git("show", f"{report['tests_head']}:value.py"), "def value(): return 0")
        self.assertEqual(self.git("show", "--format=", "--name-only", report["tests_head"]), "test_value.py")
        self.assertEqual((self.root / "value.py").read_text(), "def value(): return 1\n")
        commit = next(e for e in report["evidence"] if e["argv"][:2] == ["git", "commit"])
        red = next(e for e in report["evidence"] if e["exit"] != 0)
        self.assertLessEqual(commit["finished_at"], red["started_at"])
        self.assertLessEqual(red["finished_at"], report["applied_at"])

    def test_apply_request_uses_the_same_critical_sequence(self):
        self.prepare_apply()
        request = self.scratch / "request.json"
        request.write_text(json.dumps({
            "lane": str(self.root), "base": self.base,
            "paths": ["value.py", "test_value.py"], "tests": ["test_value.py"],
            "checks": [[os.sys.executable, "-m", "unittest", "test_value"]],
            "files": {"value.py": "def value(): return 1\n"}, "message": "critical tests",
        }), encoding="utf-8")
        status, report = self.apply_report(["apply", "--request", str(request)])
        self.assertEqual(status, 0, report)
        self.assertEqual(self.git("show", f"{report['tests_head']}:value.py"), "def value(): return 0")
        self.assertEqual((self.root / "value.py").read_text(), "def value(): return 1\n")

    def test_apply_request_rejects_bad_schema_without_product_edits(self):
        self.prepare_apply()
        request = self.scratch / "request.json"
        for data in [{}, {"base": 3}, ["not an object"]]:
            request.write_text(json.dumps(data), encoding="utf-8")
            status, report = self.apply_report(["apply", "--request", str(request)])
            self.assertNotEqual(status, 0, report)
            self.assertEqual((self.root / "value.py").read_text(), "def value(): return 0\n")

    def test_apply_rejects_product_edits_before_test_commit(self):
        arguments = self.prepare_apply()
        self.write("value.py", "def value(): return 2\n")
        before = self.git("rev-parse", "HEAD")
        status, report = self.apply_report(arguments)
        self.assertNotEqual(status, 0, report)
        self.assertEqual(self.git("rev-parse", "HEAD"), before)
        self.assertEqual((self.root / "value.py").read_text(), "def value(): return 2\n")

    def test_apply_does_not_write_after_vacuous_or_setup_failure(self):
        arguments = self.prepare_apply()
        for content in [
            "import unittest\nclass Test(unittest.TestCase):\n    def test_vacuous(self): self.assertTrue(True)\n",
            "import nonexistent_unrelated_dependency\n",
        ]:
            self.write("test_value.py", content)
            status, report = self.apply_report(arguments)
            self.assertNotEqual(status, 0, report)
            self.assertEqual((self.root / "value.py").read_text(), "def value(): return 0\n")

    def test_apply_rejects_out_of_scope_proposal_before_commit(self):
        arguments = self.prepare_apply({"unapproved.py": "valuable = False\n"})
        before = self.git("rev-parse", "HEAD")
        status, report = self.apply_report(arguments)
        self.assertNotEqual(status, 0, report)
        self.assertEqual(self.git("rev-parse", "HEAD"), before)
        self.assertFalse((self.root / "unapproved.py").exists())

    def test_apply_refuses_to_change_critical_test_assertions(self):
        arguments = self.prepare_apply({"test_value.py": "import unittest\n"})
        status, report = self.apply_report(arguments)
        self.assertNotEqual(status, 0, report)
        self.assertIn("product file", report["error"])

    def test_apply_checks_markers_in_new_untracked_tests_before_commit(self):
        arguments = self.prepare_apply()
        self.write("new_test.py", "import unittest\n@unittest.skip('later')\nclass Test(unittest.TestCase):\n    def test_omitted(self): self.fail()\n")
        arguments += ["--path", "new_test.py", "--test-file", "new_test.py"]
        before = self.git("rev-parse", "HEAD")
        status, report = self.apply_report(arguments)
        self.assertNotEqual(status, 0, report)
        self.assertIn("marker", report["error"])
        self.assertEqual(self.git("rev-parse", "HEAD"), before)

    def test_apply_rejects_product_mutation_by_the_red_test(self):
        arguments = self.prepare_apply()
        self.write("test_value.py", "import unittest\nfrom pathlib import Path\nclass Test(unittest.TestCase):\n    def test_mutation(self):\n        Path('value.py').write_text('unexpected = True\\n')\n        self.fail('not legitimate proof')\n")
        status, report = self.apply_report(arguments)
        self.assertNotEqual(status, 0, report)
        self.assertIn("changed", report["error"])
        self.assertEqual((self.root / "value.py").read_text(), "unexpected = True\n")


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
