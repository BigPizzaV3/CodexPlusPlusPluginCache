#!/usr/bin/env python3
"""Verify a host task export and issue one locally consumable binding receipt."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from task_binding_common import (
    TaskBindingError,
    atomic_write_json,
    canonical_hash,
    challenge_path,
    exclusive_lock,
    load_challenge,
    normalize_input,
    parse_timestamp,
    readback_proof_hash,
    resolve_workspace,
)


EVIDENCE_KEYS = {"schema_version", "source", "captured_at", "task"}
TASK_KEYS = {"task_id", "host_id", "task_title", "messages"}
MESSAGE_KEYS = {"message_id", "role", "body", "observed_at"}
READY_KEYS = {
    "nonce",
    "workspace_id",
    "workspace_path",
    "role",
    "task_id",
    "host_id",
    "task_title",
    "standing_instructions_revision",
}


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Verify one host task/message readback without external actions."
    )
    parser.add_argument("workspace", help="Absolute path to the user workspace")
    parser.add_argument("--nonce", required=True, help="Issued one-time ready nonce")
    parser.add_argument(
        "--evidence",
        required=True,
        help="Host readback JSON path, or - for stdin",
    )
    parser.add_argument("--request-id", required=True, help="Binding request ID")
    parser.add_argument("--replaces-event-id", help="Active binding event being replaced")
    parser.add_argument("--timestamp", help="ISO 8601 verification time override")
    parser.add_argument(
        "--binding-only",
        action="store_true",
        help="Print only the verified binding config for piping into the recorder",
    )
    return parser


def _object(value: Any, label: str) -> Dict[str, Any]:
    if not isinstance(value, dict):
        raise TaskBindingError(f"{label} must be an object")
    return dict(value)


def _exact(value: Dict[str, Any], label: str, keys: set[str]) -> None:
    missing = sorted(keys - set(value))
    unknown = sorted(set(value) - keys)
    if missing:
        raise TaskBindingError(f"{label} is missing fields: {', '.join(missing)}")
    if unknown:
        raise TaskBindingError(f"{label} has unknown fields: {', '.join(unknown)}")


def _text(value: Any, label: str, maximum: int = 100_000) -> str:
    if not isinstance(value, str) or not value.strip():
        raise TaskBindingError(f"{label} must be non-empty text")
    if len(value) > maximum:
        raise TaskBindingError(f"{label} is too long")
    return value


def _load(path: str) -> Dict[str, Any]:
    if path == "-":
        value = json.load(sys.stdin)
    else:
        with Path(path).open("r", encoding="utf-8") as handle:
            value = json.load(handle)
    return _object(value, "host evidence")


def _ready_payload(body: str) -> Optional[Dict[str, Any]]:
    lines = [line.strip() for line in body.splitlines() if line.strip()]
    if not lines or not lines[-1].startswith("READY_RECEIPT "):
        return None
    raw = lines[-1][len("READY_RECEIPT ") :]
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise TaskBindingError("READY_RECEIPT is invalid JSON") from exc
    payload = _object(value, "READY_RECEIPT")
    _exact(payload, "READY_RECEIPT", READY_KEYS)
    return payload


def _validate_evidence(
    evidence: Dict[str, Any],
    challenge: Dict[str, Any],
    verified_at: str,
) -> Tuple[Dict[str, Any], str]:
    _exact(evidence, "host evidence", EVIDENCE_KEYS)
    if evidence.get("schema_version") != 1:
        raise TaskBindingError("host evidence schema_version is unsupported")
    if evidence.get("source") != "host_task_readback_v1":
        raise TaskBindingError("host evidence source is not a task readback")
    captured_at, captured_moment = parse_timestamp(evidence.get("captured_at"))
    if evidence.get("captured_at") != captured_at:
        raise TaskBindingError("host evidence captured_at is not normalized")

    task = _object(evidence.get("task"), "host evidence task")
    _exact(task, "host evidence task", TASK_KEYS)
    for field in ("task_id", "host_id", "task_title"):
        if task.get(field) != challenge[field]:
            raise TaskBindingError(f"host evidence {field} does not match challenge")
    raw_messages = task.get("messages")
    if not isinstance(raw_messages, list) or not 2 <= len(raw_messages) <= 100:
        raise TaskBindingError("host evidence must contain 2 to 100 messages")

    messages: List[Dict[str, Any]] = []
    message_ids: set[str] = set()
    previous_moment = None
    for index, raw in enumerate(raw_messages):
        message = _object(raw, f"host evidence message {index}")
        _exact(message, f"host evidence message {index}", MESSAGE_KEYS)
        message_id = _text(message.get("message_id"), "message_id", 256).strip()
        if "\n" in message_id or "\r" in message_id or message_id in message_ids:
            raise TaskBindingError("host evidence message IDs must be unique one-line text")
        message_ids.add(message_id)
        if message.get("role") not in {"user", "assistant"}:
            raise TaskBindingError("host evidence message role is invalid")
        body = _text(message.get("body"), "message body")
        observed_at, observed_moment = parse_timestamp(message.get("observed_at"))
        if message.get("observed_at") != observed_at:
            raise TaskBindingError("host evidence message time is not normalized")
        if previous_moment is not None and observed_moment < previous_moment:
            raise TaskBindingError("host evidence message time goes backwards")
        previous_moment = observed_moment
        messages.append(
            {
                "message_id": message_id,
                "role": message["role"],
                "body": body,
                "observed_at": observed_at,
                "_moment": observed_moment,
                "_sha256": hashlib.sha256(body.encode("utf-8")).hexdigest(),
            }
        )

    kickoff_matches = [
        (index, message)
        for index, message in enumerate(messages)
        if message["role"] == "user"
        and message["_sha256"] == challenge["kickoff_message_sha256"]
    ]
    if len(kickoff_matches) != 1:
        raise TaskBindingError("host evidence must contain the exact kickoff message once")
    kickoff_index, kickoff = kickoff_matches[0]
    _, issued_moment = parse_timestamp(challenge["issued_at"])
    if kickoff["_moment"] < issued_moment:
        raise TaskBindingError("kickoff message predates its ready challenge")

    expected_ready = {
        "nonce": challenge["ready_nonce"],
        "workspace_id": challenge["workspace_id"],
        "role": challenge["role"],
        "task_id": challenge["task_id"],
        "host_id": challenge["host_id"],
        "task_title": challenge["task_title"],
        "standing_instructions_revision": challenge[
            "standing_instructions_revision"
        ],
    }
    # workspace_path is injected by the caller because challenge state stores only IDs.
    ready_matches: List[Tuple[int, Dict[str, Any], Dict[str, Any]]] = []
    for index, message in enumerate(messages):
        if index <= kickoff_index or message["role"] != "assistant":
            continue
        payload = _ready_payload(message["body"])
        if payload is not None:
            ready_matches.append((index, message, payload))
    if len(ready_matches) != 1:
        raise TaskBindingError("host evidence must contain exactly one READY_RECEIPT reply")
    _, ready, payload = ready_matches[0]
    for field, expected_value in expected_ready.items():
        if payload.get(field) != expected_value:
            raise TaskBindingError(f"READY_RECEIPT {field} does not match challenge")
    if ready["_moment"] <= kickoff["_moment"]:
        raise TaskBindingError("READY_RECEIPT must be observed after kickoff")
    if captured_moment < ready["_moment"]:
        raise TaskBindingError("host evidence was captured before the ready reply")
    _, verified_moment = parse_timestamp(verified_at)
    if verified_moment < captured_moment:
        raise TaskBindingError("host evidence was verified before it was captured")

    clean_evidence = {
        "schema_version": 1,
        "source": "host_task_readback_v1",
        "captured_at": captured_at,
        "task": {
            "task_id": task["task_id"],
            "host_id": task["host_id"],
            "task_title": task["task_title"],
            "messages": [
                {
                    "message_id": message["message_id"],
                    "role": message["role"],
                    "body": message["body"],
                    "observed_at": message["observed_at"],
                }
                for message in messages
            ],
        },
    }
    return {
        "kickoff": kickoff,
        "ready": ready,
        "ready_payload": payload,
    }, canonical_hash(clean_evidence)


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace, manifest, settings = resolve_workspace(args.workspace)
        evidence = _load(args.evidence)
        lock_time, _ = parse_timestamp(args.timestamp)
        with exclusive_lock(workspace / "strategy/.task-binding.lock", lock_time):
            challenge = load_challenge(workspace, args.nonce)
            if challenge.get("status") == "consumed":
                raise TaskBindingError("ready challenge was already consumed")
            if challenge.get("status") not in {"issued", "verified"}:
                raise TaskBindingError("ready challenge status is invalid")
            if challenge.get("workspace_id") != manifest.get("workspace_id"):
                raise TaskBindingError("ready challenge workspace_id does not match")
            topology = settings["task_topology"]
            if (
                challenge.get("task_mode") != topology["mode"]
                or challenge.get("binding_generation")
                != topology["binding_generation"]
            ):
                raise TaskBindingError("ready challenge is for an obsolete task topology")

            verified_at = (
                challenge["verified_at"]
                if challenge.get("status") == "verified"
                else lock_time
            )
            details, evidence_sha256 = _validate_evidence(
                evidence, challenge, verified_at
            )
            ready_payload = details["ready_payload"]
            ready_workspace_path = Path(ready_payload["workspace_path"])
            if not ready_workspace_path.is_absolute() or ready_workspace_path.resolve() != workspace:
                raise TaskBindingError("READY_RECEIPT workspace_path does not match")
            kickoff = details["kickoff"]
            ready = details["ready"]
            proof_sha256 = readback_proof_hash(
                challenge,
                host_evidence_sha256=evidence_sha256,
                kickoff_message_id=kickoff["message_id"],
                ready_message_id=ready["message_id"],
                ready_message_sha256=ready["_sha256"],
                observed_at=ready["observed_at"],
                verified_at=verified_at,
            )
            receipt = {
                "verification_method": "verified_host_export_v1",
                "challenge_proof_sha256": proof_sha256,
                "host_evidence_sha256": evidence_sha256,
                "kickoff_message_id": kickoff["message_id"],
                "kickoff_message_sha256": kickoff["_sha256"],
                "ready_message_id": ready["message_id"],
                "ready_message_sha256": ready["_sha256"],
                "ready_nonce": challenge["ready_nonce"],
                "observed_task_id": challenge["task_id"],
                "observed_host_id": challenge["host_id"],
                "observed_task_title": challenge["task_title"],
                "observed_workspace_id": challenge["workspace_id"],
                "observed_workspace_path": str(workspace),
                "observed_role": challenge["role"],
                "standing_instructions_revision": challenge[
                    "standing_instructions_revision"
                ],
                "observed_at": ready["observed_at"],
                "verified_at": verified_at,
            }
            config = normalize_input(
                {
                    "schema_version": 1,
                    "request_id": args.request_id,
                    "role": challenge["role"],
                    "slot": challenge["slot"],
                    "task_id": challenge["task_id"],
                    "host_id": challenge["host_id"],
                    "task_title": challenge["task_title"],
                    "binding_origin": challenge["binding_origin"],
                    "ready_receipt": receipt,
                    "replaces_event_id": args.replaces_event_id,
                },
                settings,
                workspace,
                manifest,
            )
            if challenge.get("status") == "verified":
                if (
                    challenge.get("host_evidence_sha256") != evidence_sha256
                    or challenge.get("challenge_proof_sha256") != proof_sha256
                ):
                    raise TaskBindingError(
                        "ready challenge was already verified with different evidence"
                    )
                status = "duplicate"
            else:
                updated = dict(challenge)
                updated.update(
                    {
                        "status": "verified",
                        "host_evidence_sha256": evidence_sha256,
                        "challenge_proof_sha256": proof_sha256,
                        "verified_at": verified_at,
                    }
                )
                atomic_write_json(challenge_path(workspace, args.nonce), updated)
                status = "verified"
        output = (
            config
            if args.binding_only
            else {
                "status": status,
                "binding_config": config,
                "evidence_copied_to_workspace": False,
                "external_actions": [],
            }
        )
        print(json.dumps(output, ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(
            json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
