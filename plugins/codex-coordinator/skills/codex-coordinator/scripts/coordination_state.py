#!/usr/bin/env python3
"""Read and update the local Codex task-boundary board.

The board stores one small JSON claim per active Codex task and generates a
human-readable active view from those claims. It never reads or stores task
transcripts, prompts, reasoning, tool output, or full-turn logs.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
import unicodedata
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any


MARKER_SCHEMA_VERSION = 2
CLAIM_SCHEMA_VERSION = 1
DEFAULT_ACTIVE_LIMIT = 3
HARD_ACTIVE_LIMIT = 12
MAX_RECORD_BYTES = 4096
MAX_PATHS = 32
MAX_ACTIONS = 16
MAX_DEPENDENCIES = 16
CURRENT_VIEW_NAME = "CURRENT.md"
LEGACY_ADVISORY_ACTIONS = frozenset({"git-integration"})

PROJECT_ID = re.compile(r"[a-z0-9][a-z0-9-]{0,63}")
THREAD_ID = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
)
ACTION = re.compile(r"[a-z][a-z0-9-]{0,63}")
CLAIM_KEYS = {
    "schemaVersion",
    "projectId",
    "threadId",
    "title",
    "goal",
    "status",
    "revision",
    "createdAt",
    "updatedAt",
    "paths",
    "actions",
    "blockedBy",
    "limitOverride",
}


class BoardError(RuntimeError):
    """Raised when board state is invalid or a requested write is unsafe."""


class ClaimConflict(BoardError):
    """Raised when a proposed claim overlaps an exclusive active action."""

    def __init__(self, conflicts: list[dict[str, Any]]):
        super().__init__("The requested exclusive action overlaps an active task claim")
        self.conflicts = conflicts


def _is_linklike(path: Path) -> bool:
    return path.is_symlink() or (
        hasattr(path, "is_junction") and path.exists() and path.is_junction()
    )


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, child in pairs:
        if key in value:
            raise BoardError(f"Duplicate JSON key: {key}")
        value[key] = child
    return value


def _read_json(path: Path, *, maximum: int = MAX_RECORD_BYTES) -> dict[str, Any]:
    try:
        raw = path.read_bytes()
    except OSError as error:
        raise BoardError(f"Cannot read board record {path.name}: {error}") from error
    if len(raw) > maximum:
        raise BoardError(f"Board record exceeds {maximum} bytes: {path.name}")
    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_object)
    except (UnicodeError, json.JSONDecodeError) as error:
        raise BoardError(f"Cannot parse board record {path.name}: {error}") from error
    if not isinstance(value, dict):
        raise BoardError(f"Board record is not a JSON object: {path.name}")
    return value


def _marker_value(text: str, key: str) -> str:
    matches = re.findall(
        rf"(?mi)^\s*{re.escape(key)}\s*:\s*([^#\r\n]+?)\s*(?:#.*)?$",
        text,
    )
    if len(matches) != 1:
        raise BoardError(f"Marker must contain exactly one {key}")
    return matches[0].strip().strip("`\"'")


def _load_marker(project_root: Path, *, require_enabled: bool = True) -> dict[str, Any]:
    project_root = project_root.resolve(strict=True)
    marker_path = project_root / ".codex" / "coordination" / "project.yaml"
    coordination_path = marker_path.parent
    if _is_linklike(project_root / ".codex") or _is_linklike(coordination_path):
        raise BoardError("The coordination path must not be a symlink or junction")
    if _is_linklike(marker_path):
        raise BoardError("The project marker must not be a symlink or junction")
    try:
        raw = marker_path.read_bytes()
    except OSError as error:
        raise BoardError(f"Cannot read project marker: {error}") from error
    if len(raw) > 16_384:
        raise BoardError("Project marker exceeds 16384 bytes")
    try:
        text = raw.decode("utf-8")
    except UnicodeError as error:
        raise BoardError("Project marker is not valid UTF-8") from error

    schema = _marker_value(text, "schema_version")
    enabled = _marker_value(text, "coordination_enabled").lower()
    project_id = _marker_value(text, "project_id")
    if schema != str(MARKER_SCHEMA_VERSION):
        raise BoardError(
            f"Unsupported marker schema {schema!r}; expected {MARKER_SCHEMA_VERSION}. "
            "Keep Coordinator disabled and run the documented migration."
        )
    if enabled not in {"true", "false"}:
        raise BoardError("coordination_enabled must be true or false")
    if require_enabled and enabled != "true":
        raise BoardError("The task-boundary board is disabled for this project")
    if not PROJECT_ID.fullmatch(project_id):
        raise BoardError("project_id is invalid")
    if _marker_value(text, "cross_project_task_access") != "false":
        raise BoardError("cross_project_task_access must be false")
    if _marker_value(text, "cross_project_state_changes") != "false":
        raise BoardError("cross_project_state_changes must be false")
    if _marker_value(text, "active") != ".codex/coordination/active":
        raise BoardError("Marker active path is incompatible")
    if _marker_value(text, "archive") != ".codex/coordination/archive":
        raise BoardError("Marker archive path is incompatible")

    coordination_root = marker_path.parent.resolve(strict=False)
    active_root = (project_root / ".codex" / "coordination" / "active").resolve(
        strict=False
    )
    archive_root = (project_root / ".codex" / "coordination" / "archive").resolve(
        strict=False
    )
    for label, path in (("active", active_root), ("archive", archive_root)):
        try:
            path.relative_to(coordination_root)
        except ValueError as error:
            raise BoardError(f"Marker {label} path escapes the coordination root") from error
    for label, lexical in (
        ("active", coordination_path / "active"),
        ("archive", coordination_path / "archive"),
    ):
        if _is_linklike(lexical):
            raise BoardError(f"The {label} board path must not be a symlink or junction")

    return {
        "projectRoot": project_root,
        "coordinationRoot": coordination_root,
        "activeRoot": active_root,
        "archiveRoot": archive_root,
        "projectId": project_id,
        "enabled": enabled == "true",
    }


def _valid_text(value: Any, *, label: str, maximum: int) -> str:
    if not isinstance(value, str):
        raise BoardError(f"{label} must be text")
    value = value.strip()
    if not 1 <= len(value) <= maximum:
        raise BoardError(f"{label} must contain 1 to {maximum} characters")
    if any(
        character in {"\r", "\n", "\u2028", "\u2029"}
        or unicodedata.category(character) in {"Cc", "Cs"}
        for character in value
    ):
        raise BoardError(f"{label} contains unsupported control text")
    return value


def _timestamp(value: Any, *, label: str) -> str:
    value = _valid_text(value, label=label, maximum=40)
    candidate = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(candidate)
    except ValueError as error:
        raise BoardError(f"{label} is not ISO-8601") from error
    if parsed.utcoffset() is None or "T" not in value:
        raise BoardError(f"{label} must include a timezone")
    return value


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _normalize_path(value: str) -> str:
    value = _valid_text(value, label="claim path", maximum=240).replace("\\", "/")
    if value == ".":
        return value
    if any(character in value for character in "*?[]") or ":" in value:
        raise BoardError(f"Claim path must be a concrete repository-relative path: {value}")
    if any(part in {"", ".", ".."} for part in value.split("/")):
        raise BoardError(f"Claim path escapes or ambiguously names the repository: {value}")
    path = PurePosixPath(value)
    if path.is_absolute():
        raise BoardError(f"Claim path escapes or ambiguously names the repository: {value}")
    return path.as_posix()


def _deduplicate(values: list[str], *, label: str) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for value in values:
        key = value.casefold()
        if key in seen:
            raise BoardError(f"Duplicate {label}: {value}")
        seen.add(key)
        result.append(value)
    return result


def _string_items(value: Any, *, label: str, maximum: int) -> list[str]:
    if not isinstance(value, list) or len(value) > maximum:
        raise BoardError(f"Claim has too many {label}s")
    if any(not isinstance(item, str) for item in value):
        raise BoardError(f"Every claim {label} must be text")
    return value


def _validate_claim(value: dict[str, Any], *, project_id: str, filename: str) -> dict[str, Any]:
    unknown = set(value) - CLAIM_KEYS
    missing = CLAIM_KEYS - set(value)
    if unknown:
        raise BoardError(
            f"Claim {filename} contains unsupported fields: {', '.join(sorted(unknown))}"
        )
    if missing:
        raise BoardError(f"Claim {filename} is missing fields: {', '.join(sorted(missing))}")
    if value["schemaVersion"] != CLAIM_SCHEMA_VERSION:
        raise BoardError(f"Claim {filename} has an unsupported schema")
    if value["projectId"] != project_id:
        raise BoardError(f"Claim {filename} belongs to another project")
    thread_id = value["threadId"]
    if not isinstance(thread_id, str) or not THREAD_ID.fullmatch(thread_id):
        raise BoardError(f"Claim {filename} has an invalid threadId")
    if filename != f"{thread_id}.json":
        raise BoardError(f"Claim filename does not match its threadId: {filename}")
    title = _valid_text(value["title"], label="title", maximum=120)
    goal = _valid_text(value["goal"], label="goal", maximum=320)
    status = value["status"]
    if status not in {"active", "blocked"}:
        raise BoardError(f"Claim {filename} has an invalid status")
    revision = value["revision"]
    if not isinstance(revision, int) or isinstance(revision, bool) or revision < 1:
        raise BoardError(f"Claim {filename} has an invalid revision")
    created_at = _timestamp(value["createdAt"], label="createdAt")
    updated_at = _timestamp(value["updatedAt"], label="updatedAt")

    paths = _string_items(value["paths"], label="path", maximum=MAX_PATHS)
    actions = _string_items(value["actions"], label="action", maximum=MAX_ACTIONS)
    blocked_by = _string_items(
        value["blockedBy"], label="dependency", maximum=MAX_DEPENDENCIES
    )
    paths = _deduplicate([_normalize_path(item) for item in paths], label="path")
    actions = _deduplicate(actions, label="action")
    for action in actions:
        if not ACTION.fullmatch(action):
            raise BoardError(f"Claim {filename} has an invalid action: {action}")
    dependencies = _deduplicate(blocked_by, label="dependency")
    for dependency in dependencies:
        if not THREAD_ID.fullmatch(dependency) or dependency == thread_id:
            raise BoardError(f"Claim {filename} has an invalid dependency")
    if not paths and not actions:
        raise BoardError(f"Claim {filename} must own at least one path or action")
    if not isinstance(value["limitOverride"], bool):
        raise BoardError(f"Claim {filename} has an invalid limitOverride")
    return {
        **value,
        "title": title,
        "goal": goal,
        "createdAt": created_at,
        "updatedAt": updated_at,
        "paths": paths,
        "actions": actions,
        "blockedBy": dependencies,
    }


def _active_records(marker: dict[str, Any]) -> list[dict[str, Any]]:
    active_root: Path = marker["activeRoot"]
    if not active_root.exists():
        return []
    if not active_root.is_dir() or active_root.is_symlink():
        raise BoardError("The active board path is not a normal directory")
    paths = sorted(active_root.glob("*.json"), key=lambda item: item.name.casefold())
    if len(paths) > HARD_ACTIVE_LIMIT:
        raise BoardError(
            f"The active board has {len(paths)} records; hard limit is {HARD_ACTIVE_LIMIT}"
        )
    records: list[dict[str, Any]] = []
    for path in paths:
        if path.is_symlink() or not path.is_file():
            raise BoardError(f"Active claim is not a normal file: {path.name}")
        records.append(
            _validate_claim(
                _read_json(path), project_id=marker["projectId"], filename=path.name
            )
        )
    return records


def _path_overlap(left: str, right: str) -> bool:
    if left == "." or right == ".":
        return True
    left_parts = tuple(part.casefold() for part in PurePosixPath(left).parts)
    right_parts = tuple(part.casefold() for part in PurePosixPath(right).parts)
    common = min(len(left_parts), len(right_parts))
    return left_parts[:common] == right_parts[:common]


def _overlaps(
    candidate: dict[str, Any], records: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    overlaps: list[dict[str, Any]] = []
    for record in records:
        if record["threadId"] == candidate["threadId"]:
            continue
        path_pairs = sorted(
            {
                (left, right)
                for left in candidate["paths"]
                for right in record["paths"]
                if _path_overlap(left, right)
            }
        )
        action_overlap = sorted(
            set(candidate["actions"]).intersection(record["actions"])
        )
        if path_pairs or action_overlap:
            overlaps.append(
                {
                    "threadId": record["threadId"],
                    "title": record["title"],
                    "goal": record["goal"],
                    "pathOverlaps": [
                        {"requested": left, "owned": right}
                        for left, right in path_pairs
                    ],
                    "actionOverlaps": action_overlap,
                }
            )
    return overlaps


def _warnings(
    candidate: dict[str, Any], records: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Report possible shared-file work without turning task scope into a lock."""

    warnings: list[dict[str, Any]] = []
    for overlap in _overlaps(candidate, records):
        advisory_actions = [
            action
            for action in overlap["actionOverlaps"]
            if action in LEGACY_ADVISORY_ACTIONS
        ]
        if overlap["pathOverlaps"] or advisory_actions:
            warnings.append(
                {
                    **overlap,
                    "actionOverlaps": advisory_actions,
                }
            )
    return warnings


