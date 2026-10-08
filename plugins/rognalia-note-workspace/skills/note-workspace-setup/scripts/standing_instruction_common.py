#!/usr/bin/env python3
"""Validated current state and append-only history for standing instructions."""

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

from workspace_common import render_standing_instructions


SCHEMA_VERSION = 1
PRODUCT_ID = "note-workspace"
CATEGORIES = {"workflow", "editorial", "image", "safety", "other"}
REQUEST_ID_PATTERN = re.compile(r"[a-z0-9][a-z0-9._:-]{7,127}")
INSTRUCTION_ID_PATTERN = re.compile(r"rule-[a-z0-9][a-z0-9-]{2,63}")
EVENT_ID_PATTERN = re.compile(r"standing-[0-9]{8}-[0-9a-f]{12}")
SHA256_PATTERN = re.compile(r"[0-9a-f]{64}")

INPUT_KEYS = {
    "schema_version",
    "request_id",
    "reason",
    "approved_by_user",
    "instructions",
}
INSTRUCTION_KEYS = {"instruction_id", "category", "text"}
STATE_KEYS = {
    "schema_version",
    "workspace_id",
    "revision",
    "updated_at",
    "latest_event_id",
    "instructions",
}
EVENT_KEYS = {
    "schema_version",
    "event_id",
    "request_id",
    "revision",
    "changed_at",
    "reason",
    "approved_by_user",
    "before",
    "after",
    "before_sha256",
    "after_sha256",
    "payload_sha256",
}


class StandingInstructionError(ValueError):
    """Raised when standing instructions cannot be changed safely."""


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


def json_text(value: Dict[str, Any]) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def parse_timestamp(value: Optional[str]) -> Tuple[str, datetime]:
    if value is None:
        moment = datetime.now().astimezone().replace(microsecond=0)
    else:
        try:
            moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (AttributeError, ValueError) as exc:
            raise StandingInstructionError(
                "timestamp must be ISO 8601 with a timezone"
            ) from exc
        if moment.tzinfo is None:
            raise StandingInstructionError("timestamp must include a timezone")
        moment = moment.replace(microsecond=0)
    normalized = moment.isoformat()
    if normalized.endswith("+00:00"):
        normalized = normalized[:-6] + "Z"
    return normalized, moment


def _object(value: Any, label: str) -> Dict[str, Any]:
    if not isinstance(value, dict):
        raise StandingInstructionError(f"{label} must be an object")
    return dict(value)


def _exact_keys(value: Dict[str, Any], label: str, keys: set[str]) -> None:
    unknown = sorted(set(value) - keys)
    missing = sorted(keys - set(value))
    if unknown:
        raise StandingInstructionError(
            f"{label} has unknown fields: {', '.join(unknown)}"
        )
    if missing:
        raise StandingInstructionError(
            f"{label} is missing fields: {', '.join(missing)}"
        )


def _one_line(value: Any, label: str, maximum: int = 2000) -> str:
    if not isinstance(value, str):
        raise StandingInstructionError(f"{label} must be a string")
    cleaned = value.strip()
    if not cleaned or "\n" in cleaned or "\r" in cleaned:
        raise StandingInstructionError(f"{label} must be non-empty one-line text")
    if len(cleaned) > maximum:
        raise StandingInstructionError(f"{label} is too long")
    return cleaned


def normalize_instructions(value: Any, label: str = "instructions") -> List[Dict[str, str]]:
    if not isinstance(value, list):
        raise StandingInstructionError(f"{label} must be an array")
    if len(value) > 100:
        raise StandingInstructionError(f"{label} must contain at most 100 items")
    output: List[Dict[str, str]] = []
    ids: set[str] = set()
    for index, raw in enumerate(value):
        item_label = f"{label}[{index}]"
        item = _object(raw, item_label)
        _exact_keys(item, item_label, INSTRUCTION_KEYS)
        instruction_id = item.get("instruction_id")
        if (
            not isinstance(instruction_id, str)
            or not INSTRUCTION_ID_PATTERN.fullmatch(instruction_id)
        ):
            raise StandingInstructionError(
                f"{item_label}.instruction_id has an invalid format"
            )
        if instruction_id in ids:
            raise StandingInstructionError(f"{label} has duplicate instruction_id")
        ids.add(instruction_id)
        category = item.get("category")
        if category not in CATEGORIES:
            raise StandingInstructionError(f"{item_label}.category is invalid")
        output.append(
            {
                "instruction_id": instruction_id,
                "category": category,
                "text": _one_line(item.get("text"), f"{item_label}.text"),
            }
        )
    return output


