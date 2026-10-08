#!/usr/bin/env python3
"""Read-only Dreamer receipt validation and redacted resume cards."""

from __future__ import annotations

import json
import argparse
import re
import sys
import hashlib
import stat
from pathlib import Path

RECEIPT_FIELDS = (
    "owner_task_id",
    "parent_task_id",
    "destination_task_id",
    "destination_artifact",
    "destination_sha256",
    "receipt_kind",
    "state",
    "timestamp",
    "producer",
    "provenance",
)
IDENTITY_FIELDS = (
    "owner_task_id",
    "parent_task_id",
    "destination_task_id",
    "destination_artifact",
    "receipt_kind",
    "producer",
)
SHA256_RE = re.compile(r"^[0-9a-f]{64}$", re.IGNORECASE)
PEM_RE = re.compile(
    r"-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----.*?-----END [A-Z0-9 ]*PRIVATE KEY-----",
    re.IGNORECASE | re.DOTALL,
)
GITHUB_TOKEN_RE = re.compile(r"\b(?:github_pat|gh[pousr])_[A-Za-z0-9_:-]+\b", re.IGNORECASE)
SHORT_TOKEN_RE = re.compile(r"\bsk-[A-Za-z0-9_-]{4,}\b")
ASSIGNMENT_RE = re.compile(
    r"(?i)(\b(?:api[_-]?key|token|secret|password|private[_-]?key)\b\s*[:=]\s*)"
    r"(['\"]?)([^,\s}\"']+)\2"
)
JSON_SECRET_RE = re.compile(
    r'(?i)(["\'](?:api[_-]?key|token|secret|password|private[_-]?key)["\']\s*:\s*)'
    r'(["\'])(?:\\.|(?!\2).)*\2'
)
BEARER_RE = re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+")
URL_SECRET_RE = re.compile(
    r"(?i)(https?://)([^/@\s]+):([^/@\s]+)@|([?&](?:api[_-]?key|token|secret|password|access_token)=)[^&#\s]+"
)
MAX_INPUT_BYTES = 1024 * 1024
MAX_TEXT_BYTES = 4096
SCALAR = (str, int, float, bool, type(None))


def redact_text(value: object) -> str:
    """Redact common credential forms without reading or writing external state."""
    text = value if isinstance(value, str) else "[REDACTED:INVALID]"
    text = PEM_RE.sub("[REDACTED:PRIVATE_KEY]", text)
    text = GITHUB_TOKEN_RE.sub("[REDACTED:GITHUB_TOKEN]", text)
    text = SHORT_TOKEN_RE.sub("[REDACTED:API_TOKEN]", text)
    text = JSON_SECRET_RE.sub(r'\1"[REDACTED:SECRET]"', text)
    text = BEARER_RE.sub("Bearer [REDACTED:CREDENTIAL]", text)
    text = URL_SECRET_RE.sub(
        lambda m: (m.group(1) + "[REDACTED:CREDENTIAL]@" if m.group(1) else m.group(4) + "[REDACTED:SECRET]"),
        text,
    )
    text = ASSIGNMENT_RE.sub(r"\1[REDACTED:SECRET]", text)
    return text[:MAX_TEXT_BYTES]


def _receipt_value(receipt: dict[str, str], field: str) -> str:
    value = receipt.get(field, "")
    return value.strip() if isinstance(value, str) else ""


def _safe_identity(receipt: dict) -> dict[str, str]:
    return {field: redact_text(_receipt_value(receipt, field)) for field in IDENTITY_FIELDS}


