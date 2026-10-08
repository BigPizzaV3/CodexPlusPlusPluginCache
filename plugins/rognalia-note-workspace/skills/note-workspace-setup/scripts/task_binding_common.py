#!/usr/bin/env python3
"""Shared validation and append-only storage for role/task bindings."""

from __future__ import annotations

import hashlib
import json
import os
import re
import tempfile
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Tuple

from workspace_common import PRIMARY_ROLES_BY_MODE


SCHEMA_VERSION = 1
PRODUCT_ID = "note-workspace"
ROLES = {"strategy", "tracker", "writer", "image", "diary", "compact"}
ID_PATTERN = re.compile(r"[a-z0-9][a-z0-9._:-]{7,127}")
SLOT_PATTERN = re.compile(r"(?:primary|extra-[a-z0-9][a-z0-9-]{2,63})")
EVENT_ID_PATTERN = re.compile(r"task-binding-[0-9]{8}-[0-9a-f]{12}")
SHA256_PATTERN = re.compile(r"[0-9a-f]{64}")
READY_NONCE_PATTERN = re.compile(r"ready-[a-z0-9][a-z0-9-]{11,63}")

INPUT_KEYS = {
    "schema_version",
    "request_id",
    "role",
    "slot",
    "task_id",
    "host_id",
    "task_title",
    "binding_origin",
    "ready_receipt",
    "replaces_event_id",
}
EVENT_KEYS = INPUT_KEYS | {
    "event_id",
    "workspace_id",
    "task_mode",
    "binding_generation",
    "bound_at",
    "payload_sha256",
}
READY_RECEIPT_KEYS = {
    "verification_method",
    "challenge_proof_sha256",
    "host_evidence_sha256",
    "kickoff_message_id",
    "kickoff_message_sha256",
    "ready_message_id",
    "ready_message_sha256",
    "ready_nonce",
    "observed_task_id",
    "observed_host_id",
    "observed_task_title",
    "observed_workspace_id",
    "observed_workspace_path",
    "observed_role",
    "standing_instructions_revision",
    "observed_at",
    "verified_at",
}
CHALLENGE_KEYS = {
    "schema_version",
    "status",
    "ready_nonce",
    "workspace_id",
    "task_mode",
    "binding_generation",
    "role",
    "slot",
    "task_id",
    "host_id",
    "task_title",
    "binding_origin",
    "standing_instructions_revision",
    "issued_at",
    "kickoff_message_sha256",
    "host_evidence_sha256",
    "challenge_proof_sha256",
    "verified_at",
    "consumed_at",
    "consumed_event_id",
}


class TaskBindingError(ValueError):
    """Raised when a role/task binding is unsafe or inconsistent."""


def _fsync_directory(path: Path) -> None:
    """Persist directory metadata where Python supports opening directories."""
    if os.name == "nt":
        return
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def canonical_hash(value: Any) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def parse_timestamp(value: Optional[str]) -> Tuple[str, datetime]:
    if value is None:
        moment = datetime.now().astimezone().replace(microsecond=0)
    else:
        try:
            moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (AttributeError, ValueError) as exc:
            raise TaskBindingError(
                "timestamp must be ISO 8601 with a timezone"
            ) from exc
        if moment.tzinfo is None:
            raise TaskBindingError("timestamp must include a timezone")
        moment = moment.replace(microsecond=0)
    normalized = moment.isoformat()
    if normalized.endswith("+00:00"):
        normalized = normalized[:-6] + "Z"
    return normalized, moment


def _object(value: Any, label: str) -> Dict[str, Any]:
    if not isinstance(value, dict):
        raise TaskBindingError(f"{label} must be an object")
    return dict(value)


def _exact_keys(value: Dict[str, Any], label: str, keys: set[str]) -> None:
    unknown = sorted(set(value) - keys)
    missing = sorted(keys - set(value))
    if unknown:
        raise TaskBindingError(f"{label} has unknown fields: {', '.join(unknown)}")
    if missing:
        raise TaskBindingError(f"{label} is missing fields: {', '.join(missing)}")


