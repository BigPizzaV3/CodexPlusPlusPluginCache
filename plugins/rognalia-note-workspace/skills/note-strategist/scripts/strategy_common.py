#!/usr/bin/env python3
"""Shared storage, rendering, and validation for note Workspace strategy data."""

from __future__ import annotations

import base64
import hashlib
import importlib.util
import json
import os
import re
import sys
import tempfile
from contextlib import ExitStack, contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional, Tuple


SCHEMA_VERSION = 1
PRODUCT_ID = "note-workspace"

ID_PATTERN = re.compile(r"[a-z0-9][a-z0-9._:-]{7,127}")
CARD_ID_PATTERN = re.compile(r"src-[a-z0-9]{8,32}")
CANDIDATE_ID_PATTERN = re.compile(r"idea-[a-z0-9][a-z0-9-]{2,63}")
WEEK_PATTERN = re.compile(r"([0-9]{4})-W([0-9]{2})")
EVENT_ID_PATTERN = re.compile(r"strategy-[0-9]{4}-[0-9a-f]{12}")
SHA256_PATTERN = re.compile(r"[0-9a-f]{64}")
RUN_ID_PATTERN = re.compile(r"run-[a-z0-9][a-z0-9._:-]{6,127}")
PLAN_MARKER_PATTERN = re.compile(
    r"^<!-- note-workspace-weekly-plan-revision: ([A-Za-z0-9_-]+) -->$",
    re.MULTILINE,
)

ARTICLE_ROLES = {
    "record",
    "relationship",
    "expertise",
    "work",
    "revenue",
    "other",
}
ROLE_LABELS = {
    "record": "記録",
    "relationship": "交流",
    "expertise": "専門性",
    "work": "仕事",
    "revenue": "収益",
    "other": "その他",
}
MATERIAL_STATUSES = {"ready", "needs_more_source"}
MATERIAL_LABELS = {
    "ready": "記事制作へ進める",
    "needs_more_source": "本人の材料をもう少し集める",
}
RECORD_TYPES = {"strategy_recommendation", "user_selection"}
DECISIONS = {"recommend", "adopt", "revise", "replace", "pause"}
DECISION_LABELS = {
    "recommend": "戦略担当の推奨",
    "adopt": "採用",
    "revise": "修正",
    "replace": "差し替え",
    "pause": "今週は休む",
}
CADENCE_STATUSES = {"active", "paused"}
CADENCE_LABELS = {"active": "継続中", "paused": "休止中"}
CADENCE_VALUES = {value: key for key, value in CADENCE_LABELS.items()}

WEEKLY_INPUT_KEYS = {
    "schema_version",
    "request_id",
    "week",
    "record_type",
    "decision",
    "desired_article_count",
    "change_summary",
    "confirmed_by_user",
    "candidates",
}
CANDIDATE_KEYS = {
    "candidate_id",
    "direction",
    "audience",
    "reader_value",
    "article_role",
    "source_card_ids",
    "material_status",
    "missing_information",
    "research_questions",
    "why_now",
    "estimated_effort",
}
WEEKLY_METADATA_KEYS = {
    "schema_version",
    "week",
    "revision",
    "request_id",
    "recorded_at",
    "status",
    "payload_sha256",
    "body_sha256",
    "plan",
}
WEEKLY_PLAN_KEYS = {
    "record_type",
    "decision",
    "desired_article_count",
    "change_summary",
    "confirmed_by_user",
    "candidates",
    "source_card_snapshots",
    "tracking_review",
}
TRACKING_REVIEW_KEYS = {
    "status",
    "checked_at",
    "history_path",
    "history_byte_length",
    "history_prefix_sha256",
    "history_event_count",
    "latest_request_id",
    "latest_run_id",
    "latest_observed_at",
    "latest_recorded_at",
    "latest_metric_statuses",
}
METRIC_NAMES_BY_SCHEMA_VERSION = {
    1: ("views", "likes", "comments"),
    2: ("impressions", "page_views", "likes", "comments", "sales"),
}
METRIC_STATUSES = {
    "available",
    "unavailable",
    "not_visible",
    "fetch_failed",
    "not_applicable",
    "not_collected",
}
SNAPSHOT_KEYS = {
    "source_card_id",
    "revision",
    "summary",
    "public_scope",
    "statement_type",
    "kind",
    "status",
}
STRATEGY_INPUT_KEYS = {
    "schema_version",
    "request_id",
    "reason",
    "approved_by_user",
    "changes",
}
STRATEGY_CHANGE_KEYS = {
    "goal",
    "desired_frequency",
    "minimum_frequency",
    "cadence_status",
}
STRATEGY_EVENT_KEYS = {
    "schema_version",
    "event_id",
    "request_id",
    "revision",
    "changed_at",
    "input",
    "before",
    "after",
    "payload_sha256",
}
STRATEGY_STATE_KEYS = {
    "goal",
    "desired_frequency",
    "minimum_frequency",
    "cadence_status",
}


class StrategyDataError(ValueError):
    """Raised when strategy data cannot be read or changed safely."""


def _fsync_directory(path: Path) -> None:
    """Persist directory metadata where Python supports opening directories."""
    if os.name == "nt":
        return
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def canonical_hash(value: Any) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def text_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def parse_timestamp(value: Optional[str]) -> Tuple[str, datetime]:
    if value is None:
        moment = datetime.now().astimezone().replace(microsecond=0)
    else:
        if not isinstance(value, str):
            raise StrategyDataError("timestamp must be ISO 8601 with a timezone")
        try:
            moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise StrategyDataError(
                "timestamp must be ISO 8601 with a timezone"
            ) from exc
        if moment.tzinfo is None:
            raise StrategyDataError("timestamp must include a timezone")
        moment = moment.replace(microsecond=0)
    normalized = moment.isoformat()
    if normalized.endswith("+00:00"):
        normalized = normalized[:-6] + "Z"
    return normalized, moment


def check_exact_keys(
    value: Dict[str, Any],
    *,
    label: str,
    allowed: Iterable[str],
    required: Iterable[str],
) -> None:
    allowed_set = set(allowed)
    required_set = set(required)
    unknown = sorted(set(value) - allowed_set)
    missing = sorted(required_set - set(value))
    if unknown:
        raise StrategyDataError(
            f"{label} has unknown fields: {', '.join(unknown)}"
        )
    if missing:
        raise StrategyDataError(
            f"{label} is missing fields: {', '.join(missing)}"
        )


def require_object(value: Any, label: str) -> Dict[str, Any]:
    if not isinstance(value, dict):
        raise StrategyDataError(f"{label} must be an object")
    return dict(value)


def require_id(
    value: Any,
    label: str,
    pattern: re.Pattern[str] = ID_PATTERN,
) -> str:
    if not isinstance(value, str) or not pattern.fullmatch(value):
        raise StrategyDataError(f"{label} has an invalid format")
    return value


def require_integer(
    value: Any,
    label: str,
    *,
    minimum: int,
    maximum: Optional[int] = None,
) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise StrategyDataError(f"{label} must be an integer")
    if value < minimum or (maximum is not None and value > maximum):
        if maximum is None:
            raise StrategyDataError(f"{label} must be at least {minimum}")
        raise StrategyDataError(
            f"{label} must be between {minimum} and {maximum}"
        )
    return value


def require_one_line(
    value: Any,
    label: str,
    *,
    maximum: int = 4000,
) -> str:
    if not isinstance(value, str):
        raise StrategyDataError(f"{label} must be a string")
    cleaned = value.strip()
    if not cleaned:
        raise StrategyDataError(f"{label} must not be empty")
    if "\n" in cleaned or "\r" in cleaned:
        raise StrategyDataError(f"{label} must be one line")
    if len(cleaned) > maximum:
        raise StrategyDataError(f"{label} is too long")
    return cleaned


