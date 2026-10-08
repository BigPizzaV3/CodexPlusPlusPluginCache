from __future__ import annotations

import hashlib
import json
import mimetypes
import re
import shutil
import tempfile
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Any, Mapping

from ragops.loader import ContractError

DEFAULT_MAX_ARTIFACT_BYTES = 50 * 1024 * 1024
_DECISIONS = {"PASS", "WARN", "BLOCK"}
_LOGICAL_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")


@dataclass(frozen=True)
class ArtifactRecord:
    logical_name: str
    path: str
    media_type: str
    bytes: int
    sha256: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class EvidenceManifest:
    schema_version: str
    ragops_version: str
    created_at: str
    decision: str
    limitations: tuple[str, ...]
    artifacts: tuple[ArtifactRecord, ...]
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "ragops_version": self.ragops_version,
            "created_at": self.created_at,
            "decision": self.decision,
            "limitations": list(self.limitations),
            "artifacts": [artifact.to_dict() for artifact in self.artifacts],
            "metadata": self.metadata,
        }

    def canonical_bytes(self) -> bytes:
        return _canonical_json(self.to_dict())


def create_evidence_bundle(
    output: str | Path,
    artifacts: Mapping[str, str | Path],
    decision: str,
    limitations: tuple[str, ...],
    created_at: str,
    metadata: Mapping[str, Any],
    *,
    max_artifact_bytes: int = DEFAULT_MAX_ARTIFACT_BYTES,
) -> EvidenceManifest:
    _validate_decision(decision)
    _validate_timestamp(created_at)
    if not artifacts:
        raise ContractError("Evidence bundle requires at least one artifact")
    if not limitations or any(not isinstance(item, str) or not item.strip() for item in limitations):
        raise ContractError("Evidence bundle limitations must be non-empty strings")
    if isinstance(max_artifact_bytes, bool) or max_artifact_bytes <= 0:
        raise ContractError("Evidence artifact byte limit must be positive")
    normalized_metadata = _json_object(metadata, "Evidence metadata")
    target = Path(output)
    if target.exists() or target.is_symlink():
        raise FileExistsError(f"Evidence bundle already exists: {target}")
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=f".{target.name}-", dir=target.parent))
    try:
        artifact_dir = temporary / "artifacts"
        artifact_dir.mkdir()
        records = []
        destinations: set[str] = set()
        for logical_name, raw_source in sorted(artifacts.items()):
            if not isinstance(logical_name, str) or _LOGICAL_NAME.fullmatch(logical_name) is None:
                raise ContractError(f"Invalid evidence artifact logical name: {logical_name!r}")
            source = Path(raw_source)
            if source.is_symlink() or not source.is_file():
                raise ContractError(f"Evidence artifact must be a regular non-symlink file: {source}")
            size = source.stat().st_size
            if size > max_artifact_bytes:
                raise ContractError(
                    f"Evidence artifact {logical_name!r} exceeds {max_artifact_bytes} bytes"
                )
            suffix = "".join(source.suffixes[-2:]) if source.name.endswith(".tar.gz") else source.suffix
            filename = f"{logical_name}{suffix}"
            if filename in destinations:
                raise ContractError(f"Duplicate evidence artifact destination: {filename}")
            destinations.add(filename)
            destination = artifact_dir / filename
            shutil.copyfile(source, destination)
            relative = destination.relative_to(temporary).as_posix()
            records.append(
                ArtifactRecord(
                    logical_name=logical_name,
                    path=relative,
                    media_type=mimetypes.guess_type(source.name)[0] or "application/octet-stream",
                    bytes=size,
                    sha256=_digest(destination),
                )
            )
        manifest = EvidenceManifest(
            schema_version="1.0",
            ragops_version=_ragops_version(),
            created_at=created_at,
            decision=decision,
            limitations=tuple(limitations),
            artifacts=tuple(records),
            metadata=normalized_metadata,
        )
        (temporary / "manifest.json").write_bytes(manifest.canonical_bytes() + b"\n")
        temporary.rename(target)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    return manifest


def load_evidence_manifest(path: str | Path) -> EvidenceManifest:
    manifest_path = Path(path)
    if manifest_path.is_dir():
        manifest_path = manifest_path / "manifest.json"
    if manifest_path.is_symlink() or not manifest_path.is_file():
        raise ContractError(f"Evidence manifest must be a regular non-symlink file: {manifest_path}")
    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ContractError(f"Cannot load evidence manifest: {exc}") from exc
    if not isinstance(data, dict):
        raise ContractError("Evidence manifest must be a JSON object")
    expected = {
        "schema_version",
        "ragops_version",
        "created_at",
        "decision",
        "limitations",
        "artifacts",
        "metadata",
    }
    if set(data) != expected:
        raise ContractError("Evidence manifest fields do not match schema 1.0")
    if data["schema_version"] != "1.0":
        raise ContractError(f"Unsupported evidence bundle schema: {data['schema_version']}")
    _validate_decision(data["decision"])
    _validate_timestamp(data["created_at"])
    if not isinstance(data["ragops_version"], str) or not data["ragops_version"]:
        raise ContractError("Evidence ragops_version must be a non-empty string")
    limitations = data["limitations"]
    if not isinstance(limitations, list) or not limitations or any(
        not isinstance(item, str) or not item.strip() for item in limitations
    ):
        raise ContractError("Evidence limitations must be non-empty strings")
    raw_artifacts = data["artifacts"]
    if not isinstance(raw_artifacts, list) or not raw_artifacts:
        raise ContractError("Evidence manifest requires at least one artifact")
    records = tuple(_artifact_record(item) for item in raw_artifacts)
    if len({item.logical_name for item in records}) != len(records):
        raise ContractError("Evidence artifact logical names must be unique")
    if len({item.path for item in records}) != len(records):
        raise ContractError("Evidence artifact paths must be unique")
    return EvidenceManifest(
        schema_version="1.0",
        ragops_version=data["ragops_version"],
        created_at=data["created_at"],
        decision=data["decision"],
        limitations=tuple(limitations),
        artifacts=records,
        metadata=_json_object(data["metadata"], "Evidence metadata"),
    )