def _one_line(value: Any, label: str, maximum: int = 256) -> str:
    if not isinstance(value, str):
        raise TaskBindingError(f"{label} must be a string")
    cleaned = value.strip()
    if not cleaned or "\n" in cleaned or "\r" in cleaned:
        raise TaskBindingError(f"{label} must be non-empty one-line text")
    if len(cleaned) > maximum:
        raise TaskBindingError(f"{label} is too long")
    return cleaned


def load_json(path: str) -> Dict[str, Any]:
    import sys

    if path == "-":
        value = json.load(sys.stdin)
    else:
        with Path(path).open("r", encoding="utf-8") as handle:
            value = json.load(handle)
    return _object(value, "config")


def challenge_path(workspace: Path, nonce: str) -> Path:
    if not isinstance(nonce, str) or not READY_NONCE_PATTERN.fullmatch(nonce):
        raise TaskBindingError("ready nonce is invalid")
    directory = workspace / "strategy/task-binding-challenges"
    if directory.exists() and (not directory.is_dir() or directory.is_symlink()):
        raise TaskBindingError("task binding challenge directory is unsafe")
    return directory / f"{nonce}.json"


def load_challenge(workspace: Path, nonce: str) -> Dict[str, Any]:
    path = challenge_path(workspace, nonce)
    if not path.is_file() or path.is_symlink() or path.parent.is_symlink():
        raise TaskBindingError("ready challenge is missing or unsafe")
    try:
        challenge = _object(
            json.loads(path.read_text(encoding="utf-8")),
            "ready challenge",
        )
    except json.JSONDecodeError as exc:
        raise TaskBindingError("ready challenge is invalid JSON") from exc
    _exact_keys(challenge, "ready challenge", CHALLENGE_KEYS)
    if challenge.get("schema_version") != SCHEMA_VERSION:
        raise TaskBindingError("ready challenge schema_version is unsupported")
    if challenge.get("ready_nonce") != nonce:
        raise TaskBindingError("ready challenge nonce does not match its path")
    return challenge


def atomic_write_json(path: Path, value: Dict[str, Any], *, create: bool = False) -> None:
    if path.parent.exists() and (not path.parent.is_dir() or path.parent.is_symlink()):
        raise TaskBindingError("task binding state directory is unsafe")
    path.parent.mkdir(mode=0o700, parents=False, exist_ok=True)
    if create and path.exists():
        raise TaskBindingError("ready challenge already exists")
    if path.exists() and (not path.is_file() or path.is_symlink()):
        raise TaskBindingError("task binding state file is unsafe")
    content = (
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
    ).encode("utf-8")
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    temporary_path = Path(temporary)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        if create and path.exists():
            raise TaskBindingError("ready challenge already exists")
        os.replace(temporary_path, path)
        _fsync_directory(path.parent)
    finally:
        try:
            temporary_path.unlink()
        except FileNotFoundError:
            pass


def readback_proof_hash(
    challenge: Dict[str, Any],
    *,
    host_evidence_sha256: str,
    kickoff_message_id: str,
    ready_message_id: str,
    ready_message_sha256: str,
    observed_at: str,
    verified_at: str,
) -> str:
    immutable_challenge = {
        key: challenge[key]
        for key in (
            "schema_version",
            "ready_nonce",
            "workspace_id",
            "task_mode",
            "binding_generation",
            "role",
            "slot",
            "task_id",
            "host_id",
            "task_title",
            "binding_origin",
            "standing_instructions_revision",
            "issued_at",
            "kickoff_message_sha256",
        )
    }
    return canonical_hash(
        {
            "challenge": immutable_challenge,
            "host_evidence_sha256": host_evidence_sha256,
            "kickoff_message_id": kickoff_message_id,
            "ready_message_id": ready_message_id,
            "ready_message_sha256": ready_message_sha256,
            "observed_at": observed_at,
            "verified_at": verified_at,
        }
    )


