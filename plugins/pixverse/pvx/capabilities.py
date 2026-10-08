from __future__ import annotations

import json
import zipfile
from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any

from .canvas_sync import (
    CANVAS_OPTIONAL_REVIEWED_COMMANDS,
    CANVAS_REVIEWED_COMMAND_POLICIES,
    canvas_command_contract_issues,
)
from .compatibility import (
    PIXVERSE_CLI_BASELINE_CAPABILITIES_SCHEMA,
    PIXVERSE_CLI_MINIMUM_VERSION,
    normalize_cli_version,
    pixverse_cli_capabilities_path,
    pixverse_cli_channel,
    pixverse_cli_installed_version,
    pixverse_cli_internal_artifact,
    pixverse_cli_version_at_least,
)
from .internal_cli import (
    CANVAS_CAPABILITY_DISCOVERY,
    CREATE_CAPABILITIES_SCHEMA,
    INTERNAL_CLI_CHANNEL,
    InternalCliError,
)


def _normalize_duration_scalar(value: Any, *, zero_is_auto: bool) -> Any:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        if zero_is_auto and value == 0:
            return "auto"
        if float(value).is_integer():
            return str(int(value))
    if isinstance(value, str) and zero_is_auto and value.strip() == "0":
        return "auto"
    return value


def _normalize_reference_duration_contract(create: dict[str, Any]) -> dict[str, Any]:
    """Canonicalize equivalent public/internal reference duration encodings.

    PixVerse CLI 1.4.0 accepts ``--duration auto`` for models that expose the
    public schema's numeric ``0`` sentinel.  The internal artifact already
    serializes the same contract as strings with an explicit ``auto`` value.
    Keep one wrapper-facing representation so queue validation is independent
    of the selected distribution channel.
    """

    normalized = deepcopy(create)
    modes = normalized.get("modes")
    reference = modes.get("reference") if isinstance(modes, dict) else None
    if not isinstance(reference, dict):
        return normalized

    parameters = reference.get("parameters")
    duration = parameters.get("duration") if isinstance(parameters, dict) else None
    if isinstance(duration, dict):
        duration["type"] = "string"
        if "default" in duration:
            duration["default"] = _normalize_duration_scalar(
                duration.get("default"),
                zero_is_auto=True,
            )
        if isinstance(duration.get("enum"), list):
            duration["enum"] = [
                _normalize_duration_scalar(value, zero_is_auto=True)
                for value in duration["enum"]
            ]
        duration["unit"] = "seconds_or_auto"
        duration["description"] = "Output duration in seconds, or auto where supported."

    model_parameters = reference.get("model_parameters")
    by_model = model_parameters.get("duration") if isinstance(model_parameters, dict) else None
    if isinstance(by_model, dict):
        for contract in by_model.values():
            if not isinstance(contract, dict):
                continue
            if "default" in contract:
                contract["default"] = _normalize_duration_scalar(
                    contract.get("default"),
                    zero_is_auto=True,
                )
            if isinstance(contract.get("enum"), list):
                contract["enum"] = [
                    _normalize_duration_scalar(value, zero_is_auto=True)
                    for value in contract["enum"]
                ]
    return normalized


def _normalized_create_domain(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict) or payload.get("schema_version") != "1.2.0":
        return {}
    domains = payload.get("capability_domains")
    create = domains.get("create") if isinstance(domains, dict) else None
    if (
        not isinstance(create, dict)
        or create.get("schema_version") != CREATE_CAPABILITIES_SCHEMA
        or create.get("encoding") != "normalized"
        or not isinstance(create.get("modes"), dict)
    ):
        return {}
    return _normalize_reference_duration_contract(create)


def _capabilities_payload(payload: Any) -> dict[str, Any]:
    return payload if isinstance(payload, dict) else {}


@lru_cache(maxsize=8)
def _read_capabilities_payload_file(path_text: str, _mtime_ns: int, _size: int) -> dict[str, Any]:
    try:
        return _capabilities_payload(json.loads(Path(path_text).read_text(encoding="utf-8")))
    except (OSError, json.JSONDecodeError):
        return {}