def require_text_list(
    value: Any,
    label: str,
    *,
    maximum_items: int = 20,
    id_pattern: Optional[re.Pattern[str]] = None,
) -> List[str]:
    if not isinstance(value, list):
        raise StrategyDataError(f"{label} must be an array")
    if len(value) > maximum_items:
        raise StrategyDataError(
            f"{label} must contain at most {maximum_items} items"
        )
    output: List[str] = []
    for index, item in enumerate(value):
        if id_pattern is None:
            cleaned = require_one_line(
                item,
                f"{label}[{index}]",
                maximum=2000,
            )
        else:
            cleaned = require_id(
                item,
                f"{label}[{index}]",
                id_pattern,
            )
        if cleaned in output:
            raise StrategyDataError(f"{label} must not contain duplicates")
        output.append(cleaned)
    return output


def require_week(value: Any, label: str = "week") -> str:
    if not isinstance(value, str):
        raise StrategyDataError(f"{label} must be a string")
    match = WEEK_PATTERN.fullmatch(value)
    if not match:
        raise StrategyDataError(f"{label} must use YYYY-Www")
    year = int(match.group(1))
    week = int(match.group(2))
    try:
        date.fromisocalendar(year, week, 1)
    except ValueError as exc:
        raise StrategyDataError(f"{label} is not a valid ISO week") from exc
    return value


def load_json(path: str) -> Dict[str, Any]:
    if path == "-":
        value = json.load(sys.stdin)
    else:
        with Path(path).open("r", encoding="utf-8") as handle:
            value = json.load(handle)
    return require_object(value, "config")


def _load_json_file(path: Path, label: str) -> Dict[str, Any]:
    if not path.is_file() or path.is_symlink():
        raise StrategyDataError(f"{label} is missing or unsafe")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise StrategyDataError(f"{label} is invalid JSON") from exc
    return require_object(value, label)


def _require_regular_file(path: Path, label: str) -> None:
    if not path.is_file() or path.is_symlink():
        raise StrategyDataError(f"{label} is missing or unsafe")


def _require_directory(path: Path, label: str) -> None:
    if not path.is_dir() or path.is_symlink():
        raise StrategyDataError(f"{label} is missing or unsafe")


def resolve_workspace(raw: str) -> Path:
    provided = Path(raw).expanduser()
    if provided.is_symlink():
        raise StrategyDataError("workspace root must not be a symlink")
    workspace = provided.resolve()
    if not workspace.is_dir():
        raise StrategyDataError("workspace does not exist or is not a directory")

    manifest_path = workspace / "workspace.json"
    settings_path = workspace / "strategy/operating-settings.json"
    manifest = _load_json_file(manifest_path, "workspace.json")
    settings = _load_json_file(
        settings_path,
        "strategy/operating-settings.json",
    )
    if manifest.get("schema_version") != SCHEMA_VERSION:
        raise StrategyDataError("workspace schema_version is not supported")
    if manifest.get("product_id") != PRODUCT_ID:
        raise StrategyDataError("workspace product_id mismatch")
    if manifest.get("data_owner") != "user":
        raise StrategyDataError("workspace data_owner must be user")
    if manifest.get("status") != "ready":
        raise StrategyDataError(
            "workspace is not ready; migration or hold must be resolved first"
        )
    if settings.get("schema_version") != SCHEMA_VERSION:
        raise StrategyDataError("operating settings schema_version is not supported")
    if settings.get("workspace_id") != manifest.get("workspace_id"):
        raise StrategyDataError("workspace ID mismatch")

    for relative in (
        "profile/creator-profile.md",
        "strategy/strategy.md",
        "strategy/change-history.jsonl",
        "source-cards/cards.jsonl",
        "articles/registry.jsonl",
        "metrics/history.jsonl",
    ):
        _require_regular_file(workspace / relative, relative)
    for relative in ("strategy", "source-cards", "plans/weekly"):
        _require_directory(workspace / relative, relative)
    return workspace


@contextmanager
def exclusive_lock(path: Path, created_at: str) -> Iterator[None]:
    payload = json.dumps(
        {"created_at": created_at, "pid": os.getpid()},
        ensure_ascii=False,
    ).encode("utf-8")
    try:
        descriptor = os.open(
            path,
            os.O_CREAT | os.O_EXCL | os.O_WRONLY,
            0o600,
        )
    except FileExistsError as exc:
        raise StrategyDataError(
            f"another write may be active; inspect the lock before retrying: {path}"
        ) from exc
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        yield
    finally:
        try:
            path.unlink()
        except FileNotFoundError:
            pass


@contextmanager
def exclusive_locks(
    paths: Iterable[Path],
    created_at: str,
) -> Iterator[None]:
    with ExitStack() as stack:
        for path in paths:
            stack.enter_context(exclusive_lock(path, created_at))
        yield


def _atomic_write_bytes(path: Path, content: bytes, mode: int) -> None:
    descriptor, temporary = tempfile.mkstemp(
        prefix=f".{path.name}.",
        dir=str(path.parent),
    )
    temporary_path = Path(temporary)
    try:
        os.fchmod(descriptor, mode)
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
        _fsync_directory(path.parent)
    finally:
        try:
            temporary_path.unlink()
        except FileNotFoundError:
            pass


def atomic_write_text(path: Path, content: str) -> None:
    if path.is_symlink():
        raise StrategyDataError(f"write target is unsafe: {path}")
    if path.exists():
        if not path.is_file():
            raise StrategyDataError(f"write target is unsafe: {path}")
        mode = path.stat().st_mode & 0o777
    else:
        if not path.parent.is_dir() or path.parent.is_symlink():
            raise StrategyDataError(f"write directory is unsafe: {path.parent}")
        mode = 0o600
    _atomic_write_bytes(path, content.encode("utf-8"), mode)


def atomic_replace_many(contents: Dict[Path, str]) -> None:
    originals: Dict[Path, bytes] = {}
    modes: Dict[Path, int] = {}
    temporary_paths: Dict[Path, Path] = {}
    replaced: List[Path] = []

    for path in contents:
        if not path.is_file() or path.is_symlink():
            raise StrategyDataError(f"write target is missing or unsafe: {path}")
        originals[path] = path.read_bytes()
        modes[path] = path.stat().st_mode & 0o777

    try:
        for path, content in contents.items():
            descriptor, temporary = tempfile.mkstemp(
                prefix=f".{path.name}.",
                dir=str(path.parent),
            )
            temporary_path = Path(temporary)
            temporary_paths[path] = temporary_path
            os.fchmod(descriptor, modes[path])
            with os.fdopen(descriptor, "wb") as handle:
                handle.write(content.encode("utf-8"))
                handle.flush()
                os.fsync(handle.fileno())
        for path in contents:
            os.replace(temporary_paths[path], path)
            replaced.append(path)
        for parent in sorted({path.parent for path in contents}, key=str):
            _fsync_directory(parent)
    except OSError as exc:
        rollback_errors: List[str] = []
        for path in reversed(replaced):
            try:
                _atomic_write_bytes(path, originals[path], modes[path])
            except OSError as rollback_exc:
                rollback_errors.append(f"{path}: {rollback_exc}")
        detail = (
            f"; rollback also failed for {', '.join(rollback_errors)}"
            if rollback_errors
            else ""
        )
        raise StrategyDataError(f"strategy update failed: {exc}{detail}") from exc
    finally:
        for temporary_path in temporary_paths.values():
            try:
                temporary_path.unlink()
            except FileNotFoundError:
                pass


def iter_jsonl(path: Path) -> Iterator[Tuple[int, Dict[str, Any]]]:
    _require_regular_file(path, str(path))
    with path.open("r", encoding="utf-8") as handle:
        for number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise StrategyDataError(
                    f"{path}:{number} is invalid JSON"
                ) from exc
            if not isinstance(value, dict):
                raise StrategyDataError(
                    f"{path}:{number} must contain an object"
                )
            yield number, value


