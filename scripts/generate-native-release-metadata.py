#!/usr/bin/env python3
"""Generate checksums, a release manifest, and dependency notices."""

import argparse
import hashlib
import json
import pathlib
import platform
import subprocess


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact-dir", required=True)
    parser.add_argument("--executable", required=True)
    parser.add_argument("--platform", required=True)
    args = parser.parse_args()

    root = pathlib.Path(__file__).resolve().parent.parent
    artifact_dir = pathlib.Path(args.artifact_dir).resolve()
    executable = artifact_dir / args.executable
    digest = hashlib.sha256(executable.read_bytes()).hexdigest()
    (artifact_dir / f"{args.executable}.sha256").write_text(
        f"{digest}  {args.executable}\n", encoding="utf-8"
    )

    machine = platform.machine().lower()
    architecture = "arm64" if machine in {"arm64", "aarch64"} else "x86_64" if machine in {"amd64", "x86_64"} else machine
    release = {
        "schemaVersion": 1,
        "name": "phasepal-browser-host",
        "version": "0.1.0",
        "platform": args.platform,
        "architecture": architecture,
        "executable": args.executable,
        "sha256": digest,
        "nativeHostName": "app.phasepal.music",
        "extensionId": "liinajbmlphpehjkmjdffpjhajdpgfpm",
    }
    (artifact_dir / "release-manifest.json").write_text(
        json.dumps(release, indent=2) + "\n", encoding="utf-8"
    )

    metadata = json.loads(
        subprocess.check_output(
            ["cargo", "metadata", "--format-version", "1", "--locked"],
            cwd=root / "native-host",
            text=True,
        )
    )
    dependencies = sorted(
        {
            (package["name"], package["version"], package.get("license") or "See package source")
            for package in metadata["packages"]
            if package["name"] != "phasepal-browser-host"
        }
    )
    lines = [
        "Phase Pal Browser Host - Third-Party Notices",
        "",
        "This file is generated from the locked Rust dependency graph.",
        "Complete license texts remain in each dependency source package.",
        "",
    ]
    lines.extend(f"- {name} {version}: {license_name}" for name, version, license_name in dependencies)
    (artifact_dir / "THIRD_PARTY_NOTICES.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