def _conflicts(candidate: dict[str, Any], records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return only conflicts that must have one active owner."""

    conflicts: list[dict[str, Any]] = []
    for overlap in _overlaps(candidate, records):
        blocking_actions = [
            action
            for action in overlap["actionOverlaps"]
            if action not in LEGACY_ADVISORY_ACTIONS
        ]
        if blocking_actions:
            conflicts.append(
                {
                    **overlap,
                    "pathOverlaps": [],
                    "actionOverlaps": blocking_actions,
                }
            )
    return conflicts


def _atomic_write(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if _is_linklike(path.parent):
        raise BoardError(
            f"Refusing to write through a linked board directory: {path.parent}"
        )
    temporary_name: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=path.parent, prefix=f".{path.name}.", suffix=".tmp", delete=False
        ) as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
            temporary_name = stream.name
        os.replace(temporary_name, path)
    except OSError as error:
        if temporary_name:
            try:
                Path(temporary_name).unlink(missing_ok=True)
            except OSError:
                pass
        raise BoardError(f"Cannot write board record {path.name}: {error}") from error


@contextmanager
def _board_write_lock(marker: dict[str, Any]):
    """Serialize claim mutations without creating another state authority."""

    active_root: Path = marker["activeRoot"]
    active_root.mkdir(parents=True, exist_ok=True)
    if _is_linklike(active_root) or not active_root.is_dir():
        raise BoardError("The active board path is not a normal directory")
    lock_path = active_root / ".write.lock"
    if _is_linklike(lock_path):
        raise BoardError("The board lock must not be a symlink or junction")
    try:
        with lock_path.open("a+b") as stream:
            if os.name == "nt":
                import msvcrt

                stream.seek(0)
                msvcrt.locking(stream.fileno(), msvcrt.LK_LOCK, 1)
                try:
                    if os.fstat(stream.fileno()).st_size == 0:
                        stream.seek(0)
                        stream.write(b"\0")
                        stream.flush()
                        os.fsync(stream.fileno())
                    yield
                finally:
                    stream.seek(0)
                    msvcrt.locking(stream.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(stream.fileno(), fcntl.LOCK_EX)
                try:
                    yield
                finally:
                    fcntl.flock(stream.fileno(), fcntl.LOCK_UN)
    except OSError as error:
        raise BoardError(f"Cannot lock the active board: {error}") from error


def _encode(value: dict[str, Any]) -> bytes:
    payload = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if len(payload) > MAX_RECORD_BYTES:
        raise BoardError(f"Board record exceeds {MAX_RECORD_BYTES} bytes")
    return payload


def _markdown_cell(value: str) -> str:
    """Keep validated claim text inert inside the generated Markdown table."""

    return (
        value.replace("\\", "\\\\")
        .replace("|", "\\|")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _render_current_view(marker: dict[str, Any], records: list[dict[str, Any]]) -> bytes:
    """Render the small human view from canonical active claims only."""

    coordinators = [
        record for record in records if "goal-coordination" in record["actions"]
    ]
    lines = [
        "# Current coordinated work",
        "",
        "> Generated active-only view. Schema-2 JSON claims in `active/` are canonical.",
        "",
        f"Project: `{marker['projectId']}`",
        f"Active lanes: {len(records)}",
    ]
    if len(coordinators) == 1:
        coordinator = coordinators[0]
        lines.extend(
            (
                "Coordinator: "
                f"`{coordinator['threadId']}` — {_markdown_cell(coordinator['title'])}",
                f"Shared goal: {_markdown_cell(coordinator['goal'])}",
            )
        )
    lines.extend(
        (
            "",
            "| Task | Goal | Owns | Status | Depends on |",
            "| --- | --- | --- | --- | --- |",
        )
    )
    for record in records:
        task = f"{_markdown_cell(record['title'])} (`{record['threadId']}`)"
        ownership = [f"path: {path}" for path in record["paths"]]
        ownership.extend(f"action: {action}" for action in record["actions"])
        dependencies = record["blockedBy"] or ["—"]
        lines.append(
            "| "
            + " | ".join(
                (
                    task,
                    _markdown_cell(record["goal"]),
                    _markdown_cell(", ".join(ownership)),
                    record["status"],
                    _markdown_cell(", ".join(dependencies)),
                )
            )
            + " |"
        )
    if not records:
        lines.append("| — | — | — | — | — |")
    return ("\n".join(lines) + "\n").encode("utf-8")


def _refresh_current_view(
    marker: dict[str, Any], records: list[dict[str, Any]]
) -> bool:
    """Best-effort refresh; a derived view can never veto canonical state."""

    try:
        _atomic_write(
            marker["coordinationRoot"] / CURRENT_VIEW_NAME,
            _render_current_view(marker, records),
        )
    except (BoardError, OSError, UnicodeError):
        return False
    return True


def list_board(project_root: Path) -> dict[str, Any]:
    marker = _load_marker(project_root)
    records = _active_records(marker)
    conflicts: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    for record in records:
        conflicts.extend(
            {
                "requestedBy": record["threadId"],
                **conflict,
            }
            for conflict in _conflicts(record, records)
            if record["threadId"] < conflict["threadId"]
        )
        warnings.extend(
            {
                "requestedBy": record["threadId"],
                **warning,
            }
            for warning in _warnings(record, records)
            if record["threadId"] < warning["threadId"]
        )
    return {
        "status": "ok" if not conflicts else "conflict",
        "schemaVersion": MARKER_SCHEMA_VERSION,
        "projectId": marker["projectId"],
        "activeCount": len(records),
        "defaultLimit": DEFAULT_ACTIVE_LIMIT,
        "hardLimit": HARD_ACTIVE_LIMIT,
        "records": records,
        "conflicts": conflicts,
        "warnings": warnings,
    }


def claim_boundary(
    project_root: Path,
    *,
    thread_id: str,
    title: str,
    goal: str,
    paths: list[str],
    actions: list[str],
    blocked_by: list[str],
    status: str,
    expected_revision: int,
    user_approved_over_limit: bool,
) -> dict[str, Any]:
    marker = _load_marker(project_root)
    if not THREAD_ID.fullmatch(thread_id):
        raise BoardError("thread-id must be an exact native Codex thread UUID")
    with _board_write_lock(marker):
        return _claim_boundary_locked(
            marker,
            thread_id=thread_id,
            title=title,
            goal=goal,
            paths=paths,
            actions=actions,
            blocked_by=blocked_by,
            status=status,
            expected_revision=expected_revision,
            user_approved_over_limit=user_approved_over_limit,
        )


def _claim_boundary_locked(
    marker: dict[str, Any],
    *,
    thread_id: str,
    title: str,
    goal: str,
    paths: list[str],
    actions: list[str],
    blocked_by: list[str],
    status: str,
    expected_revision: int,
    user_approved_over_limit: bool,
) -> dict[str, Any]:
    records = _active_records(marker)
    existing = next((item for item in records if item["threadId"] == thread_id), None)
    current_revision = existing["revision"] if existing else 0
    if expected_revision != current_revision:
        raise BoardError(
            f"Claim revision changed: expected {expected_revision}, found {current_revision}"
        )
    if existing is None and len(records) >= HARD_ACTIVE_LIMIT:
        raise BoardError(f"The active-task hard limit is {HARD_ACTIVE_LIMIT}")
    if (
        existing is None
        and len(records) >= DEFAULT_ACTIVE_LIMIT
        and not user_approved_over_limit
    ):
        raise BoardError(
            f"The default active-task limit is {DEFAULT_ACTIVE_LIMIT}; "
            "a direct user decision is required before adding another task"
        )
    normalized_paths = _deduplicate(
        [
            _normalize_path(value)
            for value in _string_items(paths, label="path", maximum=MAX_PATHS)
        ],
        label="path",
    )
    normalized_actions = _deduplicate(
        _string_items(actions, label="action", maximum=MAX_ACTIONS), label="action"
    )
    for action in normalized_actions:
        if not ACTION.fullmatch(action):
            raise BoardError(f"Invalid action claim: {action}")
    dependencies = _deduplicate(
        _string_items(
            blocked_by, label="dependency", maximum=MAX_DEPENDENCIES
        ),
        label="dependency",
    )
    for dependency in dependencies:
        if not THREAD_ID.fullmatch(dependency) or dependency == thread_id:
            raise BoardError(f"Invalid dependency thread ID: {dependency}")
    if not normalized_paths and not normalized_actions:
        raise BoardError("A claim must include at least one path or exclusive action")
    if status not in {"active", "blocked"}:
        raise BoardError("status must be active or blocked")

    now = _now()
    candidate = {
        "schemaVersion": CLAIM_SCHEMA_VERSION,
        "projectId": marker["projectId"],
        "threadId": thread_id,
        "title": _valid_text(title, label="title", maximum=120),
        "goal": _valid_text(goal, label="goal", maximum=320),
        "status": status,
        "revision": current_revision + 1,
        "createdAt": existing["createdAt"] if existing else now,
        "updatedAt": now,
        "paths": normalized_paths,
        "actions": normalized_actions,
        "blockedBy": dependencies,
        "limitOverride": bool(
            (existing and existing["limitOverride"]) or user_approved_over_limit
        ),
    }
    candidate = _validate_claim(
        candidate, project_id=marker["projectId"], filename=f"{thread_id}.json"
    )
    conflicts = _conflicts(candidate, records)
    if conflicts:
        raise ClaimConflict(conflicts)

    target = marker["activeRoot"] / f"{thread_id}.json"
    if _is_linklike(target):
        raise BoardError("The task claim must not be a symlink or junction")
    previous = target.read_bytes() if target.is_file() else None
    _atomic_write(target, _encode(candidate))
    try:
        post_records = _active_records(marker)
        post_conflicts = _conflicts(candidate, post_records)
        if post_conflicts:
            if previous is None:
                target.unlink(missing_ok=True)
            else:
                _atomic_write(target, previous)
            raise ClaimConflict(post_conflicts)
    except (BoardError, OSError):
        if previous is None and target.exists():
            try:
                target.unlink()
            except OSError:
                pass
        elif previous is not None:
            try:
                _atomic_write(target, previous)
            except BoardError:
                pass
        raise

    _refresh_current_view(marker, post_records)

    return {
        "status": "claimed" if existing is None else "updated",
        "projectId": marker["projectId"],
        "record": candidate,
        "activeCount": len(post_records),
        "warnings": _warnings(candidate, post_records),
    }


def release_boundary(
    project_root: Path,
    *,
    thread_id: str,
    expected_revision: int,
    final_status: str,
) -> dict[str, Any]:
    marker = _load_marker(project_root)
    if not THREAD_ID.fullmatch(thread_id):
        raise BoardError("thread-id must be an exact native Codex thread UUID")
    with _board_write_lock(marker):
        return _release_boundary_locked(
            marker,
            thread_id=thread_id,
            expected_revision=expected_revision,
            final_status=final_status,
        )


def _release_boundary_locked(
    marker: dict[str, Any],
    *,
    thread_id: str,
    expected_revision: int,
    final_status: str,
) -> dict[str, Any]:
    records = _active_records(marker)
    record = next((item for item in records if item["threadId"] == thread_id), None)
    if record is None:
        raise BoardError("No active claim exists for this thread")
    if record["revision"] != expected_revision:
        raise BoardError(
            f"Claim revision changed: expected {expected_revision}, found {record['revision']}"
        )
    if final_status not in {
        "completed",
        "stopped",
        "superseded",
        "stale-owner-confirmed",
    }:
        raise BoardError("Invalid final status")

    closed_at = _now()
    receipt = {
        "schemaVersion": CLAIM_SCHEMA_VERSION,
        "projectId": marker["projectId"],
        "threadId": thread_id,
        "title": record["title"],
        "goal": record["goal"],
        "finalStatus": final_status,
        "lastRevision": record["revision"],
        "closedAt": closed_at,
    }
    archive_root: Path = marker["archiveRoot"]
    archive_root.mkdir(parents=True, exist_ok=True)
    if _is_linklike(archive_root):
        raise BoardError("The archive path must not be a symlink or junction")
    stamp = closed_at.replace(":", "").replace("-", "")
    payload = _encode(receipt)
    archive_path: Path | None = None
    try:
        for ordinal in range(10_000):
            suffix = "" if ordinal == 0 else f"-{ordinal}"
            candidate = archive_root / f"{thread_id}-{stamp}{suffix}.json"
            try:
                with candidate.open("xb") as stream:
                    stream.write(payload)
                    stream.flush()
                    os.fsync(stream.fileno())
                archive_path = candidate
                break
            except FileExistsError:
                continue
        if archive_path is None:
            raise OSError("Cannot allocate a unique compact receipt name")
        (marker["activeRoot"] / f"{thread_id}.json").unlink()
    except OSError as error:
        try:
            if archive_path is not None:
                archive_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise BoardError(f"Cannot release claim safely: {error}") from error
    _refresh_current_view(
        marker,
        [item for item in records if item["threadId"] != thread_id],
    )
    return {
        "status": "released",
        "projectId": marker["projectId"],
        "receipt": receipt,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    listing = commands.add_parser("list", help="read the bounded active board")
    listing.add_argument("--project-root", required=True, type=Path)

    claim = commands.add_parser("claim", help="create or update this task's claim")
    claim.add_argument("--project-root", required=True, type=Path)
    claim.add_argument("--thread-id", required=True)
    claim.add_argument("--title", required=True)
    claim.add_argument("--goal", required=True)
    claim.add_argument("--path", action="append", default=[])
    claim.add_argument("--action", action="append", default=[])
    claim.add_argument("--blocked-by", action="append", default=[])
    claim.add_argument("--status", choices=("active", "blocked"), default="active")
    claim.add_argument("--expected-revision", required=True, type=int)
    claim.add_argument("--user-approved-over-limit", action="store_true")

    release = commands.add_parser("release", help="move this task's claim to a cold receipt")
    release.add_argument("--project-root", required=True, type=Path)
    release.add_argument("--thread-id", required=True)
    release.add_argument("--expected-revision", required=True, type=int)
    release.add_argument(
        "--status",
        dest="final_status",
        required=True,
        choices=("completed", "stopped", "superseded", "stale-owner-confirmed"),
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "list":
            report = list_board(args.project_root)
        elif args.command == "claim":
            report = claim_boundary(
                args.project_root,
                thread_id=args.thread_id,
                title=args.title,
                goal=args.goal,
                paths=args.path,
                actions=args.action,
                blocked_by=args.blocked_by,
                status=args.status,
                expected_revision=args.expected_revision,
                user_approved_over_limit=args.user_approved_over_limit,
            )
        else:
            report = release_boundary(
                args.project_root,
                thread_id=args.thread_id,
                expected_revision=args.expected_revision,
                final_status=args.final_status,
            )
    except ClaimConflict as error:
        print(
            json.dumps(
                {"status": "conflict", "error": str(error), "conflicts": error.conflicts},
                indent=2,
                ensure_ascii=False,
            )
        )
        return 2
    except (BoardError, OSError, UnicodeError) as error:
        print(json.dumps({"status": "error", "error": str(error)}, indent=2))
        return 1
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
