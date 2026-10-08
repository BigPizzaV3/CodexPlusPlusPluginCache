from __future__ import annotations

import copy
import json
import math
import re
from dataclasses import asdict, dataclass
from importlib.resources import files
from pathlib import Path
from typing import Any

from ragops.loader import ContractError


@dataclass(frozen=True)
class ContractDescriptor:
    kind: str
    version: str
    schema_file: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


@dataclass(frozen=True)
class ValidationResult:
    kind: str
    version: str
    schema_file: str
    valid: bool = True

    def to_dict(self) -> dict[str, str | bool]:
        return asdict(self)


@dataclass(frozen=True)
class ContractDiff:
    kind: str
    from_version: str
    to_version: str
    compatibility: str
    added_required_fields: tuple[str, ...]
    removed_required_fields: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


_CONTRACTS = (
    ContractDescriptor("scenario", "0.1", "scenario-0.1.schema.json"),
    ContractDescriptor("scenario", "0.2", "scenario-0.2.schema.json"),
    ContractDescriptor("trace", "0.3", "trace-0.3.schema.json"),
    ContractDescriptor("trace", "0.4", "trace-0.4.schema.json"),
)


def registered_contracts() -> tuple[ContractDescriptor, ...]:
    return _CONTRACTS


def validate_contract(data: object, kind: str = "auto") -> ValidationResult:
    if not isinstance(data, dict):
        raise ContractError("Contract input must be a JSON object")
    resolved_kind = _detect_kind(data) if kind == "auto" else kind
    if resolved_kind not in {"scenario", "trace"}:
        raise ContractError(f"Unsupported contract kind: {resolved_kind}")
    version = data.get("schema_version")
    if resolved_kind == "trace" and version is None:
        version = "0.3"
    if not isinstance(version, str):
        raise ContractError(f"{resolved_kind.capitalize()} schema_version must be a string")
    descriptor = _descriptor(resolved_kind, version)
    schema = _schema_document(descriptor.schema_file)
    _validate_schema(data, schema, path=resolved_kind)
    return ValidationResult(descriptor.kind, descriptor.version, descriptor.schema_file)


def diff_contract(kind: str, from_version: str, to_version: str) -> ContractDiff:
    source = _schema_document(_descriptor(kind, from_version).schema_file)
    target = _schema_document(_descriptor(kind, to_version).schema_file)
    source_required = _required_paths(source)
    target_required = _required_paths(target)
    added = tuple(sorted(target_required - source_required))
    removed = tuple(sorted(source_required - target_required))
    compatibility = "migration-required" if added or removed else "compatible"
    return ContractDiff(kind, from_version, to_version, compatibility, added, removed)


def migrate_contract(
    data: object,
    kind: str,
    from_version: str,
    to_version: str,
    *,
    question: str = "",
) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise ContractError("Contract input must be a JSON object")
    validate_contract(data, kind)
    actual_version = data.get("schema_version", "0.3" if kind == "trace" else None)
    if actual_version != from_version:
        raise ContractError(
            f"Declared migration source {from_version!r} does not match input {actual_version!r}"
        )
    migrated = copy.deepcopy(data)
    if (kind, from_version, to_version) == ("scenario", "0.1", "0.2"):
        migrated["schema_version"] = "0.2"
        migrated["thresholds"].setdefault("citation_precision", 0.0)
        for case in migrated["cases"]:
            case.setdefault("category", "unspecified")
            case.setdefault("severity", "medium")
            case.setdefault("language", "und")
    elif (kind, from_version, to_version) == ("trace", "0.3", "0.4"):
        migrated["schema_version"] = "0.4"
        migrated.setdefault("input", {"question": question})
        metadata = migrated.setdefault("metadata", {})
        if not isinstance(metadata, dict):
            raise ContractError("Trace metadata must be an object")
        metadata["migrated_from"] = "0.3"
    else:
        raise ContractError(
            f"Unsupported {kind} migration: {from_version} -> {to_version}"
        )
    validate_contract(migrated, kind)
    return migrated


def _detect_kind(data: dict[str, Any]) -> str:
    candidates = []
    if "thresholds" in data and "cases" in data:
        candidates.append("scenario")
    if "case_id" in data and "output" in data:
        candidates.append("trace")
    if len(candidates) != 1:
        raise ContractError(f"Cannot identify contract kind; candidates={candidates}")
    return candidates[0]


