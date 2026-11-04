import configparser
import os
from pathlib import Path
import plistlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class MemoryStartupTests(unittest.TestCase):
    def test_windows_task_priority(self):
        source = (ROOT / "install.ps1").read_text(encoding="utf-8")
        command = re.search(r"(?m)^\s*\$settings = (New-ScheduledTaskSettingsSet .+)$", source)
        self.assertIsNotNone(command)
        self.assertRegex(command[1], r"-Priority 4(?:\s|$)")
        if sys.platform == "win32":
            result = subprocess.run(
                [
                    "powershell.exe", "-NoProfile", "-NonInteractive", "-Command",
                    "$ErrorActionPreference = 'Stop'; "
                    f"$settings = {command[1]}; "
                    "if ($settings.Priority -ne 4) { throw 'Expected task priority 4' }; "
                    "if ($settings.MultipleInstances -ne 'IgnoreNew') { throw 'Expected IgnoreNew' }; "
                    "if ($settings.ExecutionTimeLimit -ne 'PT0S') { throw 'Expected no execution limit' }",
                ],
                capture_output=True, text=True, timeout=30,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def render_service(self, directory, platform, custom_config=False):
        source = (ROOT / "install.sh").read_text(encoding="utf-8")
        block = source.rsplit('\nif [ -n "$memory_command" ] && [ "$startup" -eq 1 ]; then\n', 1)[1]
        block = block.split("  request=", 1)[0]
        bash = shutil.which("bash")
        if sys.platform == "win32":
            git_bash = Path(os.environ["ProgramFiles"]) / "Git" / "bin" / "bash.exe"
            if git_bash.exists():
                bash = str(git_bash)
        self.assertIsNotNone(bash, "Bash is required to exercise installer service generation")
        script = """
set -euo pipefail
export HOME="$(pwd)"
unset XDG_CONFIG_HOME
memory_command="$HOME/memory bin/basic-memory"
memory_port=8123
launchctl() { printf '%s\\n' "$*" >> "$HOME/commands.log"; }
systemctl() { printf '%s\\n' "$*" >> "$HOME/commands.log"; }
fail() { printf '%s\\n' "$*" >&2; exit 1; }
"""
        script += f"os={platform}\n"
        if custom_config:
            script += 'export XDG_CONFIG_HOME="$HOME/custom-config"\n'
        result = subprocess.run(
            [bash, "-c", script + block],
            cwd=directory, capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_macos_launch_agent(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            self.render_service(directory, "Darwin")
            path = directory / "Library" / "LaunchAgents" / "com.promptlings.basic-memory.plist"
            with path.open("rb") as stream:
                plist = plistlib.load(stream)
            self.assertEqual(plist["ProcessType"], "Interactive")
            self.assertEqual(plist["Label"], "com.promptlings.basic-memory")
            self.assertEqual(Path(plist["ProgramArguments"][0]).name, "basic-memory")
            self.assertIn("memory bin", plist["ProgramArguments"][0])
            self.assertEqual(plist["ProgramArguments"][1:], [
                "mcp", "--transport", "streamable-http",
                "--host", "127.0.0.1", "--port", "8123",
            ])
            self.assertIs(plist["RunAtLoad"], True)
            self.assertEqual(plist["KeepAlive"], {"SuccessfulExit": False})
            self.assertEqual(plist["StandardOutPath"], plist["StandardErrorPath"])
            self.assertIn("bootstrap gui/", (directory / "commands.log").read_text())
            if sys.platform == "darwin":
                result = subprocess.run(
                    ["plutil", "-lint", str(path)], capture_output=True, text=True, timeout=30,
                )
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_linux_user_service(self):
        for custom_config in (False, True):
            with self.subTest(custom_config=custom_config), tempfile.TemporaryDirectory() as temporary:
                directory = Path(temporary)
                self.render_service(directory, "Linux", custom_config)
                config_home = directory / ("custom-config" if custom_config else ".config")
                path = config_home / "systemd" / "user" / "promptlings-memory.service"
                unit = configparser.ConfigParser(interpolation=None)
                unit.read(path)
                self.assertEqual(unit["Service"]["Nice"], "0")
                self.assertEqual(unit["Service"]["CPUSchedulingPolicy"], "other")
                self.assertEqual(unit["Service"]["IOSchedulingClass"], "best-effort")
                self.assertEqual(unit["Service"]["IOSchedulingPriority"], "4")
                command = unit["Service"]["ExecStart"]
                self.assertIn('/memory bin/basic-memory" mcp ', command)
                self.assertTrue(command.endswith(
                    "--transport streamable-http --host 127.0.0.1 --port 8123"
                ))
                self.assertEqual(unit["Service"]["Restart"], "on-failure")
                self.assertEqual(unit["Install"]["WantedBy"], "default.target")
                self.assertEqual((directory / "commands.log").read_text().splitlines(), [
                    "--user daemon-reload",
                    "--user enable promptlings-memory.service",
                    "--user restart promptlings-memory.service",
                    "--user is-active --quiet promptlings-memory.service",
                ])
                if sys.platform == "linux":
                    executable = directory / "memory bin" / "basic-memory"
                    executable.parent.mkdir()
                    executable.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
                    executable.chmod(0o755)
                    result = subprocess.run(
                        ["systemd-analyze", "--user", "verify", str(path)],
                        capture_output=True, text=True, timeout=30,
                    )
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
