#!/usr/bin/env python3
"""Query OSV for exact recorded dependencies without installing/importing them."""
from __future__ import annotations

import argparse
from datetime import date
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import urllib.request


def packages(root: Path) -> list[dict]:
    found = {}
    for lock in (root / "package-lock.json", root / "frontend/package-lock.json"):
        manifest = lock.with_name("package.json")
        if manifest.exists():
            declared = json.loads(manifest.read_text())
            if (declared.get("dependencies") or declared.get("devDependencies")) and not lock.exists():
                raise ValueError(f"Missing npm lockfile for {manifest}")
        if not lock.exists():
            continue
        data = json.loads(lock.read_text())
        entries = data.get("packages")
        if not isinstance(entries, dict) or len(entries) < 2:
            raise ValueError(f"Missing resolved packages in {lock}")
        if manifest.exists():
            for section in ("dependencies", "devDependencies", "optionalDependencies"):
                if declared.get(section, {}) != entries.get("", {}).get(section, {}):
                    raise ValueError(f"{manifest} differs from its lockfile ({section})")
            if declared.get("overrides"):
                raise ValueError("Overrides require an npm resolution check; unsupported by this metadata-only audit")
        for path, entry in entries.items():
            if not path:
                continue
            name = entry.get("name") or path.rsplit("node_modules/", 1)[-1]
            version = entry.get("version")
            if not version or entry.get("link"):
                raise ValueError(f"Unresolved package {path} in {lock}")
            found[("npm", name, version)] = None
    inventory = root / "security/python-inventory.json"
    if (root / "environment.yml").exists() and not inventory.exists():
        raise ValueError("Python environment exists but resolved inventory is missing")
    if inventory.exists():
        data = json.loads(inventory.read_text())
        manifest = root / "environment.yml"
        if data.get("environment_sha256") != hashlib.sha256(manifest.read_bytes()).hexdigest():
            raise ValueError("environment.yml changed; refresh the resolved Python inventory")
        distributions = data.get("distributions")
        if not isinstance(distributions, list) or not distributions:
            raise ValueError("Empty Python inventory")
        for entry in distributions:
            if not entry.get("name") or not entry.get("version"):
                raise ValueError("Unresolved Python distribution")
            found[("PyPI", entry["name"], entry["version"])] = None
    if not found:
        raise ValueError("No dependencies found; refusing a green empty scan")
    return [{"package": {"ecosystem": e, "name": n}, "version": v}
            for e, n, v in sorted(found)]


def runtime_findings(root: Path) -> list[dict]:
    policy = json.loads((root / "security/runtime-policy.json").read_text())
    version = lambda value: tuple(int(part) for part in value.split("."))
    for manifest in (root / "package.json", root / "frontend/package.json"):
        if manifest.exists():
            data = json.loads(manifest.read_text())
            pin = data.get("volta", {}).get("node", "0")
            if version(pin)[0] != policy["node_major"] or version(pin) < version(policy["node_minimum"]):
                raise ValueError(f"{manifest} must pin patched Node {policy['node_minimum']} or newer in this LTS line")
    path = root / "security/python-inventory.json"
    if not path.exists():
        if (root / "environment.yml").exists():
            raise ValueError("Missing Python inventory")
        return []
    inventory = json.loads(path.read_text())
    if version(inventory["python"]) < version(policy["python_minimum"]):
        raise ValueError("Python runtime predates the security floor")
    native = {item["name"]: item for item in inventory["conda_packages"]}
    for name, minimum in policy["conda_minimums"].items():
        if name not in native or version(native[name]["version"]) < version(minimum):
            raise ValueError(f"Conda package {name} must be >= {minimum}")
    findings = []
    for item in policy["unresolved_native_advisories"]:
        if item["name"] not in native:
            continue
        installed = native[item["name"]]
        affected = version(installed["version"]) >= version(item["introduced"])
        if item["fixed"]:
            affected = affected and version(installed["version"]) < version(item["fixed"])
        if affected and installed.get("sha256", "unverified") not in item["patched_sha256"]:
            findings.append({"package": {"ecosystem": "Conda", "name": item["name"]},
                             "version": installed["version"], "build": installed["build"],
                             "id": item["id"], "url": item["url"]})
    return findings


