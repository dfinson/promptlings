"""Offline installer integration tests with isolated homes and real local downloads."""

import functools
import http.server
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import unittest


ROOT = Path(__file__).resolve().parents[1]
READSIDE = "agents/context/memory-manager-read-side.md"
BLOCK = (ROOT / READSIDE).read_text(encoding="utf-8")
LEGACY = (
    "<!-- session-handoff-read-side-start -->\n"
    "Old mandatory file-reading instructions.\n"
    "<!-- session-handoff-read-side-end -->\n"
)
STALE = (
    "<!-- memory-manager-read-side-start -->\n"
    "Outdated memory instructions.\n"
    "<!-- memory-manager-read-side-end -->\n"
)


class FixtureHandler(http.server.SimpleHTTPRequestHandler):
    fault = None
    fault_path = READSIDE

    def do_GET(self):
        if self.path == "/" + self.fault_path and self.fault:
            if self.fault == "http":
                self.send_error(503, "fixture download failure")
                return
            self.send_response(200)
            self.end_headers()
            self.wfile.write(self.fault.encode("utf-8"))
            return
        super().do_GET()

    def log_message(self, *args):
        pass


class InstallerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = http.server.ThreadingHTTPServer(
            ("127.0.0.1", 0), functools.partial(FixtureHandler, directory=str(ROOT))
        )
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_port}"
        cls.shells = {}
        if shutil.which("bash"):
            cls.shells["bash"] = shutil.which("bash")
        ps = shutil.which("pwsh") or shutil.which("powershell")
        if ps:
            cls.shells["powershell"] = ps
        if not cls.shells:
            raise RuntimeError("Bash or PowerShell is required")
        print("Installer shells exercised: " + ", ".join(cls.shells), flush=True)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        FixtureHandler.fault = None
        FixtureHandler.fault_path = READSIDE
        self.temp = tempfile.TemporaryDirectory(prefix="promptlings-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def prepare(self, shell, content=None):
        home = self.root / shell
        home.mkdir()
        for directory in [".copilot", ".claude"]:
            (home / directory / "agents").mkdir(parents=True)
        if content is not None:
            for path in self.instructions(home):
                path.write_bytes(content.encode("utf-8"))
        script_name = "install.sh" if shell == "bash" else "install.ps1"
        source = (ROOT / script_name).read_text(encoding="utf-8")
        if shell == "bash":
            source = source.replace(
                'BASE_URL="https://raw.githubusercontent.com/$REPO/$BRANCH"',
                f'BASE_URL="{self.base_url}"',
            )
        else:
            source = source.replace(
                '$BaseUrl = "https://raw.githubusercontent.com/$Repo/$Branch"',
                f'$BaseUrl = "{self.base_url}"',
            )
        script = home / script_name
        script.write_text(source, encoding="utf-8", newline="\n")
        return home, script

    def instructions(self, home):
        return [
            home / ".copilot" / "copilot-instructions.md",
            home / ".claude" / "CLAUDE.md",
        ]

    def run_installer(
        self, shell, home, script, *, readside=True, dry=False,
        agents="memory-manager", list_only=False, all_agents=False, expect_success=True,
        skills=None, review=False, default_selection=False, list_skills=False,
        copilot_home=None,
    ):
        env = os.environ.copy()
        env.pop("COPILOT_HOME", None)
        env.update(HOME=str(home), USERPROFILE=str(home))
        if copilot_home is not None:
            env["COPILOT_HOME"] = str(copilot_home)
        if shell == "bash":
            command = [self.shells[shell], "--noprofile", "--norc", str(script)]
            args = ["--yes"]
            if agents is not None and not default_selection:
                args += ["--agents", agents]
            if all_agents:
                args = ["--all", "--yes"]
            if review:
                args = ["--review", "--yes"]
            if skills is not None:
                args += ["--skills", skills]
            if list_only or list_skills:
                args = ["--list-skills" if list_skills else "--list"]
            if readside and not (list_only or list_skills):
                args.append("--with-readside")
            if dry:
                args.append("--dry-run")
        else:
            command = [
                self.shells[shell], "-NoProfile", "-NonInteractive",
                "-ExecutionPolicy", "Bypass", "-File", str(script),
            ]
            args = ["-Yes"]
            if agents is not None and not default_selection:
                args += ["-Agents", agents]
            if all_agents:
                args = ["-All", "-Yes"]
            if review:
                args = ["-Review", "-Yes"]
            if skills is not None:
                args += ["-Skills", skills]
            if list_only or list_skills:
                args = ["-ListSkills" if list_skills else "-List"]
            if readside and not (list_only or list_skills):
                args.append("-WithReadSide")
            if dry:
                args.append("-DryRun")
        result = subprocess.run(
            command + args, env=env, stdin=subprocess.DEVNULL,
            capture_output=True, text=True, timeout=60,
        )
        if expect_success:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        return result

    def test_fresh_install_and_idempotent_upgrade(self):
        for shell in self.shells:
            with self.subTest(shell=shell):
                home, script = self.prepare(shell, "Unrelated instructions.\n")
                self.run_installer(shell, home, script)
                before = [path.read_bytes() for path in self.instructions(home)]
                for content in before:
                    self.assertEqual(
                        content.decode(), "Unrelated instructions.\n" + BLOCK
                    )
                expected = (ROOT / "agents/context/memory-manager.agent.md").read_bytes()
                for tool in [".copilot", ".claude"]:
                    self.assertEqual(
                        (home / tool / "agents/memory-manager.agent.md").read_bytes(),
                        expected,
                    )
                self.run_installer(shell, home, script)
                self.assertEqual(before, [p.read_bytes() for p in self.instructions(home)])

    def test_creates_missing_instructions_and_handles_missing_final_newline(self):
        for shell in self.shells:
            for number, original in enumerate([None, "Existing instructions."]):
                with self.subTest(shell=shell, original=original):
                    home, script = self.prepare_case(shell, number, original)
                    self.run_installer(shell, home, script)
                    expected = BLOCK if original is None else original + "\n" + BLOCK
                    for path in self.instructions(home):
                        self.assertEqual(path.read_text(), expected)

    def test_all_installs_eight_canonical_agents_and_six_skills_without_global_opt_in(self):
        expected = {
            "the-nitcracker.agent.md", "pr-walkthrough.agent.md",
            "memory-manager.agent.md", "technical-demo.agent.md",
            "bmad-orchestrator.agent.md", "speckit-flow.agent.md",
            "sparring-partner.agent.md", "artifact-inspector.agent.md",
        }
        for shell in self.shells:
            with self.subTest(shell=shell):
                home, script = self.prepare(shell)
                self.run_installer(shell, home, script, all_agents=True, readside=False)
                for tool in [".copilot", ".claude"]:
                    self.assertEqual(
                        {p.name for p in (home / tool / "agents").iterdir()}, expected
                    )
                    self.assert_skills(home / tool, {
                        "technical-investigation", "test-analysis", "design-analysis",
                        "evidence-verification", "review-ensemble", "artifact-inspection",
                    })
                self.assertFalse(any(p.exists() for p in self.instructions(home)))

    def assert_skills(self, host, expected):
        skill_root = host / "skills"
        self.assertEqual({p.name for p in skill_root.iterdir()}, expected)
        for name in expected:
            source = ROOT / "skills" / name
            installed = skill_root / name
            expected_files = {p.relative_to(source) for p in source.rglob("*")
                              if p.is_file() and "__pycache__" not in p.parts}
            self.assertEqual({p.relative_to(installed) for p in installed.rglob("*")
                              if p.is_file()}, expected_files)
            for relative in expected_files:
                self.assertEqual((installed / relative).read_bytes(),
                                 (source / relative).read_bytes())

    def test_review_and_default_and_skill_selection_install_ensemble_dependencies(self):
        for shell in self.shells:
            for number, selection in enumerate((
                {"review": True}, {"default_selection": True},
                {"agents": None, "skills": " \treview-ensemble,review-ensemble "},
            )):
                with self.subTest(shell=shell, selection=selection):
                    home, script = self.prepare_case(shell, number, "Keep these instructions.\n")
                    before = [p.read_bytes() for p in self.instructions(home)]
                    self.run_installer(shell, home, script, readside=False, **selection)
                    for tool in (".copilot", ".claude"):
                        self.assertEqual({p.name for p in (home / tool / "agents").iterdir()},
                                         {"the-nitcracker.agent.md", "pr-walkthrough.agent.md"})
                        self.assert_skills(home / tool, {"review-ensemble", "evidence-verification"})
                    self.assertEqual(before, [p.read_bytes() for p in self.instructions(home)])

    def test_new_agents_install_exact_companions_at_custom_root(self):
        for shell in self.shells:
            for number, (agent, expected) in enumerate((
                ("sparring-partner", {
                    "technical-investigation", "test-analysis", "design-analysis",
                    "evidence-verification",
                }),
                ("artifact-inspector", {"artifact-inspection"}),
            )):
                with self.subTest(shell=shell, agent=agent):
                    home, script = self.prepare_case(shell, number, LEGACY)
                    custom = home / "custom copilot root"
                    before = [p.read_bytes() for p in self.instructions(home)]
                    plan = self.run_installer(
                        shell, home, script, agents=agent, dry=True,
                        readside=False, copilot_home=custom,
                    )
                    self.assertFalse(custom.exists())
                    for name in expected:
                        self.assertIn(name, plan.stdout)
                    self.run_installer(shell, home, script, agents=f" \t{agent}\t ",
                                       readside=False, copilot_home=custom)
                    for host in (custom, home / ".claude"):
                        self.assertEqual({p.name for p in (host / "agents").iterdir()},
                                         {f"{agent}.agent.md"})
                        self.assert_skills(host, expected)
                    self.assertEqual(before, [p.read_bytes() for p in self.instructions(home)])
                    self.assertFalse(list((home / ".copilot/agents").iterdir()))

    def test_standalone_skill_and_list_do_not_install_unrelated_agents(self):
        for shell in self.shells:
            with self.subTest(shell=shell):
                home, script = self.prepare(shell)
                result = self.run_installer(shell, home, script, list_skills=True)
                self.assertIn("review-ensemble", result.stdout)
                self.assertFalse((home / ".copilot/skills").exists())
                self.run_installer(shell, home, script, agents=None,
                                   skills="technical-investigation", readside=False)
                for tool in (".copilot", ".claude"):
                    self.assertFalse(list((home / tool / "agents").iterdir()))
                    self.assert_skills(home / tool, {"technical-investigation"})

    def test_invalid_skills_fail_before_writing(self):
        for shell in self.shells:
            for number, name in enumerate(("missing", "../outside", ",")):
                with self.subTest(shell=shell, skill=name):
                    home, script = self.prepare_case(shell, number, LEGACY)
                    before = [p.read_bytes() for p in self.instructions(home)]
                    self.run_installer(
                        shell, home, script, agents=None, skills=name, readside=False,
                        expect_success=False,
                    )
                    self.assertFalse((home / ".copilot/skills").exists())
                    self.assertFalse(list((home / ".copilot/agents").iterdir()))
                    self.assertEqual(before, [p.read_bytes() for p in self.instructions(home)])

    def test_failed_skill_download_preserves_existing_content(self):
        for shell in self.shells:
            with self.subTest(shell=shell):
                home, script = self.prepare(shell, LEGACY)
                self.run_installer(shell, home, script, agents="sparring-partner", readside=False)
                installed = home / ".copilot/skills/design-analysis/SKILL.md"
                installed.write_text("Existing customized skill.\n", encoding="utf-8")
                FixtureHandler.fault_path = "skills/design-analysis/SKILL.md"
                FixtureHandler.fault = "http"
                self.run_installer(
                    shell, home, script, agents="sparring-partner", readside=False,
                    expect_success=False,
                )
                self.assertEqual(installed.read_text(), "Existing customized skill.\n")
                self.assertEqual({p.name for p in installed.parent.iterdir()}, {"SKILL.md"})
                FixtureHandler.fault = None

    def test_legacy_and_current_duplicates_replaced_without_losing_other_text(self):
        original = "Before.\n" + LEGACY + "Between.\n" + STALE + "After.\n" + LEGACY
        for shell in self.shells:
            with self.subTest(shell=shell):
                home, script = self.prepare(shell, original)
                self.run_installer(shell, home, script)
                for path in self.instructions(home):
                    self.assertEqual(
                        path.read_text(), "Before.\n" + BLOCK + "Between.\nAfter.\n"
                    )

    def test_crlf_and_unicode_unmanaged_instructions_survive(self):
        original = "Before: caf\u00e9.\r\n" + LEGACY.replace("\n", "\r\n") + "After.\r\n"
        for shell in self.shells:
            with self.subTest(shell=shell):
                home, script = self.prepare(shell, original)
                self.run_installer(shell, home, script)
                for path in self.instructions(home):
                    data = path.read_bytes()
                    self.assertTrue(data.startswith("Before: caf\u00e9.\r\n".encode()))
                    self.assertTrue(data.endswith(b"After.\r\n"))
                    self.assertEqual(data.count(b"memory-manager-read-side-start"), 1)

    def test_opt_out_and_dry_run_do_not_change_instructions(self):
        for shell in self.shells:
            with self.subTest(shell=shell):
                home, script = self.prepare(shell, LEGACY)
                before = [p.read_bytes() for p in self.instructions(home)]
                self.run_installer(shell, home, script, dry=True)
                self.assertFalse((home / ".copilot/agents/memory-manager.agent.md").exists())
                self.assertEqual(before, [p.read_bytes() for p in self.instructions(home)])
                self.run_installer(shell, home, script, readside=False)
                self.assertEqual(before, [p.read_bytes() for p in self.instructions(home)])

    def test_legacy_alias_installs_only_canonical_agent_and_preserves_old_files(self):
        for shell in self.shells:
            with self.subTest(shell=shell):
                home, script = self.prepare(shell)
                old = home / ".copilot/agents/session-handoff.agent.md"
                old.write_text("User's old agent", encoding="utf-8")
                self.run_installer(
                    shell, home, script, agents="session-handoff,memory-manager",
                    readside=False,
                )
                self.assertEqual(old.read_text(), "User's old agent")
                self.assertTrue((home / ".copilot/agents/memory-manager.agent.md").exists())
                self.assertFalse((home / ".claude/agents/session-handoff.agent.md").exists())
                result = self.run_installer(shell, home, script, list_only=True)
                self.assertIn("memory-manager", result.stdout)
                self.assertNotIn("session-handoff", result.stdout)

    def test_malformed_existing_markers_fail_without_rewriting(self):
        cases = [
            "<!-- session-handoff-read-side-start -->\nUnclosed.\n",
            "<!-- memory-manager-read-side-end -->\n",
            "<!-- session-handoff-read-side-start -->\n" + STALE
            + "<!-- session-handoff-read-side-end -->\n",
            "<!-- session-handoff-read-side-start -->\n"
            "<!-- memory-manager-read-side-end -->\n",
        ]
        for shell in self.shells:
            for number, original in enumerate(cases):
                with self.subTest(shell=shell, case=number):
                    # Each invocation gets a separate home.
                    home, script = self.prepare_case(shell, number, original)
                    before = [p.read_bytes() for p in self.instructions(home)]
                    self.run_installer(shell, home, script, expect_success=False)
                    self.assertEqual(before, [p.read_bytes() for p in self.instructions(home)])
                    self.assertFalse(list((home / ".copilot").glob("*.md.*")))

    def prepare_case(self, shell, number, content):
        original_root = self.root
        self.root = original_root / f"case-{number}"
        self.root.mkdir(exist_ok=True)
        try:
            return self.prepare(shell, content)
        finally:
            self.root = original_root

    def test_bad_download_fails_and_preserves_instructions(self):
        for shell in self.shells:
            for number, fault in enumerate([
                "http", " ", "Not a managed block.\n",
                "<!-- memory-manager-read-side-start -->\n" + LEGACY
                + "<!-- memory-manager-read-side-end -->\n",
            ]):
                with self.subTest(shell=shell, fault=fault):
                    home, script = self.prepare_case(shell, number, LEGACY)
                    before = [p.read_bytes() for p in self.instructions(home)]
                    FixtureHandler.fault = fault
                    self.run_installer(shell, home, script, expect_success=False)
                    self.assertEqual(before, [p.read_bytes() for p in self.instructions(home)])

    def test_readside_requires_memory_manager(self):
        for shell in self.shells:
            with self.subTest(shell=shell):
                home, script = self.prepare(shell)
                self.run_installer(shell, home, script, agents="pr-walkthrough",
                                   expect_success=False)
                self.assertFalse(any(p.exists() for p in self.instructions(home)))


if __name__ == "__main__":
    unittest.main(verbosity=2)
