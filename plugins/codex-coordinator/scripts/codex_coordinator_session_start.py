#!/usr/bin/env python3
"""Emit a bounded task-board hint for an explicitly enabled repository."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any


MARKER_LIMIT = 16_384
MARKER_SCHEMA_VERSION = "2"
PROJECT_ID = re.compile(r"[a-z0-9][a-z0-9-]{0,63}")


def _is_linklike(path: Path) -> bool:
    return path.is_symlink() or (
        hasattr(path, "is_junction") and path.exists() and path.is_junction()
    )


def _emit(context: str) -> None:
    json.dump(
        {
            "continue": True,
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": context,
            },
        },
        sys.stdout,
    )


def _read_marker(path: Path) -> str:
    with path.open("rb") as stream:
        raw = stream.read(MARKER_LIMIT + 1)
    if len(raw) > MARKER_LIMIT:
        raise ValueError("marker_too_large")
    try:
        return raw.decode("utf-8")
    except UnicodeError as error:
        raise ValueError("marker_invalid_utf8") from error


def _marker_value(text: str, key: str) -> str | None:
    matches = re.findall(
        rf"(?mi)^\s*{re.escape(key)}\s*:\s*([^#\r\n]+?)\s*(?:#.*)?$",
        text,
    )
    if len(matches) != 1:
        return None
    return matches[0].strip().strip("`\"'")


def _find_marker(cwd: Path) -> Path | None:
    current = cwd.resolve(strict=True)
    for index, root in enumerate((current, *current.parents)):
        if index >= 64:
            return None
        marker = root / ".codex" / "coordination" / "project.yaml"
        git_entry = root / ".git"
        if marker.is_file() and git_entry.exists():
            if (
                _is_linklike(root / ".codex")
                or _is_linklike(marker.parent)
                or _is_linklike(marker)
            ):
                raise ValueError("marker_link_unsupported")
            return marker
    return None


def _invalid(project_id: str, warning: str) -> None:
    _emit(
        "\n".join(
            [
                "Codex task-boundary board is enabled but incompatible.",
                f"project_id={project_id}",
                f"board_warning={warning}",
                "Do not change board claims. Continue only conflict-free read-only work, or ask the user to update or reinstall Codex Coordinator and migrate this project.",
            ]
        )
    )


def _payload() -> dict[str, Any]:
    value = json.load(sys.stdin)
    return value if isinstance(value, dict) else {}


def main() -> None:
    enabled_project = "UNKNOWN"
    marker_seen = False
    try:
        payload = _payload()
        cwd_value = payload.get("cwd")
        if not isinstance(cwd_value, str) or not 1 <= len(cwd_value) <= 4096:
            return
        cwd = Path(cwd_value)
        if not cwd.is_dir():
            return
        marker_path = _find_marker(cwd)
        if marker_path is None:
            return
        marker_seen = True

        text = _read_marker(marker_path)
        enabled = _marker_value(text, "coordination_enabled")
        if enabled is None:
            _invalid("UNKNOWN", "coordination_enabled_missing_or_duplicate")
            return
        if enabled.lower() == "false":
            return
        if enabled.lower() != "true":
            _invalid("UNKNOWN", "coordination_enabled_invalid")
            return

        project_id = _marker_value(text, "project_id") or "UNKNOWN"
        enabled_project = project_id if PROJECT_ID.fullmatch(project_id) else "UNKNOWN"
        checks = {
            "schema_version": MARKER_SCHEMA_VERSION,
            "cross_project_task_access": "false",
            "cross_project_state_changes": "false",
            "active": ".codex/coordination/active",
            "archive": ".codex/coordination/archive",
        }
        for key, expected in checks.items():
            if _marker_value(text, key) != expected:
                _invalid(enabled_project, f"{key}_incompatible")
                return
        if enabled_project == "UNKNOWN":
            _invalid(enabled_project, "project_id_missing_or_invalid")
            return

        _emit(
            "\n".join(
                [
                    "Codex task-boundary board is enabled for this repository.",
                    f"project_id={enabled_project}",
                    "Before substantial writes, load the installed codex-coordinator skill and list the bounded active claims from the primary worktree.",
                    "This hook grants no ownership, creates no task, launches no process, scans no history, and stores no transcript.",
                ]
            )
        )
    except Exception:
        if marker_seen:
            try:
                _invalid(enabled_project, "hook_validation_failed")
            except Exception:
                return


if __name__ == "__main__":
    main()