def require_verified_challenge(
    workspace: Path,
    manifest: Dict[str, Any],
    settings: Dict[str, Any],
    config: Dict[str, Any],
    *,
    allow_consumed_event_id: Optional[str] = None,
) -> Dict[str, Any]:
    receipt = config["ready_receipt"]
    challenge = load_challenge(workspace, receipt["ready_nonce"])
    status = challenge.get("status")
    if status == "verified":
        if challenge.get("consumed_at") is not None or challenge.get(
            "consumed_event_id"
        ) is not None:
            raise TaskBindingError("verified ready challenge has consumption state")
    elif status == "consumed" and allow_consumed_event_id is not None:
        if challenge.get("consumed_event_id") != allow_consumed_event_id:
            raise TaskBindingError("ready challenge was consumed by another binding")
        consumed_at, consumed_moment = parse_timestamp(challenge.get("consumed_at"))
        if challenge.get("consumed_at") != consumed_at:
            raise TaskBindingError("ready challenge consumed_at is not normalized")
    else:
        raise TaskBindingError("ready challenge is not verified or was already consumed")
    expected = {
        "workspace_id": manifest["workspace_id"],
        "task_mode": settings["task_topology"]["mode"],
        "binding_generation": settings["task_topology"]["binding_generation"],
        "role": config["role"],
        "slot": config["slot"],
        "task_id": config["task_id"],
        "host_id": config["host_id"],
        "task_title": config["task_title"],
        "binding_origin": config["binding_origin"],
        "standing_instructions_revision": receipt[
            "standing_instructions_revision"
        ],
        "kickoff_message_sha256": receipt["kickoff_message_sha256"],
        "host_evidence_sha256": receipt["host_evidence_sha256"],
        "challenge_proof_sha256": receipt["challenge_proof_sha256"],
        "verified_at": receipt["verified_at"],
    }
    for field, expected_value in expected.items():
        if challenge.get(field) != expected_value:
            raise TaskBindingError(f"ready challenge {field} does not match binding")
    proof = readback_proof_hash(
        challenge,
        host_evidence_sha256=receipt["host_evidence_sha256"],
        kickoff_message_id=receipt["kickoff_message_id"],
        ready_message_id=receipt["ready_message_id"],
        ready_message_sha256=receipt["ready_message_sha256"],
        observed_at=receipt["observed_at"],
        verified_at=receipt["verified_at"],
    )
    if proof != receipt["challenge_proof_sha256"]:
        raise TaskBindingError("ready challenge proof does not match host readback")
    _, issued_moment = parse_timestamp(challenge.get("issued_at"))
    _, observed_moment = parse_timestamp(receipt["observed_at"])
    _, verified_moment = parse_timestamp(receipt["verified_at"])
    if not issued_moment < observed_moment <= verified_moment:
        raise TaskBindingError("ready challenge timestamps are out of order")
    if status == "consumed" and consumed_moment < verified_moment:
        raise TaskBindingError("ready challenge was consumed before verification")
    return challenge


def consume_verified_challenge(
    workspace: Path,
    challenge: Dict[str, Any],
    *,
    event_id: str,
    consumed_at: str,
) -> None:
    updated = dict(challenge)
    updated.update(
        {
            "status": "consumed",
            "consumed_at": consumed_at,
            "consumed_event_id": event_id,
        }
    )
    atomic_write_json(
        challenge_path(workspace, challenge["ready_nonce"]),
        updated,
    )


