from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import tempfile
import unicodedata
import zipfile
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path, PurePosixPath, PureWindowsPath
from typing import Any, Callable

from .canvas_sync import (
    CANVAS_OPTIONAL_REVIEWED_COMMANDS,
    CANVAS_REVIEWED_COMMAND_POLICIES,
    CanvasSyncLockError,
    canvas_command_contract_issues,
    canvas_sync_lock,
)


BUNDLED_CLI_DIRECTORY = "bundled-cli"
BUNDLED_CLI_ARCHIVE = f"{BUNDLED_CLI_DIRECTORY}/pixverse-internal.zip"
BUNDLED_CLI_MANIFEST = f"{BUNDLED_CLI_DIRECTORY}/manifest.json"
SOURCE_CLI_DIRECTORY = "internal-cli"
INTERNAL_CLI_CHANNEL = "internal"
ONLINE_CLI_CHANNEL = "online"
MAX_ARCHIVE_ENTRIES = 10_000
MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024
INSTALL_RECORD_FILENAME = "internal-install.json"
ACTIVE_RECORD_FILENAME = "active.json"
INSTALL_LOCK_STATE_FILENAME = ".internal-cli-install"
WINDOWS_RESERVED_PATH_NAMES = {
    "con",
    "prn",
    "aux",
    "nul",
    *(f"com{number}" for number in range(1, 10)),
    *(f"lpt{number}" for number in range(1, 10)),
}

REQUIRED_COMMANDS = (
    "pixverse capabilities",
    "pixverse capabilities create",
    "pixverse capabilities canvas",
    "pixverse auth login",
    "pixverse auth status",
    "pixverse account info",
    "pixverse account slots",
    "pixverse account usage",
    "pixverse create video",
    "pixverse create image",
    "pixverse create transition",
    "pixverse create voice",
    "pixverse create music",
    "pixverse create extend",
    "pixverse create modify",
    "pixverse create upscale",
    "pixverse create reference",
    "pixverse create motion-control",
    "pixverse create template",
    "pixverse task status",
    "pixverse asset info",
    "pixverse asset download",
    "pixverse asset list",
    "pixverse canvas project create",
    "pixverse subscribe",
)

REQUIRED_CREATE_CAPABILITY_MODES = (
    "video",
    "image",
    "transition",
    "voice",
    "music",
    "extend",
    "modify",
    "upscale",
    "reference",
    "motion-control",
    "template",
)
CREATE_CAPABILITIES_SCHEMA = "pixverse_create_capabilities.v1"
CANVAS_BINDINGS_SCHEMA = "pixverse_canvas_cli_bindings.v1"
CANVAS_CAPABILITY_DISCOVERY = {
    "merged_command": "pixverse capabilities canvas --json",
    "raw_command": "pixverse capabilities canvas --raw --json",
    "schema_command": "pixverse canvas node schema --node-type <type> --json",
    "adapter_contract_revision": "canvas_cli_capability_adapter.v2",
}
PIXVERSE_REGION_OPTION = "--region <region>"
PIXVERSE_REGION_OPTION_DESCRIPTION = (
    "Region: global or cn (default: global; PIXVERSE_REGION overrides) | choices: global, cn"
)


class InternalCliError(RuntimeError):
    pass


class InternalCliInstallError(InternalCliError):
    pass