def check_installed_npm(root: Path, items: list[dict]) -> int:
    """Include stale stores and conflict copies; never execute package code."""
    locked = {(item["package"]["name"], item["version"]) for item in items
              if item["package"]["ecosystem"] == "npm"}
    installed = set()
    for directory in (root / "node_modules", root / "frontend/node_modules"):
        if not directory.parent.joinpath("package-lock.json").exists():
            continue
        if not directory.is_dir():
            raise ValueError(f"Missing installed npm tree: {directory}")
        directory = directory.resolve()
        visited = set()
        for current, dirs, files in os.walk(directory, followlinks=True):
            real = Path(current).resolve()
            if real in visited:
                dirs[:] = []
                continue
            visited.add(real)
            if "package.json" not in files:
                continue
            path = Path(current) / "package.json"
            relative = "node_modules/" + path.relative_to(directory).as_posix()
            if not re.search(r"(?:^|/)node_modules/(?:@[^/]+/)?[^/]+/package.json$", relative):
                continue
            data = json.loads(path.read_text())
            if not data.get("name") or not data.get("version"):
                raise ValueError(f"Unresolved installed package: {path}")
            installed.add((data["name"], data["version"]))
    if not installed:
        raise ValueError("No installed npm packages inspected")
    unexpected = sorted(installed - locked)
    if unexpected:
        raise ValueError(f"Installed npm versions absent from the audited lockfile: {unexpected}")
    return len(installed)


def exceptions(root: Path, today: date) -> list[dict]:
    path = root / "security/advisory-exceptions.json"
    entries = json.loads(path.read_text()) if path.exists() else []
    for entry in entries:
        if date.fromisoformat(entry["expires"]) <= today:
            raise ValueError(f"Expired advisory exception: {entry['id']}")
        if not entry.get("reason") or not entry.get("forbidden_source_tokens"):
            raise ValueError("Exceptions require rationale and a source guard")
        for source in (root / "frontend/src").rglob("*"):
            if source.suffix not in {".svelte", ".ts", ".js"}:
                continue
            text = source.read_text()
            for token in entry["forbidden_source_tokens"]:
                if token in text:
                    raise ValueError(f"Exception {entry['id']} invalidated by {token} in {source}")
    return entries


def query(batch: list[dict]) -> dict:
    request = urllib.request.Request(
        "https://api.osv.dev/v1/querybatch",
        data=json.dumps({"queries": batch}).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "cerna-security-audit/1"},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)


def scan(items: list[dict], allowed: list[dict], fetch=query) -> dict:
    findings, accepted = [], []
    for offset in range(0, len(items), 100):
        batch = items[offset:offset + 100]
        response = fetch(batch)
        results = response.get("results")
        if not isinstance(results, list) or len(results) != len(batch):
            raise ValueError("Incomplete OSV response; audit coverage is unknown")
        for item, result in zip(batch, results):
            if not isinstance(result, dict) or result.get("error") or result.get("next_page_token"):
                raise ValueError(f"OSV query failed for {item}")
            for vuln in result.get("vulns", []):
                advisory = vuln["id"]
                finding = {**item, "id": advisory, "url": f"https://osv.dev/vulnerability/{advisory}"}
                matches = [entry for entry in allowed if entry["id"] == advisory
                           and entry["package"] == item["package"]
                           and entry["version"] == item["version"]]
                (accepted if matches else findings).append(finding)
    return {"scanned_versions": len(items), "findings": findings, "accepted_exceptions": accepted}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--installed-npm", action="store_true", help="Also reject installed versions absent from the lock")
    args = parser.parse_args()
    try:
        items = packages(args.root)
        installed_count = check_installed_npm(args.root, items) if args.installed_npm else None
        result = scan(items, exceptions(args.root, date.today()))
        if installed_count is not None:
            result["installed_npm_versions_checked"] = installed_count
        result["findings"].extend(runtime_findings(args.root))
        print(json.dumps(result, indent=2))
        return 1 if result["findings"] else 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