@lru_cache(maxsize=8)
def _read_capabilities_payload_archive(
    path_text: str,
    _mtime_ns: int,
    _size: int,
    archive_root: str,
) -> dict[str, Any]:
    try:
        with zipfile.ZipFile(path_text) as archive:
            payload = json.loads(archive.read(f"{archive_root}/dist/capabilities.json"))
    except (OSError, KeyError, json.JSONDecodeError, zipfile.BadZipFile):
        return {}
    return _capabilities_payload(payload)


@lru_cache(maxsize=8)
def _read_capabilities_file(path_text: str, _mtime_ns: int, _size: int) -> dict[str, Any]:
    return _normalized_create_domain(
        _read_capabilities_payload_file(path_text, _mtime_ns, _size)
    )


@lru_cache(maxsize=8)
def _read_capabilities_archive(
    path_text: str,
    _mtime_ns: int,
    _size: int,
    archive_root: str,
) -> dict[str, Any]:
    return _normalized_create_domain(
        _read_capabilities_payload_archive(path_text, _mtime_ns, _size, archive_root)
    )


def load_cli_capabilities() -> dict[str, Any]:
    """Load the complete offline CLI capability manifest for either channel."""

    if pixverse_cli_channel() == INTERNAL_CLI_CHANNEL:
        try:
            artifact = pixverse_cli_internal_artifact()
        except InternalCliError:
            artifact = None
        if artifact is not None:
            try:
                archive_stat = artifact.path.stat()
            except OSError:
                pass
            else:
                payload = _read_capabilities_payload_archive(
                    str(artifact.path),
                    archive_stat.st_mtime_ns,
                    archive_stat.st_size,
                    artifact.archive_root,
                )
                if payload:
                    return payload

    installed = pixverse_cli_capabilities_path()
    try:
        installed_stat = installed.stat()
    except OSError:
        installed_stat = None
    if installed_stat is not None:
        payload = _read_capabilities_payload_file(
            str(installed.resolve()),
            installed_stat.st_mtime_ns,
            installed_stat.st_size,
        )
        if payload:
            return payload

    try:
        artifact = pixverse_cli_internal_artifact()
    except InternalCliError:
        artifact = None
    if artifact is None:
        return {}
    try:
        archive_stat = artifact.path.stat()
    except OSError:
        return {}
    return _read_capabilities_payload_archive(
        str(artifact.path),
        archive_stat.st_mtime_ns,
        archive_stat.st_size,
        artifact.archive_root,
    )


