from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from .internal_cli import (
    INTERNAL_CLI_CHANNEL,
    ONLINE_CLI_CHANNEL,
    InternalCliArtifact,
    InternalCliError,
    active_install_root,
    active_matches_artifact,
    internal_cli_source_present,
    load_internal_cli_artifact,
)
from .state import local_data_home, plugin_root


COMPATIBILITY_PATH = Path(__file__).with_name("cli-compatibility.json")


def load_cli_compatibility() -> dict[str, Any]:
    payload = json.loads(COMPATIBILITY_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or not isinstance(payload.get("pixverse_cli"), dict):
        raise RuntimeError(f"invalid PixVerse CLI compatibility contract: {COMPATIBILITY_PATH}")
    return payload


def validate_cli_compatibility(*, plugin_version: str | None = None, root: Path | None = None) -> list[str]:
    """Validate the checked-in release contract without requiring npm or a CLI install."""
    payload = CLI_COMPATIBILITY
    issues: list[str] = []
    if plugin_version is not None and payload.get("plugin_version") != plugin_version:
        issues.append(
            f"compatibility plugin_version {payload.get('plugin_version')!r} does not match {plugin_version!r}"
        )
    if not re.fullmatch(r"\d+\.\d+\.\d+", PIXVERSE_CLI_MINIMUM_VERSION):
        issues.append(f"invalid minimum PixVerse CLI version: {PIXVERSE_CLI_MINIMUM_VERSION!r}")
    if not re.fullmatch(r"\d+\.\d+\.\d+", PIXVERSE_CLI_BASELINE_VERSION):
        issues.append(f"invalid baseline PixVerse CLI version: {PIXVERSE_CLI_BASELINE_VERSION!r}")
    if not re.fullmatch(r"\s*>=\s*\d+\.\d+\.\d+\s*", PIXVERSE_CLI_NODE_REQUIREMENT):
        issues.append(
            f"invalid PixVerse CLI Node requirement: {PIXVERSE_CLI_NODE_REQUIREMENT!r}"
        )
    if not pixverse_cli_version_at_least(PIXVERSE_CLI_BASELINE_VERSION, PIXVERSE_CLI_MINIMUM_VERSION):
        issues.append("baseline_version must be greater than or equal to minimum_version")
    if PIXVERSE_CLI_INSTALL_SPEC != "latest":
        issues.append("install_spec must be 'latest' so bootstrap refreshes the newest compatible CLI")
    if PIXVERSE_CLI_PACKAGE != "pixverse":
        issues.append(f"unexpected PixVerse CLI package: {PIXVERSE_CLI_PACKAGE!r}")
    if not re.fullmatch(r"[0-9a-f]{64}", PIXVERSE_CLI_BASELINE_CAPABILITIES_SHA256):
        issues.append("baseline_capabilities_sha256 must be a lower-case SHA-256 digest")
    if not re.fullmatch(r"\d+\.\d+\.\d+", PIXVERSE_INTERNAL_CLI_CAPABILITIES_SCHEMA):
        issues.append("internal_capabilities_schema_version must be semantic x.y.z")
    if not PIXVERSE_CLI_BASELINE_NPM_INTEGRITY.startswith("sha512-"):
        issues.append("baseline_npm_integrity must be an npm sha512 integrity value")
    if not isinstance(payload.get("reviewed_command_count"), int) or payload["reviewed_command_count"] < 1:
        issues.append("reviewed_command_count must be a positive integer")
    reviewed = payload.get("reviewed_documents")
    if not isinstance(reviewed, list) or not reviewed or not all(isinstance(item, str) for item in reviewed):
        issues.append("reviewed_documents must be a non-empty string list")
    elif root is not None:
        for relative in reviewed:
            if not (root / relative).is_file():
                issues.append(f"reviewed capability document is missing: {relative}")
    changes = payload.get("reviewed_changes")
    if not isinstance(changes, list) or not changes or not all(isinstance(item, str) for item in changes):
        issues.append("reviewed_changes must record the manually reviewed CLI delta")
    internal_changes = payload.get("internal_reviewed_changes")
    if (
        not isinstance(internal_changes, list)
        or not internal_changes
        or not all(isinstance(item, str) for item in internal_changes)
    ):
        issues.append("internal_reviewed_changes must record the manually reviewed internal CLI delta")
    if not isinstance(payload.get("internal_reviewed_from_cli_version"), str) or not normalize_cli_version(
        str(payload.get("internal_reviewed_from_cli_version") or "")
    ):
        issues.append("internal_reviewed_from_cli_version must include a semantic CLI version")
    if (
        not isinstance(payload.get("internal_reviewed_command_count"), int)
        or payload["internal_reviewed_command_count"] < 1
    ):
        issues.append("internal_reviewed_command_count must be a positive integer")
    if not re.fullmatch(r"[0-9a-f]{64}", str(payload.get("internal_capabilities_sha256") or "")):
        issues.append("internal_capabilities_sha256 must be a lower-case SHA-256 digest")
    return issues


CLI_COMPATIBILITY = load_cli_compatibility()
CLI_CONTRACT = CLI_COMPATIBILITY["pixverse_cli"]
PIXVERSE_CLI_PACKAGE = str(CLI_CONTRACT["package"])
PIXVERSE_CLI_MINIMUM_VERSION = str(CLI_CONTRACT["minimum_version"])
PIXVERSE_CLI_NODE_REQUIREMENT = str(CLI_CONTRACT["node_requirement"])
PIXVERSE_CLI_INSTALL_SPEC = str(CLI_CONTRACT["install_spec"])
PIXVERSE_CLI_BASELINE_VERSION = str(CLI_CONTRACT["baseline_version"])
PIXVERSE_CLI_BASELINE_CAPABILITIES_SCHEMA = str(CLI_CONTRACT["baseline_capabilities_schema_version"])
PIXVERSE_INTERNAL_CLI_CAPABILITIES_SCHEMA = str(CLI_CONTRACT["internal_capabilities_schema_version"])
PIXVERSE_CLI_BASELINE_CAPABILITIES_SHA256 = str(CLI_CONTRACT["baseline_capabilities_sha256"])
PIXVERSE_CLI_BASELINE_NPM_INTEGRITY = str(CLI_CONTRACT["baseline_npm_integrity"])


def pixverse_cli_runtime_root() -> Path:
    configured = os.environ.get("PIXVERSE_AGENT_CLI_RUNTIME", "").strip()
    if configured:
        return Path(configured).expanduser()
    if pixverse_cli_channel() == INTERNAL_CLI_CHANNEL:
        return local_data_home() / "runtime" / "pixverse-cli" / "internal"
    return local_data_home() / "runtime" / "pixverse-cli" / "current"


def pixverse_cli_channel() -> str:
    configured = os.environ.get("PIXVERSE_AGENT_CLI_CHANNEL", "").strip().lower()
    if configured:
        if configured not in {INTERNAL_CLI_CHANNEL, ONLINE_CLI_CHANNEL}:
            raise RuntimeError(
                f"PIXVERSE_AGENT_CLI_CHANNEL must be {INTERNAL_CLI_CHANNEL!r} or {ONLINE_CLI_CHANNEL!r}"
            )
        return configured
    return INTERNAL_CLI_CHANNEL if internal_cli_source_present(plugin_root()) else ONLINE_CLI_CHANNEL


def pixverse_cli_internal_artifact() -> InternalCliArtifact | None:
    if pixverse_cli_channel() != INTERNAL_CLI_CHANNEL:
        return None
    return load_internal_cli_artifact(
        plugin_root(),
        minimum_version=PIXVERSE_CLI_MINIMUM_VERSION,
        capabilities_schema=PIXVERSE_INTERNAL_CLI_CAPABILITIES_SCHEMA,
        expected_node_requirement=PIXVERSE_CLI_NODE_REQUIREMENT,
    )


def pixverse_cli_node_requirement() -> str:
    """Return the shared Node floor for both managed CLI channels."""

    return PIXVERSE_CLI_NODE_REQUIREMENT


def pixverse_cli_source() -> str:
    return "bundled-zip" if pixverse_cli_channel() == INTERNAL_CLI_CHANNEL else "npm-latest"


def pixverse_cli_effective_install_spec() -> str:
    if pixverse_cli_channel() != INTERNAL_CLI_CHANNEL:
        return PIXVERSE_CLI_INSTALL_SPEC
    try:
        artifact = pixverse_cli_internal_artifact()
    except InternalCliError:
        return "bundled-zip-invalid"
    return artifact.version if artifact is not None else "bundled-zip-missing"


def pixverse_cli_artifact_sha256() -> str:
    try:
        artifact = pixverse_cli_internal_artifact()
    except InternalCliError:
        return ""
    return artifact.archive_sha256 if artifact is not None else ""


def pixverse_cli_active_root() -> Path:
    if pixverse_cli_channel() == INTERNAL_CLI_CHANNEL:
        return active_install_root(pixverse_cli_runtime_root())
    return pixverse_cli_runtime_root()


def pixverse_cli_executable() -> Path:
    configured = os.environ.get("PIXVERSE_AGENT_PIXVERSE_EXECUTABLE", "").strip()
    if configured:
        return Path(configured).expanduser()
    binary = "pixverse.cmd" if os.name == "nt" else "pixverse"
    if pixverse_cli_channel() == INTERNAL_CLI_CHANNEL:
        return pixverse_cli_active_root() / binary
    return pixverse_cli_active_root() / "node_modules" / ".bin" / binary


def pixverse_cli_package_root() -> Path:
    if pixverse_cli_channel() == INTERNAL_CLI_CHANNEL:
        return pixverse_cli_active_root()
    return pixverse_cli_active_root() / "node_modules" / PIXVERSE_CLI_PACKAGE


def pixverse_cli_package_json() -> Path:
    return pixverse_cli_package_root() / "package.json"


def pixverse_cli_capabilities_path() -> Path:
    return pixverse_cli_package_root() / "dist" / "capabilities.json"


def pixverse_cli_installed_version() -> str:
    try:
        payload = json.loads(pixverse_cli_package_json().read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return ""
    return str(payload.get("version") or "") if isinstance(payload, dict) else ""


def pixverse_cli_runtime_is_supported() -> bool:
    executable = pixverse_cli_executable()
    executable_ready = executable.is_file() and (os.name == "nt" or os.access(executable, os.X_OK))
    if os.environ.get("PIXVERSE_AGENT_PIXVERSE_EXECUTABLE", "").strip():
        return executable_ready
    if pixverse_cli_channel() == INTERNAL_CLI_CHANNEL:
        try:
            artifact = pixverse_cli_internal_artifact()
        except InternalCliError:
            return False
        return bool(
            artifact is not None
            and active_matches_artifact(pixverse_cli_runtime_root(), artifact)
            and executable_ready
            and pixverse_cli_version_supported(pixverse_cli_installed_version())
        )
    return executable_ready and pixverse_cli_version_supported(pixverse_cli_installed_version())


def pixverse_cli_install_argv(npm: str = "npm") -> list[str]:
    if pixverse_cli_channel() == INTERNAL_CLI_CHANNEL:
        raise RuntimeError("the internal CLI channel installs from its bundled ZIP, not npm latest")
    return [
        npm,
        "install",
        "--prefix",
        str(pixverse_cli_runtime_root()),
        "--save-exact",
        "--no-audit",
        "--no-fund",
        f"{PIXVERSE_CLI_PACKAGE}@{PIXVERSE_CLI_INSTALL_SPEC}",
    ]


def normalize_cli_version(value: str) -> str:
    match = re.search(r"(?<!\d)(\d+\.\d+\.\d+)(?!\d)", value)
    return match.group(1) if match else ""


def semver_tuple(value: str) -> tuple[int, int, int] | None:
    normalized = normalize_cli_version(value)
    if not normalized:
        return None
    return tuple(int(part) for part in normalized.split("."))  # type: ignore[return-value]


def pixverse_cli_version_at_least(value: str, minimum: str) -> bool:
    actual_tuple = semver_tuple(value)
    minimum_tuple = semver_tuple(minimum)
    return bool(actual_tuple is not None and minimum_tuple is not None and actual_tuple >= minimum_tuple)


def pixverse_cli_version_supported(value: str) -> bool:
    return pixverse_cli_version_at_least(value, PIXVERSE_CLI_MINIMUM_VERSION)
