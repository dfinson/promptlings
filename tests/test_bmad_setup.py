"""CLI acceptance tests for personal setup. No real home configuration is touched."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import tomllib
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "bmad_setup.py"


class SetupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="promptlings-bmad-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.code = self.root / "code checkout"
        self.code.mkdir()
        self.config = self.root / "personal" / "bmad.toml"
        self.env = os.environ.copy()
        self.env.update({
            "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_SYSTEM": os.devnull,
            "GIT_AUTHOR_NAME": "Fixture", "GIT_AUTHOR_EMAIL": "fixture@example.invalid",
            "GIT_COMMITTER_NAME": "Fixture", "GIT_COMMITTER_EMAIL": "fixture@example.invalid",
        })
        self.git("init", "--quiet", "--initial-branch=main")
        self.git("config", "commit.gpgsign", "false")
        self.git("config", "core.autocrlf", "false")
        (self.code / "code.txt").write_text("initial\n", encoding="utf-8")
        self.git("add", ".")
        self.git("commit", "--quiet", "-m", "Fixture")
        runtime = self.code / "_bmad"
        for name, text in {
            "_config/manifest.yaml": "installation:\n  version: 6.12.1\n",
            "_config/skill-manifest.csv": "canonicalId\nbmad-build\n",
            "config.toml": '[core]\noutput_folder = "_bmad-output"\n',
            "scripts/render_skill.py": "# fixture, never executed\n",
            "scripts/resolve_config.py": "# fixture, never executed\n",
        }.items():
            path = runtime.joinpath(*name.split("/"))
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")

    def git(self, *args, cwd=None, expected=0):
        result = subprocess.run(
            ["git", "-C", str(cwd or self.code), *args], env=self.env,
            text=True, encoding="utf-8", capture_output=True,
        )
        self.assertEqual(result.returncode, expected, result.stderr)
        return result.stdout.strip()

    def cli(self, *args, error=None):
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--config", str(self.config), *map(str, args)],
            env=self.env, text=True, encoding="utf-8", capture_output=True,
        )
        if error:
            self.assertEqual(result.returncode, 2, result.stdout + result.stderr)
            self.assertIn(error, result.stderr)
            return result
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return json.loads(result.stdout)

    def apply(self, *args):
        preview = self.cli(*args)
        self.assertFalse(preview["applied"])
        applied = self.cli(*args, "--approve", preview["approval"])
        self.assertTrue(applied["applied"])
        return applied

    def defaults(self, *settings):
        args = ["configure", "--scope", "defaults"]
        for value in settings:
            args.extend(["--set", value])
        return self.apply(*args)

    def test_preview_does_not_write_and_approval_is_required(self):
        args = ("configure", "--scope", "defaults", "--set", "exclusions=local")
        self.cli(*args)
        self.assertFalse(self.config.exists())
        self.cli(*args, "--approve", "not-approved", error="stale")
        self.assertFalse(self.config.exists())

    def test_central_default_project_override_and_explicit_run_choice(self):
        central = self.root / "central workspace"
        self.defaults("artifacts=central", "exclusions=local", f"central_root={central}")
        self.apply("configure", "--scope", "project", "--project", self.code,
                   "--set", "planning=project")
        plan = self.apply("bind", "--project", self.code, "--run", "session-1")
        self.assertNotIn("modules.bmm.planning_artifacts", plan["paths"])
        impl = Path(plan["paths"]["modules.bmm.implementation_artifacts"])
        self.assertTrue(impl.is_relative_to(central))
        parsed = tomllib.loads((self.code / "_bmad" / "custom" / "config.user.toml").read_text())
        self.assertEqual(parsed["modules"]["bmm"]["implementation_artifacts"], str(impl))
        self.assertEqual(self.git("status", "--porcelain"), "")
        other = self.cli("status", "--project", self.code, "--run", "session-1",
                         "--planning", "central", error="binding differs")
        self.assertIn("ERROR", other.stderr)

    def test_project_defaults_do_not_redirect_artifacts_or_add_ignores(self):
        plan = self.apply("bind", "--project", self.code)
        self.assertEqual(plan["paths"].keys(), {"configuration"})
        self.assertFalse((self.code / "_bmad" / "custom" / "config.user.toml").exists())
        self.assertNotIn("promptlings-bmad:start", (self.code / ".git" / "info" / "exclude").read_text())

    def test_project_default_with_central_category(self):
        self.defaults(f"central_root={self.root / 'personal artifacts'}")
        plan = self.apply("bind", "--project", self.code, "--run", "session-2",
                          "--implementation", "central", "--exclusions", "local")
        self.assertIn("modules.bmm.implementation_artifacts", plan["paths"])
        self.assertNotIn("core.output_folder", plan["paths"])

    def test_reconfigure_requires_explicit_unbind_and_does_not_move_artifacts(self):
        central = self.root / "central"
        self.defaults("artifacts=central", f"central_root={central}", "exclusions=local")
        plan = self.apply("bind", "--project", self.code, "--run", "first")
        artifact = Path(plan["paths"]["modules.bmm.implementation_artifacts"]) / "spec.md"
        artifact.parent.mkdir(parents=True)
        artifact.write_text("valuable work")
        self.cli("bind", "--project", self.code, "--run", "second", error="binding differs")
        self.apply("unbind", "--project", self.code)
        self.assertEqual(artifact.read_text(), "valuable work")
        self.apply("bind", "--project", self.code, "--run", "second")

    def test_existing_personal_configuration_is_preserved(self):
        path = self.code / "_bmad" / "custom" / "config.user.toml"
        path.parent.mkdir()
        path.write_text('# personal comment\n[core]\nuser_name = "Example"\n')
        self.defaults(f"central_root={self.root / 'central'}")
        self.apply("bind", "--project", self.code, "--run", "x", "--implementation", "central")
        self.assertIn("# personal comment", path.read_text())
        self.assertEqual(tomllib.loads(path.read_text())["core"]["user_name"], "Example")
        self.apply("unbind", "--project", self.code)
        self.assertEqual(path.read_text(), '# personal comment\n[core]\nuser_name = "Example"\n')

    def test_central_binding_preserves_existing_same_tables_and_comments(self):
        path = self.code / "_bmad" / "custom" / "config.user.toml"
        path.parent.mkdir()
        original = ('# keep these comments\n[ "core" ] # quoted header\nuser_name = "Example"\n'
                    '[modules.bmm]\nuser_skill_level = "expert"\n'
                    '[other]\nitems = ["untouched"]\n')
        path.write_text(original)
        self.defaults("artifacts=central", f"central_root={self.root / 'central'}")
        self.apply("bind", "--project", self.code, "--run", "one")
        parsed = tomllib.loads(path.read_text())
        self.assertEqual(parsed["core"]["user_name"], "Example")
        self.assertEqual(parsed["modules"]["bmm"]["user_skill_level"], "expert")
        self.assertIn("planning_artifacts", parsed["modules"]["bmm"])
        self.apply("bind", "--project", self.code, "--run", "one")
        self.apply("unbind", "--project", self.code)
        self.assertEqual(path.read_text(), original)

    def test_unbind_without_binding_has_actionable_error(self):
        self.cli("unbind", "--project", self.code, error="No personal artifact binding")

    def test_conflicting_personal_settings_require_reconciliation(self):
        path = self.code / "_bmad" / "custom" / "config.user.toml"
        path.parent.mkdir()
        path.write_text('[core]\noutput_folder = "team-owned"\n')
        self.defaults("artifacts=central", f"central_root={self.root / 'central'}")
        self.cli("bind", "--project", self.code, "--run", "x", error="conflicts")

    def test_unknown_version_missing_runtime_and_invalid_preferences_fail(self):
        manifest = self.code / "_bmad" / "_config" / "manifest.yaml"
        manifest.write_text("installation:\n  version: 7.0.0\n")
        self.cli("bind", "--project", self.code, error="Unsupported BMAD")
        manifest.unlink()
        self.cli("bind", "--project", self.code, error="Missing checkout-local")
        self.cli("configure", "--scope", "defaults", "--set", "surprise=yes", error="Unknown")
        self.cli("configure", "--scope", "defaults", "--set", "central_root=relative", error="absolute")

    def test_stale_approval_and_concurrent_operation_fail_without_overwrite(self):
        args = ("configure", "--scope", "defaults", "--set", "artifacts=central")
        preview = self.cli(*args)
        self.config.parent.mkdir(parents=True)
        self.config.write_text('schema = 1\n[defaults]\nexclusions = "local"\n')
        self.cli(*args, "--approve", preview["approval"], error="stale")
        lease = self.config.with_name("bmad.toml.lock")
        lease.write_text("")
        preview = self.cli(*args)
        self.cli(*args, "--approve", preview["approval"], error="lease exists")
        self.assertIn('exclusions = "local"', self.config.read_text())

    def test_shared_worktree_preferences_unique_runs_and_excludes(self):
        self.defaults("artifacts=central", "exclusions=local", f"central_root={self.root / 'central'}")
        first = self.apply("bind", "--project", self.code, "--run", "one")
        linked = self.root / "linked"
        self.git("worktree", "add", "--quiet", "-b", "linked", str(linked))
        # Git does not materialize ignored installations in new worktrees.
        self.cli("bind", "--project", linked, "--run", "two", error="Missing checkout-local")
        import shutil
        shutil.copytree(self.code / "_bmad", linked / "_bmad",
                        ignore=shutil.ignore_patterns("custom"))
        second = self.apply("bind", "--project", linked, "--run", "one")
        self.assertEqual(first["project_id"], second["project_id"])
        self.assertNotEqual(first["paths"]["core.output_folder"], second["paths"]["core.output_folder"])
        self.assertEqual(self.git("status", "--porcelain", cwd=linked), "")

    def test_central_requires_unique_run_and_external_location(self):
        self.defaults("artifacts=central", f"central_root={self.root / 'central'}")
        self.cli("bind", "--project", self.code, error="--run")
        self.cli("bind", "--project", self.code, "--run", "../bad", error="--run")
        self.cli("bind", "--project", self.code, "--run", "one",
                 "--central-root", self.code, error="outside")

    def test_tracked_runtime_is_not_hidden(self):
        self.git("add", "_bmad")
        self.cli("bind", "--project", self.code, "--exclusions", "local", error="already tracked")

    def test_global_ignore_preserves_existing_rules_and_requires_configuration(self):
        self.cli("bind", "--project", self.code, "--exclusions", "global",
                 error="existing core.excludesFile")
        ignore = self.root / "global-ignore"
        ignore.write_text("*.personal\n")
        self.git("config", "core.excludesFile", str(ignore))
        self.apply("bind", "--project", self.code, "--exclusions", "global")
        self.assertIn("*.personal\n", ignore.read_text())
        self.assertEqual(self.git("status", "--porcelain"), "")

    def test_isolation_restore_and_conflict_prevent_discovery(self):
        skills = self.root / "host" / "skills"
        for name in ("bmad-build", "unrelated"):
            folder = skills / name
            folder.mkdir(parents=True)
            (folder / "SKILL.md").write_text(f"---\nname: {name}\n---\n")
        inventory = self.code / "_bmad" / "_config" / "skill-manifest.csv"
        original = (skills / "bmad-build" / "SKILL.md").read_bytes()
        self.apply("skills", "isolate", "--skill-root", skills, "--inventory", inventory)
        self.assertFalse((skills / "bmad-build").exists())
        self.assertTrue((skills / "unrelated" / "SKILL.md").exists())
        # A fresh filesystem-based host scan cannot discover the isolated BMAD skill.
        self.assertEqual([p.parent.name for p in skills.glob("*/SKILL.md")], ["unrelated"])
        (skills / "bmad-build").mkdir()
        self.cli("skills", "restore", "--skill-root", skills, error="Restore conflict")
        (skills / "bmad-build").rmdir()
        self.apply("skills", "restore", "--skill-root", skills)
        self.assertEqual((skills / "bmad-build" / "SKILL.md").read_bytes(), original)

    def test_private_artifact_history_does_not_travel_with_code(self):
        self.defaults("artifacts=central", "exclusions=local", f"central_root={self.root / 'central'}")
        plan = self.apply("bind", "--project", self.code, "--run", "one")
        central = self.root / "central"
        central.mkdir()
        self.git("init", "--quiet", "--initial-branch=main", cwd=central)
        self.git("config", "commit.gpgsign", "false", cwd=central)
        artifact = Path(plan["paths"]["core.output_folder"]) / "private.txt"
        artifact.parent.mkdir(parents=True)
        artifact.write_text("private fixture history")
        self.git("add", ".", cwd=central)
        self.git("commit", "--quiet", "-m", "Personal artifacts", cwd=central)
        blob = self.git("hash-object", str(artifact), cwd=central)
        (self.code / "code.txt").write_text("updated\n")
        self.git("add", ".")
        self.git("commit", "--quiet", "-m", "Production change")
        remote = self.root / "destination.git"
        self.git("init", "--bare", "--quiet", str(remote))
        self.git("push", "--quiet", str(remote), "main:main")
        result = subprocess.run(
            ["git", "--git-dir", str(remote), "cat-file", "-e", blob],
            env=self.env, capture_output=True,
        )
        self.assertEqual(result.returncode, 1, result.stderr)


if __name__ == "__main__":
    unittest.main()
