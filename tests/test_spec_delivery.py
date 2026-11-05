import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / "skills" / "spec-delivery" / "scripts" / "gate.py"
SPEC = importlib.util.spec_from_file_location("spec_delivery_gate", HELPER)
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)


class HandoffTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="spec-delivery-test-")
        self.addCleanup(self.temporary.cleanup)
        directory = Path(self.temporary.name)
        self.root = directory / "lane"
        self.scratch = directory / "evidence"
        self.root.mkdir()
        self.scratch.mkdir()
        self.environment = {
            **os.environ,
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_AUTHOR_NAME": "Fixture",
            "GIT_AUTHOR_EMAIL": "fixture@example.invalid",
            "GIT_COMMITTER_NAME": "Fixture",
            "GIT_COMMITTER_EMAIL": "fixture@example.invalid",
        }
        self.patch_environment = mock.patch.dict(os.environ, self.environment)
        self.patch_environment.start()
        self.addCleanup(self.patch_environment.stop)
        self.git("init", "--quiet", "--initial-branch=main", "--template=")
        self.git("config", "core.autocrlf", "false")
        self.write("value.txt", "old\n")
        self.base = self.commit("value.txt")
        self.git("switch", "--quiet", "-c", "lane")

    def git(self, *args):
        result = subprocess.run(
            ["git", *args], cwd=self.root, env=self.environment,
            capture_output=True, text=True, encoding="utf-8", check=True,
        )
        return result.stdout.strip()

    def write(self, path, content):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    def commit(self, *paths):
        if paths:
            self.git("add", "--", *paths)
        self.git("-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "fixture")
        return self.git("rev-parse", "HEAD")

    def implement(self, extra_check=""):
        self.write("value.txt", "new\n")
        self.write(
            "checks.py",
            "from pathlib import Path\n"
            "assert Path('value.txt').read_text(encoding='utf-8') == 'new\\n'\n"
            + extra_check,
        )
        return self.commit("value.txt", "checks.py")

    def options(self, **overrides):
        values = {
            "lane": str(self.root),
            "base": self.base,
            "target": self.base,
            "head": self.git("rev-parse", "HEAD"),
            "path": ["value.txt", "checks.py"],
            "test_file": ["checks.py"],
            "check": [json.dumps([sys.executable, "checks.py"])],
            "introduced": [],
            "scratch": str(self.scratch),
        }
        return SimpleNamespace(**(values | overrides))

    def test_scoped_pr_needs_no_spec_commit_or_local_merge(self):
        head = self.implement()
        branches = self.git("for-each-ref", "--format=%(refname) %(objectname)")
        report = gate.handoff(self.options(), [])
        self.assertEqual(report["base"], self.base)
        self.assertEqual(report["head"], head)
        self.assertEqual(report["target"], self.base)
        self.assertEqual(report["review_base"], self.base)
        self.assertEqual(report["review_paths"], ["checks.py", "value.txt"])
        self.assertEqual(branches, self.git("for-each-ref", "--format=%(refname) %(objectname)"))
        self.assertEqual(self.git("status", "--porcelain"), "")
        self.assertEqual(list(self.scratch.iterdir()), [])

    def test_lane_delta_cannot_hide_peer_changes_in_pr(self):
        self.write("peer.txt", "another lane\n")
        cumulative_base = self.commit("peer.txt")
        self.implement()
        with self.assertRaisesRegex(gate.GateFailure, "PR diff.*peer.txt"):
            gate.handoff(self.options(base=cumulative_base), [])

    def test_planning_artifact_in_ancestry_is_rejected(self):
        self.write("specs/feature.md", "unapproved repository artifact\n")
        cumulative_base = self.commit("specs/feature.md")
        self.implement()
        with self.assertRaisesRegex(gate.GateFailure, "PR diff.*specs/feature.md"):
            gate.handoff(self.options(base=cumulative_base), [])

    def test_explicitly_authorized_documentation_can_be_in_pr_scope(self):
        self.write("docs/feature.md", "authorized product documentation\n")
        documented_base = self.commit("docs/feature.md")
        self.implement()
        report = gate.handoff(self.options(
            base=documented_base, path=["value.txt", "checks.py", "docs/feature.md"],
        ), [])
        self.assertIn("docs/feature.md", report["review_paths"])

    def test_stack_excludes_only_its_declared_producer(self):
        self.write("producer.txt", "required contract\n")
        producer = self.commit("producer.txt")
        self.implement()
        report = gate.handoff(self.options(base=producer, target=producer), [])
        self.assertEqual(report["target"], producer)
        self.assertEqual(report["review_paths"], ["checks.py", "value.txt"])
        with self.assertRaisesRegex(gate.GateFailure, "PR diff.*producer.txt"):
            gate.handoff(self.options(base=producer), [])

    def test_target_advance_uses_merge_base_for_review_diff(self):
        head = self.implement()
        self.git("switch", "--quiet", "main")
        self.write("target-only.txt", "merged elsewhere\n")
        target = self.commit("target-only.txt")
        self.git("switch", "--quiet", "lane")
        report = gate.handoff(self.options(target=target), [])
        self.assertEqual(report["head"], head)
        self.assertEqual(report["target"], target)
        self.assertEqual(report["review_base"], self.base)
        self.assertEqual(report["review_paths"], ["checks.py", "value.txt"])

    def test_wrong_pr_head_is_rejected(self):
        self.implement()
        with self.assertRaisesRegex(gate.GateFailure, "PR head"):
            gate.handoff(self.options(head=self.base), [])

    def test_empty_pr_is_rejected_even_when_lane_has_changes(self):
        head = self.implement()
        with self.assertRaisesRegex(gate.GateFailure, "PR diff is empty"):
            gate.handoff(self.options(target=head), [])

    def test_lane_scope_is_checked_even_when_target_contains_peer(self):
        self.write("peer.txt", "another lane\n")
        target = self.commit("peer.txt")
        self.implement()
        with self.assertRaisesRegex(gate.GateFailure, "Paths outside approved scope.*peer.txt"):
            gate.handoff(self.options(target=target), [])

    def test_deletion_in_pr_diff_cannot_hide_behind_lane_base(self):
        self.git("switch", "--quiet", "main")
        self.write("keep.txt", "existing product\n")
        target = self.commit("keep.txt")
        self.git("switch", "--quiet", "lane")
        self.git("merge", "--quiet", "--ff-only", target)
        self.git("rm", "--quiet", "--", "keep.txt")
        cumulative_base = self.commit()
        self.implement()
        with self.assertRaisesRegex(gate.GateFailure, "PR diff.*keep.txt"):
            gate.handoff(self.options(base=cumulative_base, target=target), [])

    def test_checks_cannot_leave_untracked_files(self):
        self.implement("Path('unexpected.txt').write_text('side effect')\n")
        with self.assertRaisesRegex(gate.GateFailure, "checks changed"):
            gate.handoff(self.options(), [])

    def test_checks_cannot_advance_lane_head(self):
        self.implement(
            "import subprocess\n"
            "subprocess.run(['git', 'commit', '--quiet', '--allow-empty', "
            "'-m', 'unexpected revision'], check=True)\n"
        )
        with self.assertRaisesRegex(gate.GateFailure, "checks changed"):
            gate.handoff(self.options(), [])

    def test_handoff_records_revisions_via_cli(self):
        head = self.implement()
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            exit_code = gate.main([
                "handoff", "--lane", str(self.root), "--base", self.base,
                "--target", self.base, "--head", head,
                "--path", "value.txt", "--path", "checks.py",
                "--test-file", "checks.py",
                "--check", json.dumps([sys.executable, "checks.py"]),
                "--scratch", str(self.scratch), "--record",
            ])
        self.assertEqual(exit_code, 0, output.getvalue())
        report = json.loads(output.getvalue())
        saved = json.loads(Path(report["record"]).read_text(encoding="utf-8"))
        self.assertEqual(saved["target"], self.base)
        self.assertEqual(saved["head"], head)
        self.assertEqual(saved["status"], "verified")

    def test_handoff_requires_target_and_head(self):
        self.implement()
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            exit_code = gate.main([
                "handoff", "--lane", str(self.root), "--base", self.base,
                "--path", "value.txt", "--path", "checks.py",
                "--test-file", "checks.py",
                "--check", json.dumps([sys.executable, "checks.py"]),
                "--scratch", str(self.scratch),
            ])
        self.assertEqual(exit_code, 1)
        self.assertIn("target and head", json.loads(output.getvalue())["error"])

    def test_local_merge_action_is_not_available(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as result:
            gate.main(["merge"])
        self.assertEqual(result.exception.code, 2)

    def test_critical_apply_still_commits_red_tests_before_product(self):
        self.write(
            "checks.py",
            "from pathlib import Path\n"
            "assert Path('value.txt').read_text(encoding='utf-8') == 'new\\n'\n",
        )
        request = self.scratch / "request.json"
        request.write_text(json.dumps({
            "lane": str(self.root), "base": self.base,
            "paths": ["value.txt", "checks.py"], "tests": ["checks.py"],
            "checks": [[sys.executable, "checks.py"]],
            "files": {"value.txt": "new\n"}, "message": "critical tests",
        }), encoding="utf-8")
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            exit_code = gate.main(["apply", "--request", str(request)])
        self.assertEqual(exit_code, 0, output.getvalue())
        report = json.loads(output.getvalue())
        self.assertEqual(self.git("show", f"{report['tests_head']}:value.txt"), "old")
        self.assertEqual((self.root / "value.txt").read_text(encoding="utf-8"), "new\n")
        self.assertEqual(self.git("status", "--porcelain"), "M value.txt")
        self.commit("value.txt")
        handoff = gate.handoff(self.options(), [])
        self.assertEqual(handoff["target"], self.base)


class ContractTests(unittest.TestCase):
    def read(self, relative):
        return (ROOT / relative).read_text(encoding="utf-8")

    def test_templates_do_not_require_repository_specs_or_approval_commits(self):
        for name in ["spec-template.md", "execution-plan-template.md", "lane-brief-template.md"]:
            with self.subTest(template=name):
                text = self.read(f"skills/spec-delivery/references/{name}")
                self.assertNotIn("specs/<slug>", text)
                self.assertNotIn("<approval-sha>", text)
                self.assertNotIn("same commit", text)
                self.assertIn("SHA-256", text)

    def test_concurrency_and_pr_boundaries_are_in_the_loaded_contract(self):
        text = self.read("skills/spec-delivery/SKILL.md")
        for requirement in [
            "Maximize safe concurrency",
            "Start every ready independent lane before waiting",
            "including on an unmerged PR",
            "Never use an accumulating local integration branch",
            "--target <actual-target-sha>",
            "--head <actual-pr-head-sha>",
            "Approval of\ncontent does not authorize",
        ]:
            self.assertIn(requirement, text)
        self.assertNotIn("gate.py merge", text)
        agent = self.read("agents/orchestration/spec-master.agent.md")
        self.assertIn("PRs are the default review", agent)
        self.assertIn("explicit\nauthorization", agent)


if __name__ == "__main__":
    unittest.main()