def normalize_config(raw: Any) -> Dict[str, Any]:
    config = _object(raw, "config")
    _exact_keys(config, "config", INPUT_KEYS)
    if config.get("schema_version") != SCHEMA_VERSION:
        raise StandingInstructionError(f"schema_version must be {SCHEMA_VERSION}")
    request_id = config.get("request_id")
    if not isinstance(request_id, str) or not REQUEST_ID_PATTERN.fullmatch(request_id):
        raise StandingInstructionError("request_id has an invalid format")
    if config.get("approved_by_user") is not True:
        raise StandingInstructionError(
            "approved_by_user must be true after the standing instruction read-back"
        )
    return {
        "schema_version": SCHEMA_VERSION,
        "request_id": request_id,
        "reason": _one_line(config.get("reason"), "reason"),
        "approved_by_user": True,
        "instructions": normalize_instructions(config.get("instructions")),
    }


def load_json(path: str) -> Dict[str, Any]:
    import sys

    if path == "-":
        value = json.load(sys.stdin)
    else:
        with Path(path).open("r", encoding="utf-8") as handle:
            value = json.load(handle)
    return _object(value, "config")


def resolve_workspace(raw: str) -> Tuple[Path, Dict[str, Any]]:
    provided = Path(raw).expanduser()
    if provided.is_symlink():
        raise StandingInstructionError("workspace root must not be a symlink")
    workspace = provided.resolve()
    if not workspace.is_dir():
        raise StandingInstructionError("workspace does not exist or is not a directory")
    manifest_path = workspace / "workspace.json"
    for relative in (
        "profile/standing-instructions.md",
        "profile/standing-instructions.json",
        "profile/standing-instructions-history.jsonl",
    ):
        path = workspace / relative
        if not path.is_file() or path.is_symlink():
            raise StandingInstructionError(f"{relative} is missing or unsafe")
    try:
        manifest = _object(
            json.loads(manifest_path.read_text(encoding="utf-8")),
            "workspace.json",
        )
    except json.JSONDecodeError as exc:
        raise StandingInstructionError("workspace.json is invalid JSON") from exc
    if manifest.get("schema_version") != SCHEMA_VERSION:
        raise StandingInstructionError("workspace schema_version is not supported")
    if manifest.get("product_id") != PRODUCT_ID:
        raise StandingInstructionError("workspace product_id mismatch")
    if manifest.get("data_owner") != "user" or manifest.get("status") != "ready":
        raise StandingInstructionError("workspace is not ready or user-owned")
    return workspace, manifest


def _event_config(event: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "schema_version": event.get("schema_version"),
        "request_id": event.get("request_id"),
        "reason": event.get("reason"),
        "approved_by_user": event.get("approved_by_user"),
        "instructions": event.get("after"),
    }


def load_history(
    workspace: Path,
    manifest: Dict[str, Any],
) -> List[Dict[str, Any]]:
    path = workspace / "profile/standing-instructions-history.jsonl"
    events: List[Dict[str, Any]] = []
    current: List[Dict[str, str]] = []
    requests: set[str] = set()
    event_ids: set[str] = set()
    previous_moment: Optional[datetime] = None
    with path.open("r", encoding="utf-8") as handle:
        for number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                event = _object(json.loads(line), f"{path}:{number}")
            except json.JSONDecodeError as exc:
                raise StandingInstructionError(f"{path}:{number} is invalid JSON") from exc
            _exact_keys(event, f"{path}:{number}", EVENT_KEYS)
            if event.get("schema_version") != SCHEMA_VERSION:
                raise StandingInstructionError(f"{path}:{number} schema_version mismatch")
            revision = event.get("revision")
            if (
                isinstance(revision, bool)
                or not isinstance(revision, int)
                or revision != number
            ):
                raise StandingInstructionError(f"{path}:{number} revision mismatch")
            event_id = event.get("event_id")
            if (
                not isinstance(event_id, str)
                or not EVENT_ID_PATTERN.fullmatch(event_id)
                or event_id in event_ids
            ):
                raise StandingInstructionError(f"{path}:{number} invalid event_id")
            event_ids.add(event_id)
            config = normalize_config(_event_config(event))
            if config["request_id"] in requests:
                raise StandingInstructionError(f"{path}:{number} duplicate request_id")
            requests.add(config["request_id"])
            before = normalize_instructions(event.get("before"), "before")
            after = config["instructions"]
            if before != current:
                raise StandingInstructionError(f"{path}:{number} history chain mismatch")
            if event.get("before_sha256") != canonical_hash(before):
                raise StandingInstructionError(f"{path}:{number} before_sha256 mismatch")
            if event.get("after_sha256") != canonical_hash(after):
                raise StandingInstructionError(f"{path}:{number} after_sha256 mismatch")
            if event.get("payload_sha256") != canonical_hash(config):
                raise StandingInstructionError(f"{path}:{number} payload_sha256 mismatch")
            changed_at, moment = parse_timestamp(event.get("changed_at"))
            if event.get("changed_at") != changed_at:
                raise StandingInstructionError(f"{path}:{number} changed_at is not normalized")
            if previous_moment is not None and moment < previous_moment:
                raise StandingInstructionError(f"{path}:{number} changed_at goes backwards")
            previous_moment = moment
            current = after
            events.append(event)
    return events


