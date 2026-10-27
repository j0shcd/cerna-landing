"""Regression checks for fail-closed dependency monitoring (stdlib only)."""
from datetime import date
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("security_audit", Path(__file__).resolve().parents[1] / "scripts/security_audit.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class SecurityAuditTests(unittest.TestCase):
    def test_flags_vulnerable_version_and_allows_only_exact_exception(self):
        item = {"package": {"ecosystem": "npm", "name": "vite"}, "version": "5.4.21"}
        fetch = lambda batch: {"results": [{"vulns": [{"id": "GHSA-rq7h-c2jc-7f22"}]}]}
        self.assertTrue(audit.scan([item], [], fetch)["findings"])
        allowed = [{**item, "id": "GHSA-rq7h-c2jc-7f22"}]
        self.assertFalse(audit.scan([item], allowed, fetch)["findings"])
        allowed[0]["version"] = "6.4.5"
        self.assertTrue(audit.scan([item], allowed, fetch)["findings"])

    def test_incomplete_or_failed_query_is_never_clean(self):
        for response in [{}, {"results": []}, {"results": [{"error": "unavailable"}]}, {"results": [{"next_page_token": "more"}]}]:
            with self.subTest(response=response), self.assertRaises(ValueError):
                audit.scan([{"package": {"ecosystem": "npm", "name": "vite"}, "version": "5.4.21"}], [], lambda batch: response)

    def test_missing_python_inventory_and_empty_locks_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(ValueError, "No dependencies"):
                audit.packages(root)
            (root / "environment.yml").touch()
            with self.assertRaisesRegex(ValueError, "inventory is missing"):
                audit.packages(root)

    def test_exception_expires_or_is_invalidated_by_new_feature(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "security").mkdir()
            path = root / "security/advisory-exceptions.json"
            entry = {"id": "GHSA-example", "expires": "2026-11-10", "reason": "no forms", "forbidden_source_tokens": ["use:enhance"]}
            path.write_text(json.dumps([entry]))
            self.assertTrue(audit.exceptions(root, date(2026, 10, 27)))
            with self.assertRaisesRegex(ValueError, "Expired"):
                audit.exceptions(root, date(2026, 11, 10))
            source = root / "frontend/src/routes"
            source.mkdir(parents=True)
            (source / "+page.svelte").write_text('<form use:enhance></form>')
            with self.assertRaisesRegex(ValueError, "invalidated"):
                audit.exceptions(root, date(2026, 10, 27))

    def test_changed_python_manifest_requires_a_new_inventory(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "security").mkdir()
            (root / "environment.yml").write_text("changed")
            (root / "security/python-inventory.json").write_text(json.dumps({"environment_sha256": "stale", "distributions": [{"name": "pillow", "version": "13.0.0"}]}))
            with self.assertRaisesRegex(ValueError, "changed"):
                audit.packages(root)

    def test_another_ecosystem_cannot_hide_a_deleted_npm_lock(self):
        import hashlib
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "frontend").mkdir()
            (root / "frontend/package.json").write_text(json.dumps({"dependencies": {"vite": "5.4.21"}}))
            (root / "environment.yml").write_text("python")
            (root / "security").mkdir()
            (root / "security/python-inventory.json").write_text(json.dumps({
                "environment_sha256": hashlib.sha256(b"python").hexdigest(),
                "distributions": [{"name": "certifi", "version": "2026.10.23"}]}))
            with self.assertRaisesRegex(ValueError, "lockfile"):
                audit.packages(root)

    def test_manifest_changes_cannot_scan_the_old_dependency_graph(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "package.json").write_text(json.dumps({"dependencies": {"vite": "6.4.5"}}))
            (root / "package-lock.json").write_text(json.dumps({"packages": {
                "": {"dependencies": {"vite": "5.4.21"}},
                "node_modules/vite": {"version": "5.4.21"}}}))
            with self.assertRaisesRegex(ValueError, "differs"):
                audit.packages(root)

    def test_native_finding_survives_clean_pypi_and_new_build_numbers(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "security").mkdir()
            policy = {"node_major": 24, "node_minimum": "24.22.1", "python_minimum": "3.12.16",
                      "conda_minimums": {}, "unresolved_native_advisories": [
                          {"name": "openjpeg", "introduced": "2.5.3", "fixed": None,
                           "patched_sha256": [], "id": "OSV-2025-219", "url": "https://osv.dev/vulnerability/OSV-2025-219"}]}
            (root / "security/runtime-policy.json").write_text(json.dumps(policy))
            inventory = {"python": "3.12.16", "conda_packages": [
                {"name": "openjpeg", "version": "2.5.4", "build": "unreviewed-build-3", "sha256": "unreviewed"}]}
            (root / "security/python-inventory.json").write_text(json.dumps(inventory))
            self.assertEqual(audit.runtime_findings(root)[0]["id"], "OSV-2025-219")
            policy["unresolved_native_advisories"][0]["patched_sha256"] = ["unreviewed"]
            (root / "security/runtime-policy.json").write_text(json.dumps(policy))
            self.assertFalse(audit.runtime_findings(root))

    def test_stale_package_manager_stores_cannot_hide_behind_a_clean_lock(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "package-lock.json").touch()
            package = root / "node_modules/vite"
            package.mkdir(parents=True)
            (package / "package.json").write_text(json.dumps({"name": "vite", "version": "6.4.5"}))
            items = [{"package": {"ecosystem": "npm", "name": "vite"}, "version": "6.4.5"}]
            self.assertEqual(audit.check_installed_npm(root, items), 1)
            stale = root / "node_modules/.pnpm 2/old/node_modules/vite"
            stale.mkdir(parents=True)
            (stale / "package.json").write_text(json.dumps({"name": "vite", "version": "5.4.21"}))
            with self.assertRaisesRegex(ValueError, "absent from the audited lockfile"):
                audit.check_installed_npm(root, items)

if __name__ == "__main__":
    unittest.main()