def verify_evidence_bundle(path: str | Path) -> EvidenceManifest:
    root = Path(path)
    if root.is_symlink() or not root.is_dir():
        raise ContractError(f"Evidence bundle must be a regular non-symlink directory: {root}")
    manifest = load_evidence_manifest(root / "manifest.json")
    declared = {"manifest.json"}
    for record in manifest.artifacts:
        relative = _safe_artifact_path(record.path)
        artifact = root.joinpath(*relative.parts)
        declared.add(relative.as_posix())
        if artifact.is_symlink() or not artifact.is_file():
            raise ContractError(f"Evidence artifact is missing or not regular: {record.path}")
        if artifact.stat().st_size != record.bytes:
            raise ContractError(f"Evidence artifact size mismatch: {record.logical_name}")
        if _digest(artifact) != record.sha256:
            raise ContractError(f"Evidence artifact digest mismatch: {record.logical_name}")
    actual = set()
    for item in root.rglob("*"):
        if item.is_symlink():
            raise ContractError(f"Evidence bundle contains symlink: {item.relative_to(root)}")
        if item.is_file():
            actual.add(item.relative_to(root).as_posix())
    extra = sorted(actual - declared)
    if extra:
        raise ContractError(f"Evidence bundle contains undeclared files: {extra}")
    missing = sorted(declared - actual)
    if missing:
        raise ContractError(f"Evidence bundle is missing declared files: {missing}")
    return manifest


def _artifact_record(value: object) -> ArtifactRecord:
    if not isinstance(value, dict):
        raise ContractError("Evidence artifact record must be an object")
    expected = {"logical_name", "path", "media_type", "bytes", "sha256"}
    if set(value) != expected:
        raise ContractError("Evidence artifact fields do not match schema 1.0")
    logical_name = value["logical_name"]
    if not isinstance(logical_name, str) or _LOGICAL_NAME.fullmatch(logical_name) is None:
        raise ContractError("Evidence artifact logical name is invalid")
    if not isinstance(value["path"], str):
        raise ContractError("Evidence artifact path must be a string")
    _safe_artifact_path(value["path"])
    if not isinstance(value["media_type"], str) or not value["media_type"]:
        raise ContractError("Evidence artifact media_type must be a non-empty string")
    size = value["bytes"]
    if isinstance(size, bool) or not isinstance(size, int) or size < 0:
        raise ContractError("Evidence artifact bytes must be a non-negative integer")
    digest = value["sha256"]
    if not isinstance(digest, str) or re.fullmatch(r"[0-9a-f]{64}", digest) is None:
        raise ContractError("Evidence artifact sha256 must be lowercase hexadecimal")
    return ArtifactRecord(logical_name, value["path"], value["media_type"], size, digest)


def _safe_artifact_path(value: str) -> PurePosixPath:
    path = PurePosixPath(value)
    if path.is_absolute() or not path.parts or path.parts[0] != "artifacts" or ".." in path.parts:
        raise ContractError(f"Invalid evidence artifact path: {value!r}")
    if len(path.parts) != 2 or path.parts[1] in {"", "."}:
        raise ContractError(f"Invalid evidence artifact path: {value!r}")
    return path


def _validate_decision(value: object) -> None:
    if value not in _DECISIONS:
        raise ContractError("Evidence decision must be PASS, WARN, or BLOCK")


def _validate_timestamp(value: object) -> None:
    if not isinstance(value, str):
        raise ContractError("Evidence created_at must be an ISO-8601 timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ContractError("Evidence created_at must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None:
        raise ContractError("Evidence created_at must include a timezone")


def _json_object(value: Mapping[str, Any] | object, label: str) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        raise ContractError(f"{label} must be an object")
    try:
        encoded = _canonical_json(dict(value))
        decoded = json.loads(encoded)
    except (TypeError, ValueError) as exc:
        raise ContractError(f"{label} must contain finite JSON values") from exc
    if not isinstance(decoded, dict):
        raise ContractError(f"{label} must be an object")
    return decoded


def _canonical_json(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def _digest(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def _ragops_version() -> str:
    from ragops import __version__

    return __version__