def load_state(workspace: Path, manifest: Dict[str, Any]) -> Dict[str, Any]:
    path = workspace / "profile/standing-instructions.json"
    try:
        state = _object(json.loads(path.read_text(encoding="utf-8")), str(path))
    except json.JSONDecodeError as exc:
        raise StandingInstructionError(f"{path} is invalid JSON") from exc
    _exact_keys(state, str(path), STATE_KEYS)
    if state.get("schema_version") != SCHEMA_VERSION:
        raise StandingInstructionError("standing instruction state schema mismatch")
    if state.get("workspace_id") != manifest.get("workspace_id"):
        raise StandingInstructionError("standing instruction workspace_id mismatch")
    revision = state.get("revision")
    if isinstance(revision, bool) or not isinstance(revision, int) or revision < 0:
        raise StandingInstructionError("standing instruction revision is invalid")
    state["instructions"] = normalize_instructions(state.get("instructions"))
    updated_at, _ = parse_timestamp(state.get("updated_at"))
    if state.get("updated_at") != updated_at:
        raise StandingInstructionError("standing instruction updated_at is not normalized")
    latest = state.get("latest_event_id")
    if latest is not None and (
        not isinstance(latest, str) or not EVENT_ID_PATTERN.fullmatch(latest)
    ):
        raise StandingInstructionError("standing instruction latest_event_id is invalid")
    return state


def validate_data(
    workspace: Path,
    manifest: Dict[str, Any],
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    state = load_state(workspace, manifest)
    events = load_history(workspace, manifest)
    if events:
        latest = events[-1]
        if state["revision"] != latest["revision"]:
            raise StandingInstructionError("standing instruction state revision mismatch")
        if state["updated_at"] != latest["changed_at"]:
            raise StandingInstructionError("standing instruction state time mismatch")
        if state["latest_event_id"] != latest["event_id"]:
            raise StandingInstructionError("standing instruction latest event mismatch")
        if state["instructions"] != latest["after"]:
            raise StandingInstructionError("standing instruction state history mismatch")
    else:
        created_at, _ = parse_timestamp(manifest.get("created_at"))
        if state != {
            "schema_version": SCHEMA_VERSION,
            "workspace_id": manifest["workspace_id"],
            "revision": 0,
            "updated_at": created_at,
            "latest_event_id": None,
            "instructions": [],
        }:
            raise StandingInstructionError("initial standing instruction state mismatch")
    expected_markdown = render_standing_instructions(state["instructions"]).rstrip() + "\n"
    actual_markdown = (
        workspace / "profile/standing-instructions.md"
    ).read_text(encoding="utf-8")
    if actual_markdown != expected_markdown:
        raise StandingInstructionError("standing instruction Markdown does not match state")
    return state, events


@contextmanager
def exclusive_lock(path: Path, created_at: str) -> Iterator[None]:
    payload = json.dumps(
        {"created_at": created_at, "pid": os.getpid()}, ensure_ascii=False
    ).encode("utf-8")
    try:
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise StandingInstructionError(
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


def atomic_replace_many(contents: Dict[Path, bytes]) -> None:
    originals: Dict[Path, bytes] = {}
    modes: Dict[Path, int] = {}
    temporaries: Dict[Path, Path] = {}
    replaced: List[Path] = []
    for path in contents:
        if not path.is_file() or path.is_symlink():
            raise StandingInstructionError(f"write target is missing or unsafe: {path}")
        originals[path] = path.read_bytes()
        modes[path] = path.stat().st_mode & 0o777
    try:
        for path, content in contents.items():
            descriptor, temporary = tempfile.mkstemp(
                prefix=f".{path.name}.", dir=str(path.parent)
            )
            temporary_path = Path(temporary)
            temporaries[path] = temporary_path
            os.fchmod(descriptor, modes[path])
            with os.fdopen(descriptor, "wb") as handle:
                handle.write(content)
                handle.flush()
                os.fsync(handle.fileno())
        for path in contents:
            os.replace(temporaries[path], path)
            replaced.append(path)
        for parent in sorted({path.parent for path in contents}, key=str):
            _fsync_directory(parent)
    except OSError as exc:
        rollback_errors: List[str] = []
        for path in reversed(replaced):
            try:
                descriptor, temporary = tempfile.mkstemp(
                    prefix=f".{path.name}.rollback.", dir=str(path.parent)
                )
                os.fchmod(descriptor, modes[path])
                with os.fdopen(descriptor, "wb") as handle:
                    handle.write(originals[path])
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(temporary, path)
            except OSError as rollback_exc:
                rollback_errors.append(f"{path}: {rollback_exc}")
        detail = (
            "; rollback failed for " + ", ".join(rollback_errors)
            if rollback_errors
            else ""
        )
        raise StandingInstructionError(
            f"standing instruction update failed: {exc}{detail}"
        ) from exc
    finally:
        for temporary_path in temporaries.values():
            try:
                temporary_path.unlink()
            except FileNotFoundError:
                pass


def render_history(events: List[Dict[str, Any]]) -> bytes:
    return "".join(
        json.dumps(event, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
        for event in events
    ).encode("utf-8")