def resolve_workspace(raw: str) -> Tuple[Path, Dict[str, Any], Dict[str, Any]]:
    provided = Path(raw).expanduser()
    if provided.is_symlink():
        raise TaskBindingError("workspace root must not be a symlink")
    workspace = provided.resolve()
    if not workspace.is_dir():
        raise TaskBindingError("workspace does not exist or is not a directory")
    manifest_path = workspace / "workspace.json"
    settings_path = workspace / "strategy/operating-settings.json"
    registry = workspace / "strategy/role-task-bindings.jsonl"
    for path, label in (
        (manifest_path, "workspace.json"),
        (settings_path, "strategy/operating-settings.json"),
        (registry, "strategy/role-task-bindings.jsonl"),
    ):
        if not path.is_file() or path.is_symlink():
            raise TaskBindingError(f"{label} is missing or unsafe")
    try:
        manifest = _object(
            json.loads(manifest_path.read_text(encoding="utf-8")),
            "workspace.json",
        )
        settings = _object(
            json.loads(settings_path.read_text(encoding="utf-8")),
            "strategy/operating-settings.json",
        )
    except json.JSONDecodeError as exc:
        raise TaskBindingError("workspace metadata is invalid JSON") from exc
    if manifest.get("schema_version") != SCHEMA_VERSION:
        raise TaskBindingError("workspace schema_version is not supported")
    if manifest.get("product_id") != PRODUCT_ID:
        raise TaskBindingError("workspace product_id mismatch")
    if manifest.get("data_owner") != "user" or manifest.get("status") != "ready":
        raise TaskBindingError("workspace is not ready or user-owned")
    if settings.get("workspace_id") != manifest.get("workspace_id"):
        raise TaskBindingError("workspace ID mismatch")
    topology = settings.get("task_topology")
    if not isinstance(topology, dict) or topology.get("mode") not in PRIMARY_ROLES_BY_MODE:
        raise TaskBindingError("task topology is missing or invalid")
    generation = topology.get("binding_generation")
    if (
        isinstance(generation, bool)
        or not isinstance(generation, int)
        or generation < 1
    ):
        raise TaskBindingError("task topology binding_generation is invalid")
    names = settings.get("task_names")
    required_names = ROLES if topology["mode"] == "standard_five" else ROLES - {"diary"}
    if not isinstance(names, dict) or not required_names.issubset(names):
        raise TaskBindingError("task names are missing or invalid")
    return workspace, manifest, settings