def validate_receipt(
    receipt: dict,
    *,
    current_sha256: str | None = None,
    previous: dict | None = None,
) -> dict:
    """Return a deterministic, fail-closed receipt verdict."""
    if not isinstance(receipt, dict) or any(not isinstance(key, str) or not isinstance(value, str) for key, value in receipt.items()):
        return {"verdict": "UNPROVEN", "missing_fields": list(RECEIPT_FIELDS)}
    if any(not isinstance(receipt.get(field), str) for field in RECEIPT_FIELDS if field in receipt):
        return {"verdict": "UNPROVEN", "missing_fields": ["invalid_scalar"]}

    missing = [field for field in RECEIPT_FIELDS if not _receipt_value(receipt, field)]
    claimed = _receipt_value(receipt, "destination_sha256").lower()
    current = current_sha256.strip().lower() if isinstance(current_sha256, str) else ""
    if claimed and not SHA256_RE.fullmatch(claimed):
        missing.append("destination_sha256:invalid")
        claimed = ""
    if current and not SHA256_RE.fullmatch(current):
        missing.append("current_sha256:invalid")
        current = ""

    verdict = "UNPROVEN"
    owner = _receipt_value(receipt, "owner_task_id")
    parent = _receipt_value(receipt, "parent_task_id")
    previous_valid = isinstance(previous, dict) and all(
        isinstance(key, str) and isinstance(value, str) for key, value in previous.items()
    ) and all(_receipt_value(previous, field) for field in RECEIPT_FIELDS) and SHA256_RE.fullmatch(
        _receipt_value(previous, "destination_sha256").lower()
    ) is not None
    if not previous_valid and previous is not None:
        missing.append("previous:invalid")
    if owner and parent and owner == parent:
        verdict = "CONFLICT"
    elif missing:
        verdict = "UNPROVEN"
    elif previous_valid and any(
        _receipt_value(previous, field) != _receipt_value(receipt, field)
        for field in IDENTITY_FIELDS
    ):
        verdict = "CONFLICT"
    elif not current:
        verdict = "UNPROVEN"
    elif claimed != current:
        verdict = "STALE_POINTER"
    elif previous_valid and _receipt_value(previous, "destination_sha256").lower() == claimed:
        verdict = "SAME"
    else:
        verdict = "NEW"

    result = {
        "verdict": verdict,
        "identity": _safe_identity(receipt),
        "claimed_sha256": claimed,
        "current_sha256": current,
        "missing_fields": sorted(set(missing)),
    }
    if previous_valid:
        previous_sha = _receipt_value(previous, "destination_sha256").lower()
        result["previous_sha256"] = previous_sha if SHA256_RE.fullmatch(previous_sha) else ""
    return result


def build_resume_card(receipt: dict, verdict: str) -> dict:
    """Build a stable redacted projection for Codex, Hermes, and OpenCode."""
    safe = {key: redact_text(value) for key, value in receipt.items()} if isinstance(receipt, dict) else {}
    safe_hash = safe.get("destination_sha256", "")
    if not isinstance(receipt, dict) or not isinstance(receipt.get("destination_sha256"), str) or not SHA256_RE.fullmatch(receipt["destination_sha256"].strip()):
        safe_hash = ""
    safe_verdict = verdict if verdict in {"NEW", "SAME", "CONFLICT", "STALE_POINTER", "UNPROVEN"} else "UNPROVEN"
    return {
        "schema_version": "dreamer.resume-card.v1",
        "receipt_verdict": safe_verdict,
        "owner_task_id": safe.get("owner_task_id", ""),
        "parent_task_id": safe.get("parent_task_id", ""),
        "destination_task_id": safe.get("destination_task_id", ""),
        "state": safe.get("state", "UNPROVEN"),
        "blocker": safe.get("blocker", ""),
        "next_action": safe.get("next_action", ""),
        "human_gate": safe.get("human_gate", ""),
        "evidence": [{
            "path": safe.get("destination_artifact", ""),
            "sha256": safe_hash,
        }],
        "confidence": safe.get("confidence", "unproven"),
        "provenance": safe.get("provenance", ""),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--receipt", required=True)
    parser.add_argument("--previous")
    parser.add_argument("--current-sha256")
    parser.add_argument("--artifact")
    args = parser.parse_args(argv if argv is not None else sys.argv[1:])
    try:
        if args.artifact and args.current_sha256:
            raise ValueError("mutually exclusive hash sources")
        def load(path: str):
            file_path = Path(path)
            if not stat.S_ISREG(file_path.stat().st_mode):
                raise ValueError("not a regular file")
            with file_path.open("rb") as handle:
                raw = handle.read(MAX_INPUT_BYTES + 1)
            if len(raw) > MAX_INPUT_BYTES:
                raise ValueError("input too large")
            return json.loads(raw.decode("utf-8"))
        value = load(args.receipt)
        previous = load(args.previous) if args.previous else None
        if not isinstance(value, dict) or any(not isinstance(key, str) or not isinstance(item, str) for key, item in value.items()):
            raise ValueError("invalid receipt types")
        if args.previous and previous is None:
            raise ValueError("invalid previous")
        current = args.current_sha256
        if args.artifact:
            artifact_path = Path(args.artifact)
            if not stat.S_ISREG(artifact_path.stat().st_mode):
                raise ValueError("not a regular artifact")
            digest = hashlib.sha256()
            with artifact_path.open("rb") as handle:
                for chunk in iter(lambda: handle.read(65536), b""):
                    digest.update(chunk)
            current = digest.hexdigest()
        verdict = validate_receipt(value, current_sha256=current, previous=previous)
        output = {"receipt": verdict, "resume_card": build_resume_card(value, verdict["verdict"])}
        print(json.dumps(output, sort_keys=True, separators=(",", ":")))
        return 0
    except (OSError, ValueError, TypeError, AttributeError, RecursionError, json.JSONDecodeError, UnicodeError):
        print(json.dumps({"error": "invalid input"}, separators=(",", ":")))
        return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
