from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import unicodedata
from copy import deepcopy
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Any


SCHEMA_VERSION = "agentproof_codex_session_v1"
CANONICALIZATION_NAME = "HREVN_CANONICAL_JSON_V1"
GENESIS_PREVIOUS_HASH = "0" * 64
SEQUENCE_START = 1
SEQUENCE_STEP = 1
MAX_RECEIPT_BYTES = 50 * 1024 * 1024

_RECEIPT_KEYS = {
    "schema_version",
    "canonicalization",
    "session_id",
    "agent_name",
    "model",
    "repository_id",
    "base_commit",
    "head_commit",
    "started_at",
    "ended_at",
    "event_count",
    "chain_head_sha256",
    "events",
}
_EVENT_KEYS = {
    "sequence",
    "event_type",
    "occurred_at",
    "previous_event_hash",
    "payload",
    "event_hash",
}
_COMMAND_PAYLOAD_KEYS = {
    "command_class",
    "command_sha256",
    "output_capture_mode",
    "output_sha256",
    "exit_code",
}
_FILE_CHANGE_PAYLOAD_KEYS = {
    "path",
    "change_type",
    "before_sha256",
    "after_sha256",
    "diff_sha256",
    "diff_format",
}

_HASH_RE = re.compile(r"^[0-9a-f]{64}$")
_RAW_CONTENT_KEYS = {
    "command_text",
    "stdout_text",
    "stderr_text",
    "diff_text",
    "file_content",
    "prompt_text",
}


class AgentProofContractError(ValueError):
    pass


class ReceiptLoadError(RuntimeError):
    pass


def _require_exact_keys(value: dict[str, Any], expected: set[str], field: str) -> None:
    actual = set(value)
    if actual != expected:
        missing = ",".join(sorted(expected - actual)) or "-"
        unknown = ",".join(sorted(actual - expected)) or "-"
        raise AgentProofContractError(
            f"fields_invalid:{field}:missing={missing}:unknown={unknown}"
        )


def _read_fd_limited(fd: int, limit: int) -> bytes:
    chunks: list[bytes] = []
    remaining = limit + 1
    while remaining:
        chunk = os.read(fd, min(64 * 1024, remaining))
        if not chunk:
            break
        chunks.append(chunk)
        remaining -= len(chunk)
    return b"".join(chunks)


def _normalize_json_value(value: Any, path: str = "$") -> Any:
    if value is None or isinstance(value, bool) or isinstance(value, int):
        return value
    if isinstance(value, float):
        raise AgentProofContractError(f"floating_point_not_allowed:{path}")
    if isinstance(value, str):
        return unicodedata.normalize("NFC", value)
    if isinstance(value, list):
        return [
            _normalize_json_value(item, f"{path}[{index}]")
            for index, item in enumerate(value)
        ]
    if isinstance(value, dict):
        normalized: dict[str, Any] = {}
        for key, item in value.items():
            if not isinstance(key, str):
                raise AgentProofContractError(f"non_string_key:{path}")
            normalized_key = unicodedata.normalize("NFC", key)
            if normalized_key in normalized:
                raise AgentProofContractError(
                    f"duplicate_normalized_key:{path}.{normalized_key}"
                )
            normalized[normalized_key] = _normalize_json_value(
                item, f"{path}.{normalized_key}"
            )
        return normalized
    raise AgentProofContractError(
        f"unsupported_json_type:{path}:{type(value).__name__}"
    )


