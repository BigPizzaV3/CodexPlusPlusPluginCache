#!/usr/bin/env python3
"""Atomic Career Passport updates for lifecycle events and user corrections."""
from __future__ import annotations

import argparse
import json
import os
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from contracts import APPLICATION_STAGES, load_json, validate_career_passport


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _atomic_write(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=path.name, suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            json.dump(data, stream, indent=2)
            stream.write("\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _set_path(data: dict[str, Any], dotted: str, value: Any) -> Any:
    parts = [part for part in dotted.split(".") if part]
    if not parts:
        raise ValueError("field path cannot be empty")
    target: dict[str, Any] = data
    for part in parts[:-1]:
        child = target.get(part)
        if not isinstance(child, dict):
            child = {}
            target[part] = child
        target = child
    old = target.get(parts[-1])
    target[parts[-1]] = value
    return old


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("passport")
    subparsers = parser.add_subparsers(dest="command", required=True)

    event = subparsers.add_parser("append-event")
    event.add_argument("--role-id", required=True)
    event.add_argument("--stage", choices=sorted(APPLICATION_STAGES), required=True)
    event.add_argument("--source", choices=["user", "posting", "system"], required=True)
    event.add_argument("--note", default="")

    correction = subparsers.add_parser("correct")
    correction.add_argument("--field", required=True)
    correction.add_argument("--value-json", required=True)

    feedback = subparsers.add_parser("append-feedback")
    feedback.add_argument("--category", choices=["search", "role", "document", "workflow"], required=True)
    feedback.add_argument("--statement", required=True)
    feedback.add_argument("--confirmed", action="store_true")

    subparsers.add_parser("validate")
    args = parser.parse_args()
    path = Path(args.passport).resolve()
    data = load_json(path)
    if args.command == "append-event":
        data.setdefault("application_events", []).append(
            {
                "event_id": f"APP-{uuid.uuid4().hex[:12].upper()}",
                "role_id": args.role_id,
                "stage": args.stage,
                "recorded_at": _now(),
                "source": args.source,
                "note": args.note,
            }
        )
        data["updated_at"] = _now()
    elif args.command == "correct":
        new_value = json.loads(args.value_json)
        old_value = _set_path(data, args.field, new_value)
        data.setdefault("corrections", []).append(
            {
                "field": args.field,
                "old_value": old_value,
                "new_value": new_value,
                "recorded_at": _now(),
                "source": "user",
            }
        )
        data["updated_at"] = _now()
    elif args.command == "append-feedback":
        data.setdefault("feedback", []).append(
            {
                "feedback_id": f"FB-{uuid.uuid4().hex[:12].upper()}",
                "category": args.category,
                "statement": args.statement,
                "confirmed": args.confirmed,
                "recorded_at": _now(),
            }
        )
        data["updated_at"] = _now()
    errors = validate_career_passport(data)
    report = {"passed": not errors, "errors": errors, "passport": str(path)}
    if errors:
        print(json.dumps(report, indent=2))
        return 1
    if args.command != "validate":
        _atomic_write(path, data)
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
