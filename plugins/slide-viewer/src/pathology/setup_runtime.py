"""Explicitly provision/check this plugin's private optional CPU environment.

Installation uses the approved oaipkg manager. It never modifies the chosen base
interpreter, a host environment, or a global package set. This is a manual setup
entrypoint, never an import/open/job hook.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import TypedDict


class RuntimeMetadata(TypedDict):
    prefix: str
    python: str
    packages: dict[str, str]


def run(command: list[str], root: Path, environment: dict[str, str]) -> None:
    subprocess.run(command, cwd=root, env=environment, check=True)


def private_environment_metadata(
    root: Path, python: Path, packages: Sequence[str] = ()
) -> RuntimeMetadata:
    """Verify the selected interpreter before any manager or model action."""
    venv = root / ".pathology-venv"
    if venv.is_symlink() or not python.is_file():
        raise ValueError("A private, explicitly provisioned interpreter is required")
    configuration = venv / "pyvenv.cfg"
    if not configuration.is_file() or configuration.stat().st_size > 16_384:
        raise ValueError("The private interpreter must have its bounded virtualenv configuration")
    settings = dict(
        line.partition(" = ")[::2]
        for line in configuration.read_text().splitlines()
        if " = " in line
    )
    if settings.get("include-system-site-packages") != "false":
        raise ValueError("The private environment must not inherit host/global packages")
    # Metadata-only check: no TensorFlow initialization, image load or installer.
    code = "import importlib.metadata,json,sys; sys.stdout.write(json.dumps({'prefix':sys.prefix,'python':sys.version.split()[0],'packages':{name:importlib.metadata.version(name) for name in json.loads(sys.argv[1])}}))"
    environment = {**os.environ, "OAIPKG_BOOTSTRAP_SKIP": "1", "OAIPKG_DISABLE_META": "1"}
    result = subprocess.run(
        [str(python), "-I", "-c", code, json.dumps(list(packages))],
        cwd=root,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    if len(result.stdout) > 16_384:
        raise ValueError("The interpreter returned oversized runtime metadata")
    metadata = json.loads(result.stdout)
    if not isinstance(metadata, dict) or set(metadata) != {"prefix", "python", "packages"}:
        raise ValueError("The interpreter returned unexpected runtime metadata")
    prefix, version, installed = metadata["prefix"], metadata["python"], metadata["packages"]
    if not isinstance(prefix, str) or Path(prefix).resolve() != venv.resolve():
        raise ValueError("The interpreter does not belong to this plugin's private environment")
    if not isinstance(version, str) or not version.startswith("3.12."):
        raise ValueError("Choose the qualified CPython 3.12 runtime")
    if not isinstance(installed, dict) or any(
        not isinstance(name, str) or not isinstance(pin, str) for name, pin in installed.items()
    ):
        raise ValueError("The interpreter returned invalid package metadata")
    return RuntimeMetadata(prefix=prefix, python=version, packages=installed)


def check_environment(root: Path, python: Path) -> None:
    requirements = root / "pathology-requirements.txt"
    pins: dict[str, str] = {}
    for line in requirements.read_text().splitlines():
        requirement = line.strip()
        if not requirement or requirement.startswith("#"):
            continue
        name, version = requirement.split("==")
        pins[name] = version
    metadata = private_environment_metadata(root, python, tuple(pins))
    if metadata["packages"] != pins:
        raise ValueError(
            "The optional environment differs from the declared exact package versions"
        )
    registry_file = Path(__file__).with_name("model-registry.json")
    registry = json.loads(registry_file.read_text())
    model_root = root / ".pathology-assets/models/stardist-2d-versatile-he"
    model_verified = True
    for name, key in (
        ("config.json", "configSha256"),
        ("thresholds.json", "thresholdsSha256"),
        ("weights_best.h5", "weightsSha256"),
    ):
        path = model_root / name
        if not path.is_file():
            model_verified = False
            continue
        if (
            path.stat().st_size > 32 * 1024 * 1024
            or "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest() != registry[key]
        ):
            raise ValueError("A provisioned StarDist model asset differs from its pinned digest")
    sys.stdout.write(
        json.dumps(
            {
                "pluginRoot": str(root),
                "metadata": metadata,
                "packagesVerified": True,
                "stardistAssetsVerified": model_verified,
                "proofBoundary": "Package metadata and optional asset hashes, not an inference or scientific accuracy test",
            },
            indent=2,
        )
        + "\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--python",
        type=Path,
        default=Path(sys.executable),
        help="Existing CPython 3.12 base interpreter; it is not modified",
    )
    parser.add_argument(
        "--bootstrap-install-py",
        type=Path,
        help="Existing approved monorepo install.py for bootstrapping oaipkg into the new private environment",
    )
    parser.add_argument(
        "--install-runtime",
        action="store_true",
        help="Explicitly authorize package installation into .pathology-venv",
    )
    parser.add_argument(
        "--download-model",
        action="store_true",
        help="Explicitly fetch/verify the pinned public StarDist asset",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check existing pinned packages and any provisioned model without inference/network",
    )
    args = parser.parse_args()
    if not args.install_runtime and not args.download_model and not args.check:
        parser.error("Choose an explicit install, model-provisioning, or offline check action")
    root = Path(__file__).resolve().parents[2]
    venv = root / ".pathology-venv"
    if venv.is_symlink():
        raise ValueError("The optional environment must not redirect to a host/global environment")
    executable_folder = venv / ("Scripts" if os.name == "nt" else "bin")
    python = executable_folder / ("python.exe" if os.name == "nt" else "python")
    manager = executable_folder / ("oaipkg.exe" if os.name == "nt" else "oaipkg")
    environment = dict(os.environ)
    if args.install_runtime:
        if not python.is_file():
            if venv.exists():
                raise ValueError(
                    "The private environment is incomplete; explicit operator recovery is required"
                )
            run(
                [
                    str(args.python),
                    "-I",
                    "-c",
                    "import sys; assert sys.version_info[:2] == (3,12), 'Choose the qualified CPython 3.12 runtime'",
                ],
                root,
                environment,
            )
            run(
                [str(args.python), "-I", "-m", "venv", "--without-pip", str(venv)],
                root,
                environment,
            )
        private_environment_metadata(root, python)
        if not manager.is_file():
            if args.bootstrap_install_py is None or not args.bootstrap_install_py.is_file():
                raise ValueError(
                    "Provide the existing approved install.py bootstrap; no raw pip/uv or host-install fallback is permitted"
                )
            run(
                [str(python), str(args.bootstrap_install_py.resolve()), "oaipackaging"],
                root,
                environment,
            )
        run(
            [
                str(python),
                "-I",
                "-c",
                "from oaipkg.cli import main; raise SystemExit(main())",
                "installpip",
                "-r",
                str(root / "pathology-requirements.txt"),
            ],
            root,
            environment,
        )
    if args.download_model:
        if not python.is_file():
            raise ValueError(
                "Provision the private runtime explicitly before downloading its model"
            )
        private_environment_metadata(root, python)
        run(
            [
                str(python),
                "-I",
                str(Path(__file__).with_name("provision_assets.py")),
                "--download-model",
            ],
            root,
            {**environment, "OAIPKG_BOOTSTRAP_SKIP": "1", "OAIPKG_DISABLE_META": "1"},
        )
    if args.check or args.install_runtime:
        check_environment(root, python)


if __name__ == "__main__":
    main()