def canvas_wrapper_contract_issues(payload: dict[str, Any] | None = None) -> list[str]:
    """Return reasons the active CLI cannot safely use the guarded Canvas wrapper."""

    capabilities = payload if payload is not None else load_cli_capabilities()
    if not capabilities:
        return ["offline CLI capabilities are unavailable"]

    issues: list[str] = []
    schema_version = str(capabilities.get("schema_version") or "")
    if schema_version != PIXVERSE_CLI_BASELINE_CAPABILITIES_SCHEMA:
        issues.append(
            "CLI capabilities schema "
            f"{schema_version or '<missing>'!r} != {PIXVERSE_CLI_BASELINE_CAPABILITIES_SCHEMA!r}"
        )

    cli = capabilities.get("cli")
    manifest_version = str(cli.get("version") or "") if isinstance(cli, dict) else ""
    active_version = normalize_cli_version(manifest_version or pixverse_cli_installed_version())
    if not pixverse_cli_version_at_least(active_version, PIXVERSE_CLI_MINIMUM_VERSION):
        issues.append(
            f"CLI version {active_version or '<missing>'!r} is below {PIXVERSE_CLI_MINIMUM_VERSION!r}"
        )

    commands = capabilities.get("commands")
    command_payloads: dict[str, list[dict[str, Any]]] = {}
    if isinstance(commands, list):
        for command in commands:
            if (
                isinstance(command, dict)
                and command.get("run") is True
                and isinstance(command.get("cmd"), str)
                and (
                    str(command["cmd"]).startswith("pixverse canvas ")
                    or str(command["cmd"]) == "pixverse capabilities canvas"
                )
            ):
                command_payloads.setdefault(str(command["cmd"]), []).append(command)
    else:
        issues.append("CLI capabilities commands must be an array")

    reviewed = set(CANVAS_REVIEWED_COMMAND_POLICIES)
    observed = set(command_payloads)
    missing = sorted(reviewed - observed - CANVAS_OPTIONAL_REVIEWED_COMMANDS)
    extra = sorted(observed - reviewed)
    duplicates = sorted(path for path, values in command_payloads.items() if len(values) != 1)
    if missing:
        issues.append("missing reviewed Canvas commands: " + ", ".join(missing))
    if extra:
        issues.append("unreviewed runnable Canvas commands: " + ", ".join(extra))
    if duplicates:
        issues.append("duplicate runnable Canvas commands: " + ", ".join(duplicates))
    for path in sorted(reviewed & observed):
        if len(command_payloads[path]) == 1:
            issues.extend(canvas_command_contract_issues(command_payloads[path][0]))

    domains = capabilities.get("capability_domains")
    canvas = domains.get("canvas") if isinstance(domains, dict) else None
    if not isinstance(canvas, dict) or canvas.get("source") != "runtime":
        issues.append("Canvas capability domain must use runtime discovery")
    elif canvas.get("discovery") != CANVAS_CAPABILITY_DISCOVERY:
        issues.append("Canvas capability discovery contract changed")
    return issues


def load_create_capabilities() -> dict[str, Any]:
    """Load reviewed normalized create capabilities without invoking the CLI or network."""
    # The bundled archive is the reviewed source of truth for the internal
    # channel. An activated runtime can temporarily be one build behind after
    # a plugin/package refresh; reading it first would reject newly reviewed
    # models until bootstrap happens to replace the cache.
    if pixverse_cli_channel() == INTERNAL_CLI_CHANNEL:
        try:
            artifact = pixverse_cli_internal_artifact()
        except InternalCliError:
            artifact = None
        if artifact is not None:
            try:
                archive_stat = artifact.path.stat()
            except OSError:
                pass
            else:
                create = _read_capabilities_archive(
                    str(artifact.path),
                    archive_stat.st_mtime_ns,
                    archive_stat.st_size,
                    artifact.archive_root,
                )
                if create:
                    return create

    installed = pixverse_cli_capabilities_path()
    try:
        installed_stat = installed.stat()
    except OSError:
        installed_stat = None
    if installed_stat is not None:
        create = _read_capabilities_file(
            str(installed.resolve()),
            installed_stat.st_mtime_ns,
            installed_stat.st_size,
        )
        if create:
            return create

    try:
        artifact = pixverse_cli_internal_artifact()
    except InternalCliError:
        artifact = None
    if artifact is None:
        return {}
    try:
        archive_stat = artifact.path.stat()
    except OSError:
        return {}
    return _read_capabilities_archive(
        str(artifact.path),
        archive_stat.st_mtime_ns,
        archive_stat.st_size,
        artifact.archive_root,
    )


def create_mode_capability(mode: str) -> dict[str, Any]:
    modes = load_create_capabilities().get("modes")
    payload = modes.get(mode) if isinstance(modes, dict) else None
    return payload if isinstance(payload, dict) else {}


def create_model_supported(mode: str, model: str) -> bool:
    model_ids = create_mode_capability(mode).get("model_ids")
    return isinstance(model_ids, list) and model in model_ids


def create_model_parameter(mode: str, model: str, parameter: str) -> dict[str, Any]:
    mode_payload = create_mode_capability(mode)
    model_parameters = mode_payload.get("model_parameters")
    parameter_payload = model_parameters.get(parameter) if isinstance(model_parameters, dict) else None
    model_payload = parameter_payload.get(model) if isinstance(parameter_payload, dict) else None
    return model_payload if isinstance(model_payload, dict) else {}
