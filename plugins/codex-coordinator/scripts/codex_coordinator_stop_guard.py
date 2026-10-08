#!/usr/bin/env python3
"""Prompt one task to resolve its own active claim before its turn ends."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any


PAYLOAD_LIMIT = 131_072
MARKER_LIMIT = 16_384
CLAIM_LIMIT = 4_096
MARKER_SCHEMA_VERSION = "2"
CLAIM_SCHEMA_VERSION = 1
PROJECT_ID = re.compile(r"[a-z0-9][a-z0-9-]{0,63}")
THREAD_ID = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
)
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


class GuardError(RuntimeError):
    """Raised when bounded local state cannot be trusted."""


def _is_linklike(path: Path) -> bool:
    return path.is_symlink() or (
        hasattr(path, "is_junction") and path.exists() and path.is_junction()
    )


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise GuardError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _bounded_bytes(path: Path, maximum: int) -> bytes:
    if _is_linklike(path) or not path.is_file():
        raise GuardError(f"unsupported file: {path.name}")
    with path.open("rb") as stream:
        raw = stream.read(maximum + 1)
    if len(raw) > maximum:
        raise GuardError(f"oversized file: {path.name}")
    return raw


def _payload() -> dict[str, Any]:
    raw = sys.stdin.buffer.read(PAYLOAD_LIMIT + 1)
    if len(raw) > PAYLOAD_LIMIT:
        return {}
    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_object)
    except (UnicodeError, json.JSONDecodeError, GuardError):
        return {}
    return value if isinstance(value, dict) else {}


def _marker_value(text: str, key: str) -> str | None:
    matches = re.findall(
        rf"(?mi)^\s*{re.escape(key)}\s*:\s*([^#\r\n]+?)\s*(?:#.*)?$",
        text,
    )
    if len(matches) != 1:
        return None
    return matches[0].strip().strip("`\"'")


def _find_repository(cwd: Path) -> Path | None:
    current = cwd.resolve(strict=True)
    for index, root in enumerate((current, *current.parents)):
        if index >= 64:
            return None
        marker = root / ".codex" / "coordination" / "project.yaml"
        if marker.is_file() and (root / ".git").exists():
            if _is_linklike(root / ".codex") or _is_linklike(marker.parent):
                raise GuardError("linked marker path")
            return root
    return None


def _primary_worktree(root: Path) -> Path:
    git_entry = root / ".git"
    if git_entry.is_dir() and not _is_linklike(git_entry):
        return root
    raw = _bounded_bytes(git_entry, 4_096)
    try:
        text = raw.decode("utf-8").strip()
    except UnicodeError as error:
        raise GuardError("invalid linked-worktree metadata") from error
    match = re.fullmatch(r"gitdir:\s*(.+)", text, flags=re.IGNORECASE)
    if match is None:
        raise GuardError("invalid linked-worktree metadata")
    git_dir = Path(match.group(1).strip())
    if not git_dir.is_absolute():
        git_dir = git_entry.parent / git_dir
    git_dir = git_dir.resolve(strict=True)
    common_raw = _bounded_bytes(git_dir / "commondir", 4_096)
    try:
        common_value = common_raw.decode("utf-8").strip()
    except UnicodeError as error:
        raise GuardError("invalid common Git directory") from error
    common_dir = (git_dir / common_value).resolve(strict=True)
    if common_dir.name.casefold() != ".git" or _is_linklike(common_dir):
        raise GuardError("unsupported common Git directory")
    primary = common_dir.parent
    if not primary.is_dir():
        raise GuardError("missing primary worktree")
    return primary


def _enabled_marker(root: Path) -> str | None:
    marker = root / ".codex" / "coordination" / "project.yaml"
    if _is_linklike(root / ".codex") or _is_linklike(marker.parent):
        raise GuardError("linked marker path")
    try:
        text = _bounded_bytes(marker, MARKER_LIMIT).decode("utf-8")
    except UnicodeError as error:
        raise GuardError("invalid marker encoding") from error
    enabled = _marker_value(text, "coordination_enabled")
    if enabled is None or enabled.casefold() == "false":
        return None
    if enabled.casefold() != "true":
        raise GuardError("invalid enablement")
    project_id = _marker_value(text, "project_id")
    checks = {
        "schema_version": MARKER_SCHEMA_VERSION,
        "cross_project_task_access": "false",
        "cross_project_state_changes": "false",
        "active": ".codex/coordination/active",
        "archive": ".codex/coordination/archive",
    }
    if not isinstance(project_id, str) or PROJECT_ID.fullmatch(project_id) is None:
        raise GuardError("invalid project identity")
    if any(_marker_value(text, key) != expected for key, expected in checks.items()):
        raise GuardError("incompatible marker")
    return project_id


def _own_claim(root: Path, project_id: str, thread_id: str) -> dict[str, Any] | None:
    active_root = root / ".codex" / "coordination" / "active"
    if not active_root.exists():
        return None
    if not active_root.is_dir() or _is_linklike(active_root):
        raise GuardError("unsupported active board")
    path = active_root / f"{thread_id}.json"
    if not path.exists():
        return None
    raw = _bounded_bytes(path, CLAIM_LIMIT)
    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=_unique_object)
    except (UnicodeError, json.JSONDecodeError) as error:
        raise GuardError("invalid own claim") from error
    if not isinstance(value, dict) or set(value) != CLAIM_KEYS:
        raise GuardError("incompatible own claim")
    if (
        value.get("schemaVersion") != CLAIM_SCHEMA_VERSION
        or value.get("projectId") != project_id
        or value.get("threadId") != thread_id
        or value.get("status") not in {"active", "blocked"}
        or not isinstance(value.get("revision"), int)
        or isinstance(value.get("revision"), bool)
        or value["revision"] < 1
    ):
        raise GuardError("incompatible own claim")
    return value


def _block(project_id: str, revision: int) -> None:
    reason = " ".join(
        [
            f"Resolve your own Codex task-boundary claim for project {project_id} before ending this turn.",
            f"The exact claim is still active at revision {revision}.",
            "If this task is complete, stopped, or superseded, use the existing coordination_state.py release command with your exact session id and revision.",
            "If the work genuinely continues across turns, keep or update only your own claim and say briefly that ownership remains active.",
            "Do not inspect other tasks, send coordination messages, create a task, or read transcripts for this check.",
        ]
    )
    json.dump({"decision": "block", "reason": reason}, sys.stdout)


def main() -> None:
    try:
        payload = _payload()
        if payload.get("hook_event_name") != "Stop":
            return
        thread_id = payload.get("session_id")
        cwd_value = payload.get("cwd")
        if (
            not isinstance(thread_id, str)
            or THREAD_ID.fullmatch(thread_id) is None
            or not isinstance(cwd_value, str)
            or not 1 <= len(cwd_value) <= 4_096
        ):
            return
        cwd = Path(cwd_value)
        if not cwd.is_dir():
            return
        discovered = _find_repository(cwd)
        if discovered is None:
            return
        discovered_project = _enabled_marker(discovered)
        if discovered_project is None:
            return
        primary = _primary_worktree(discovered)
        project_id = _enabled_marker(primary)
        if project_id is None or project_id != discovered_project:
            return
        claim = _own_claim(primary, project_id, thread_id)
        if claim is None or claim["status"] != "active":
            return
        if payload.get("stop_hook_active") is True:
            return
        _block(project_id, claim["revision"])
    except Exception:
        # Lifecycle advice must never wedge a Codex turn.
        return


if __name__ == "__main__":
    main()