def normalize_input(
    raw: Any,
    settings: Dict[str, Any],
    workspace: Path,
    manifest: Dict[str, Any],
    *,
    task_mode: Optional[str] = None,
    binding_generation: Optional[int] = None,
    enforce_current_title: bool = True,
    enforce_current_standing_revision: bool = True,
) -> Dict[str, Any]:
    config = _object(raw, "config")
    _exact_keys(config, "config", INPUT_KEYS)
    if config.get("schema_version") != SCHEMA_VERSION:
        raise TaskBindingError(f"schema_version must be {SCHEMA_VERSION}")
    request_id = config.get("request_id")
    if not isinstance(request_id, str) or not ID_PATTERN.fullmatch(request_id):
        raise TaskBindingError("request_id has an invalid format")
    role = config.get("role")
    if role not in ROLES:
        raise TaskBindingError("role is invalid")
    slot = config.get("slot")
    if not isinstance(slot, str) or not SLOT_PATTERN.fullmatch(slot):
        raise TaskBindingError("slot is invalid")
    if slot != "primary" and role != "image":
        raise TaskBindingError("only image may use an extra slot")
    mode = task_mode or settings["task_topology"]["mode"]
    generation = (
        binding_generation
        if binding_generation is not None
        else settings["task_topology"]["binding_generation"]
    )
    if isinstance(generation, bool) or not isinstance(generation, int) or generation < 1:
        raise TaskBindingError("binding_generation is invalid")
    if mode not in PRIMARY_ROLES_BY_MODE:
        raise TaskBindingError("task_mode is invalid")
    if slot == "primary":
        if role not in PRIMARY_ROLES_BY_MODE[mode]:
            raise TaskBindingError(f"{mode} requires a matching primary role")
    title = _one_line(config.get("task_title"), "task_title", maximum=200)
    if (
        enforce_current_title
        and slot == "primary"
        and title != settings["task_names"].get(role)
    ):
        raise TaskBindingError("task_title does not match operating settings")
    task_id = _one_line(config.get("task_id"), "task_id")
    host_id = _one_line(config.get("host_id"), "host_id")
    binding_origin = config.get("binding_origin")
    if binding_origin not in {"reused_setup", "created"}:
        raise TaskBindingError("binding_origin is invalid")
    if binding_origin == "reused_setup" and not (
        slot == "primary" and role in {"strategy", "compact"}
    ):
        raise TaskBindingError(
            "only a primary strategy or compact task may reuse the setup task"
        )

    receipt = _object(config.get("ready_receipt"), "ready_receipt")
    _exact_keys(receipt, "ready_receipt", READY_RECEIPT_KEYS)
    if receipt.get("verification_method") != "verified_host_export_v1":
        raise TaskBindingError(
            "ready receipt must come from verify_role_task_readback.py"
        )
    proof_sha256 = receipt.get("challenge_proof_sha256")
    evidence_sha256 = receipt.get("host_evidence_sha256")
    for value, label in (
        (proof_sha256, "ready_receipt.challenge_proof_sha256"),
        (evidence_sha256, "ready_receipt.host_evidence_sha256"),
    ):
        if not isinstance(value, str) or not SHA256_PATTERN.fullmatch(value):
            raise TaskBindingError(f"{label} is invalid")
    kickoff_message_id = _one_line(
        receipt.get("kickoff_message_id"), "ready_receipt.kickoff_message_id"
    )
    ready_message_id = _one_line(
        receipt.get("ready_message_id"), "ready_receipt.ready_message_id"
    )
    if kickoff_message_id == ready_message_id:
        raise TaskBindingError("kickoff and ready message IDs must differ")
    kickoff_sha256 = receipt.get("kickoff_message_sha256")
    ready_sha256 = receipt.get("ready_message_sha256")
    for value, label in (
        (kickoff_sha256, "ready_receipt.kickoff_message_sha256"),
        (ready_sha256, "ready_receipt.ready_message_sha256"),
    ):
        if not isinstance(value, str) or not SHA256_PATTERN.fullmatch(value):
            raise TaskBindingError(f"{label} is invalid")
    nonce = receipt.get("ready_nonce")
    if not isinstance(nonce, str) or not READY_NONCE_PATTERN.fullmatch(nonce):
        raise TaskBindingError("ready_receipt.ready_nonce is invalid")
    if _one_line(
        receipt.get("observed_task_id"), "ready_receipt.observed_task_id"
    ) != task_id:
        raise TaskBindingError("ready receipt task_id does not match binding")
    if _one_line(
        receipt.get("observed_host_id"), "ready_receipt.observed_host_id"
    ) != host_id:
        raise TaskBindingError("ready receipt host_id does not match binding")
    if _one_line(
        receipt.get("observed_task_title"), "ready_receipt.observed_task_title"
    ) != title:
        raise TaskBindingError("ready receipt task title does not match binding")
    if _one_line(
        receipt.get("observed_workspace_id"),
        "ready_receipt.observed_workspace_id",
    ) != manifest.get("workspace_id"):
        raise TaskBindingError("ready receipt workspace_id does not match")
    observed_workspace_path = _one_line(
        receipt.get("observed_workspace_path"),
        "ready_receipt.observed_workspace_path",
        maximum=1000,
    )
    if observed_workspace_path != str(workspace):
        raise TaskBindingError("ready receipt workspace path does not match")
    if receipt.get("observed_role") != role:
        raise TaskBindingError("ready receipt role does not match binding")
    standing_path = workspace / "profile/standing-instructions.json"
    if not standing_path.is_file() or standing_path.is_symlink():
        raise TaskBindingError("standing instructions state is missing or unsafe")
    try:
        standing = _object(
            json.loads(standing_path.read_text(encoding="utf-8")),
            "profile/standing-instructions.json",
        )
    except json.JSONDecodeError as exc:
        raise TaskBindingError("standing instructions state is invalid JSON") from exc
    current_standing_revision = standing.get("revision")
    if (
        isinstance(current_standing_revision, bool)
        or not isinstance(current_standing_revision, int)
        or current_standing_revision < 0
    ):
        raise TaskBindingError("standing instructions revision is invalid")
    observed_standing_revision = receipt.get("standing_instructions_revision")
    if (
        isinstance(observed_standing_revision, bool)
        or not isinstance(observed_standing_revision, int)
        or observed_standing_revision < 0
        or observed_standing_revision > current_standing_revision
    ):
        raise TaskBindingError("ready receipt standing instructions revision is invalid")
    if (
        enforce_current_standing_revision
        and observed_standing_revision != current_standing_revision
    ):
        raise TaskBindingError(
            "ready receipt must confirm the current standing instructions revision"
        )
    observed_at, observed_moment = parse_timestamp(receipt.get("observed_at"))
    verified_at, verified_moment = parse_timestamp(receipt.get("verified_at"))
    if verified_moment < observed_moment:
        raise TaskBindingError("ready receipt was verified before it was observed")
    replaces = config.get("replaces_event_id")
    if replaces is not None and (
        not isinstance(replaces, str) or not EVENT_ID_PATTERN.fullmatch(replaces)
    ):
        raise TaskBindingError("replaces_event_id has an invalid format")
    return {
        "schema_version": SCHEMA_VERSION,
        "request_id": request_id,
        "role": role,
        "slot": slot,
        "task_id": task_id,
        "host_id": host_id,
        "task_title": title,
        "binding_origin": binding_origin,
        "ready_receipt": {
            "verification_method": "verified_host_export_v1",
            "challenge_proof_sha256": proof_sha256,
            "host_evidence_sha256": evidence_sha256,
            "kickoff_message_id": kickoff_message_id,
            "kickoff_message_sha256": kickoff_sha256,
            "ready_message_id": ready_message_id,
            "ready_message_sha256": ready_sha256,
            "ready_nonce": nonce,
            "observed_task_id": task_id,
            "observed_host_id": host_id,
            "observed_task_title": title,
            "observed_workspace_id": manifest["workspace_id"],
            "observed_workspace_path": str(workspace),
            "observed_role": role,
            "standing_instructions_revision": observed_standing_revision,
            "observed_at": observed_at,
            "verified_at": verified_at,
        },
        "replaces_event_id": replaces,
    }


