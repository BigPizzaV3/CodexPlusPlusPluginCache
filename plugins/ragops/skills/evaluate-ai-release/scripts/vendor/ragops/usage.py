from __future__ import annotations

import json
import re
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

EVENT_VERSION = "ragops-local-usage-event-0.1"
REPORT_VERSION = "ragops-local-usage-report-0.1"
EVENT_FIELDS = {
    "schema_version",
    "recorded_at",
    "ragops_version",
    "command",
    "exit_code",
}
COMMAND = re.compile(r"[a-z][a-z0-9-]{0,63}")


class UsageContractError(ValueError):
    """Raised when local usage evidence violates its public contract."""


def _timestamp(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.endswith("Z"):
        raise UsageContractError(f"{label} must be a UTC timestamp ending in Z")
    try:
        parsed = datetime.fromisoformat(value.removesuffix("Z") + "+00:00")
    except ValueError as exc:
        raise UsageContractError(f"{label} must be an ISO timestamp") from exc
    if parsed.tzinfo != UTC:
        raise UsageContractError(f"{label} must use UTC")
    return value


def _timestamp_sort_key(value: str) -> datetime:
    return datetime.fromisoformat(value.removesuffix("Z") + "+00:00")


def _event(data: Any, line_number: int) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise UsageContractError(f"usage event line {line_number} must be an object")
    missing = EVENT_FIELDS - data.keys()
    unexpected = data.keys() - EVENT_FIELDS
    if missing:
        raise UsageContractError(
            f"usage event line {line_number} is missing fields: {', '.join(sorted(missing))}"
        )
    if unexpected:
        raise UsageContractError(
            f"usage event line {line_number} has unexpected fields: "
            f"{', '.join(sorted(unexpected))}"
        )
    if data["schema_version"] != EVENT_VERSION:
        raise UsageContractError(
            f"usage event line {line_number} has unsupported schema_version"
        )
    recorded_at = _timestamp(data["recorded_at"], f"usage event line {line_number} recorded_at")
    version = data["ragops_version"]
    if not isinstance(version, str) or not version or len(version) > 64:
        raise UsageContractError(
            f"usage event line {line_number} ragops_version must be a non-empty string"
        )
    command = data["command"]
    if not isinstance(command, str) or not COMMAND.fullmatch(command):
        raise UsageContractError(f"usage event line {line_number} command is invalid")
    exit_code = data["exit_code"]
    if isinstance(exit_code, bool) or not isinstance(exit_code, int) or not 0 <= exit_code <= 255:
        raise UsageContractError(
            f"usage event line {line_number} exit_code must be an integer from 0 to 255"
        )
    return {
        "schema_version": EVENT_VERSION,
        "recorded_at": recorded_at,
        "ragops_version": version,
        "command": command,
        "exit_code": exit_code,
    }


def record_local_usage(
    path: str | Path,
    *,
    ragops_version: str,
    command: str,
    exit_code: int,
    recorded_at: str | None = None,
) -> None:
    event = _event(
        {
            "schema_version": EVENT_VERSION,
            "recorded_at": recorded_at
            or datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
            "ragops_version": ragops_version,
            "command": command,
            "exit_code": exit_code,
        },
        1,
    )
    with Path(path).open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(event, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
        stream.write("\n")


def summarize_local_usage(path: str | Path) -> dict[str, Any]:
    try:
        lines = Path(path).read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError) as exc:
        raise UsageContractError("usage events must be readable UTF-8 JSONL") from exc
    events = []
    for line_number, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            events.append(_event(json.loads(line), line_number))
        except json.JSONDecodeError as exc:
            raise UsageContractError(
                f"usage event line {line_number} is not valid JSON"
            ) from exc
    if not events:
        raise UsageContractError("usage events must not be empty")
    command_counts = Counter(event["command"] for event in events)
    exit_code_counts = Counter(str(event["exit_code"]) for event in events)
    timestamps = [event["recorded_at"] for event in events]
    return {
        "report_version": REPORT_VERSION,
        "event_count": len(events),
        "first_recorded_at": min(timestamps, key=_timestamp_sort_key),
        "last_recorded_at": max(timestamps, key=_timestamp_sort_key),
        "command_counts": dict(sorted(command_counts.items())),
        "exit_code_counts": dict(sorted(exit_code_counts.items())),
    }
