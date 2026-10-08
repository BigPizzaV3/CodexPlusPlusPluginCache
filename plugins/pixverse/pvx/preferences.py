from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from .state import append_jsonl, ensure_project, local_data_home, project_dir, read_jsonl, repo_root, slugify, utc_now


QUOTE_CONFIRMATION_REQUIRE = "require"
QUOTE_CONFIRMATION_SKIP = "skip"
QUOTE_CONFIRMATION_MODES = {QUOTE_CONFIRMATION_REQUIRE, QUOTE_CONFIRMATION_SKIP}
MEMBERSHIP_ROUTING_AUTO = "auto"
MEMBERSHIP_ROUTING_UNRESTRICTED_TEST = "unrestricted-test"
MEMBERSHIP_ROUTING_MODES = {
    MEMBERSHIP_ROUTING_AUTO,
    MEMBERSHIP_ROUTING_UNRESTRICTED_TEST,
}


def preferences_path() -> Path:
    return local_data_home() / "preferences.json"


def load_preferences() -> dict[str, Any]:
    path = preferences_path()
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"issues": ["preferences_json_invalid"], "path": str(path)}
    return payload if isinstance(payload, dict) else {"issues": ["preferences_not_object"], "path": str(path)}


def save_preferences(payload: dict[str, Any]) -> Path:
    path = preferences_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")
    return path


def set_quote_confirmation_mode(mode: str, *, source: str = "user") -> dict[str, Any]:
    if mode not in QUOTE_CONFIRMATION_MODES:
        raise ValueError(f"mode must be one of {sorted(QUOTE_CONFIRMATION_MODES)}")
    payload = load_preferences()
    payload["quote_confirmation"] = {
        "mode": mode,
        "source": source,
        "updated_at": utc_now(),
        "revision": uuid.uuid4().hex,
    }
    path = save_preferences(payload)
    return {"path": str(path), "quote_confirmation": payload["quote_confirmation"]}


def set_membership_routing_mode(
    mode: str,
    *,
    source: str = "user",
    account_fingerprint: str = "",
) -> dict[str, Any]:
    """Persist a local account-capability exception without changing billing safety.

    The unrestricted-test value is intentionally explicit and user-controlled:
    it means a test account may use premium model routes even when PixVerse's
    public account label says Free/Basic. Authentication, balance checks, preflight,
    and the user's effective confirmation preference still apply.
    """
    if mode not in MEMBERSHIP_ROUTING_MODES:
        raise ValueError(f"mode must be one of {sorted(MEMBERSHIP_ROUTING_MODES)}")
    payload = load_preferences()
    payload["membership_routing"] = {
        "mode": mode,
        "source": source,
        "updated_at": utc_now(),
    }
    if account_fingerprint:
        payload["membership_routing"]["account_fingerprint"] = account_fingerprint
    path = save_preferences(payload)
    return {"path": str(path), "membership_routing": payload["membership_routing"]}


def membership_routing_record() -> dict[str, Any]:
    payload = load_preferences()
    item = payload.get("membership_routing") if isinstance(payload.get("membership_routing"), dict) else {}
    return item if item.get("mode") in MEMBERSHIP_ROUTING_MODES else {}


def membership_routing_mode(*, account_fingerprint: str | None = None) -> str:
    item = membership_routing_record()
    mode = item.get("mode")
    if mode not in MEMBERSHIP_ROUTING_MODES:
        return MEMBERSHIP_ROUTING_AUTO
    stored_fingerprint = str(item.get("account_fingerprint") or "")
    if account_fingerprint is not None and stored_fingerprint and account_fingerprint != stored_fingerprint:
        return MEMBERSHIP_ROUTING_AUTO
    return str(mode)


def quote_confirmation_mode() -> str:
    payload = load_preferences()
    if payload.get("issues"):
        return QUOTE_CONFIRMATION_REQUIRE
    if "quote_confirmation" not in payload:
        return QUOTE_CONFIRMATION_SKIP
    item = payload["quote_confirmation"]
    mode = item.get("mode") if isinstance(item, dict) else None
    return mode if mode in QUOTE_CONFIRMATION_MODES else QUOTE_CONFIRMATION_REQUIRE


def _global_quote_confirmation_record() -> dict[str, Any]:
    payload = load_preferences()
    item = payload.get("quote_confirmation") if isinstance(payload.get("quote_confirmation"), dict) else {}
    return item if item.get("mode") in QUOTE_CONFIRMATION_MODES else {}


def quote_confirmation_required() -> bool:
    return quote_confirmation_mode() != QUOTE_CONFIRMATION_SKIP