def _config_from_event(event: Dict[str, Any]) -> Dict[str, Any]:
    return {key: event[key] for key in INPUT_KEYS}


def load_events(
    workspace: Path,
    manifest: Dict[str, Any],
    settings: Dict[str, Any],
) -> List[Dict[str, Any]]:
    path = workspace / "strategy/role-task-bindings.jsonl"
    events: List[Dict[str, Any]] = []
    requests: set[str] = set()
    event_ids: set[str] = set()
    challenge_proofs: set[str] = set()
    active_by_slot: Dict[Tuple[int, str, str, str], Dict[str, Any]] = {}
    active_by_task: Dict[str, Dict[str, Any]] = {}
    previous_moment: Optional[datetime] = None
    previous_generation = 0
    mode_by_generation: Dict[int, str] = {}
    with path.open("r", encoding="utf-8") as handle:
        for number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                event = _object(json.loads(line), f"{path}:{number}")
            except json.JSONDecodeError as exc:
                raise TaskBindingError(f"{path}:{number} is invalid JSON") from exc
            _exact_keys(event, f"{path}:{number}", EVENT_KEYS)
            if event.get("workspace_id") != manifest.get("workspace_id"):
                raise TaskBindingError(f"{path}:{number} workspace_id mismatch")
            event_mode = event.get("task_mode")
            if event_mode not in PRIMARY_ROLES_BY_MODE:
                raise TaskBindingError(f"{path}:{number} task_mode is invalid")
            generation = event.get("binding_generation")
            if (
                isinstance(generation, bool)
                or not isinstance(generation, int)
                or generation < 1
                or generation < previous_generation
            ):
                raise TaskBindingError(
                    f"{path}:{number} binding_generation is invalid"
                )
            generation_mode = mode_by_generation.get(generation)
            if generation_mode is not None and generation_mode != event_mode:
                raise TaskBindingError(
                    f"{path}:{number} one binding_generation cannot contain multiple task modes"
                )
            mode_by_generation[generation] = event_mode
            previous_generation = generation
            config = normalize_input(
                _config_from_event(event),
                settings,
                workspace,
                manifest,
                task_mode=event_mode,
                binding_generation=generation,
                enforce_current_title=False,
                enforce_current_standing_revision=False,
            )
            request_id = config["request_id"]
            if request_id in requests:
                raise TaskBindingError(f"{path}:{number} duplicate request_id")
            requests.add(request_id)
            challenge_proof = config["ready_receipt"]["challenge_proof_sha256"]
            if challenge_proof in challenge_proofs:
                raise TaskBindingError(
                    f"{path}:{number} reuses a consumed ready challenge proof"
                )
            challenge_proofs.add(challenge_proof)
            event_id = event.get("event_id")
            if (
                not isinstance(event_id, str)
                or not EVENT_ID_PATTERN.fullmatch(event_id)
                or event_id in event_ids
            ):
                raise TaskBindingError(f"{path}:{number} invalid or duplicate event_id")
            event_ids.add(event_id)
            bound_at, moment = parse_timestamp(event.get("bound_at"))
            if event.get("bound_at") != bound_at:
                raise TaskBindingError(f"{path}:{number} bound_at is not normalized")
            if previous_moment is not None and moment < previous_moment:
                raise TaskBindingError(f"{path}:{number} bound_at goes backwards")
            previous_moment = moment
            _, ready_moment = parse_timestamp(
                config["ready_receipt"]["observed_at"]
            )
            if ready_moment > moment:
                raise TaskBindingError(
                    f"{path}:{number} ready receipt was observed after binding"
                )
            _, verified_moment = parse_timestamp(
                config["ready_receipt"]["verified_at"]
            )
            if verified_moment > moment:
                raise TaskBindingError(
                    f"{path}:{number} ready receipt was verified after binding"
                )
            payload_hash = event.get("payload_sha256")
            if (
                not isinstance(payload_hash, str)
                or not SHA256_PATTERN.fullmatch(payload_hash)
                or payload_hash
                != canonical_hash(
                    {
                        "task_mode": event_mode,
                        "binding_generation": generation,
                        "binding": config,
                    }
                )
            ):
                raise TaskBindingError(f"{path}:{number} payload_sha256 mismatch")
            key = (generation, event_mode, config["role"], config["slot"])
            previous_by_slot = active_by_slot.get(key)
            previous_by_task = active_by_task.get(config["task_id"])
            previous_candidates = {
                candidate["event_id"]: candidate
                for candidate in (previous_by_slot, previous_by_task)
                if candidate is not None
            }
            if len(previous_candidates) > 1:
                raise TaskBindingError(
                    f"{path}:{number} cannot replace an occupied slot and another active task binding in one event"
                )
            previous = next(iter(previous_candidates.values()), None)
            if previous is None and config["replaces_event_id"] is not None:
                raise TaskBindingError(f"{path}:{number} replaces a missing binding")
            if previous is not None and config["replaces_event_id"] != previous["event_id"]:
                raise TaskBindingError(f"{path}:{number} must replace the active binding")
            if previous is not None:
                previous_key = (
                    previous["binding_generation"],
                    previous["task_mode"],
                    previous["role"],
                    previous["slot"],
                )
                if active_by_slot.get(previous_key) is previous:
                    del active_by_slot[previous_key]
                if active_by_task.get(previous["task_id"]) is previous:
                    del active_by_task[previous["task_id"]]
            active_by_slot[key] = event
            active_by_task[config["task_id"]] = event
            events.append(event)
    current_generation = settings["task_topology"]["binding_generation"]
    if previous_generation > current_generation:
        raise TaskBindingError(
            "operating settings binding_generation is older than binding history"
        )
    return events