def normalize_weekly_config(raw: Any) -> Dict[str, Any]:
    config = require_object(raw, "config")
    check_exact_keys(
        config,
        label="config",
        allowed=WEEKLY_INPUT_KEYS,
        required=WEEKLY_INPUT_KEYS,
    )
    if config.get("schema_version") != SCHEMA_VERSION:
        raise StrategyDataError(
            f"schema_version must be {SCHEMA_VERSION}"
        )
    request_id = require_id(config.get("request_id"), "request_id")
    week = require_week(config.get("week"))
    record_type = config.get("record_type")
    if record_type not in RECORD_TYPES:
        raise StrategyDataError("record_type is invalid")
    decision = config.get("decision")
    if decision not in DECISIONS:
        raise StrategyDataError("decision is invalid")
    desired_count = require_integer(
        config.get("desired_article_count"),
        "desired_article_count",
        minimum=0,
        maximum=7,
    )
    change_summary = require_one_line(
        config.get("change_summary"),
        "change_summary",
        maximum=2000,
    )
    confirmed = config.get("confirmed_by_user")
    if not isinstance(confirmed, bool):
        raise StrategyDataError("confirmed_by_user must be true or false")
    if record_type == "strategy_recommendation":
        if decision != "recommend" or confirmed is not False:
            raise StrategyDataError(
                "strategy_recommendation requires decision recommend and confirmed_by_user false"
            )
    elif decision == "recommend" or confirmed is not True:
        raise StrategyDataError(
            "user_selection requires an explicit user decision and confirmed_by_user true"
        )
    raw_candidates = config.get("candidates")
    if not isinstance(raw_candidates, list):
        raise StrategyDataError("candidates must be an array")
    if len(raw_candidates) > 7:
        raise StrategyDataError(
            "candidates must contain at most 7 items"
        )

    candidates: List[Dict[str, Any]] = []
    candidate_ids: set[str] = set()
    for index, raw_candidate in enumerate(raw_candidates):
        label = f"candidates[{index}]"
        candidate = require_object(raw_candidate, label)
        check_exact_keys(
            candidate,
            label=label,
            allowed=CANDIDATE_KEYS,
            required=CANDIDATE_KEYS,
        )
        candidate_id = require_id(
            candidate.get("candidate_id"),
            f"{label}.candidate_id",
            CANDIDATE_ID_PATTERN,
        )
        if candidate_id in candidate_ids:
            raise StrategyDataError(
                "candidates must not repeat candidate_id"
            )
        candidate_ids.add(candidate_id)
        role = candidate.get("article_role")
        if role not in ARTICLE_ROLES:
            raise StrategyDataError(f"{label}.article_role is invalid")
        material_status = candidate.get("material_status")
        if material_status not in MATERIAL_STATUSES:
            raise StrategyDataError(
                f"{label}.material_status is invalid"
            )
        source_card_ids = require_text_list(
            candidate.get("source_card_ids"),
            f"{label}.source_card_ids",
            id_pattern=CARD_ID_PATTERN,
        )
        missing_information = require_text_list(
            candidate.get("missing_information"),
            f"{label}.missing_information",
        )
        research_questions = require_text_list(
            candidate.get("research_questions"),
            f"{label}.research_questions",
        )
        if material_status == "ready" and not source_card_ids:
            raise StrategyDataError(
                f"{label}: ready requires at least one source card"
            )
        if material_status == "needs_more_source" and not missing_information:
            raise StrategyDataError(
                f"{label}: needs_more_source requires missing_information"
            )
        candidates.append(
            {
                "candidate_id": candidate_id,
                "direction": require_one_line(
                    candidate.get("direction"),
                    f"{label}.direction",
                    maximum=2000,
                ),
                "audience": require_one_line(
                    candidate.get("audience"),
                    f"{label}.audience",
                    maximum=2000,
                ),
                "reader_value": require_one_line(
                    candidate.get("reader_value"),
                    f"{label}.reader_value",
                    maximum=2000,
                ),
                "article_role": role,
                "source_card_ids": source_card_ids,
                "material_status": material_status,
                "missing_information": missing_information,
                "research_questions": research_questions,
                "why_now": require_one_line(
                    candidate.get("why_now"),
                    f"{label}.why_now",
                    maximum=2000,
                ),
                "estimated_effort": require_one_line(
                    candidate.get("estimated_effort"),
                    f"{label}.estimated_effort",
                    maximum=2000,
                ),
            }
        )

    if decision == "pause":
        if desired_count != 0 or candidates:
            raise StrategyDataError(
                "pause requires desired_article_count 0 and no candidates"
            )
    else:
        if desired_count < 1:
            raise StrategyDataError(
                "an active weekly plan requires desired_article_count of at least 1"
            )
        if not candidates:
            raise StrategyDataError(
                "an active weekly record requires at least one candidate"
            )
        if len(candidates) > desired_count:
            raise StrategyDataError(
                "candidates must not exceed desired_article_count"
            )

    return {
        "schema_version": SCHEMA_VERSION,
        "request_id": request_id,
        "week": week,
        "record_type": record_type,
        "decision": decision,
        "desired_article_count": desired_count,
        "change_summary": change_summary,
        "confirmed_by_user": confirmed,
        "candidates": candidates,
    }


def weekly_payload_hash(config: Dict[str, Any]) -> str:
    return canonical_hash(config)


def load_source_card_events(
    workspace: Path,
) -> Tuple[
    List[Dict[str, Any]],
    Dict[str, Dict[str, Any]],
    Dict[Tuple[str, int], Dict[str, Any]],
]:
    events: List[Dict[str, Any]] = []
    current: Dict[str, Dict[str, Any]] = {}
    by_revision: Dict[Tuple[str, int], Dict[str, Any]] = {}
    for number, event in iter_jsonl(workspace / "source-cards/cards.jsonl"):
        card_id = event.get("source_card_id")
        revision = event.get("revision")
        if not isinstance(card_id, str) or not CARD_ID_PATTERN.fullmatch(card_id):
            raise StrategyDataError(
                f"source-cards/cards.jsonl:{number} has invalid source_card_id"
            )
        if (
            isinstance(revision, bool)
            or not isinstance(revision, int)
            or revision < 1
        ):
            raise StrategyDataError(
                f"source-cards/cards.jsonl:{number} has invalid revision"
            )
        for field in ("summary", "public_scope", "statement_type", "kind", "status"):
            if not isinstance(event.get(field), str) or not event[field].strip():
                raise StrategyDataError(
                    f"source-cards/cards.jsonl:{number} has invalid {field}"
                )
        key = (card_id, revision)
        if key in by_revision:
            raise StrategyDataError(
                f"source-cards/cards.jsonl has duplicate {card_id} revision {revision}"
            )
        events.append(event)
        by_revision[key] = event
        previous = current.get(card_id)
        if previous is None or revision > previous["revision"]:
            current[card_id] = event
    return events, current, by_revision


def source_card_snapshot(event: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "source_card_id": event["source_card_id"],
        "revision": event["revision"],
        "summary": event["summary"],
        "public_scope": event["public_scope"],
        "statement_type": event["statement_type"],
        "kind": event["kind"],
        "status": event["status"],
    }


def build_source_snapshots(
    config: Dict[str, Any],
    current_cards: Dict[str, Dict[str, Any]],
) -> List[Dict[str, Any]]:
    snapshots: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for candidate in config["candidates"]:
        for card_id in candidate["source_card_ids"]:
            if card_id in seen:
                continue
            card = current_cards.get(card_id)
            if card is None:
                raise StrategyDataError(
                    f"source card does not exist: {card_id}"
                )
            if card.get("status") != "active":
                raise StrategyDataError(
                    f"source card is not active: {card_id}"
                )
            snapshots.append(source_card_snapshot(card))
            seen.add(card_id)
    return snapshots


def weekly_plan_object(
    config: Dict[str, Any],
    snapshots: List[Dict[str, Any]],
    tracking_review: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "record_type": config["record_type"],
        "decision": config["decision"],
        "desired_article_count": config["desired_article_count"],
        "change_summary": config["change_summary"],
        "confirmed_by_user": config["confirmed_by_user"],
        "candidates": config["candidates"],
        "source_card_snapshots": snapshots,
        "tracking_review": tracking_review,
    }


