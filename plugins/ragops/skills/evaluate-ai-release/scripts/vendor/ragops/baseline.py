from __future__ import annotations

import hashlib
import json
import math
import os
import tempfile
import tomllib
from dataclasses import asdict
from datetime import datetime
from pathlib import Path

from ragops.config import load_sequential_policy, load_statistical_policy
from ragops.loader import ContractError
from ragops.models import (
    ArtifactDigest,
    BaselineAcceptance,
    BaselineManifest,
    ReplayProvenance,
)
from ragops.statistical import load_replay_bundle

MAX_BUNDLE_BYTES = 100_000_000
MAX_POLICY_BYTES = 1_000_000
MAX_MANIFEST_BYTES = 1_000_000


def create_baseline_manifest(
    bundle_path: str | Path,
    policy_path: str | Path,
    *,
    owner: str,
    accepted_at: str,
) -> BaselineManifest:
    if not isinstance(owner, str) or not owner:
        raise ContractError("Baseline acceptance owner must be a non-empty string")
    _timestamp(accepted_at)
    bundle_bytes = _bounded_bytes(bundle_path, MAX_BUNDLE_BYTES, "baseline bundle")
    policy_bytes = _bounded_bytes(policy_path, MAX_POLICY_BYTES, "baseline policy")
    bundle = load_replay_bundle(bundle_path)
    policy_kind = _validate_policy_file(policy_path, policy_bytes)
    return BaselineManifest(
        schema_version="0.1",
        scenario_id=bundle.scenario_id,
        scenario_digest=bundle.scenario_digest,
        policy_kind=policy_kind,
        bundle=_digest(bundle_bytes),
        policy=_digest(policy_bytes),
        provenance=bundle.provenance,
        acceptance=BaselineAcceptance(owner=owner, accepted_at=accepted_at),
    )