def _descriptor(kind: str, version: str) -> ContractDescriptor:
    for descriptor in _CONTRACTS:
        if descriptor.kind == kind and descriptor.version == version:
            return descriptor
    raise ContractError(f"Unsupported {kind} schema: {version}")


def _schema_document(filename: str) -> dict[str, Any]:
    repository_schema = Path(__file__).resolve().parents[2] / "schemas" / filename
    try:
        if repository_schema.is_file():
            return json.loads(repository_schema.read_text(encoding="utf-8"))
        resource = files("ragops").joinpath("schemas", filename)
        return json.loads(resource.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ContractError(f"Cannot load contract schema {filename}: {exc}") from exc


def _required_paths(schema: dict[str, Any], prefix: str = "") -> set[str]:
    paths: set[str] = set()
    required = schema.get("required", [])
    properties = schema.get("properties", {})
    if isinstance(required, list):
        for name in required:
            path = f"{prefix}.{name}" if prefix else str(name)
            paths.add(path)
    if isinstance(properties, dict):
        for name, child in properties.items():
            if not isinstance(child, dict):
                continue
            path = f"{prefix}.{name}" if prefix else name
            paths.update(_required_paths(child, path))
            items = child.get("items")
            if isinstance(items, dict):
                paths.update(_required_paths(items, f"{path}[]"))
    return paths


def _validate_schema(value: Any, schema: dict[str, Any], *, path: str) -> None:
    if "const" in schema and value != schema["const"]:
        raise ContractError(f"{path} must equal {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        raise ContractError(f"{path} must be one of {schema['enum']}")
    expected = schema.get("type")
    if expected is not None and not _matches_type(value, expected):
        raise ContractError(f"{path} must have JSON type {expected}")
    if isinstance(value, dict):
        properties = schema.get("properties", {})
        required = schema.get("required", [])
        missing = [name for name in required if name not in value]
        if missing:
            raise ContractError(f"{path} missing required fields: {missing}")
        if schema.get("additionalProperties") is False:
            unknown = sorted(set(value) - set(properties))
            if unknown:
                raise ContractError(f"{path} has unknown fields: {unknown}")
        for name, item in value.items():
            child = properties.get(name)
            if isinstance(child, dict):
                _validate_schema(item, child, path=f"{path}.{name}")
    if isinstance(value, list):
        minimum = schema.get("minItems")
        if isinstance(minimum, int) and len(value) < minimum:
            raise ContractError(f"{path} must contain at least {minimum} items")
        if schema.get("uniqueItems") and len({json.dumps(item, sort_keys=True) for item in value}) != len(value):
            raise ContractError(f"{path} items must be unique")
        child = schema.get("items")
        if isinstance(child, dict):
            for index, item in enumerate(value):
                _validate_schema(item, child, path=f"{path}[{index}]")
    if isinstance(value, str):
        minimum_length = schema.get("minLength")
        if isinstance(minimum_length, int) and len(value) < minimum_length:
            raise ContractError(f"{path} must have length at least {minimum_length}")
        pattern = schema.get("pattern")
        if isinstance(pattern, str) and re.fullmatch(pattern, value) is None:
            raise ContractError(f"{path} does not match required pattern")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if not math.isfinite(float(value)):
            raise ContractError(f"{path} must be finite")
        if "minimum" in schema and value < schema["minimum"]:
            raise ContractError(f"{path} must be at least {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            raise ContractError(f"{path} must be at most {schema['maximum']}")


def _matches_type(value: Any, expected: str | list[str]) -> bool:
    options = [expected] if isinstance(expected, str) else expected
    checks = {
        "object": lambda item: isinstance(item, dict),
        "array": lambda item: isinstance(item, list),
        "string": lambda item: isinstance(item, str),
        "number": lambda item: isinstance(item, (int, float)) and not isinstance(item, bool),
        "integer": lambda item: isinstance(item, int) and not isinstance(item, bool),
        "boolean": lambda item: isinstance(item, bool),
        "null": lambda item: item is None,
    }
    return any(checks[option](value) for option in options if option in checks)
