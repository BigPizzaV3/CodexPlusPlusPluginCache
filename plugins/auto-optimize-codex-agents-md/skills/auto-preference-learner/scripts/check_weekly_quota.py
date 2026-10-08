#!/usr/bin/env python3
from __future__ import annotations

import argparse
import math
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from _common import codex_home, parse_timestamp, read_jsonl, write_json_output


def quota_observation(event: dict[str, Any], source: Path, line_number: int, window_minutes: int) -> dict[str, Any] | None:
    payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
    if event.get("type") != "event_msg" or payload.get("type") != "token_count":
        return None
    event_time = parse_timestamp(event.get("timestamp"))
    containers: list[dict[str, Any]] = []
    if isinstance(payload.get("rate_limits"), dict):
        containers.append(payload["rate_limits"])
    info = payload.get("info") if isinstance(payload.get("info"), dict) else {}
    if isinstance(info.get("rate_limits"), dict):
        containers.append(info["rate_limits"])
    base = {
        "event_time": event_time.isoformat().replace("+00:00", "Z") if event_time else None,
        "source_mtime": datetime.fromtimestamp(source.stat().st_mtime, tz=timezone.utc).isoformat().replace("+00:00", "Z"),
        "source_path": str(source.resolve()),
        "line_number": line_number,
    }
    if event_time is None or not containers:
        return {**base, "valid": False, "invalid_reason": "latest token_count event lacks trusted timestamp or rate_limits"}
    matching_windows: list[tuple[str, dict[str, Any]]] = []
    for limits in containers:
        for window_name in ("primary", "secondary"):
            value = limits.get(window_name)
            if not isinstance(value, dict):
                continue
            if value.get("window_minutes") == window_minutes:
                matching_windows.append((window_name, value))
    if not matching_windows:
        return {**base, "valid": False, "invalid_reason": "latest token_count event has no seven-day window"}

    for window_name, value in matching_windows:
        used = value.get("used_percent")
        if isinstance(used, bool) or not isinstance(used, (int, float)) or not math.isfinite(float(used)) or not 0 <= float(used) <= 100:
            continue
        reset = parse_timestamp(value.get("resets_at"))
        if reset is None or reset <= event_time or reset > event_time + timedelta(minutes=window_minutes + 5):
            continue
        return {
            **base,
            "valid": True,
            "window_name": window_name,
            "used_percent": float(used),
            "remaining_percent": 100.0 - float(used),
            "window_minutes": window_minutes,
            "resets_at": reset.isoformat().replace("+00:00", "Z"),
        }
    return {**base, "valid": False, "invalid_reason": "latest seven-day window has invalid fields"}


def check(home: Path, threshold: float = 20.0, window_minutes: int = 10080, now: datetime | None = None, max_files: int = 100) -> dict[str, Any]:
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    files: list[Path] = []
    for folder in (home / "sessions", home / "archived_sessions"):
        if folder.is_dir():
            files.extend(folder.rglob("*.jsonl"))
    files.sort(key=lambda path: path.stat().st_mtime, reverse=True)
    observations: list[dict[str, Any]] = []
    for path in files[:max_files]:
        for line_number, event in read_jsonl(path):
            observation = quota_observation(event, path, line_number, window_minutes)
            if observation is not None:
                observations.append(observation)

    observations.sort(
        key=lambda item: (
            parse_timestamp(item.get("event_time")) or parse_timestamp(item.get("source_mtime")) or datetime.min.replace(tzinfo=timezone.utc),
            item["line_number"],
        ),
        reverse=True,
    )

    if not observations:
        return {
            "status": "unknown",
            "allowed": False,
            "reason": "no fresh seven-day quota window was found",
            "threshold_remaining_percent": threshold,
            "window_minutes": window_minutes,
        }
    latest = observations[0]
    if not latest.get("valid"):
        return {
            "status": "unknown",
            "allowed": False,
            "reason": latest.get("invalid_reason", "latest seven-day quota observation is invalid"),
            "threshold_remaining_percent": threshold,
            "window_minutes": window_minutes,
            "source_path": latest.get("source_path"),
            "line_number": latest.get("line_number"),
        }
    event_time = parse_timestamp(latest.get("event_time"))
    if event_time is None or event_time > now:
        return {
            "status": "unknown",
            "allowed": False,
            "reason": "latest seven-day quota observation has an invalid or future event time",
            "threshold_remaining_percent": threshold,
            **latest,
        }
    reset = parse_timestamp(latest.get("resets_at"))
    if reset is None or reset <= now:
        return {
            "status": "unknown",
            "allowed": False,
            "reason": "latest seven-day quota observation is expired",
            "threshold_remaining_percent": threshold,
            **latest,
        }
    allowed = latest["remaining_percent"] > threshold
    return {
        "status": "allowed" if allowed else "blocked",
        "allowed": allowed,
        "reason": "remaining quota is above threshold" if allowed else "remaining quota is not above threshold",
        "threshold_remaining_percent": threshold,
        **latest,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Fail closed unless a fresh seven-day Codex quota window has more than the configured percentage remaining.")
    parser.add_argument("--codex-home")
    parser.add_argument("--threshold", type=float, default=20.0)
    parser.add_argument("--window-minutes", type=int, default=10080)
    parser.add_argument("--max-files", type=int, default=100)
    parser.add_argument("--output")
    args = parser.parse_args()
    result = check(codex_home(args.codex_home), args.threshold, args.window_minutes, max_files=args.max_files)
    write_json_output(result, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
