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

    def do_GET(self):
        if self.path == "/" + READSIDE and self.fault:
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
        agents="memory-manager", list_only=False, all_agents=False, expect_success=True
    ):
        env = os.environ.copy()
        env.update(HOME=str(home), USERPROFILE=str(home))
        if shell == "bash":
            command = [self.shells[shell], "--noprofile", "--norc", str(script)]
            args = ["--list"] if list_only else ["--agents", agents, "--yes"]
            if all_agents:
                args = ["--all", "--yes"]
            if readside and not list_only:
                args.append("--with-readside")
            if dry:
                args.append("--dry-run")
        else:
            command = [
                self.shells[shell], "-NoProfile", "-NonInteractive",
                "-ExecutionPolicy", "Bypass", "-File", str(script),
            ]
            args = ["-List"] if list_only else ["-Agents", agents, "-Yes"]
            if all_agents:
                args = ["-All", "-Yes"]
            if readside and not list_only:
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

    def test_all_installs_six_canonical_agents_without_global_opt_in(self):
        expected = {
            "the-nitcracker.agent.md", "pr-walkthrough.agent.md",
            "memory-manager.agent.md", "technical-demo.agent.md",
            "bmad-orchestrator.agent.md", "speckit-flow.agent.md",
        }
        for shell in self.shells:
            with self.subTest(shell=shell):
                home, script = self.prepare(shell)
                self.run_installer(shell, home, script, all_agents=True, readside=False)
                for tool in [".copilot", ".claude"]:
                    self.assertEqual(
                        {p.name for p in (home / tool / "agents").iterdir()}, expected
                    )
                self.assertFalse(any(p.exists() for p in self.instructions(home)))

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
