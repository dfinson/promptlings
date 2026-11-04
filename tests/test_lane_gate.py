import contextlib
import importlib.util
import io
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

GATE = Path(__file__).resolve().parents[1] / "skills" / "lane-delivery" / "scripts" / "gate.py"
spec_loader = importlib.util.spec_from_file_location("gate", GATE)
gate = importlib.util.module_from_spec(spec_loader)
spec_loader.loader.exec_module(gate)

CRITERIA = """\
## What

| ID | Criterion | Method | Owner |
| --- | --- | --- | --- |
{rows}
"""
LANES = """\
## Lane graph

| Lane | Functionality | Write set | Contracts changed | Contracts used | Depends on | Criteria owned | Risky |
| --- | --- | --- | --- | --- | --- | --- | --- |
{rows}
"""
RISKS = """\
## Concurrency risks

| Lanes | Coupling evidence | Decision | Recovery |
| --- | --- | --- | --- |
{rows}
"""


def run(*argv):
    out = io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
        code = gate.main([str(a) for a in argv])
    return code, out.getvalue()


def write_spec(path, criteria, lanes, risks=""):
    text = "# Spec\n\n## Why\n\nReason.\n\n" + CRITERIA.format(rows=criteria) + "\n" + LANES.format(rows=lanes)
    if risks:
        text += "\n" + RISKS.format(rows=risks)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text + "\n## Out of scope\n\nNothing.\n", encoding="utf-8")
    return path