def _replay_active(
    events: List[Dict[str, Any]],
) -> Tuple[
    Dict[Tuple[int, str, str, str], Dict[str, Any]],
    Dict[str, Dict[str, Any]],
]:
    active_by_slot: Dict[Tuple[int, str, str, str], Dict[str, Any]] = {}
    active_by_task: Dict[str, Dict[str, Any]] = {}
    for event in events:
        replaced = event["replaces_event_id"]
        if replaced is not None:
            previous = next(
                candidate
                for candidate in active_by_task.values()
                if candidate["event_id"] == replaced
            )
            previous_key = (
                previous["binding_generation"],
                previous["task_mode"],
                previous["role"],
                previous["slot"],
            )
            if active_by_slot.get(previous_key) is previous:
                del active_by_slot[previous_key]
            if active_by_task.get(previous["task_id"]) is previous:
                del active_by_task[previous["task_id"]]
        key = (
            event["binding_generation"],
            event["task_mode"],
            event["role"],
            event["slot"],
        )
        active_by_slot[key] = event
        active_by_task[event["task_id"]] = event
    return active_by_slot, active_by_task


def active_bindings(
    events: List[Dict[str, Any]], task_mode: str, binding_generation: int
) -> Dict[Tuple[str, str], Dict[str, Any]]:
    active_by_slot, _ = _replay_active(events)
    return {
        (role, slot): event
        for (generation, mode, role, slot), event in active_by_slot.items()
        if mode == task_mode and generation == binding_generation
    }