def _tracking_review_from_bytes(
    workspace: Path,
    raw: bytes,
    checked_at: str,
) -> Dict[str, Any]:
    checked_normalized, checked_moment = parse_timestamp(checked_at)
    if checked_at != checked_normalized:
        raise StrategyDataError("tracking checked_at is not normalized")
    if raw and not raw.endswith(b"\n"):
        raise StrategyDataError("metrics history prefix must end at a line boundary")

    manifest = _load_json_file(workspace / "workspace.json", "workspace.json")
    workspace_id = manifest.get("workspace_id")
    events: List[Dict[str, Any]] = []
    for line_number, raw_line in enumerate(raw.splitlines(), start=1):
        if not raw_line.strip():
            continue
        try:
            value = json.loads(raw_line.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise StrategyDataError(
                f"metrics history prefix line {line_number} is invalid JSON"
            ) from exc
        event = require_object(value, f"metrics history prefix line {line_number}")
        metrics_schema_version = event.get("schema_version")
        metric_names = METRIC_NAMES_BY_SCHEMA_VERSION.get(metrics_schema_version)
        if metric_names is None:
            raise StrategyDataError("metrics history prefix has unsupported schema_version")
        if event.get("event_type") != "metrics_observed":
            raise StrategyDataError("metrics history prefix has unsupported event_type")
        if event.get("workspace_id") != workspace_id:
            raise StrategyDataError("metrics history prefix workspace_id does not match")
        require_id(event.get("request_id"), "metrics request_id")
        require_id(event.get("run_id"), "metrics run_id", RUN_ID_PATTERN)
        observed_at, _ = parse_timestamp(event.get("observed_at"))
        recorded_at, recorded_moment = parse_timestamp(event.get("recorded_at"))
        if event.get("observed_at") != observed_at:
            raise StrategyDataError("metrics observed_at is not normalized")
        if event.get("recorded_at") != recorded_at:
            raise StrategyDataError("metrics recorded_at is not normalized")
        if recorded_moment > checked_moment:
            raise StrategyDataError(
                "tracking review cannot include metrics recorded after checked_at"
            )
        metrics = event.get("metrics")
        if not isinstance(metrics, list) or len(metrics) != len(metric_names):
            raise StrategyDataError(
                "metrics history prefix has the wrong number of metrics"
            )
        statuses: Dict[str, str] = {}
        for metric in metrics:
            item = require_object(metric, "metrics history metric")
            name = item.get("metric")
            status = item.get("status")
            if name not in metric_names or name in statuses:
                raise StrategyDataError("metrics history prefix has invalid metric names")
            if status not in METRIC_STATUSES:
                raise StrategyDataError("metrics history prefix has invalid metric status")
            statuses[name] = status
        if set(statuses) != set(metric_names):
            raise StrategyDataError("metrics history prefix is missing a metric")
        normalized_event = dict(event)
        normalized_event["_metric_statuses"] = statuses
        normalized_event["_recorded_moment"] = recorded_moment
        events.append(normalized_event)

    latest: Optional[Dict[str, Any]] = None
    if events:
        latest = max(
            enumerate(events),
            key=lambda item: (item[1]["_recorded_moment"], item[0]),
        )[1]
    empty_statuses: Dict[str, Optional[str]] = {
        name: None for name in METRIC_NAMES_BY_SCHEMA_VERSION[1]
    }
    if latest is None:
        status = "not_yet_recorded"
        metric_statuses: Dict[str, Optional[str]] = empty_statuses
    else:
        metric_statuses = latest["_metric_statuses"]
        available_count = sum(
            value == "available" for value in metric_statuses.values()
        )
        status = (
            "available"
            if available_count == len(metric_statuses)
            else "partial"
            if available_count
            else "unavailable"
        )
    return {
        "status": status,
        "checked_at": checked_at,
        "history_path": "metrics/history.jsonl",
        "history_byte_length": len(raw),
        "history_prefix_sha256": hashlib.sha256(raw).hexdigest(),
        "history_event_count": len(events),
        "latest_request_id": None if latest is None else latest["request_id"],
        "latest_run_id": None if latest is None else latest["run_id"],
        "latest_observed_at": None if latest is None else latest["observed_at"],
        "latest_recorded_at": None if latest is None else latest["recorded_at"],
        "latest_metric_statuses": metric_statuses,
    }


def validate_tracker_history_contract(workspace: Path) -> None:
    tracker_common_path = (
        Path(__file__).resolve().parents[2]
        / "note-tracker/scripts/tracker_common.py"
    )
    if not tracker_common_path.is_file() or tracker_common_path.is_symlink():
        raise StrategyDataError(
            "note-tracker canonical history validator is missing or unsafe"
        )
    specification = importlib.util.spec_from_file_location(
        "note_workspace_tracker_contract",
        tracker_common_path,
    )
    if specification is None or specification.loader is None:
        raise StrategyDataError("note-tracker canonical history validator cannot load")
    module = importlib.util.module_from_spec(specification)
    specification.loader.exec_module(module)
    manifest = _load_json_file(workspace / "workspace.json", "workspace.json")
    errors = module.validate_metrics_history(workspace, manifest.get("workspace_id"))
    if errors:
        raise StrategyDataError(
            "metrics history failed the note-tracker canonical validator: "
            + "; ".join(errors)
        )


def build_tracking_review(workspace: Path, checked_at: str) -> Dict[str, Any]:
    path = workspace / "metrics/history.jsonl"
    _require_regular_file(path, "metrics/history.jsonl")
    validate_tracker_history_contract(workspace)
    return _tracking_review_from_bytes(workspace, path.read_bytes(), checked_at)


def validate_tracking_review(
    workspace: Path, raw_review: Any
) -> Dict[str, Any]:
    review = require_object(raw_review, "tracking_review")
    check_exact_keys(
        review,
        label="tracking_review",
        allowed=TRACKING_REVIEW_KEYS,
        required=TRACKING_REVIEW_KEYS,
    )
    if review.get("history_path") != "metrics/history.jsonl":
        raise StrategyDataError("tracking_review history_path is invalid")
    validate_tracker_history_contract(workspace)
    byte_length = require_integer(
        review.get("history_byte_length"),
        "tracking_review.history_byte_length",
        minimum=0,
    )
    current = (workspace / "metrics/history.jsonl").read_bytes()
    if len(current) < byte_length:
        raise StrategyDataError("metrics history is shorter than the reviewed prefix")
    prefix = current[:byte_length]
    digest = review.get("history_prefix_sha256")
    if (
        not isinstance(digest, str)
        or not SHA256_PATTERN.fullmatch(digest)
        or hashlib.sha256(prefix).hexdigest() != digest
    ):
        raise StrategyDataError("tracking_review history prefix hash does not match")
    expected = _tracking_review_from_bytes(
        workspace,
        prefix,
        require_one_line(review.get("checked_at"), "tracking_review.checked_at", maximum=100),
    )
    if review != expected:
        raise StrategyDataError("tracking_review does not match the reviewed metrics prefix")
    return expected


def _escape_inline(value: str) -> str:
    cleaned = " ".join(value.split())
    cleaned = cleaned.replace("<", "&lt;").replace(">", "&gt;")
    if cleaned.startswith(("#", ">", "- ", "* ", "+ ")):
        cleaned = "\\" + cleaned
    return cleaned


def _render_list(values: List[str], empty: str) -> str:
    if not values:
        return f"  - {empty}\n"
    return "".join(f"  - {_escape_inline(value)}\n" for value in values)


def render_weekly_body(metadata: Dict[str, Any]) -> str:
    plan = metadata["plan"]
    tracking = plan["tracking_review"]
    metric_count = len(tracking["latest_metric_statuses"])
    tracking_labels = (
        {
            "available": "直近5項目を確認",
            "partial": "一部未取得を含めて確認",
            "unavailable": "直近は取得不能または未収集",
            "not_yet_recorded": "まだ記録なし",
        }
        if metric_count == 5
        else {
            "available": "直近3項目を確認",
            "partial": "一部取得不能を含めて確認",
            "unavailable": "直近は取得不能",
            "not_yet_recorded": "まだ記録なし",
        }
    )
    status_label = {
        "recommended": "推奨（未確定）",
        "confirmed": "利用者確定",
        "paused": "利用者が休止を確定",
    }[metadata["status"]]
    actor_label = (
        "戦略担当の記録"
        if plan["record_type"] == "strategy_recommendation"
        else "利用者の判断"
    )
    lines = [
        f"## 第{metadata['revision']}版 / {status_label}",
        "",
        f"- 記録日時: {metadata['recorded_at']}",
        f"- {actor_label}: {DECISION_LABELS[plan['decision']]}",
        f"- 今週の目安: {plan['desired_article_count']}本",
        f"- 変更理由: {_escape_inline(plan['change_summary'])}",
        (
            "- 指標確認: "
            + tracking_labels[tracking["status"]]
            + f" / {tracking['checked_at']}"
        ),
        "",
    ]
    snapshot_by_id = {
        item["source_card_id"]: item
        for item in plan["source_card_snapshots"]
    }
    if not plan["candidates"]:
        lines.extend(
            [
                "今週は記事候補を確定せず、休む判断を記録しました。",
                "",
            ]
        )
        return "\n".join(lines)

    if plan["record_type"] == "strategy_recommendation":
        lines.extend(
            [
                "これは戦略担当の推奨であり、利用者の確定判断ではありません。別のテーマを選んでも構いません。",
                "",
            ]
        )

    for candidate in plan["candidates"]:
        lines.extend(
            [
                (
                    f"### {candidate['candidate_id']} / "
                    f"{_escape_inline(candidate['direction'])}"
                ),
                "",
                f"- 想定読者: {_escape_inline(candidate['audience'])}",
                f"- 読者が得るもの: {_escape_inline(candidate['reader_value'])}",
                f"- 記事の役割: {ROLE_LABELS[candidate['article_role']]}",
                (
                    "- 材料状態: "
                    + MATERIAL_LABELS[candidate["material_status"]]
                ),
                f"- 今書く理由: {_escape_inline(candidate['why_now'])}",
                f"- 負担感: {_escape_inline(candidate['estimated_effort'])}",
                "- 中心にする一次情報:",
            ]
        )
        if candidate["source_card_ids"]:
            for card_id in candidate["source_card_ids"]:
                snapshot = snapshot_by_id[card_id]
                lines.append(
                    (
                        f"  - {card_id} / 第{snapshot['revision']}版 / "
                        f"{_escape_inline(snapshot['summary'])}"
                    )
                )
        else:
            lines.append("  - まだありません。")
        lines.append("- まだ足りない本人情報:")
        lines.extend(
            _render_list(
                candidate["missing_information"],
                "現時点では記録されていません。",
            ).rstrip("\n").splitlines()
        )
        lines.append("- 調べたい論点:")
        lines.extend(
            _render_list(
                candidate["research_questions"],
                "現時点ではありません。",
            ).rstrip("\n").splitlines()
        )
        lines.append("")
    return "\n".join(lines)


def _encode_metadata(metadata: Dict[str, Any]) -> str:
    encoded = json.dumps(
        metadata,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return base64.urlsafe_b64encode(encoded).decode("ascii").rstrip("=")


def _decode_metadata(token: str) -> Dict[str, Any]:
    padding = "=" * (-len(token) % 4)
    try:
        decoded = base64.urlsafe_b64decode(token + padding)
        value = json.loads(decoded.decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise StrategyDataError(
            "weekly plan revision metadata is invalid"
        ) from exc
    return require_object(value, "weekly plan revision metadata")


def render_weekly_segment(metadata: Dict[str, Any], body: str) -> str:
    marker = (
        "<!-- note-workspace-weekly-plan-revision: "
        + _encode_metadata(metadata)
        + " -->"
    )
    return marker + "\n\n" + body


def weekly_segment_sha256(metadata: Dict[str, Any], body: str) -> str:
    return text_hash(render_weekly_segment(metadata, body))


def render_weekly_file(
    week: str,
    segments: List[Tuple[Dict[str, Any], str]],
) -> str:
    header = f"# 週間計画: {week}\n\n"
    return header + "\n".join(
        render_weekly_segment(metadata, body)
        for metadata, body in segments
    )


def _config_from_metadata(metadata: Dict[str, Any]) -> Dict[str, Any]:
    plan = require_object(metadata.get("plan"), "weekly plan plan")
    check_exact_keys(
        plan,
        label="weekly plan plan",
        allowed=WEEKLY_PLAN_KEYS,
        required=WEEKLY_PLAN_KEYS,
    )
    return normalize_weekly_config(
        {
            "schema_version": metadata.get("schema_version"),
            "request_id": metadata.get("request_id"),
            "week": metadata.get("week"),
            "record_type": plan.get("record_type"),
            "decision": plan.get("decision"),
            "desired_article_count": plan.get("desired_article_count"),
            "change_summary": plan.get("change_summary"),
            "confirmed_by_user": plan.get("confirmed_by_user"),
            "candidates": plan.get("candidates"),
        }
    )


def _validate_snapshots(
    config: Dict[str, Any],
    raw_snapshots: Any,
    source_by_revision: Dict[Tuple[str, int], Dict[str, Any]],
) -> List[Dict[str, Any]]:
    if not isinstance(raw_snapshots, list):
        raise StrategyDataError("source_card_snapshots must be an array")
    snapshots: List[Dict[str, Any]] = []
    snapshot_by_id: Dict[str, Dict[str, Any]] = {}
    seen: set[str] = set()
    for index, raw_snapshot in enumerate(raw_snapshots):
        label = f"source_card_snapshots[{index}]"
        snapshot = require_object(raw_snapshot, label)
        check_exact_keys(
            snapshot,
            label=label,
            allowed=SNAPSHOT_KEYS,
            required=SNAPSHOT_KEYS,
        )
        card_id = require_id(
            snapshot.get("source_card_id"),
            f"{label}.source_card_id",
            CARD_ID_PATTERN,
        )
        revision = require_integer(
            snapshot.get("revision"),
            f"{label}.revision",
            minimum=1,
        )
        if card_id in seen:
            raise StrategyDataError(
                "source_card_snapshots must not contain duplicate cards"
            )
        seen.add(card_id)
        expected_event = source_by_revision.get((card_id, revision))
        if expected_event is None:
            raise StrategyDataError(
                f"weekly plan refers to missing source card revision: "
                f"{card_id} revision {revision}"
            )
        normalized = source_card_snapshot(expected_event)
        if snapshot != normalized:
            raise StrategyDataError(
                f"source card snapshot does not match stored revision: {card_id}"
            )
        if snapshot["status"] != "active":
            raise StrategyDataError(
                f"weekly plan captured a non-active source card: {card_id}"
            )
        snapshots.append(normalized)
        snapshot_by_id[card_id] = normalized

    referenced_in_order: List[str] = []
    for candidate in config["candidates"]:
        for card_id in candidate["source_card_ids"]:
            if card_id not in referenced_in_order:
                referenced_in_order.append(card_id)
    referenced = set(referenced_in_order)
    if seen != referenced:
        raise StrategyDataError(
            "source card snapshots do not exactly match plan references"
        )
    deterministic = [
        snapshot_by_id[card_id]
        for card_id in referenced_in_order
    ]
    if snapshots != deterministic:
        raise StrategyDataError(
            "source card snapshots are not in reference order"
        )
    return deterministic


def parse_weekly_file(
    path: Path,
    source_by_revision: Dict[Tuple[str, int], Dict[str, Any]],
) -> List[Tuple[Dict[str, Any], str]]:
    _require_regular_file(path, str(path))
    week = require_week(path.stem, "weekly plan filename")
    text = path.read_text(encoding="utf-8")
    matches = list(PLAN_MARKER_PATTERN.finditer(text))
    expected_header = f"# 週間計画: {week}\n\n"
    if not matches:
        raise StrategyDataError(f"{path}: no weekly plan revisions")
    if text[: matches[0].start()] != expected_header:
        raise StrategyDataError(f"{path}: weekly plan header is invalid")

    segments: List[Tuple[Dict[str, Any], str]] = []
    request_ids: set[str] = set()
    previous_moment: Optional[datetime] = None
    previous_status: Optional[str] = None
    for index, match in enumerate(matches):
        if text[match.end() : match.end() + 2] != "\n\n":
            raise StrategyDataError(
                f"{path}: revision marker must be followed by a blank line"
            )
        body_start = match.end() + 2
        if index + 1 < len(matches):
            next_start = matches[index + 1].start()
            if next_start < 1 or text[next_start - 1] != "\n":
                raise StrategyDataError(
                    f"{path}: revisions must be separated by a blank line"
                )
            body_end = next_start - 1
        else:
            body_end = len(text)
        body = text[body_start:body_end]
        if not body.endswith("\n"):
            raise StrategyDataError(
                f"{path}: revision body must end with a newline"
            )
        metadata = _decode_metadata(match.group(1))
        check_exact_keys(
            metadata,
            label="weekly plan revision metadata",
            allowed=WEEKLY_METADATA_KEYS,
            required=WEEKLY_METADATA_KEYS,
        )
        if metadata.get("schema_version") != SCHEMA_VERSION:
            raise StrategyDataError(f"{path}: unsupported schema_version")
        if metadata.get("week") != week:
            raise StrategyDataError(
                f"{path}: metadata week does not match filename"
            )
        revision = require_integer(
            metadata.get("revision"),
            "weekly plan revision",
            minimum=1,
        )
        if revision != index + 1:
            raise StrategyDataError(
                f"{path}: revisions must be sequential from 1"
            )
        request_id = require_id(
            metadata.get("request_id"),
            "weekly plan request_id",
        )
        if request_id in request_ids:
            raise StrategyDataError(
                f"{path}: duplicate request_id {request_id}"
            )
        request_ids.add(request_id)
        recorded_at, recorded_moment = parse_timestamp(
            metadata.get("recorded_at")
        )
        if metadata.get("recorded_at") != recorded_at:
            raise StrategyDataError(
                f"{path}: recorded_at is not normalized"
            )
        if previous_moment is not None and recorded_moment < previous_moment:
            raise StrategyDataError(
                f"{path}: recorded_at must not go backwards"
            )
        previous_moment = recorded_moment

        config = _config_from_metadata(metadata)
        if config["record_type"] == "strategy_recommendation":
            expected_status = "recommended"
        else:
            expected_status = (
                "paused" if config["decision"] == "pause" else "confirmed"
            )
        if metadata.get("status") != expected_status:
            raise StrategyDataError(
                f"{path}: status does not match decision"
            )
        if index == 0:
            first_allowed = (
                config["record_type"] == "strategy_recommendation"
                or config["decision"] in {"adopt", "pause"}
            )
            if not first_allowed:
                raise StrategyDataError(
                    f"{path}: first revision must recommend, adopt, or pause"
                )
        else:
            if (
                config["record_type"] == "strategy_recommendation"
                and previous_status in {"confirmed", "paused"}
            ):
                raise StrategyDataError(
                    f"{path}: recommendation cannot follow a user-confirmed decision"
                )
            if (
                config["record_type"] == "user_selection"
                and config["decision"] == "adopt"
                and previous_status != "recommended"
            ):
                raise StrategyDataError(
                    f"{path}: adopt must confirm a recommendation"
                )
        previous_status = expected_status
        payload_sha256 = metadata.get("payload_sha256")
        if (
            not isinstance(payload_sha256, str)
            or not SHA256_PATTERN.fullmatch(payload_sha256)
            or payload_sha256 != weekly_payload_hash(config)
        ):
            raise StrategyDataError(
                f"{path}: payload_sha256 mismatch"
            )
        plan = metadata["plan"]
        snapshots = _validate_snapshots(
            config,
            plan.get("source_card_snapshots"),
            source_by_revision,
        )
        tracking_review = validate_tracking_review(
            path.parents[2], plan.get("tracking_review")
        )
        normalized_plan = weekly_plan_object(config, snapshots, tracking_review)
        if plan != normalized_plan:
            raise StrategyDataError(
                f"{path}: plan fields are not normalized"
            )
        expected_body = render_weekly_body(metadata)
        if body != expected_body:
            raise StrategyDataError(
                f"{path}: rendered revision body does not match metadata"
            )
        body_sha256 = metadata.get("body_sha256")
        if (
            not isinstance(body_sha256, str)
            or not SHA256_PATTERN.fullmatch(body_sha256)
            or body_sha256 != text_hash(body)
        ):
            raise StrategyDataError(
                f"{path}: body_sha256 mismatch"
            )
        segments.append((metadata, body))
    return segments


def load_all_weekly_plans(
    workspace: Path,
    source_by_revision: Dict[Tuple[str, int], Dict[str, Any]],
) -> Dict[str, List[Tuple[Dict[str, Any], str]]]:
    plans: Dict[str, List[Tuple[Dict[str, Any], str]]] = {}
    global_requests: Dict[str, str] = {}
    for path in sorted((workspace / "plans/weekly").glob("*.md")):
        if path.is_symlink() or not path.is_file():
            raise StrategyDataError(
                f"weekly plan path is unsafe: {path}"
            )
        segments = parse_weekly_file(path, source_by_revision)
        plans[path.stem] = segments
        for metadata, _ in segments:
            request_id = metadata["request_id"]
            previous_week = global_requests.get(request_id)
            if previous_week is not None:
                raise StrategyDataError(
                    f"duplicate weekly plan request_id across "
                    f"{previous_week} and {path.stem}: {request_id}"
                )
            global_requests[request_id] = path.stem
    return plans


def normalize_strategy_change(raw: Any) -> Dict[str, Any]:
    config = require_object(raw, "config")
    check_exact_keys(
        config,
        label="config",
        allowed=STRATEGY_INPUT_KEYS,
        required=STRATEGY_INPUT_KEYS,
    )
    if config.get("schema_version") != SCHEMA_VERSION:
        raise StrategyDataError(
            f"schema_version must be {SCHEMA_VERSION}"
        )
    request_id = require_id(config.get("request_id"), "request_id")
    reason = require_one_line(
        config.get("reason"),
        "reason",
        maximum=4000,
    )
    if config.get("approved_by_user") is not True:
        raise StrategyDataError(
            "approved_by_user must be true after explicit user approval"
        )
    raw_changes = require_object(config.get("changes"), "changes")
    check_exact_keys(
        raw_changes,
        label="changes",
        allowed=STRATEGY_CHANGE_KEYS,
        required=set(),
    )
    if not raw_changes:
        raise StrategyDataError("changes must contain at least one field")
    changes: Dict[str, str] = {}
    for key in ("goal", "desired_frequency", "minimum_frequency"):
        if key in raw_changes:
            changes[key] = require_one_line(
                raw_changes[key],
                f"changes.{key}",
            )
    if "cadence_status" in raw_changes:
        status = raw_changes["cadence_status"]
        if status not in CADENCE_STATUSES:
            raise StrategyDataError(
                "changes.cadence_status must be active or paused"
            )
        changes["cadence_status"] = status
    return {
        "schema_version": SCHEMA_VERSION,
        "request_id": request_id,
        "reason": reason,
        "approved_by_user": True,
        "changes": changes,
    }


def _read_managed_text(path: Path, label: str) -> str:
    _require_regular_file(path, label)
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise StrategyDataError(f"{label} must be UTF-8") from exc


def _section_value(text: str, heading: str, label: str) -> str:
    pattern = re.compile(
        r"^" + re.escape(heading) + r"\n\n(.*?)(?=\n## |\Z)",
        re.MULTILINE | re.DOTALL,
    )
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise StrategyDataError(
            f"{label}: managed section must appear exactly once: {heading}"
        )
    value = matches[0].group(1).strip()
    if not value or "\n" in value or "\r" in value:
        raise StrategyDataError(
            f"{label}: managed section must contain one non-empty line: {heading}"
        )
    return value


def _section_body(text: str, heading: str, label: str) -> str:
    pattern = re.compile(
        r"^" + re.escape(heading) + r"\n\n(.*?)(?=\n## |\Z)",
        re.MULTILINE | re.DOTALL,
    )
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise StrategyDataError(
            f"{label}: managed section must appear exactly once: {heading}"
        )
    return matches[0].group(1).strip()


def _bullet_value(section: str, bullet_label: str, label: str) -> str:
    pattern = re.compile(
        r"^- " + re.escape(bullet_label) + r": (.+)$",
        re.MULTILINE,
    )
    matches = list(pattern.finditer(section))
    if len(matches) != 1:
        raise StrategyDataError(
            f"{label}: managed bullet must appear exactly once: {bullet_label}"
        )
    value = matches[0].group(1).strip()
    if not value:
        raise StrategyDataError(
            f"{label}: managed bullet must not be empty: {bullet_label}"
        )
    return value


def read_strategy_state(
    workspace: Path,
) -> Tuple[Dict[str, str], Dict[str, Any], Dict[str, Any], str, str]:
    profile_path = workspace / "profile/creator-profile.md"
    strategy_path = workspace / "strategy/strategy.md"
    settings_path = workspace / "strategy/operating-settings.json"
    manifest_path = workspace / "workspace.json"

    profile_text = _read_managed_text(
        profile_path,
        "profile/creator-profile.md",
    )
    strategy_text = _read_managed_text(
        strategy_path,
        "strategy/strategy.md",
    )
    settings = _load_json_file(
        settings_path,
        "strategy/operating-settings.json",
    )
    manifest = _load_json_file(manifest_path, "workspace.json")

    profile_goal = _section_value(
        profile_text,
        "## noteで達成したいこと",
        "profile/creator-profile.md",
    )
    strategy_goal = _section_value(
        strategy_text,
        "## 最優先の目的",
        "strategy/strategy.md",
    )
    profile_cadence = _section_body(
        profile_text,
        "## 継続条件",
        "profile/creator-profile.md",
    )
    strategy_cadence = _section_body(
        strategy_text,
        "## 投稿頻度",
        "strategy/strategy.md",
    )
    profile_desired = _bullet_value(
        profile_cadence,
        "希望頻度",
        "profile/creator-profile.md",
    )
    profile_minimum = _bullet_value(
        profile_cadence,
        "最低限の頻度",
        "profile/creator-profile.md",
    )
    strategy_desired = _bullet_value(
        strategy_cadence,
        "希望",
        "strategy/strategy.md",
    )
    strategy_minimum = _bullet_value(
        strategy_cadence,
        "最低限",
        "strategy/strategy.md",
    )
    strategy_status_label = _bullet_value(
        strategy_cadence,
        "運用状態",
        "strategy/strategy.md",
    )
    strategy_status = CADENCE_VALUES.get(strategy_status_label)
    if strategy_status is None:
        raise StrategyDataError(
            "strategy/strategy.md: 運用状態 must be 継続中 or 休止中"
        )

    cadence = settings.get("cadence")
    if not isinstance(cadence, dict):
        raise StrategyDataError(
            "strategy/operating-settings.json: cadence must be an object"
        )
    check_exact_keys(
        cadence,
        label="strategy/operating-settings.json cadence",
        allowed={"status", "desired_frequency", "minimum_frequency"},
        required={"status", "desired_frequency", "minimum_frequency"},
    )
    settings_status = cadence.get("status")
    if settings_status not in CADENCE_STATUSES:
        raise StrategyDataError(
            "strategy/operating-settings.json: invalid cadence status"
        )
    settings_desired = require_one_line(
        cadence.get("desired_frequency"),
        "strategy/operating-settings.json cadence.desired_frequency",
    )
    settings_minimum = require_one_line(
        cadence.get("minimum_frequency"),
        "strategy/operating-settings.json cadence.minimum_frequency",
    )
    if profile_goal != strategy_goal:
        raise StrategyDataError(
            "goal differs between creator profile and strategy"
        )
    if not (
        profile_desired == strategy_desired == settings_desired
    ):
        raise StrategyDataError(
            "desired frequency differs between managed strategy files"
        )
    if not (
        profile_minimum == strategy_minimum == settings_minimum
    ):
        raise StrategyDataError(
            "minimum frequency differs between managed strategy files"
        )
    if strategy_status != settings_status:
        raise StrategyDataError(
            "cadence status differs between strategy and operating settings"
        )
    if settings.get("workspace_id") != manifest.get("workspace_id"):
        raise StrategyDataError("workspace ID mismatch")
    state = {
        "goal": profile_goal,
        "desired_frequency": settings_desired,
        "minimum_frequency": settings_minimum,
        "cadence_status": settings_status,
    }
    return state, settings, manifest, profile_text, strategy_text


def _replace_section_value(
    text: str,
    heading: str,
    value: str,
    label: str,
) -> str:
    pattern = re.compile(
        r"^" + re.escape(heading) + r"\n\n(.*?)(?=\n## |\Z)",
        re.MULTILINE | re.DOTALL,
    )
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise StrategyDataError(
            f"{label}: managed section must appear exactly once: {heading}"
        )
    match = matches[0]
    return (
        text[: match.start()]
        + heading
        + "\n\n"
        + value
        + "\n"
        + text[match.end() :]
    )


def _replace_section_bullet(
    text: str,
    heading: str,
    bullet_label: str,
    value: str,
    label: str,
) -> str:
    section_pattern = re.compile(
        r"^" + re.escape(heading) + r"\n\n(.*?)(?=\n## |\Z)",
        re.MULTILINE | re.DOTALL,
    )
    section_matches = list(section_pattern.finditer(text))
    if len(section_matches) != 1:
        raise StrategyDataError(
            f"{label}: managed section must appear exactly once: {heading}"
        )
    section_match = section_matches[0]
    section = section_match.group(1)
    bullet_pattern = re.compile(
        r"^- " + re.escape(bullet_label) + r": .+$",
        re.MULTILINE,
    )
    bullet_matches = list(bullet_pattern.finditer(section))
    if len(bullet_matches) != 1:
        raise StrategyDataError(
            f"{label}: managed bullet must appear exactly once: {bullet_label}"
        )
    bullet_match = bullet_matches[0]
    new_section = (
        section[: bullet_match.start()]
        + f"- {bullet_label}: {value}"
        + section[bullet_match.end() :]
    )
    return (
        text[: section_match.start()]
        + heading
        + "\n\n"
        + new_section
        + text[section_match.end() :]
    )


def strategy_event_payload(event: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "input": event.get("input"),
        "before": event.get("before"),
        "after": event.get("after"),
    }


def make_strategy_event_id(
    revision: int,
    changed_at: str,
    payload_sha256: str,
) -> str:
    suffix = canonical_hash(
        {
            "revision": revision,
            "changed_at": changed_at,
            "payload_sha256": payload_sha256,
        }
    )[:12]
    return f"strategy-{revision:04d}-{suffix}"


def _normalize_strategy_state(value: Any, label: str) -> Dict[str, str]:
    state = require_object(value, label)
    check_exact_keys(
        state,
        label=label,
        allowed=STRATEGY_STATE_KEYS,
        required=STRATEGY_STATE_KEYS,
    )
    status = state.get("cadence_status")
    if status not in CADENCE_STATUSES:
        raise StrategyDataError(f"{label}.cadence_status is invalid")
    return {
        "goal": require_one_line(state.get("goal"), f"{label}.goal"),
        "desired_frequency": require_one_line(
            state.get("desired_frequency"),
            f"{label}.desired_frequency",
        ),
        "minimum_frequency": require_one_line(
            state.get("minimum_frequency"),
            f"{label}.minimum_frequency",
        ),
        "cadence_status": status,
    }


def load_strategy_history(
    workspace: Path,
    current_state: Dict[str, str],
    settings: Dict[str, Any],
    manifest: Dict[str, Any],
) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    request_ids: set[str] = set()
    previous_after: Optional[Dict[str, str]] = None
    previous_moment: Optional[datetime] = None
    for number, raw_event in iter_jsonl(
        workspace / "strategy/change-history.jsonl"
    ):
        label = f"strategy/change-history.jsonl:{number}"
        event = require_object(raw_event, label)
        check_exact_keys(
            event,
            label=label,
            allowed=STRATEGY_EVENT_KEYS,
            required=STRATEGY_EVENT_KEYS,
        )
        if event.get("schema_version") != SCHEMA_VERSION:
            raise StrategyDataError(
                f"{label}: unsupported schema_version"
            )
        revision = require_integer(
            event.get("revision"),
            f"{label}.revision",
            minimum=1,
        )
        if revision != len(events) + 1:
            raise StrategyDataError(
                f"{label}: revisions must be sequential from 1"
            )
        request_id = require_id(
            event.get("request_id"),
            f"{label}.request_id",
        )
        if request_id in request_ids:
            raise StrategyDataError(
                f"{label}: duplicate request_id {request_id}"
            )
        request_ids.add(request_id)
        normalized_input = normalize_strategy_change(event.get("input"))
        if normalized_input["request_id"] != request_id:
            raise StrategyDataError(
                f"{label}: request_id does not match input"
            )
        before = _normalize_strategy_state(
            event.get("before"),
            f"{label}.before",
        )
        after = _normalize_strategy_state(
            event.get("after"),
            f"{label}.after",
        )
        expected_after = dict(before)
        expected_after.update(normalized_input["changes"])
        if after != expected_after:
            raise StrategyDataError(
                f"{label}: after does not match approved changes"
            )
        if after == before:
            raise StrategyDataError(
                f"{label}: change event has no effective change"
            )
        if previous_after is not None and before != previous_after:
            raise StrategyDataError(
                f"{label}: before does not match previous after"
            )
        changed_at, changed_moment = parse_timestamp(
            event.get("changed_at")
        )
        if event.get("changed_at") != changed_at:
            raise StrategyDataError(
                f"{label}: changed_at is not normalized"
            )
        if previous_moment is not None and changed_moment < previous_moment:
            raise StrategyDataError(
                f"{label}: changed_at must not go backwards"
            )
        payload_sha256 = event.get("payload_sha256")
        if (
            not isinstance(payload_sha256, str)
            or not SHA256_PATTERN.fullmatch(payload_sha256)
            or payload_sha256 != canonical_hash(strategy_event_payload(event))
        ):
            raise StrategyDataError(
                f"{label}: payload_sha256 mismatch"
            )
        expected_event_id = make_strategy_event_id(
            revision,
            changed_at,
            payload_sha256,
        )
        event_id = event.get("event_id")
        if (
            not isinstance(event_id, str)
            or not EVENT_ID_PATTERN.fullmatch(event_id)
            or event_id != expected_event_id
        ):
            raise StrategyDataError(f"{label}: event_id mismatch")
        events.append(event)
        previous_after = after
        previous_moment = changed_moment

    if events:
        if current_state != events[-1]["after"]:
            raise StrategyDataError(
                "current strategy state does not match latest change event"
            )
        latest_changed_at = events[-1]["changed_at"]
        if settings.get("updated_at") != latest_changed_at:
            raise StrategyDataError(
                "operating settings updated_at does not match latest change"
            )
        if manifest.get("updated_at") != latest_changed_at:
            raise StrategyDataError(
                "workspace updated_at does not match latest change"
            )
    return events


def apply_strategy_change(
    state: Dict[str, str],
    config: Dict[str, Any],
) -> Dict[str, str]:
    after = dict(state)
    after.update(config["changes"])
    if after == state:
        raise StrategyDataError(
            "approved strategy change does not change the current state"
        )
    return after


def render_strategy_updates(
    workspace: Path,
    config: Dict[str, Any],
    changed_at: str,
    events: List[Dict[str, Any]],
    state: Dict[str, str],
    settings: Dict[str, Any],
    manifest: Dict[str, Any],
    profile_text: str,
    strategy_text: str,
) -> Tuple[Dict[Path, str], Dict[str, Any], Dict[str, str]]:
    changes = config["changes"]
    after = apply_strategy_change(state, config)
    new_profile = profile_text
    new_strategy = strategy_text
    if "goal" in changes:
        new_profile = _replace_section_value(
            new_profile,
            "## noteで達成したいこと",
            changes["goal"],
            "profile/creator-profile.md",
        )
        new_strategy = _replace_section_value(
            new_strategy,
            "## 最優先の目的",
            changes["goal"],
            "strategy/strategy.md",
        )
    if "desired_frequency" in changes:
        new_profile = _replace_section_bullet(
            new_profile,
            "## 継続条件",
            "希望頻度",
            changes["desired_frequency"],
            "profile/creator-profile.md",
        )
        new_strategy = _replace_section_bullet(
            new_strategy,
            "## 投稿頻度",
            "希望",
            changes["desired_frequency"],
            "strategy/strategy.md",
        )
    if "minimum_frequency" in changes:
        new_profile = _replace_section_bullet(
            new_profile,
            "## 継続条件",
            "最低限の頻度",
            changes["minimum_frequency"],
            "profile/creator-profile.md",
        )
        new_strategy = _replace_section_bullet(
            new_strategy,
            "## 投稿頻度",
            "最低限",
            changes["minimum_frequency"],
            "strategy/strategy.md",
        )
    if "cadence_status" in changes:
        new_strategy = _replace_section_bullet(
            new_strategy,
            "## 投稿頻度",
            "運用状態",
            CADENCE_LABELS[changes["cadence_status"]],
            "strategy/strategy.md",
        )

    new_settings = json.loads(json.dumps(settings, ensure_ascii=False))
    new_settings["cadence"] = {
        "status": after["cadence_status"],
        "desired_frequency": after["desired_frequency"],
        "minimum_frequency": after["minimum_frequency"],
    }
    new_settings["updated_at"] = changed_at
    new_manifest = json.loads(json.dumps(manifest, ensure_ascii=False))
    new_manifest["updated_at"] = changed_at

    event: Dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "event_id": "",
        "request_id": config["request_id"],
        "revision": len(events) + 1,
        "changed_at": changed_at,
        "input": config,
        "before": state,
        "after": after,
        "payload_sha256": "",
    }
    event["payload_sha256"] = canonical_hash(strategy_event_payload(event))
    event["event_id"] = make_strategy_event_id(
        event["revision"],
        changed_at,
        event["payload_sha256"],
    )
    existing_history = (
        workspace / "strategy/change-history.jsonl"
    ).read_text(encoding="utf-8")
    if existing_history and not existing_history.endswith("\n"):
        existing_history += "\n"
    history = (
        existing_history
        + json.dumps(
            event,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
    )
    contents = {
        workspace / "profile/creator-profile.md": new_profile,
        workspace / "strategy/strategy.md": new_strategy,
        workspace / "strategy/operating-settings.json": (
            json.dumps(new_settings, ensure_ascii=False, indent=2) + "\n"
        ),
        workspace / "workspace.json": (
            json.dumps(new_manifest, ensure_ascii=False, indent=2) + "\n"
        ),
        workspace / "strategy/change-history.jsonl": history,
    }
    return contents, event, after


def strategy_automation_follow_up(settings: Dict[str, Any]) -> bool:
    """Return whether a platform-live automation check is needed.

    The workspace stores the user's requested schedule, not a cached claim that
    an external automation currently exists. The platform remains the source of
    truth for creation status, target task, and next run.
    """
    preferences = settings.get("automation_preferences")
    if not isinstance(preferences, dict):
        return False
    for value in preferences.values():
        if isinstance(value, dict) and value.get("requested") is True:
            return True
    return False
