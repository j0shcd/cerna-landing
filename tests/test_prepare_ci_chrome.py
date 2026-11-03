"""Rehearse signed apt setup without downloads, root access or host changes."""
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
import os
import subprocess
import sys
from tempfile import TemporaryDirectory, gettempdir
from types import SimpleNamespace
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/prepare_ci_chrome.py"
spec = spec_from_file_location("prepare_ci_chrome", SCRIPT)
chrome = module_from_spec(spec)
spec.loader.exec_module(chrome)
TEMP_ROOT = str(Path(gettempdir()).resolve())
PUBLIC_KEY = "-----BEGIN PGP PUBLIC KEY BLOCK-----\n\nFAKE_TEST_KEY\n-----END PGP PUBLIC KEY BLOCK-----\n"


class Rehearsal:
    def __init__(self, fail=None):
        self.calls = []
        self.fail = fail
        self.candidate = "156.0.8078.47"

    def run(self, args, **kwargs):
        self.calls.append(args)
        if self.fail and self.fail in args:
            raise subprocess.CalledProcessError(1, args)
        if args[0] == "gpg" and "--export" in args:
            self.assert_fingerprint(args[-1])
            return SimpleNamespace(stdout=PUBLIC_KEY)
        if args[:2] == ["sudo", "apt-get"]:
            # Model the hosted image: its existing sources cannot update Chrome.
            sources = [arg.split("=", 1)[1] for arg in args if arg.startswith("Dir::Etc::sourcelist=")]
            if sources:
                text = Path(sources[0]).read_text()
                assert "URIs: https://dl.google.com/linux/chrome/deb/\n" in text
                assert "Signed-By:\n -----BEGIN PGP PUBLIC KEY BLOCK-----\n .\n FAKE_TEST_KEY" in text
                assert "Dir::Etc::sourceparts=-" in args
                self.candidate = "156.0.8078.79"
            if "install" in args:
                assert self.candidate == "156.0.8078.79", "Chrome remains stale without its authenticated repository"
        return SimpleNamespace(stdout="")

    @staticmethod
    def assert_fingerprint(value):
        assert value == "EB4C1BFD4F042F6DDDCCEC917721F63BD38B4796"


class PrepareChromeTests(unittest.TestCase):
    def test_missing_runner_repository_is_repaired_without_changing_foreign_files(self):
        with TemporaryDirectory(dir=TEMP_ROOT) as root:
            base = Path(root)
            foreign = base / "existing.sources"
            foreign.write_text("owner configuration")
            probe = Rehearsal()
            chrome.prepare(base, run=probe.run, download=lambda: b"downloaded key")
            self.assertEqual(probe.candidate, "156.0.8078.79")
            self.assertEqual(foreign.read_text(), "owner configuration")
            self.assertEqual(list(base.iterdir()), [foreign])
            self.assertEqual(probe.calls[-1], ["google-chrome", "--version"])

    def test_shell_metacharacters_and_spaces_are_not_executed(self):
        with TemporaryDirectory(dir=TEMP_ROOT) as root:
            base = Path(root) / 'with spaces $(touch marker) `touch other`'
            base.mkdir()
            chrome.prepare(base, run=Rehearsal().run, download=lambda: b"key")
            self.assertEqual(list(base.iterdir()), [])
            self.assertEqual(list(Path(root).iterdir()), [base])

    def test_download_failure_runs_no_root_commands_and_cleans_up(self):
        with TemporaryDirectory(dir=TEMP_ROOT) as root:
            probe = Rehearsal()
            def unavailable():
                raise OSError("offline")
            with self.assertRaises(OSError):
                chrome.prepare(root, run=probe.run, download=unavailable)
            self.assertEqual(probe.calls, [])
            self.assertEqual(list(Path(root).iterdir()), [])

    def test_wrong_key_never_reaches_apt(self):
        with TemporaryDirectory(dir=TEMP_ROOT) as root:
            calls = []
            def wrong_key(args, **kwargs):
                calls.append(args)
                return SimpleNamespace(stdout="")
            with self.assertRaisesRegex(ValueError, "signing key"):
                chrome.prepare(root, run=wrong_key, download=lambda: b"wrong key")
            self.assertFalse(any(args[0] == "sudo" for args in calls))
            self.assertEqual(list(Path(root).iterdir()), [])

    def test_signature_failure_stops_install_and_is_resumable(self):
        with TemporaryDirectory(dir=TEMP_ROOT) as root:
            probe = Rehearsal(fail="update")
            with self.assertRaises(subprocess.CalledProcessError):
                chrome.prepare(root, run=probe.run, download=lambda: b"key")
            self.assertFalse(any("install" in args for args in probe.calls))
            self.assertEqual(list(Path(root).iterdir()), [])
            chrome.prepare(root, run=Rehearsal().run, download=lambda: b"key")
            self.assertEqual(list(Path(root).iterdir()), [])

    def test_symlink_parent_is_refused_before_download(self):
        with TemporaryDirectory(dir=TEMP_ROOT) as root:
            link = Path(root) / "link"
            link.symlink_to(root, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "symlink"):
                chrome.prepare(link, download=lambda: self.fail("must not download"))

    def test_cli_refuses_to_modify_a_developer_machine(self):
        env = dict(os.environ, GITHUB_ACTIONS="", CI="")
        result = subprocess.run([sys.executable, "-S", str(SCRIPT)], env=env, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("disposable Linux", result.stderr)

    def test_workflow_runs_rehearsal_and_the_authenticated_preparation(self):
        workflow = SCRIPT.parents[1] / ".github/workflows/dependency-validation.yml"
        text = workflow.read_text()
        self.assertIn("python3 -S tests/test_prepare_ci_chrome.py", text)
        self.assertIn("python3 -S scripts/prepare_ci_chrome.py", text)
        self.assertNotIn("sudo apt-get install --only-upgrade", text)


if __name__ == "__main__":
    unittest.main()
