#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

from _common import extract_text, load_json, read_jsonl, write_json_output
from build_conversation_records import extract_user_text


def safe_event(event: dict[str, Any], line_number: int, kinds: set[str], max_chars: int) -> dict[str, Any] | None:
    outer = event.get("type")
    payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
    inner = payload.get("type")
    result: dict[str, Any] = {"line_number": line_number, "outer_type": outer, "inner_type": inner, "timestamp": event.get("timestamp")}

    if outer == "response_item" and inner == "message":
        role = payload.get("role")
        phase = payload.get("phase")
        if role not in {"user", "assistant"}:
            return None
        kind = str(role)
        if kind not in kinds:
            return None
        text = extract_user_text(payload.get("content")) if kind == "user" else extract_text(payload.get("content"))
        if not text:
            return None
        result.update({"kind": kind, "phase": phase, "text": text[:max_chars]})
        return result
    if outer == "event_msg" and inner == "user_message" and "user" in kinds:
        text = extract_user_text(payload.get("message") or payload.get("text") or payload.get("content"))
        if not text:
            return None
        result.update({"kind": "user", "text": text[:max_chars]})
        return result
    if outer == "event_msg" and inner in {"task_started", "task_complete", "turn_aborted"} and "lifecycle" in kinds:
        result.update({"kind": "lifecycle", "turn_id": payload.get("turn_id") or payload.get("id"), "status": inner})
        if inner == "task_complete":
            result["last_agent_message"] = extract_text(payload.get("last_agent_message"))[:max_chars]
        return result
    if outer == "response_item" and inner in {"function_call", "custom_tool_call", "function_call_output", "custom_tool_call_output"} and "tool" in kinds:
        result.update(
            {
                "kind": "tool",
                "name": payload.get("name"),
                "call_id": payload.get("call_id"),
                "status": payload.get("status"),
                "summary": extract_text(payload.get("output") or payload.get("arguments") or payload.get("input"))[:max_chars],
            }
        )
        return result
    return None


def search(path: Path, kinds: set[str], max_events: int = 50, max_chars: int = 2000, line_start: int | None = None, line_end: int | None = None) -> dict[str, Any]:
    events: list[dict[str, Any]] = []
    for line_number, event in read_jsonl(path):
        if line_start is not None and line_number < line_start:
            continue
        if line_end is not None and line_number > line_end:
            continue
        item = safe_event(event, line_number, kinds, max_chars)
        if item is not None:
            events.append(item)
            if len(events) >= max_events:
                break
    return {
        "version": 1,
        "source_path": str(path.resolve()),
        "events": events,
        "truncated": len(events) >= max_events,
        "excluded": ["encrypted reasoning", "reasoning summaries", "unrequested event types"],
    }


def search_record(
    batch: dict[str, Any],
    record_id: str,
    kinds: set[str],
    line_start: int,
    line_end: int,
    max_events: int = 50,
    max_chars: int = 2000,
) -> dict[str, Any]:
    indexed: dict[str, dict[str, Any]] = {item["record_id"]: item for item in batch.get("records", [])}
    for episode in batch.get("feedback_episode_candidates", []):
        for item in episode.get("context_records", []):
            indexed.setdefault(item["record_id"], item)
    record = indexed.get(record_id)
    if record is None:
        raise ValueError(f"record_id is not present in the trusted batch: {record_id}")
    source = record.get("source") if isinstance(record.get("source"), dict) else {}
    allowed_start = source.get("line_start")
    allowed_end = source.get("line_end")
    if not isinstance(allowed_start, int) or not isinstance(allowed_end, int):
        raise ValueError("record does not provide bounded source lines")
    if line_start < allowed_start or line_end > allowed_end or line_start > line_end:
        raise ValueError(f"requested lines must stay within record bounds {allowed_start}-{allowed_end}")
    path_value = source.get("jsonl_path")
    if not isinstance(path_value, str) or not path_value:
        raise ValueError("record does not provide a source JSONL path")
    result = search(Path(path_value).expanduser().resolve(), kinds, max_events, max_chars, line_start, line_end)
    result["record_id"] = record_id
    result["allowed_line_range"] = [allowed_start, allowed_end]
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Return a bounded, redacted slice of transcript evidence after a needs_evidence decision.")
    parser.add_argument("--batch", required=True)
    parser.add_argument("--record-id", required=True)
    parser.add_argument("--kinds", required=True)
    parser.add_argument("--line-start", type=int, required=True)
    parser.add_argument("--line-end", type=int, required=True)
    parser.add_argument("--max-events", type=int, default=50)
    parser.add_argument("--max-chars", type=int, default=2000)
    parser.add_argument("--output")
    args = parser.parse_args()
    kinds = {item.strip() for item in args.kinds.split(",") if item.strip()}
    allowed = {"user", "assistant", "lifecycle", "tool"}
    if not kinds or not kinds <= allowed:
        parser.error(f"--kinds must be a comma-separated subset of {sorted(allowed)}")
    if args.max_events <= 0 or args.max_chars <= 0:
        parser.error("--max-events and --max-chars must be positive")
    batch = load_json(Path(args.batch).expanduser().resolve(), {})
    try:
        result = search_record(batch, args.record_id, kinds, args.line_start, args.line_end, args.max_events, args.max_chars)
    except ValueError as error:
        parser.error(str(error))
    write_json_output(result, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