class SpecLintTests(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.criteria = ("| AC-1 | A | `true` | L1 |\n| AC-2 | B | `true` | L2 |\n"
                         "| AC-3 | C | `human` | integration |")

    def lint(self, criteria, lanes, risks="", *flags):
        return run("spec-lint", write_spec(self.dir / "s.md", criteria, lanes, risks), *flags)

    def test_valid_spec_passes(self):
        code, out = self.lint(self.criteria,
                              "| L1 | a | `src/a/**` | `make(x)` | none | none | `AC-1` | no |\n"
                              "| L2 | b | `src/b/**` | none | `make(x)` | L1 | `AC-2` | no |")
        self.assertEqual(code, 0, out)

    def test_incomplete_criteria_and_lanes_fail(self):
        code, out = self.lint("| AC-1 | A | the agent checks it | L1 |\n| AC-1 | B | `true` | L9 |",
                              "| L1 | a | `src/a/**` | none | none | L7 | `AC-1` | no |\n"
                              "| L2 | b | `src/b/**` | none | none | none | none | no |")
        self.assertEqual(code, 1)
        for text in ("AC-1: method", "unique", "owner 'L9'", "L2: owns no", "unknown lane 'L7'"):
            self.assertIn(text, out)

    def test_cycle_fails(self):
        code, out = self.lint("| AC-1 | A | `true` | L1 |\n| AC-2 | B | `true` | L2 |",
                              "| L1 | a | `a/**` | none | none | L2 | `AC-1` | no |\n"
                              "| L2 | b | `b/**` | none | none | L1 | `AC-2` | no |")
        self.assertEqual(code, 1)
        self.assertIn("dependency cycle", out)

    def test_coupled_concurrent_lanes_need_a_risk_row(self):
        lanes = ("| L1 | a | `src/a/**`, `db/migrations/0002.sql` | `make(x)` | none | none | `AC-1` | no |\n"
                 "| L2 | b | `src/b/**`, `db/migrations/0003.sql` | none | `make(x)` | none | `AC-2` | no |")
        code, out = self.lint(self.criteria, lanes)
        self.assertEqual(code, 1)
        self.assertIn("shared contract, shared hotspot", out)
        code, out = self.lint(self.criteria, lanes, "| L1, L2 | migration and make() | accept | rebase, rerun G1 and G2 |")
        self.assertEqual(code, 0, out)
        code, out = self.lint(self.criteria, lanes, "| L1, L2 | make() | accept | none |")
        self.assertIn("needs a recovery", out)
        code, out = self.lint(self.criteria, lanes, "| L1, L2 | make() | edge | none |")
        self.assertIn("no dependency path", out)

    def test_overlapping_write_sets_and_manual_flags(self):
        code, out = self.lint(self.criteria, "| L1 | a | `src/**` | none | none | none | `AC-1` | no |\n"
                                             "| L2 | b | `src/b.py` | none | none | none | `AC-2` | no |")
        self.assertIn("overlapping write sets", out)
        code, out = self.lint(self.criteria, "| L1 | a | `src/a.py` | none | none | none | `AC-1` | no |\n"
                                             "| L2 | b | `src/b.py` | none | none | none | `AC-2` | no |",
                              "", "--flag", "L1,L2")
        self.assertIn("coupling check", out)


class LaneGateTests(unittest.TestCase):
    def git(self, *args):
        subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@t", *args], cwd=self.repo,
                       check=True, capture_output=True)

    def write(self, path, text):
        target = self.repo / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(textwrap.dedent(text), encoding="utf-8")

    def setUp(self):
        self.repo = Path(tempfile.mkdtemp())
        self.git("init", "-q", "-b", "main")
        command = f'"{sys.executable}" -m unittest discover -s tests -p test_calc.py'
        self.spec = write_spec(self.repo / "specs" / "s.md", f"| AC-1 | mul works | `{command}` | L1 |",
                               "| L1 | mul | `src/calc.py`, `tests/test_calc.py` | `mul(a, b)` | none | none | `AC-1` | no |")
        self.write(".gitignore", "__pycache__/\n")
        self.write("src/calc.py", "def add(a, b):\n    return a + b\n")
        self.write("tests/test_existing.py", """\
            import sys, unittest
            sys.path.insert(0, "src")
            import calc
            class T(unittest.TestCase):
                def test_add(self):
                    self.assertEqual(calc.add(1, 2), 3)
            """)
        self.write("README.md", "readme\n")
        self.git("add", "-A")
        self.git("commit", "-qm", "base")
        self.git("checkout", "-qb", "lane")

    def tearDown(self):
        subprocess.run(["git", "worktree", "prune"], cwd=self.repo, capture_output=True)

    def implement(self, test_body="self.assertEqual(calc.mul(2, 3), 6)", add_signature="def add(a, b):"):
        self.write("src/calc.py", f"{add_signature}\n    return a + b\n\ndef mul(a, b):\n    return a * b\n")
        self.write("tests/test_calc.py", f"""\
            import sys, unittest
            sys.path.insert(0, "src")
            import calc
            class T(unittest.TestCase):
                def test_ac_1_mul(self):
                    {test_body}
            """)

    def commit_and_gate(self):
        self.git("add", "-A")
        self.git("commit", "-qm", "L1: work")
        return run("lane-gate", self.spec, "--lane", "L1", "--base", "main", "--repo", self.repo)

    def test_lane_inside_its_write_set_passes(self):
        self.implement()
        code, out = self.commit_and_gate()
        self.assertEqual(code, 0, out)
        self.assertIn("PASS AC-1 with new tests on base", out)
        self.assertNotIn("RECHECK", out)

    def test_file_outside_write_set_fails(self):
        self.implement()
        self.write("README.md", "changed\n")
        self.write("tests/test_existing.py", "")
        code, out = self.commit_and_gate()
        self.assertEqual(code, 1)
        self.assertIn("a file outside its write set: README.md", out)
        self.assertIn("a test file outside its write set: tests/test_existing.py", out)

    def test_spec_edit_fails(self):
        self.implement()
        self.spec.write_text(self.spec.read_text(encoding="utf-8") + "\nedit\n", encoding="utf-8")
        code, out = self.commit_and_gate()
        self.assertEqual(code, 1)
        self.assertIn("the spec outside its write set", out)

    def test_skip_marker_fails(self):
        self.implement(test_body="self.assertEqual(calc.mul(2, 3), 6)\n\n    @unittest.skip('later')\n    def test_other(self):\n        pass")
        code, out = self.commit_and_gate()
        self.assertEqual(code, 1)
        self.assertIn("Skip, xfail or focus marker", out)

    def test_vacuous_test_fails_on_base_check(self):
        self.implement(test_body="self.assertTrue(True)")
        code, out = self.commit_and_gate()
        self.assertEqual(code, 1)
        self.assertIn("FAIL AC-1 with new tests on base", out)

    def test_failing_criterion_fails(self):
        self.implement(test_body="self.assertEqual(calc.mul(2, 3), 7)")
        code, out = self.commit_and_gate()
        self.assertEqual(code, 1)
        self.assertIn("FAIL AC-1 on head", out)

    def test_undeclared_contract_change_is_reported_not_failed(self):
        self.implement(add_signature="def add(a, b, c=0):")
        code, out = self.commit_and_gate()
        self.assertEqual(code, 0, out)
        self.assertIn("NOTE RECHECK L1 changed undeclared contracts: add", out)

    def test_uncommitted_changes_fail(self):
        self.implement()
        self.git("add", "-A")
        self.git("commit", "-qm", "L1: work")
        self.write("src/calc.py", "broken\n")
        code, out = run("lane-gate", self.spec, "--lane", "L1", "--base", "main", "--repo", self.repo)
        self.assertEqual(code, 1)
        self.assertIn("no uncommitted or untracked changes", out)

    def test_run_criteria_prints_table(self):
        self.implement()
        self.git("add", "-A")
        self.git("commit", "-qm", "L1: work")
        code, out = run("run-criteria", self.spec, "--repo", self.repo)
        self.assertEqual(code, 0, out)
        self.assertIn("| AC-1 | L1 | verified |", out)


if __name__ == "__main__":
    unittest.main()