def canonical_json_bytes(value: Any) -> bytes:
    normalized = _normalize_json_value(value)
    return json.dumps(
        normalized,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def _sha256_hex(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _require_hash(value: Any, field: str, *, nullable: bool = False) -> None:
    if nullable and value is None:
        return
    if not isinstance(value, str) or not _HASH_RE.fullmatch(value):
        raise AgentProofContractError(f"invalid_sha256:{field}")


def _require_timestamp(value: Any, field: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise AgentProofContractError(f"missing_timestamp:{field}")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise AgentProofContractError(f"invalid_timestamp:{field}") from exc
    if parsed.tzinfo is None:
        raise AgentProofContractError(f"timezone_required:{field}")


def _reject_raw_content(value: Any, path: str = "payload") -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            if key in _RAW_CONTENT_KEYS:
                raise AgentProofContractError(f"raw_content_forbidden:{path}.{key}")
            _reject_raw_content(item, f"{path}.{key}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            _reject_raw_content(item, f"{path}[{index}]")


def _validate_repo_path(value: Any) -> None:
    if not isinstance(value, str) or not value.strip():
        raise AgentProofContractError("missing_repository_relative_path")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or value.startswith("~"):
        raise AgentProofContractError("unsafe_repository_relative_path")


def _validate_event_input(event: dict[str, Any], index: int) -> None:
    event_type = event.get("event_type")
    payload = event.get("payload")
    if event_type not in {"command", "file_change"}:
        raise AgentProofContractError(f"unsupported_event_type:{index}")
    _require_timestamp(event.get("occurred_at"), f"events[{index}].occurred_at")
    if not isinstance(payload, dict):
        raise AgentProofContractError(f"invalid_event_payload:{index}")
    _reject_raw_content(payload)

    if event_type == "command":
        _require_exact_keys(payload, _COMMAND_PAYLOAD_KEYS, f"events[{index}].payload")
        _require_hash(payload.get("command_sha256"), "command_sha256")
        if payload.get("command_class") != "shell":
            raise AgentProofContractError("unsupported_command_class")
        if payload.get("output_capture_mode") != "combined_stream":
            raise AgentProofContractError("unsupported_output_capture_mode")
        _require_hash(payload.get("output_sha256"), "output_sha256")
        if not isinstance(payload.get("exit_code"), int):
            raise AgentProofContractError("invalid_exit_code")
    else:
        _require_exact_keys(
            payload, _FILE_CHANGE_PAYLOAD_KEYS, f"events[{index}].payload"
        )
        _validate_repo_path(payload.get("path"))
        if payload.get("change_type") not in {"created", "modified", "deleted"}:
            raise AgentProofContractError("invalid_change_type")
        _require_hash(payload.get("before_sha256"), "before_sha256", nullable=True)
        _require_hash(payload.get("after_sha256"), "after_sha256", nullable=True)
        _require_hash(payload.get("diff_sha256"), "diff_sha256")
        if payload.get("diff_format") not in {
            "unified_diff_v1",
            "binary_transition_v1",
        }:
            raise AgentProofContractError("unsupported_diff_format")


def _validate_receipt_envelope(receipt: dict[str, Any]) -> None:
    _require_exact_keys(receipt, _RECEIPT_KEYS, "receipt")
    if receipt.get("schema_version") != SCHEMA_VERSION:
        raise AgentProofContractError("schema_version_unsupported")
    if receipt.get("canonicalization") != CANONICALIZATION_NAME:
        raise AgentProofContractError("canonicalization_unsupported")
    for field in (
        "session_id",
        "agent_name",
        "model",
        "repository_id",
        "base_commit",
        "head_commit",
    ):
        if not isinstance(receipt.get(field), str) or not receipt[field].strip():
            raise AgentProofContractError(f"missing_session_field:{field}")
    if not receipt["repository_id"].startswith("sha256:"):
        raise AgentProofContractError("repository_id_format_invalid")
    _require_hash(receipt["repository_id"][7:], "repository_id")
    _require_timestamp(receipt.get("started_at"), "started_at")
    _require_timestamp(receipt.get("ended_at"), "ended_at")
    started = datetime.fromisoformat(receipt["started_at"].replace("Z", "+00:00"))
    ended = datetime.fromisoformat(receipt["ended_at"].replace("Z", "+00:00"))
    if ended < started:
        raise AgentProofContractError("session_time_order_invalid")
    if not isinstance(receipt.get("event_count"), int):
        raise AgentProofContractError("event_count_invalid")
    _require_hash(receipt.get("chain_head_sha256"), "chain_head_sha256")


def build_session_receipt(
    session: dict[str, Any], event_inputs: list[dict[str, Any]]
) -> dict[str, Any]:
    previous_hash = GENESIS_PREVIOUS_HASH
    events: list[dict[str, Any]] = []

    for index, event_input in enumerate(event_inputs, start=SEQUENCE_START):
        _validate_event_input(event_input, index)
        event = {
            "sequence": index,
            "event_type": event_input["event_type"],
            "occurred_at": event_input["occurred_at"],
            "previous_event_hash": previous_hash,
            "payload": deepcopy(event_input["payload"]),
        }
        event_hash = _sha256_hex(canonical_json_bytes(event))
        event["event_hash"] = event_hash
        events.append(event)
        previous_hash = event_hash

    if not events:
        raise AgentProofContractError("session_requires_at_least_one_event")

    for field in (
        "session_id",
        "agent_name",
        "model",
        "repository_id",
        "base_commit",
        "head_commit",
    ):
        if not isinstance(session.get(field), str) or not session[field].strip():
            raise AgentProofContractError(f"missing_session_field:{field}")
    _require_timestamp(session.get("started_at"), "started_at")
    _require_timestamp(session.get("ended_at"), "ended_at")

    return {
        "schema_version": SCHEMA_VERSION,
        "canonicalization": CANONICALIZATION_NAME,
        "session_id": session["session_id"],
        "agent_name": session["agent_name"],
        "model": session["model"],
        "repository_id": session["repository_id"],
        "base_commit": session["base_commit"],
        "head_commit": session["head_commit"],
        "started_at": session["started_at"],
        "ended_at": session["ended_at"],
        "event_count": len(events),
        "chain_head_sha256": previous_hash,
        "events": events,
    }


def verify_session_receipt(receipt: dict[str, Any]) -> dict[str, Any]:
    previous_hash = GENESIS_PREVIOUS_HASH
    errors: list[dict[str, Any]] = []
    try:
        _validate_receipt_envelope(receipt)
    except AgentProofContractError as exc:
        errors.append({"code": "receipt_contract_invalid", "detail": str(exc)})
    events = receipt.get("events")
    if not isinstance(events, list):
        errors.append({"code": "events_not_array"})
        return {"valid": False, "errors": errors}
    if not events:
        errors.append({"code": "events_empty"})

    for offset, event in enumerate(events):
        expected_sequence = SEQUENCE_START + offset * SEQUENCE_STEP
        if not isinstance(event, dict):
            errors.append({"code": "event_not_object", "sequence": expected_sequence})
            continue
        try:
            _require_exact_keys(event, _EVENT_KEYS, f"events[{expected_sequence}]")
        except AgentProofContractError as exc:
            errors.append(
                {
                    "code": "event_contract_invalid",
                    "sequence": expected_sequence,
                    "detail": str(exc),
                }
            )
        sequence = event.get("sequence")
        if sequence != expected_sequence:
            errors.append(
                {
                    "code": "sequence_mismatch",
                    "sequence": sequence,
                    "expected": expected_sequence,
                }
            )
        declared_previous = event.get("previous_event_hash")
        if declared_previous != previous_hash:
            errors.append({"code": "previous_hash_mismatch", "sequence": sequence})
        if not isinstance(declared_previous, str) or _HASH_RE.fullmatch(
            declared_previous
        ) is None:
            errors.append({"code": "previous_hash_invalid", "sequence": sequence})
        try:
            _validate_event_input(
                {
                    "event_type": event.get("event_type"),
                    "occurred_at": event.get("occurred_at"),
                    "payload": event.get("payload"),
                },
                expected_sequence,
            )
        except AgentProofContractError as exc:
            errors.append(
                {
                    "code": "event_contract_invalid",
                    "sequence": sequence,
                    "detail": str(exc),
                }
            )
        declared_hash = event.get("event_hash")
        event_scope = {
            key: value for key, value in event.items() if key != "event_hash"
        }
        try:
            recalculated_hash = _sha256_hex(canonical_json_bytes(event_scope))
        except AgentProofContractError as exc:
            errors.append(
                {
                    "code": "event_not_canonicalizable",
                    "sequence": sequence,
                    "detail": str(exc),
                }
            )
            recalculated_hash = previous_hash
        if declared_hash != recalculated_hash:
            errors.append(
                {
                    "code": "event_hash_mismatch",
                    "sequence": sequence,
                    "declared": declared_hash,
                    "recalculated": recalculated_hash,
                }
            )
        if not isinstance(declared_hash, str) or _HASH_RE.fullmatch(
            declared_hash
        ) is None:
            errors.append({"code": "event_hash_invalid", "sequence": sequence})
        previous_hash = declared_hash if isinstance(declared_hash, str) else recalculated_hash

    if receipt.get("event_count") != len(events):
        errors.append({"code": "event_count_mismatch", "expected": len(events)})
    if receipt.get("chain_head_sha256") != previous_hash:
        errors.append({"code": "chain_head_mismatch", "recalculated": previous_hash})

    return {
        "valid": not errors,
        "event_count": len(events),
        "chain_head_sha256": previous_hash,
        "errors": errors,
    }


def load_canonical_receipt(path: Path) -> tuple[dict[str, Any], bytes]:
    source = path.expanduser()
    flags = os.O_RDONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        fd = os.open(source, flags)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode):
                raise ReceiptLoadError("receipt_not_regular_file")
            if info.st_size > MAX_RECEIPT_BYTES:
                raise ReceiptLoadError("receipt_too_large")
            receipt_bytes = _read_fd_limited(fd, MAX_RECEIPT_BYTES)
            if len(receipt_bytes) > MAX_RECEIPT_BYTES:
                raise ReceiptLoadError("receipt_too_large")
        finally:
            os.close(fd)
        receipt = json.loads(receipt_bytes)
    except OSError as exc:
        raise ReceiptLoadError("receipt_not_readable") from exc
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ReceiptLoadError("receipt_not_valid_json") from exc

    if not isinstance(receipt, dict):
        raise ReceiptLoadError("receipt_must_be_object")
    try:
        canonical_bytes = canonical_json_bytes(receipt)
    except AgentProofContractError as exc:
        raise ReceiptLoadError("receipt_not_canonicalizable") from exc
    if receipt_bytes != canonical_bytes:
        raise ReceiptLoadError("receipt_not_canonical")
    if not verify_session_receipt(receipt)["valid"]:
        raise ReceiptLoadError("receipt_hash_chain_invalid")
    return receipt, receipt_bytes
