#!/usr/bin/env python3
"""Upgrade hosted-runner Chrome using Google's authenticated apt repository."""

from pathlib import Path
import os
import platform
import subprocess
import sys
from tempfile import TemporaryDirectory
from urllib.request import urlopen


# Google's active primary key: https://www.google.com/linuxrepositories/
FINGERPRINT = "EB4C1BFD4F042F6DDDCCEC917721F63BD38B4796"
KEY_URL = "https://dl.google.com/linux/linux_signing_key.pub"


def download_key():
    with urlopen(KEY_URL, timeout=30) as response:
        return response.read(1024 * 1024)


def prepare(temp_root, run=subprocess.run, download=download_key):
    """Own only a fresh temp directory; apt owns the installed package files."""
    root = Path(temp_root)
    if not root.is_absolute() or not root.is_dir() or any(p.is_symlink() for p in [root, *root.parents]):
        raise ValueError("Runner temp must be an existing directory without symlink components")
    with TemporaryDirectory(prefix="cerna-chrome-", dir=root) as temporary:
        stage = Path(temporary)
        home = stage / "gpg"
        home.mkdir(mode=0o700)
        key = stage / "downloaded-key.asc"
        key.write_bytes(download())
        gpg = ["gpg", "--batch", "--homedir", str(home)]
        run([*gpg, "--import", str(key)], check=True)
        # Export this exact primary key and its signed subkeys, not every key
        # in Google's download. A substituted key cannot satisfy the fingerprint.
        exported = run(
            [*gpg, "--armor", "--export", FINGERPRINT],
            check=True, capture_output=True, text=True,
        ).stdout
        if not exported.startswith("-----BEGIN PGP PUBLIC KEY BLOCK-----"):
            raise ValueError("Google's expected signing key was not exported")
        source = stage / "chrome.sources"
        # Deb822 supports an embedded key. No global trust or source file is
        # created, and paths containing spaces need no apt source-line escaping.
        embedded = "\n".join(" " + (line or ".") for line in exported.splitlines())
        source.write_text(
            "Types: deb\nURIs: https://dl.google.com/linux/chrome/deb/\n"
            "Suites: stable\nComponents: main\nArchitectures: amd64\n"
            f"Signed-By:\n{embedded}\n"
        )
        apt = [
            "sudo", "apt-get", "-o", f"Dir::Etc::sourcelist={source}",
            "-o", "Dir::Etc::sourceparts=-", "-o", "APT::Get::List-Cleanup=0",
        ]
        run([*apt, "update"], check=True)
        run([*apt, "install", "--only-upgrade", "--yes", "google-chrome-stable"], check=True)
        run(["google-chrome", "--version"], check=True)


def main():
    if (os.environ.get("GITHUB_ACTIONS") != "true" or os.environ.get("CI") != "true"
            or sys.platform != "linux" or platform.machine() != "x86_64"):
        raise SystemExit("Chrome preparation is restricted to disposable Linux x64 GitHub Actions runners")
    prepare(os.environ["RUNNER_TEMP"])


if __name__ == "__main__":
    main()
