#!/usr/bin/env python3
"""Install the bundled Career Command Center macOS app for the current user."""

from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import stat
import subprocess
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parent.parent
PREBUILT = PLUGIN_ROOT / "assets" / "macos-app" / "prebuilt" / "Career Command Center.app"
BUILD_SCRIPT = PLUGIN_ROOT / "scripts" / "build_app.sh"
EXECUTABLE_RELATIVE_PATH = Path("Contents/MacOS/CareerCommandCenter")


def run_build() -> Path:
    result = subprocess.run(
        ["/bin/bash", str(BUILD_SCRIPT)],
        check=True,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    return Path(result.stdout.strip().splitlines()[-1])


def ensure_launchable(app_path: Path) -> bool:
    """Restore transfer-sensitive permissions and refresh the local app signature."""
    executable = app_path / EXECUTABLE_RELATIVE_PATH
    if not executable.is_file():
        raise SystemExit(f"Bundled app executable is missing: {executable}")

    repaired_permissions = not os.access(executable, os.X_OK)
    executable.chmod(
        executable.stat().st_mode
        | stat.S_IXUSR
        | stat.S_IXGRP
        | stat.S_IXOTH
    )

    try:
        subprocess.run(
            ["/usr/bin/codesign", "--force", "--deep", "--sign", "-", str(app_path)],
            check=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        subprocess.run(
            ["/usr/bin/codesign", "--verify", "--deep", "--strict", str(app_path)],
            check=True,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or error.stdout or str(error)).strip()
        raise SystemExit(f"Could not prepare the app for launch: {detail}") from error

    return repaired_permissions


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--destination",
        type=Path,
        default=Path.home() / "Applications" / "Career Command Center.app",
    )
    parser.add_argument("--workspace", type=Path, default=None)
    parser.add_argument("--force-rebuild", action="store_true")
    parser.add_argument("--no-launch", action="store_true")
    args = parser.parse_args()

    if platform.system() != "Darwin":
        raise SystemExit("Career Command Center currently supports macOS 14 or later.")

    source = PREBUILT
    can_use_prebuilt = platform.machine().lower() in {"arm64", "aarch64"}
    if args.force_rebuild or not can_use_prebuilt or not (source / EXECUTABLE_RELATIVE_PATH).is_file():
        source = run_build()

    args.destination.parent.mkdir(parents=True, exist_ok=True)
    if args.destination.exists():
        shutil.rmtree(args.destination)
    shutil.copytree(source, args.destination, symlinks=True)
    repaired_permissions = ensure_launchable(args.destination)

    command = ["open", str(args.destination)]
    if args.workspace:
        command.extend(["--args", "--workspace", str(args.workspace)])
    if not args.no_launch:
        subprocess.run(command, check=True)

    print(
        json.dumps(
            {
                "installed_app": str(args.destination),
                "workspace_override": str(args.workspace) if args.workspace else None,
                "launched": not args.no_launch,
                "executable_permission_repaired": repaired_permissions,
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