def load_baseline_manifest(path: str | Path) -> BaselineManifest:
    raw = _bounded_bytes(path, MAX_MANIFEST_BYTES, "baseline manifest")
    try:
        data = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ContractError(f"Cannot load baseline manifest from {path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ContractError("Baseline manifest must be an object")
    expected = {
        "schema_version",
        "scenario_id",
        "scenario_digest",
        "policy_kind",
        "bundle",
        "policy",
        "provenance",
        "acceptance",
    }
    if set(data) != expected:
        raise ContractError("Baseline manifest fields do not match schema 0.1")
    try:
        manifest = BaselineManifest(
            schema_version=data["schema_version"],
            scenario_id=data["scenario_id"],
            scenario_digest=data["scenario_digest"],
            policy_kind=data["policy_kind"],
            bundle=_artifact_digest(data["bundle"], "bundle"),
            policy=_artifact_digest(data["policy"], "policy"),
            provenance=_provenance(data["provenance"]),
            acceptance=_acceptance(data["acceptance"]),
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise ContractError(f"Invalid baseline manifest contract: {exc}") from exc
    _validate_manifest(manifest)
    return manifest


def write_baseline_manifest(path: str | Path, manifest: BaselineManifest) -> None:
    _validate_manifest(manifest)
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_symlink():
        raise ContractError("Baseline manifest output must not be a symlink")
    payload = baseline_manifest_bytes(manifest)
    temporary_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb",
            dir=destination.parent,
            prefix=f".{destination.name}.",
            delete=False,
        ) as temporary:
            temporary_name = temporary.name
            temporary.write(payload)
            temporary.flush()
            os.fsync(temporary.fileno())
        os.replace(temporary_name, destination)
    finally:
        if temporary_name and Path(temporary_name).exists():
            Path(temporary_name).unlink()


def baseline_manifest_bytes(manifest: BaselineManifest) -> bytes:
    return (
        json.dumps(
            asdict(manifest),
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
    ).encode("utf-8")


def verify_baseline_manifest(
    manifest: BaselineManifest,
    bundle_path: str | Path,
    policy_path: str | Path,
) -> None:
    _validate_manifest(manifest)
    bundle_bytes = _bounded_bytes(bundle_path, MAX_BUNDLE_BYTES, "baseline bundle")
    policy_bytes = _bounded_bytes(policy_path, MAX_POLICY_BYTES, "baseline policy")
    if _digest(bundle_bytes) != manifest.bundle:
        raise ContractError("Baseline bundle digest or size does not match the manifest")
    if _digest(policy_bytes) != manifest.policy:
        raise ContractError("Baseline policy digest or size does not match the manifest")
    bundle = load_replay_bundle(bundle_path)
    if (
        bundle.scenario_id != manifest.scenario_id
        or bundle.scenario_digest != manifest.scenario_digest
        or bundle.provenance != manifest.provenance
    ):
        raise ContractError("Baseline bundle metadata does not match the manifest")
    if _validate_policy_file(policy_path, policy_bytes) != manifest.policy_kind:
        raise ContractError("Baseline policy kind does not match the manifest")


def _validate_policy_file(path: str | Path, raw: bytes) -> str:
    try:
        data = tomllib.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, tomllib.TOMLDecodeError) as exc:
        raise ContractError(f"Invalid baseline policy {path}: {exc}") from exc
    kinds = [name for name in ("statistical", "sequential") if name in data]
    if len(kinds) != 1:
        raise ContractError("Baseline policy must define exactly one statistical policy kind")
    try:
        if kinds[0] == "statistical":
            load_statistical_policy(path)
        else:
            load_sequential_policy(path)
    except ValueError as exc:
        raise ContractError(str(exc)) from exc
    return kinds[0]


def _bounded_bytes(path: str | Path, limit: int, label: str) -> bytes:
    try:
        source = Path(path)
        size = source.stat().st_size
        if size < 1 or size > limit:
            raise ContractError(f"{label} must be between 1 and {limit} bytes")
        return source.read_bytes()
    except OSError as exc:
        raise ContractError(f"Cannot read {label} from {path}: {exc}") from exc


def _digest(payload: bytes) -> ArtifactDigest:
    return ArtifactDigest(sha256=hashlib.sha256(payload).hexdigest(), bytes=len(payload))


def _artifact_digest(value: object, name: str) -> ArtifactDigest:
    if not isinstance(value, dict) or set(value) != {"sha256", "bytes"}:
        raise ValueError(f"{name} digest must contain sha256 and bytes")
    return ArtifactDigest(sha256=value["sha256"], bytes=value["bytes"])


def _provenance(value: object) -> ReplayProvenance:
    if not isinstance(value, dict) or set(value) != {
        "dataset",
        "evidence",
        "evaluator",
        "application",
        "model",
        "model_config",
        "environment",
    }:
        raise ValueError("baseline provenance fields do not match replay schema 0.1")
    return ReplayProvenance(**value)


def _acceptance(value: object) -> BaselineAcceptance:
    if not isinstance(value, dict) or set(value) != {"owner", "accepted_at"}:
        raise ValueError("acceptance must contain owner and accepted_at")
    return BaselineAcceptance(owner=value["owner"], accepted_at=value["accepted_at"])


def _validate_manifest(manifest: BaselineManifest) -> None:
    if manifest.schema_version != "0.1":
        raise ContractError(f"Unsupported baseline manifest schema: {manifest.schema_version}")
    if manifest.policy_kind not in {"statistical", "sequential"}:
        raise ContractError("Baseline manifest policy_kind must be statistical or sequential")
    string_fields = [
        ("scenario_id", manifest.scenario_id),
        ("scenario_digest", manifest.scenario_digest),
        ("acceptance.owner", manifest.acceptance.owner),
    ]
    string_fields.extend(
        (f"provenance.{name}", value)
        for name, value in asdict(manifest.provenance).items()
    )
    for name, value in string_fields:
        if not isinstance(value, str) or not value:
            raise ContractError(f"{name} must be a non-empty string")
    _timestamp(manifest.acceptance.accepted_at)
    for name, artifact in (("bundle", manifest.bundle), ("policy", manifest.policy)):
        if (
            not isinstance(artifact.sha256, str)
            or len(artifact.sha256) != 64
            or any(character not in "0123456789abcdef" for character in artifact.sha256)
        ):
            raise ContractError(f"Baseline manifest {name} sha256 must be lowercase hex")
        if isinstance(artifact.bytes, bool) or not isinstance(artifact.bytes, int):
            raise ContractError(f"Baseline manifest {name} bytes must be an integer")
        if artifact.bytes < 1 or not math.isfinite(float(artifact.bytes)):
            raise ContractError(f"Baseline manifest {name} bytes must be positive")


def _timestamp(value: object) -> None:
    if not isinstance(value, str) or not value:
        raise ContractError("Baseline accepted_at must be an RFC 3339 timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ContractError("Baseline accepted_at must be an RFC 3339 timestamp") from exc
    if parsed.tzinfo is None:
        raise ContractError("Baseline accepted_at must include a timezone")
