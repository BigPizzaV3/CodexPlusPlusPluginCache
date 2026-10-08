#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from _common import codex_home, load_json, parse_timestamp, project_root_for_cwd, write_json_output


SESSION_ID_PATTERN = re.compile(r"[0-9a-f]{8}-[0-9a-f-]{20,}", re.IGNORECASE)


def inspect_session(path: Path, storage: str, cached: dict[str, Any] | None = None) -> dict[str, Any]:
    stat = path.stat()
    can_resume = bool(cached) and int((cached or {}).get("scan_byte_offset", 0)) <= stat.st_size
    base = cached if can_resume else {}
    session_id: str | None = base.get("session_id")
    cwd: str | None = base.get("cwd")
    started_at = parse_timestamp(base.get("started_at"))
    last_event_at = parse_timestamp(base.get("last_event_at"))
    warnings: list[str] = list(base.get("warnings", []))
    valid_event_count = int(base.get("valid_event_count", 0))
    has_user_event = bool(base.get("has_user_event", False))
    has_final_event = bool(base.get("has_final_event", False))
    observed_cwds: set[str] = set(base.get("observed_cwds", []))
    is_subagent = bool(base.get("is_subagent", False))
    offset = int(base.get("scan_byte_offset", 0))
    line_number = int(base.get("scan_line_number", 0))
    scanned_event_count = 0
    with path.open("rb") as handle:
        handle.seek(offset)
        for raw_line in handle:
            line_number += 1
            try:
                event = json.loads(raw_line.decode("utf-8-sig"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
            if not isinstance(event, dict):
                continue
            valid_event_count += 1
            scanned_event_count += 1
            payload = event.get("payload") if isinstance(event.get("payload"), dict) else {}
            event_type = event.get("type")
            inner_type = payload.get("type")
            observed_at = parse_timestamp(event.get("timestamp") or payload.get("timestamp"))
            if started_at is None:
                started_at = observed_at
            if observed_at is not None and (last_event_at is None or observed_at > last_event_at):
                last_event_at = observed_at
            if event_type == "session_meta":
                session_id = str(payload.get("id") or payload.get("session_id") or session_id or "") or None
                cwd = str(payload.get("cwd") or cwd or "") or None
                if cwd:
                    observed_cwds.add(cwd)
                source = payload.get("source")
                is_subagent = bool(payload.get("parent_thread_id")) or (
                    isinstance(source, dict) and isinstance(source.get("subagent"), dict)
                )
            elif event_type == "turn_context":
                turn_cwd = str(payload.get("cwd") or "") or None
                if cwd is None:
                    cwd = turn_cwd
                if turn_cwd:
                    observed_cwds.add(turn_cwd)
            if event_type == "response_item" and inner_type == "message":
                has_user_event = has_user_event or payload.get("role") == "user"
                has_final_event = has_final_event or (
                    payload.get("role") == "assistant" and payload.get("phase") == "final_answer"
                )
            elif event_type == "event_msg":
                has_user_event = has_user_event or inner_type == "user_message"
                has_final_event = has_final_event or inner_type == "task_complete" or (
                    inner_type == "agent_message" and payload.get("phase") == "final_answer"
                )

    if session_id is None:
        match = SESSION_ID_PATTERN.search(path.stem)
        session_id = match.group(0) if match else path.stem
        warnings.append("session id inferred from filename")
    root = project_root_for_cwd(cwd)
    observed_roots = sorted({str(value) for value in (project_root_for_cwd(value) for value in observed_cwds) if value})
    return {
        "session_id": session_id,
        "storage": storage,
        "source_path": str(path.resolve()),
        "mtime": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat().replace("+00:00", "Z"),
        "started_at": started_at.isoformat().replace("+00:00", "Z") if started_at else None,
        "last_event_at": last_event_at.isoformat().replace("+00:00", "Z") if last_event_at else None,
        "cwd": cwd,
        "project_root": str(root) if root else None,
        "observed_project_roots": observed_roots,
        "is_subagent": is_subagent,
        "valid_event_count": valid_event_count,
        "valid_for_build": valid_event_count > 0 and has_user_event and has_final_event,
        "warnings": warnings,
        "has_user_event": has_user_event,
        "has_final_event": has_final_event,
        "observed_cwds": sorted(observed_cwds),
        "scan_byte_offset": stat.st_size,
        "scan_line_number": line_number,
        "scanned_event_count": scanned_event_count,
    }


def scan(home: Path, include_archived: bool = True, since: datetime | None = None, state: dict[str, Any] | None = None) -> dict[str, Any]:
    candidates: list[tuple[Path, str]] = []
    active = home / "sessions"
    if active.is_dir():
        candidates.extend((path, "active") for path in active.rglob("*.jsonl"))
    archived = home / "archived_sessions"
    if include_archived and archived.is_dir():
        candidates.extend((path, "archived") for path in archived.rglob("*.jsonl"))

    grouped: dict[str, list[dict[str, Any]]] = {}
    prior_cache = (state or {}).get("session_scan_cache", {})
    scan_cache: dict[str, dict[str, Any]] = {}
    excluded_subagent_files = 0
    for path, storage in candidates:
        try:
            resolved_path = str(path.resolve())
            record = inspect_session(path, storage, prior_cache.get(resolved_path))
        except OSError as error:
            record = {
                "session_id": path.stem,
                "storage": storage,
                "source_path": str(path.resolve()),
                "mtime": None,
                "started_at": None,
                "last_event_at": None,
                "cwd": None,
                "project_root": None,
                "observed_project_roots": [],
                "is_subagent": False,
                "valid_event_count": 0,
                "valid_for_build": False,
                "warnings": [f"unable to inspect: {error}"],
            }
        scan_cache[str(path.resolve())] = record
        if record.get("is_subagent"):
            excluded_subagent_files += 1
            continue
        grouped.setdefault(record["session_id"], []).append(record)

    sessions: list[dict[str, Any]] = []
    for session_id, copies in grouped.items():
        copies.sort(key=lambda item: item.get("mtime") or "", reverse=True)
        valid_copies = [item for item in copies if item.get("valid_for_build")]
        chosen_source = valid_copies[0] if valid_copies else copies[0]
        chosen = dict(chosen_source)
        for field in ("cwd", "project_root", "started_at"):
            if not chosen.get(field):
                chosen[field] = next((item[field] for item in copies if item.get(field)), None)
        chosen["last_event_at"] = max((item.get("last_event_at") or "" for item in copies), default="") or None
        chosen["observed_project_roots"] = sorted(
            {root for item in copies for root in item.get("observed_project_roots", [])}
        )
        ordered_copies = [chosen_source, *(item for item in copies if item is not chosen_source)]
        chosen["source_locations"] = [item["source_path"] for item in ordered_copies]
        chosen["source_copies"] = [
            {
                "source_path": item["source_path"],
                "storage": item["storage"],
                "mtime": item.get("mtime"),
                "valid_for_build": item.get("valid_for_build", False),
            }
            for item in ordered_copies
        ]
        chosen["storage_locations"] = sorted({item["storage"] for item in copies})
        if len(copies) > 1:
            chosen["warnings"] = [*chosen.get("warnings", []), "duplicate active/archive copies deduplicated"]
        if chosen_source is not copies[0]:
            chosen["warnings"] = [*chosen.get("warnings", []), "newer incomplete duplicate skipped in favor of a buildable copy"]
        observed = parse_timestamp(chosen.get("last_event_at") or chosen.get("mtime"))
        if since is None or (observed is not None and observed >= since):
            sessions.append(chosen)

    sessions.sort(key=lambda item: (item.get("started_at") or item.get("mtime") or "", item["session_id"]))
    roots = sorted(
        {
            root
            for item in sessions
            for root in [item.get("project_root"), *item.get("observed_project_roots", [])]
            if root
        }
    )
    return {
        "version": 1,
        "codex_home": str(home),
        "since": since.isoformat().replace("+00:00", "Z") if since else None,
        "sessions": sessions,
        "allowed_project_roots": roots,
        "counts": {
            "unique_sessions": len(sessions),
            "source_files": len(candidates),
            "excluded_subagent_files": excluded_subagent_files,
            "project_roots": len(roots),
        },
        "scan_cache": scan_cache,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Discover active and archived Codex JSONL sessions without modifying them.")
    parser.add_argument("--codex-home")
    parser.add_argument("--output")
    parser.add_argument("--no-archived", action="store_true")
    parser.add_argument("--since", help="Only include sessions observed on or after this ISO date/time.")
    parser.add_argument("--project-root", action="append", default=[], help="Add an explicit user-authorized project root to the target allowlist.")
    parser.add_argument("--quota-result", help="For Scheduled runs, require an allowed quota result before scanning.")
    parser.add_argument("--state", help="Optimizer state containing incremental per-file scan cursors.")
    args = parser.parse_args()
    since = parse_timestamp(args.since) if args.since else None
    if args.since and since is None:
        parser.error("--since must be an ISO date or date-time")
    quota = load_json(Path(args.quota_result).expanduser().resolve(), {}) if args.quota_result else None
    if quota is not None and quota.get("allowed") is not True:
        parser.error("quota result is blocked or unknown; refusing to scan sessions")
    state = load_json(Path(args.state).expanduser().resolve(), {}) if args.state else {}
    result = scan(codex_home(args.codex_home), include_archived=not args.no_archived, since=since, state=state)
    result["quota_gate"] = quota
    explicit_roots: list[str] = []
    for value in args.project_root:
        root = project_root_for_cwd(value)
        if root is None:
            parser.error(f"--project-root does not resolve to an existing project directory: {value}")
        explicit_roots.append(str(root))
    result["allowed_project_roots"] = sorted(set(result["allowed_project_roots"]) | set(explicit_roots))
    result["counts"]["project_roots"] = len(result["allowed_project_roots"])
    result["explicit_project_roots"] = explicit_roots
    write_json_output(result, args.output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