@dataclass(frozen=True)
class InternalCliArtifact:
    path: Path
    archive_sha256: str
    archive_root: str
    package_name: str
    version: str
    core_version: str
    node_requirement: str
    capabilities_schema: str
    capabilities_sha256: str
    command_count: int
    commands: tuple[str, ...]
    has_lockfile: bool

    def bundle_manifest(self) -> dict[str, Any]:
        return {
            "schema_version": 1,
            "channel": INTERNAL_CLI_CHANNEL,
            "distribution": "standalone-zip",
            "source_filename": self.path.name,
            "package": self.package_name,
            "version": self.version,
            "core_version": self.core_version,
            "node": self.node_requirement,
            "artifact": "pixverse-internal.zip",
            "artifact_sha256": self.archive_sha256,
            "entrypoints": {
                "posix": "pixverse",
                "windows": "pixverse.cmd",
                "node": "dist/index.js",
            },
            "capabilities": {
                "path": "dist/capabilities.json",
                "schema_version": self.capabilities_schema,
                "sha256": self.capabilities_sha256,
                "command_count": self.command_count,
            },
            "dependency_install": "npm-ci" if self.has_lockfile else "npm-install",
        }


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def bytes_sha256(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def normalize_version(value: str) -> str:
    match = re.search(r"(?<!\d)(\d+\.\d+\.\d+)(?!\d)", value)
    return match.group(1) if match else ""


def semver_tuple(value: str) -> tuple[int, int, int] | None:
    normalized = normalize_version(value)
    if not normalized:
        return None
    return tuple(int(part) for part in normalized.split("."))  # type: ignore[return-value]


def version_at_least(value: str, minimum: str) -> bool:
    actual = semver_tuple(value)
    floor = semver_tuple(minimum)
    return bool(actual is not None and floor is not None and actual >= floor)


def node_version_satisfies(actual: str, requirement: str) -> bool:
    match = re.fullmatch(r"\s*>=\s*(\d+\.\d+\.\d+)\s*", requirement)
    return bool(match and version_at_least(actual, match.group(1)))


def _platform_archive_path_key(name: str) -> str:
    parts = PurePosixPath(name.rstrip("/")).parts
    normalized_parts: list[str] = []
    for part in parts:
        normalized = unicodedata.normalize("NFKC", part)
        windows_normalized = normalized.rstrip(" .")
        if not windows_normalized or windows_normalized != normalized:
            raise InternalCliError(f"Windows-unsafe path in internal CLI ZIP: {name!r}")
        folded = windows_normalized.casefold()
        if folded.split(".", 1)[0] in WINDOWS_RESERVED_PATH_NAMES:
            raise InternalCliError(f"Windows-reserved path in internal CLI ZIP: {name!r}")
        normalized_parts.append(folded)
    return "/".join(normalized_parts)


def _runtime_executable(destination: Path) -> Path:
    return destination / ("pixverse.cmd" if os.name == "nt" else "pixverse")


def _runtime_executable_is_usable(destination: Path) -> bool:
    executable = _runtime_executable(destination)
    return executable.is_file() and (os.name == "nt" or os.access(executable, os.X_OK))


def _validate_seedance_25_mode(mode: str, payload: dict[str, Any]) -> None:
    model_ids = payload.get("model_ids")
    if not isinstance(model_ids, list) or "seedance-2.5" not in model_ids:
        raise InternalCliError(
            f"internal CLI create capability {mode!r} must include seedance-2.5"
        )
    model_parameters = payload.get("model_parameters")
    if not isinstance(model_parameters, dict):
        raise InternalCliError(
            f"internal CLI create capability {mode!r} lacks model_parameters"
        )

    def parameter(name: str) -> dict[str, Any]:
        values = model_parameters.get(name)
        value = values.get("seedance-2.5") if isinstance(values, dict) else None
        if not isinstance(value, dict):
            raise InternalCliError(
                f"internal CLI create capability {mode!r} lacks seedance-2.5 {name!r} metadata"
            )
        return value

    duration_values = parameter("duration").get("enum")
    if not isinstance(duration_values, list) or not {str(value) for value in range(4, 31)}.issubset(
        {str(value) for value in duration_values}
    ):
        raise InternalCliError(
            f"internal CLI create capability {mode!r} has an unreviewed seedance-2.5 duration range"
        )
    if mode == "reference" and "auto" not in {str(value) for value in duration_values}:
        raise InternalCliError(
            "internal CLI Seedance 2.5 reference capability must expose automatic duration"
        )
    quality_values = parameter("quality").get("enum")
    if not isinstance(quality_values, list) or set(quality_values) != {"480p", "720p", "1080p"}:
        raise InternalCliError(
            f"internal CLI create capability {mode!r} has an unreviewed seedance-2.5 quality set"
        )
    if parameter("audio").get("supported") is not False:
        raise InternalCliError(
            f"internal CLI create capability {mode!r} unexpectedly enables the Seedance 2.5 audio parameter; review its serialization contract"
        )
    if mode in {"video", "reference"}:
        aspect_values = parameter("aspect_ratio").get("enum")
        expected_aspects = {"auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"}
        if not isinstance(aspect_values, list) or set(aspect_values) != expected_aspects:
            raise InternalCliError(
                f"internal CLI create capability {mode!r} has an unreviewed Seedance 2.5 aspect set"
            )
    if mode == "video":
        for name in ("multi_shot", "off_peak"):
            if parameter(name).get("supported") is not False:
                raise InternalCliError(
                    f"internal CLI Seedance 2.5 video capability unexpectedly enables {name}"
                )
    elif mode == "reference":
        if parameter("off_peak").get("supported") is not False:
            raise InternalCliError(
                "internal CLI Seedance 2.5 reference capability unexpectedly enables off_peak"
            )
        expected_limits = {"images": 30, "videos": 10, "audios": 10}
        for name, limit in expected_limits.items():
            if parameter(name).get("max_count") != limit:
                raise InternalCliError(
                    f"internal CLI Seedance 2.5 reference {name} limit is no longer {limit}"
                )
        task_types = parameter("task_type").get("enum")
        if not isinstance(task_types, list) or set(task_types) != {
            "auto",
            "reference",
            "edit",
            "extend",
        }:
            raise InternalCliError(
                "internal CLI Seedance 2.5 reference task-type set is unreviewed"
            )
    elif parameter("off_peak").get("supported") is not False:
        raise InternalCliError(
            "internal CLI Seedance 2.5 transition capability unexpectedly enables off_peak"
        )


def _create_model_parameter(
    mode: str,
    payload: dict[str, Any],
    model: str,
    parameter: str,
) -> dict[str, Any]:
    model_parameters = payload.get("model_parameters")
    by_model = model_parameters.get(parameter) if isinstance(model_parameters, dict) else None
    value = by_model.get(model) if isinstance(by_model, dict) else None
    if not isinstance(value, dict):
        raise InternalCliError(
            f"internal CLI create capability {mode!r} lacks {model} {parameter!r} metadata"
        )
    return value


def _validate_latest_create_models(modes: dict[str, Any]) -> None:
    video = modes["video"]
    reference = modes["reference"]
    transition = modes["transition"]
    if not all(isinstance(item, dict) for item in (video, reference, transition)):
        raise InternalCliError("internal CLI video/reference/transition capabilities must be objects")

    video_models = video.get("model_ids")
    if not isinstance(video_models, list) or not {"flux-3.0", "wan-3.0"}.issubset(video_models):
        raise InternalCliError("internal CLI video capabilities must include FLUX 3 and Wan 3.0")
    for mode, payload in (("reference", reference), ("transition", transition)):
        model_ids = payload.get("model_ids")
        if not isinstance(model_ids, list) or "wan-3.0" not in model_ids:
            raise InternalCliError(f"internal CLI {mode} capabilities must include Wan 3.0")
        if "flux-3.0" in model_ids:
            raise InternalCliError(f"internal CLI {mode} unexpectedly enables FLUX 3")

    expected_flux = {
        "duration": {str(value) for value in range(5, 21)},
        "quality": {"720p", "1080p"},
        "aspect_ratio": {"auto", "21:9", "2:1", "16:9", "4:3", "1:1", "3:4", "9:16"},
    }
    for parameter, expected in expected_flux.items():
        observed = _create_model_parameter("video", video, "flux-3.0", parameter).get("enum")
        if not isinstance(observed, list) or {str(value) for value in observed} != expected:
            raise InternalCliError(f"internal CLI FLUX 3 {parameter} values changed")
    if _create_model_parameter("video", video, "flux-3.0", "audio").get("supported") is not True:
        raise InternalCliError("internal CLI FLUX 3 generated audio must remain supported")
    for parameter in ("multi_shot", "off_peak"):
        if _create_model_parameter("video", video, "flux-3.0", parameter).get("supported") is not False:
            raise InternalCliError(f"internal CLI FLUX 3 unexpectedly enables {parameter}")

    for mode, payload, duration_values in (
        ("video", video, {str(value) for value in range(2, 31)}),
        ("reference", reference, {*(str(value) for value in range(2, 31)), "auto"}),
        ("transition", transition, {str(value) for value in range(2, 31)}),
    ):
        observed_duration = _create_model_parameter(mode, payload, "wan-3.0", "duration").get("enum")
        if not isinstance(observed_duration, list) or {str(value) for value in observed_duration} != duration_values:
            raise InternalCliError(f"internal CLI Wan 3.0 {mode} duration values changed")
        quality = _create_model_parameter(mode, payload, "wan-3.0", "quality").get("enum")
        if not isinstance(quality, list) or set(quality) != {"480p", "720p", "1080p"}:
            raise InternalCliError(f"internal CLI Wan 3.0 {mode} quality values changed")
        if _create_model_parameter(mode, payload, "wan-3.0", "audio").get("supported") is not True:
            raise InternalCliError(f"internal CLI Wan 3.0 {mode} generated audio must remain supported")
        if _create_model_parameter(mode, payload, "wan-3.0", "off_peak").get("supported") is not False:
            raise InternalCliError(f"internal CLI Wan 3.0 {mode} unexpectedly enables off_peak")
    for mode, payload in (("video", video), ("reference", reference)):
        aspects = _create_model_parameter(mode, payload, "wan-3.0", "aspect_ratio").get("enum")
        if not isinstance(aspects, list) or set(aspects) != {
            "auto", "16:9", "4:3", "1:1", "3:4", "9:16"
        }:
            raise InternalCliError(f"internal CLI Wan 3.0 {mode} aspect values changed")
    if _create_model_parameter("video", video, "wan-3.0", "multi_shot").get("supported") is not False:
        raise InternalCliError("internal CLI Wan 3.0 unexpectedly enables multi_shot")
    for parameter, maximum in (("images", 10), ("videos", 5), ("audios", 5)):
        if _create_model_parameter("reference", reference, "wan-3.0", parameter).get("max_count") != maximum:
            raise InternalCliError(
                f"internal CLI Wan 3.0 reference {parameter} limit is no longer {maximum}"
            )
    if _create_model_parameter("reference", reference, "wan-3.0", "task_type").get("supported") is not False:
        raise InternalCliError("internal CLI Wan 3.0 unexpectedly enables task_type")
    metadata = reference.get("model_metadata")
    wan_metadata = metadata.get("wan-3.0") if isinstance(metadata, dict) else None
    if not isinstance(wan_metadata, dict) or wan_metadata.get("max_reference_items") != 20:
        raise InternalCliError("internal CLI Wan 3.0 total reference limit is no longer 20")

    reference_parameters = reference.get("parameters")
    prompt = reference_parameters.get("prompt") if isinstance(reference_parameters, dict) else None
    if not isinstance(prompt, dict) or prompt.get("required") is not True:
        raise InternalCliError("internal CLI reference prompt must remain required")
    transition_rules = transition.get("rules")
    prompt_rule = next(
        (
            rule for rule in transition_rules
            if isinstance(rule, dict) and rule.get("id") == "transition-prompt-required"
        ),
        None,
    ) if isinstance(transition_rules, list) else None
    required_models = (
        prompt_rule.get("when", {}).get("model", {}).get("in", [])
        if isinstance(prompt_rule, dict)
        else []
    )
    if not isinstance(required_models, list) or "wan-3.0" not in required_models:
        raise InternalCliError("internal CLI Wan 3.0 transition prompt requirement is missing")


def _validate_internal_capability_domains(
    capabilities: dict[str, Any],
    command_payloads: dict[str, list[dict[str, Any]]],
) -> None:
    domains = capabilities.get("capability_domains")
    if not isinstance(domains, dict):
        raise InternalCliError("internal CLI capabilities schema 1.2.0 lacks capability_domains")
    create = domains.get("create")
    if not isinstance(create, dict):
        raise InternalCliError("internal CLI capabilities schema 1.2.0 lacks the create domain")
    if create.get("schema_version") != CREATE_CAPABILITIES_SCHEMA:
        raise InternalCliError(
            f"internal CLI create capability schema must be {CREATE_CAPABILITIES_SCHEMA!r}"
        )
    if create.get("encoding") != "normalized":
        raise InternalCliError("internal CLI create capabilities must use normalized encoding")
    modes = create.get("modes")
    if not isinstance(modes, dict):
        raise InternalCliError("internal CLI create capabilities modes must be an object")
    missing_modes = sorted(set(REQUIRED_CREATE_CAPABILITY_MODES) - set(modes))
    if missing_modes:
        raise InternalCliError(
            "internal CLI create capabilities are missing modes: " + ", ".join(missing_modes)
        )
    for mode in REQUIRED_CREATE_CAPABILITY_MODES:
        mode_payload = modes.get(mode)
        command = f"pixverse create {mode}"
        if not isinstance(mode_payload, dict) or mode_payload.get("command") != command:
            raise InternalCliError(
                f"internal CLI create capability {mode!r} must bind to {command!r}"
            )
        if command not in command_payloads:
            raise InternalCliError(
                f"internal CLI create capability {mode!r} does not have a command entry"
            )
    model_catalog = create.get("model_catalog")
    required_models = {"seedance-2.5", "flux-3.0", "wan-3.0"}
    if not isinstance(model_catalog, dict) or any(
        not isinstance(model_catalog.get(model), str) for model in required_models
    ):
        raise InternalCliError(
            "internal CLI create model catalog lacks Seedance 2.5, FLUX 3, or Wan 3.0"
        )
    for mode in ("video", "reference", "transition"):
        _validate_seedance_25_mode(mode, modes[mode])
    _validate_latest_create_models(modes)

    canvas = domains.get("canvas")
    if not isinstance(canvas, dict) or canvas.get("source") != "runtime":
        raise InternalCliError("internal CLI Canvas capability domain must use runtime discovery")
    if canvas.get("discovery") != CANVAS_CAPABILITY_DISCOVERY:
        raise InternalCliError("internal CLI Canvas capability discovery commands changed")

    global_options = capabilities.get("global_options")
    if not isinstance(global_options, dict) or global_options.get(
        PIXVERSE_REGION_OPTION
    ) != PIXVERSE_REGION_OPTION_DESCRIPTION:
        raise InternalCliError("internal CLI global region contract changed")

    bindings = capabilities.get("bindings")
    canvas_bindings = bindings.get("canvas_cli") if isinstance(bindings, dict) else None
    if not isinstance(canvas_bindings, dict):
        raise InternalCliError("internal CLI capabilities schema 1.2.0 lacks Canvas bindings")
    if canvas_bindings.get("schema_version") != CANVAS_BINDINGS_SCHEMA:
        raise InternalCliError(
            f"internal CLI Canvas bindings schema must be {CANVAS_BINDINGS_SCHEMA!r}"
        )
    binding_items = canvas_bindings.get("items")
    if not isinstance(binding_items, list):
        raise InternalCliError("internal CLI Canvas bindings items must be a list")
    if binding_items:
        raise InternalCliError(
            "internal CLI contains unreviewed Canvas CLI bindings; update the wrapper before packaging"
        )


def inspect_internal_cli_zip(
    path: Path,
    *,
    minimum_version: str,
    capabilities_schema: str,
    expected_node_requirement: str | None = None,
) -> InternalCliArtifact:
    source = path.expanduser()
    if source.is_symlink():
        raise InternalCliError(f"internal CLI ZIP must not be a symlink: {source}")
    resolved = source.resolve()
    if not resolved.is_file():
        raise InternalCliError(f"internal CLI ZIP does not exist: {resolved}")
    stat_result = resolved.stat()
    return _inspect_internal_cli_zip_cached(
        str(resolved),
        stat_result.st_mtime_ns,
        stat_result.st_size,
        minimum_version,
        capabilities_schema,
        expected_node_requirement or "",
    )


@lru_cache(maxsize=16)
def _inspect_internal_cli_zip_cached(
    path_text: str,
    _mtime_ns: int,
    _size: int,
    minimum_version: str,
    capabilities_schema: str,
    expected_node_requirement: str,
) -> InternalCliArtifact:
    path = Path(path_text)
    try:
        archive = zipfile.ZipFile(path)
    except zipfile.BadZipFile as exc:
        raise InternalCliError(f"invalid internal CLI ZIP: {exc}") from exc

    with archive:
        infos = archive.infolist()
        if not infos:
            raise InternalCliError("internal CLI ZIP is empty")
        if len(infos) > MAX_ARCHIVE_ENTRIES:
            raise InternalCliError(f"internal CLI ZIP has too many entries: {len(infos)}")
        if sum(item.file_size for item in infos) > MAX_UNCOMPRESSED_BYTES:
            raise InternalCliError("internal CLI ZIP exceeds the uncompressed size limit")
        if archive.testzip() is not None:
            raise InternalCliError("internal CLI ZIP failed CRC verification")

        names = [item.filename for item in infos]
        if len(names) != len(set(names)):
            raise InternalCliError("internal CLI ZIP contains duplicate paths")
        roots: set[str] = set()
        normalized_paths: dict[str, str] = {}
        for item in infos:
            name = item.filename
            pure = PurePosixPath(name)
            windows = PureWindowsPath(name)
            if (
                not name
                or "\\" in name
                or pure.is_absolute()
                or windows.is_absolute()
                or windows.drive
                or ".." in pure.parts
                or any(":" in part for part in pure.parts)
            ):
                raise InternalCliError(f"unsafe path in internal CLI ZIP: {name!r}")
            normalized_path = _platform_archive_path_key(name)
            previous_name = normalized_paths.get(normalized_path)
            if previous_name is not None and previous_name != name:
                raise InternalCliError(
                    "internal CLI ZIP contains platform-colliding paths: "
                    f"{previous_name!r} and {name!r}"
                )
            normalized_paths[normalized_path] = name
            if pure.parts:
                roots.add(pure.parts[0])
            mode = (item.external_attr >> 16) & 0xFFFF
            if stat.S_ISLNK(mode):
                raise InternalCliError(f"symlink is not allowed in internal CLI ZIP: {name}")
            if mode and not (stat.S_ISREG(mode) or stat.S_ISDIR(mode)):
                raise InternalCliError(f"special file is not allowed in internal CLI ZIP: {name}")
        if len(roots) != 1:
            raise InternalCliError("internal CLI ZIP must contain exactly one top-level directory")
        root = next(iter(roots))

        required = {
            f"{root}/package.json",
            f"{root}/dist/index.js",
            f"{root}/dist/capabilities.json",
            f"{root}/pixverse",
            f"{root}/pixverse.cmd",
        }
        missing_files = sorted(required - set(names))
        if missing_files:
            raise InternalCliError("internal CLI ZIP is missing: " + ", ".join(missing_files))
        posix_wrapper_mode = (archive.getinfo(f"{root}/pixverse").external_attr >> 16) & 0o777
        if not posix_wrapper_mode & 0o111:
            raise InternalCliError("internal CLI POSIX wrapper must be executable")

        package_bytes = archive.read(f"{root}/package.json")
        capabilities_bytes = archive.read(f"{root}/dist/capabilities.json")
        try:
            package = json.loads(package_bytes)
            capabilities = json.loads(capabilities_bytes)
        except json.JSONDecodeError as exc:
            raise InternalCliError(f"internal CLI metadata is invalid JSON: {exc}") from exc
        if not isinstance(package, dict) or not isinstance(capabilities, dict):
            raise InternalCliError("internal CLI metadata must contain JSON objects")

        package_name = str(package.get("name") or "")
        version = str(package.get("version") or "")
        core_version = normalize_version(version)
        node_requirement = str((package.get("engines") or {}).get("node") or "")
        binary = (package.get("bin") or {}).get("pixverse")
        if package_name != "pixverse-internal":
            raise InternalCliError(f"unexpected internal CLI package name: {package_name!r}")
        if not version or not core_version:
            raise InternalCliError(f"invalid internal CLI version: {version!r}")
        if not version_at_least(core_version, minimum_version):
            raise InternalCliError(
                f"internal CLI {version!r} is below the plugin minimum {minimum_version}"
            )
        if binary != "./dist/index.js":
            raise InternalCliError(f"unexpected internal CLI bin entry: {binary!r}")
        if not re.fullmatch(r"\s*>=\s*\d+\.\d+\.\d+\s*", node_requirement):
            raise InternalCliError(f"unsupported internal CLI Node requirement: {node_requirement!r}")
        if expected_node_requirement and node_requirement.strip() != expected_node_requirement.strip():
            raise InternalCliError(
                "internal CLI Node requirement "
                f"{node_requirement!r} does not match plugin requirement {expected_node_requirement!r}"
            )

        observed_schema = str(capabilities.get("schema_version") or "")
        if observed_schema != capabilities_schema:
            raise InternalCliError(
                f"internal CLI capabilities schema {observed_schema!r} does not match {capabilities_schema!r}"
            )
        commands_payload = capabilities.get("commands")
        if not isinstance(commands_payload, list):
            raise InternalCliError("internal CLI capabilities commands must be a list")
        command_payloads: dict[str, list[dict[str, Any]]] = {}
        for item in commands_payload:
            if isinstance(item, dict) and isinstance(item.get("cmd"), str):
                command_payloads.setdefault(str(item["cmd"]), []).append(item)
        commands = tuple(sorted(command for command in command_payloads for _ in command_payloads[command]))
        missing_commands = sorted(set(REQUIRED_COMMANDS) - set(command_payloads))
        if missing_commands:
            raise InternalCliError(
                "internal CLI is missing required commands: " + ", ".join(missing_commands)
            )
        duplicate_required_commands = sorted(
            command for command in REQUIRED_COMMANDS if len(command_payloads.get(command, [])) != 1
        )
        if duplicate_required_commands:
            raise InternalCliError(
                "internal CLI capabilities contain duplicate required commands: "
                + ", ".join(duplicate_required_commands)
            )
        non_runnable_required_commands = sorted(
            command
            for command in REQUIRED_COMMANDS
            if command_payloads[command][0].get("run") is not True
        )
        if non_runnable_required_commands:
            raise InternalCliError(
                "internal CLI required commands are not runnable: "
                + ", ".join(non_runnable_required_commands)
            )
        if observed_schema == "1.2.0":
            _validate_internal_capability_domains(capabilities, command_payloads)
        canvas_runnable_payloads = [
            item
            for item in commands_payload
            if isinstance(item, dict)
            and item.get("run") is True
            and isinstance(item.get("cmd"), str)
            and (
                str(item["cmd"]).startswith("pixverse canvas ")
                or str(item["cmd"]) == "pixverse capabilities canvas"
            )
        ]
        canvas_runnable_commands = {str(item["cmd"]) for item in canvas_runnable_payloads}
        if len(canvas_runnable_payloads) != len(canvas_runnable_commands):
            raise InternalCliError("internal CLI capabilities contain duplicate runnable Canvas commands")
        reviewed_canvas_commands = set(CANVAS_REVIEWED_COMMAND_POLICIES)
        missing_canvas_commands = sorted(
            reviewed_canvas_commands - canvas_runnable_commands - CANVAS_OPTIONAL_REVIEWED_COMMANDS
        )
        if missing_canvas_commands:
            raise InternalCliError(
                "internal CLI is missing reviewed Canvas commands: " + ", ".join(missing_canvas_commands)
            )
        unreviewed_canvas_commands = sorted(canvas_runnable_commands - reviewed_canvas_commands)
        if unreviewed_canvas_commands:
            raise InternalCliError(
                "internal CLI contains unreviewed runnable Canvas commands; update the plugin's Canvas "
                "read/mutation policy before packaging: " + ", ".join(unreviewed_canvas_commands)
            )
        canvas_contract_issues = [
            issue
            for item in canvas_runnable_payloads
            for issue in canvas_command_contract_issues(item)
        ]
        if canvas_contract_issues:
            raise InternalCliError(
                "internal CLI Canvas capability contract changed; review wrapper policy before packaging: "
                + "; ".join(canvas_contract_issues)
            )
        capabilities_cli = capabilities.get("cli")
        capabilities_version = (
            str(capabilities_cli.get("version") or "") if isinstance(capabilities_cli, dict) else ""
        )
        if capabilities_version and normalize_version(capabilities_version) != core_version:
            raise InternalCliError(
                f"capabilities CLI version {capabilities_version!r} does not match package {version!r}"
            )

        return InternalCliArtifact(
            path=path,
            archive_sha256=file_sha256(path),
            archive_root=root,
            package_name=package_name,
            version=version,
            core_version=core_version,
            node_requirement=node_requirement.strip(),
            capabilities_schema=observed_schema,
            capabilities_sha256=bytes_sha256(capabilities_bytes),
            command_count=len(commands_payload),
            commands=commands,
            has_lockfile=f"{root}/package-lock.json" in names,
        )


def discover_internal_cli_zip(root: Path, explicit: Path | None = None) -> Path:
    if explicit is not None:
        return _absolute_without_resolving(explicit)
    configured = os.environ.get("PIXVERSE_INTERNAL_CLI_ZIP", "").strip()
    if configured:
        return _absolute_without_resolving(Path(configured))
    directory = root / SOURCE_CLI_DIRECTORY
    candidates = sorted(directory.glob("*.zip")) if directory.is_dir() else []
    if not candidates:
        raise InternalCliError(
            f"no internal CLI ZIP found in {directory}; pass --internal-cli-zip or set PIXVERSE_INTERNAL_CLI_ZIP"
        )
    if len(candidates) > 1:
        names = ", ".join(path.name for path in candidates)
        raise InternalCliError(
            f"multiple internal CLI ZIPs found in {directory}: {names}; select one explicitly"
        )
    return _absolute_without_resolving(candidates[0])


def _absolute_without_resolving(path: Path) -> Path:
    expanded = path.expanduser()
    return expanded if expanded.is_absolute() else (Path.cwd() / expanded).absolute()


def internal_cli_source_present(root: Path) -> bool:
    if (root / BUNDLED_CLI_MANIFEST).is_file():
        return True
    directory = root / SOURCE_CLI_DIRECTORY
    return directory.is_dir() and any(directory.glob("*.zip"))


def load_internal_cli_artifact(
    root: Path,
    *,
    minimum_version: str,
    capabilities_schema: str,
    expected_node_requirement: str | None = None,
) -> InternalCliArtifact:
    manifest_path = root / BUNDLED_CLI_MANIFEST
    if manifest_path.is_file():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise InternalCliError(f"invalid bundled internal CLI manifest: {exc}") from exc
        if not isinstance(manifest, dict) or manifest.get("channel") != INTERNAL_CLI_CHANNEL:
            raise InternalCliError("bundled internal CLI manifest does not declare the internal channel")
        if manifest.get("schema_version") != 1 or manifest.get("distribution") != "standalone-zip":
            raise InternalCliError("bundled internal CLI manifest has an unsupported format")
        artifact_name = str(manifest.get("artifact") or "")
        if artifact_name != "pixverse-internal.zip":
            raise InternalCliError(f"unexpected bundled internal CLI artifact name: {artifact_name!r}")
        artifact_path = (manifest_path.parent / artifact_name).resolve()
        if artifact_path.parent != manifest_path.parent.resolve():
            raise InternalCliError("bundled internal CLI artifact path escapes its directory")
        artifact = inspect_internal_cli_zip(
            artifact_path,
            minimum_version=minimum_version,
            capabilities_schema=capabilities_schema,
            expected_node_requirement=expected_node_requirement,
        )
        expected = {
            "artifact_sha256": artifact.archive_sha256,
            "package": artifact.package_name,
            "version": artifact.version,
            "core_version": artifact.core_version,
            "node": artifact.node_requirement,
        }
        for key, value in expected.items():
            if manifest.get(key) != value:
                raise InternalCliError(
                    f"bundled internal CLI manifest {key} {manifest.get(key)!r} does not match {value!r}"
                )
        capabilities = manifest.get("capabilities")
        if not isinstance(capabilities, dict):
            raise InternalCliError("bundled internal CLI manifest lacks capabilities metadata")
        expected_capabilities = {
            "path": "dist/capabilities.json",
            "schema_version": artifact.capabilities_schema,
            "sha256": artifact.capabilities_sha256,
            "command_count": artifact.command_count,
        }
        for key, value in expected_capabilities.items():
            if capabilities.get(key) != value:
                raise InternalCliError(
                    f"bundled internal CLI capabilities {key} {capabilities.get(key)!r} does not match {value!r}"
                )
        return artifact

    source = discover_internal_cli_zip(root)
    return inspect_internal_cli_zip(
        source,
        minimum_version=minimum_version,
        capabilities_schema=capabilities_schema,
        expected_node_requirement=expected_node_requirement,
    )


def active_record(runtime_root: Path) -> dict[str, Any]:
    path = runtime_root / ACTIVE_RECORD_FILENAME
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def active_install_root(runtime_root: Path) -> Path:
    relative = str(active_record(runtime_root).get("root") or "")
    if not relative:
        return runtime_root / "versions" / "missing"
    pure = PurePosixPath(relative)
    if pure.is_absolute() or ".." in pure.parts:
        return runtime_root / "versions" / "invalid"
    candidate = runtime_root.joinpath(*pure.parts).resolve()
    versions = (runtime_root / "versions").resolve()
    if candidate == versions or versions not in candidate.parents:
        return runtime_root / "versions" / "invalid"
    return candidate


def active_matches_artifact(runtime_root: Path, artifact: InternalCliArtifact) -> bool:
    record = active_record(runtime_root)
    root = active_install_root(runtime_root)
    return bool(
        record.get("channel") == INTERNAL_CLI_CHANNEL
        and record.get("artifact_sha256") == artifact.archive_sha256
        and record.get("version") == artifact.version
        and _installed_runtime_matches(root, artifact)
    )


CommandRunner = Callable[[list[str], Path, int], subprocess.CompletedProcess[str]]


def _default_command_runner(argv: list[str], cwd: Path, timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        argv,
        cwd=cwd,
        check=False,
        text=True,
        capture_output=True,
        timeout=timeout,
    )


def install_internal_cli(
    artifact: InternalCliArtifact,
    runtime_root: Path,
    *,
    node: str,
    npm: str,
    timeout: int = 600,
    command_runner: CommandRunner = _default_command_runner,
) -> dict[str, Any]:
    runtime_root.mkdir(parents=True, exist_ok=True)
    lock_state_path = runtime_root / INSTALL_LOCK_STATE_FILENAME
    try:
        with canvas_sync_lock(lock_state_path, timeout_seconds=float(timeout)):
            return _install_internal_cli_locked(
                artifact,
                runtime_root,
                node=node,
                npm=npm,
                timeout=timeout,
                command_runner=command_runner,
            )
    except CanvasSyncLockError as exc:
        raise InternalCliInstallError(
            f"timed out waiting for another internal CLI installation in {runtime_root}"
        ) from exc


def _install_internal_cli_locked(
    artifact: InternalCliArtifact,
    runtime_root: Path,
    *,
    node: str,
    npm: str,
    timeout: int,
    command_runner: CommandRunner,
) -> dict[str, Any]:
    versions = runtime_root / "versions"
    versions.mkdir(parents=True, exist_ok=True)
    version_slug = re.sub(r"[^A-Za-z0-9._-]+", "-", artifact.version).strip("-.") or "unknown"
    destination = versions / f"{version_slug}-{artifact.archive_sha256[:12]}"
    relative_root = destination.relative_to(runtime_root).as_posix()

    active_root = active_install_root(runtime_root)
    if active_matches_artifact(runtime_root, artifact) and _runtime_smoke_matches(
        active_root,
        artifact,
        node=node,
        command_runner=command_runner,
    ):
        return _install_result(artifact, runtime_root, active_root, reused=True)
    active_is_destination = active_root.resolve() == destination.resolve()
    if (
        not active_is_destination
        and _installed_runtime_matches(destination, artifact)
        and _runtime_smoke_matches(
            destination,
            artifact,
            node=node,
            command_runner=command_runner,
        )
    ):
        _write_active_record(runtime_root, artifact, relative_root)
        return _install_result(artifact, runtime_root, destination, reused=True)

    staging = Path(tempfile.mkdtemp(prefix=".internal-cli-staging-", dir=runtime_root))
    try:
        _extract_internal_cli(artifact, staging)
        install_argv = [npm, "ci" if artifact.has_lockfile else "install", "--omit=dev", "--no-audit", "--no-fund"]
        dependency_result = command_runner(install_argv, staging, timeout)
        if dependency_result.returncode != 0:
            detail = (dependency_result.stderr or dependency_result.stdout or "unknown npm error").strip()
            raise InternalCliInstallError(f"internal CLI dependency installation failed: {detail}")

        smoke_result = command_runner([str(_runtime_executable(staging)), "--version"], staging, 30)
        reported_version = (smoke_result.stdout or smoke_result.stderr or "").strip()
        if smoke_result.returncode != 0 or normalize_version(reported_version) != artifact.core_version:
            raise InternalCliInstallError(
                f"internal CLI smoke test reported {reported_version!r}, expected {artifact.core_version!r}"
            )

        install_record = artifact.bundle_manifest()
        install_record.update({"installed_root": relative_root, "reported_version": reported_version})
        (staging / INSTALL_RECORD_FILENAME).write_text(
            json.dumps(install_record, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        if destination.exists():
            shutil.rmtree(destination)
        os.replace(staging, destination)
        _write_active_record(runtime_root, artifact, relative_root)
        return _install_result(artifact, runtime_root, destination, reused=False)
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def _extract_internal_cli(artifact: InternalCliArtifact, destination: Path) -> None:
    resolved_destination = destination.resolve()
    with zipfile.ZipFile(artifact.path) as archive:
        for item in archive.infolist():
            pure = PurePosixPath(item.filename)
            relative_parts = pure.parts[1:]
            if not relative_parts:
                continue
            target = destination.joinpath(*relative_parts)
            resolved_target = target.resolve()
            if resolved_target == resolved_destination or resolved_destination not in resolved_target.parents:
                raise InternalCliInstallError(
                    f"internal CLI extraction path escaped the staging directory: {item.filename!r}"
                )
            if item.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(item) as source, target.open("wb") as output:
                shutil.copyfileobj(source, output)
            mode = ((item.external_attr >> 16) & 0o777) or 0o644
            target.chmod(mode)


def _installed_runtime_matches(destination: Path, artifact: InternalCliArtifact) -> bool:
    try:
        record = json.loads((destination / INSTALL_RECORD_FILENAME).read_text(encoding="utf-8"))
        package = json.loads((destination / "package.json").read_text(encoding="utf-8"))
        capabilities_path = destination / "dist" / "capabilities.json"
        capabilities_sha256 = file_sha256(capabilities_path)
    except (OSError, json.JSONDecodeError):
        return False
    dependencies = package.get("dependencies") if isinstance(package, dict) else None
    dependencies_ready = not isinstance(dependencies, dict) or not dependencies or (destination / "node_modules").is_dir()
    record_capabilities = record.get("capabilities") if isinstance(record, dict) else None
    return bool(
        isinstance(record, dict)
        and record.get("artifact_sha256") == artifact.archive_sha256
        and record.get("version") == artifact.version
        and isinstance(record_capabilities, dict)
        and record_capabilities.get("sha256") == artifact.capabilities_sha256
        and isinstance(package, dict)
        and package.get("name") == artifact.package_name
        and package.get("version") == artifact.version
        and (package.get("bin") or {}).get("pixverse") == "./dist/index.js"
        and capabilities_sha256 == artifact.capabilities_sha256
        and dependencies_ready
        and (destination / "package.json").is_file()
        and (destination / "dist" / "index.js").is_file()
        and _runtime_executable_is_usable(destination)
    )


def _runtime_smoke_matches(
    destination: Path,
    artifact: InternalCliArtifact,
    *,
    node: str,
    command_runner: CommandRunner,
) -> bool:
    try:
        if not _runtime_executable_is_usable(destination):
            return False
        result = command_runner([str(_runtime_executable(destination)), "--version"], destination, 30)
    except (OSError, subprocess.SubprocessError):
        return False
    reported_version = (result.stdout or result.stderr or "").strip()
    return result.returncode == 0 and normalize_version(reported_version) == artifact.core_version


def _write_active_record(
    runtime_root: Path,
    artifact: InternalCliArtifact,
    relative_root: str,
) -> None:
    record = {
        "schema_version": 1,
        "channel": INTERNAL_CLI_CHANNEL,
        "distribution": "standalone-zip",
        "version": artifact.version,
        "core_version": artifact.core_version,
        "artifact_sha256": artifact.archive_sha256,
        "capabilities_sha256": artifact.capabilities_sha256,
        "root": relative_root,
    }
    handle = tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        prefix=".active-",
        suffix=".json",
        dir=runtime_root,
        delete=False,
    )
    temporary = Path(handle.name)
    try:
        json.dump(record, handle, indent=2, ensure_ascii=False, sort_keys=True)
        handle.write("\n")
        handle.close()
        os.replace(temporary, runtime_root / ACTIVE_RECORD_FILENAME)
    finally:
        if not handle.closed:
            handle.close()
        temporary.unlink(missing_ok=True)


def _install_result(
    artifact: InternalCliArtifact,
    runtime_root: Path,
    install_root: Path,
    *,
    reused: bool,
) -> dict[str, Any]:
    return {
        "channel": INTERNAL_CLI_CHANNEL,
        "source": "bundled-zip",
        "version": artifact.version,
        "core_version": artifact.core_version,
        "artifact_sha256": artifact.archive_sha256,
        "runtime": str(runtime_root),
        "install_root": str(install_root),
        "executable": str(install_root / ("pixverse.cmd" if os.name == "nt" else "pixverse")),
        "reused": reused,
    }