def set_project_quote_confirmation_mode(project: str, mode: str, *, source: str = "user") -> dict[str, Any]:
    if mode not in QUOTE_CONFIRMATION_MODES:
        raise ValueError(f"mode must be one of {sorted(QUOTE_CONFIRMATION_MODES)}")
    path = ensure_project(project)
    record = {
        "at": utc_now(),
        "category": "quote-confirmation",
        "mode": mode,
        "preference": _project_quote_confirmation_preference_text(mode),
        "scope": "project",
        "source": source,
        "global_confirmation_context": _global_quote_confirmation_record(),
    }
    append_jsonl(path / "preferences.jsonl", record)
    return {
        "project": slugify(project),
        "path": str(path / "preferences.jsonl"),
        "quote_confirmation": record,
        "state": project_quote_confirmation_state(project),
    }


def _project_quote_confirmation_record(project: str) -> dict[str, Any]:
    for record in reversed(read_jsonl(project_dir(project) / "preferences.jsonl")):
        if not isinstance(record, dict) or record.get("category") != "quote-confirmation":
            continue
        mode = record.get("mode")
        if mode in QUOTE_CONFIRMATION_MODES:
            return record
    return {}


def project_quote_confirmation_mode(project: str) -> str:
    return str(_project_quote_confirmation_record(project).get("mode", QUOTE_CONFIRMATION_SKIP))


def project_has_paid_generation(project: str) -> bool:
    for record in read_jsonl(project_dir(project) / "manifest.jsonl"):
        if isinstance(record, dict) and record.get("event") == "queue.billing":
            return True
    return False


def project_quote_confirmation_state(project: str) -> dict[str, Any]:
    return canvas_quote_confirmation_state(
        project_path=project_dir(project),
        has_prior_generation=project_has_paid_generation(project),
    )