def expected_replacement(
    events: List[Dict[str, Any]],
    config: Dict[str, Any],
    task_mode: str,
    binding_generation: int,
) -> Optional[Dict[str, Any]]:
    active_by_slot, active_by_task = _replay_active(events)
    previous_by_slot = active_by_slot.get(
        (binding_generation, task_mode, config["role"], config["slot"])
    )
    previous_by_task = active_by_task.get(config["task_id"])
    candidates = {
        candidate["event_id"]: candidate
        for candidate in (previous_by_slot, previous_by_task)
        if candidate is not None
    }
    if len(candidates) > 1:
        raise TaskBindingError(
            "cannot replace an occupied slot and another active task binding in one event"
        )
    return next(iter(candidates.values()), None)


@contextmanager
def exclusive_lock(path: Path, created_at: str) -> Iterator[None]:
    payload = json.dumps(
        {"created_at": created_at, "pid": os.getpid()}, ensure_ascii=False
    ).encode("utf-8")
    try:
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise TaskBindingError(
            f"another write may be active; inspect the lock before retrying: {path}"
        ) from exc
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        yield
    finally:
        try:
            path.unlink()
        except FileNotFoundError:
            pass


def atomic_write_events(path: Path, events: List[Dict[str, Any]]) -> None:
    if not path.is_file() or path.is_symlink():
        raise TaskBindingError("binding registry is missing or unsafe")
    content = "".join(
        json.dumps(event, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
        for event in events
    ).encode("utf-8")
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    temporary_path = Path(temporary)
    try:
        os.fchmod(descriptor, path.stat().st_mode & 0o777)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
        _fsync_directory(path.parent)
    finally:
        try:
            temporary_path.unlink()
        except FileNotFoundError:
            pass