def _resolve_quote_confirmation_state(
    *, project: str, global_record: dict[str, Any], mode: str, has_prior_generation: bool,
    project_record: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Default to automatic generation; the latest applicable explicit choice wins.

    Generation evidence is diagnostic only, never a first-run approval gate.
    Project choices record the global setting they followed so a later explicit
    global change supersedes them, including changes within the same second.
    """
    global_mode = global_record.get("mode", QUOTE_CONFIRMATION_SKIP)
    global_explicit = bool(global_record)
    global_skip = global_explicit and global_mode == QUOTE_CONFIRMATION_SKIP
    global_require = global_explicit and global_mode == QUOTE_CONFIRMATION_REQUIRE
    project_record = project_record or {}
    context = project_record.get(
        "global_confirmation_context", project_record.get("released_global_confirmation")
    )
    project_choice_active = bool(project_record) and (not global_explicit or context == global_record)
    effective_mode = mode if project_choice_active else global_mode
    requires_confirmation = effective_mode == QUOTE_CONFIRMATION_REQUIRE
    return {
        "project": project,
        "scope": "project" if project_choice_active else "global" if global_explicit else "default",
        "global_mode": global_mode,
        "global_explicit": global_explicit,
        "global_skip": global_skip,
        "global_require": global_require,
        "project_release": project_choice_active and mode == QUOTE_CONFIRMATION_SKIP,
        "project_choice_active": project_choice_active,
        "mode": mode,
        "effective_mode": effective_mode,
        "requires_confirmation": requires_confirmation,
        "has_prior_generation": has_prior_generation,
        "first_generation_requires_confirmation": requires_confirmation and not has_prior_generation,
    }


def canvas_quote_confirmation_state(
    *, project_path: Path | None, has_prior_generation: bool,
) -> dict[str, Any]:
    """Read existing settings for the resolved Canvas binding, never the invocation cwd.

    Also used by ordinary queues so missing settings default to automatic execution
    and unreadable or malformed settings consistently fail closed. Canvas evidence
    comes from its own guarded ledger and does not control confirmation policy.
    """
    global_record: dict[str, Any] = {}
    mode = QUOTE_CONFIRMATION_SKIP
    project_record: dict[str, Any] = {}
    issues: list[str] = []
    try:
        path = preferences_path()
        payload = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        if not isinstance(payload, dict):
            raise ValueError("Global preferences must be an object")
        if "quote_confirmation" in payload:
            item = payload["quote_confirmation"]
            if not isinstance(item, dict) or item.get("mode") not in QUOTE_CONFIRMATION_MODES:
                raise ValueError("Invalid global quote-confirmation setting")
            global_record = item
        if project_path is not None:
            for row in read_jsonl(project_path / "preferences.jsonl"):
                if not isinstance(row, dict) or row.get("kind") == "invalid_jsonl":
                    raise ValueError("Invalid project preferences record")
                if row.get("category") == "quote-confirmation":
                    if row.get("mode") not in QUOTE_CONFIRMATION_MODES:
                        raise ValueError("Invalid project quote-confirmation setting")
                    mode = row["mode"]
                    project_record = row
    except (OSError, ValueError, TypeError) as exc:
        issues.append(str(exc))
    state = _resolve_quote_confirmation_state(
        project=project_path.name if project_path is not None else "",
        global_record=global_record,
        mode=mode,
        has_prior_generation=has_prior_generation,
        project_record=project_record,
    )
    if issues:
        state.update(
            effective_mode=QUOTE_CONFIRMATION_REQUIRE, requires_confirmation=True,
            first_generation_requires_confirmation=not has_prior_generation,
        )
    if project_path is None and not state["global_explicit"]:
        state["scope"] = "default"
    return {
        **state,
        "project_path": str(project_path) if project_path is not None else None,
        "issues": issues,
    }


def preferences_snapshot(project: str = "") -> dict[str, Any]:
    payload = load_preferences()
    legacy = payload.get("quote_confirmation")
    global_explicit = isinstance(legacy, dict) and legacy.get("mode") in QUOTE_CONFIRMATION_MODES
    if not isinstance(legacy, dict):
        legacy = {
            "mode": quote_confirmation_mode(),
            "source": "default",
        }
    global_mode = quote_confirmation_mode()
    snapshot: dict[str, Any] = {
        "path": str(preferences_path()),
        "membership_routing": (
            payload.get("membership_routing")
            if isinstance(payload.get("membership_routing"), dict)
            else {"mode": MEMBERSHIP_ROUTING_AUTO, "source": "default"}
        ),
        "quote_confirmation_scope": "global" if global_explicit else "default",
        "global_quote_confirmation": legacy,
        "global_note": (
            "Generation proceeds automatically after preflight by default, including the first batch. "
            "A user can enable per-batch confirmation for a project or globally at any time."
            if global_mode == QUOTE_CONFIRMATION_SKIP
            else (
                "Per-batch confirmation is enabled. A newer project choice applies within that project; a later global choice supersedes earlier project choices."
                if global_explicit
                else "Unreadable settings require confirmation until repaired."
            )
        ),
    }
    if project:
        snapshot["project_quote_confirmation"] = project_quote_confirmation_state(project)
        snapshot["project_preferences_path"] = str(project_dir(project) / "preferences.jsonl")
    return snapshot


def reset_plugin_memory(*, root: Path | None = None) -> dict[str, Any]:
    """Clear durable creative memory while preserving auth, media, and audit history.

    Queue manifests and generated files are evidence of already-spent work, so
    they are deliberately retained. The reset removes only learned notebook,
    decision, and project-preference records, then restores automatic generation.
    """
    workspace = repo_root(root)
    projects_root = workspace / "projects"
    memory_names = ("notebook.jsonl", "preferences.jsonl", "decisions.jsonl")
    cleared: list[dict[str, Any]] = []
    projects_scanned = 0
    if projects_root.exists():
        for project in sorted(path for path in projects_root.iterdir() if path.is_dir()):
            projects_scanned += 1
            for name in memory_names:
                path = project / name
                if not path.exists():
                    continue
                record_count = len(read_jsonl(path))
                path.write_text("", encoding="utf-8")
                cleared.append(
                    {
                        "project": project.name,
                        "path": str(path.resolve()),
                        "records_cleared": record_count,
                    }
                )

    global_payload = {
        "quote_confirmation": {
            "mode": QUOTE_CONFIRMATION_SKIP,
            "source": "user-reset",
            "updated_at": utc_now(),
            "revision": uuid.uuid4().hex,
        }
    }
    global_path = save_preferences(global_payload)
    return {
        "reset": True,
        "workspace": str(workspace),
        "projects_scanned": projects_scanned,
        "memory_files_cleared": len(cleared),
        "memory_records_cleared": sum(int(item["records_cleared"]) for item in cleared),
        "cleared": cleared,
        "global_preferences_path": str(global_path),
        "quote_confirmation": global_payload["quote_confirmation"],
        "preserved": [
            "PixVerse login and account state",
            "setup readiness cache",
            "project manifests and billing ledgers",
            "generated assets and deliverables",
            "editable project documents and queue specs",
        ],
    }


def _project_quote_confirmation_preference_text(mode: str) -> str:
    if mode == QUOTE_CONFIRMATION_SKIP:
        return (
            "This project's generation batches may run "
            "after preflight without stopping for per-run confirmation."
        )
    return "Require explicit confirmation after every paid-work preflight for this project."
