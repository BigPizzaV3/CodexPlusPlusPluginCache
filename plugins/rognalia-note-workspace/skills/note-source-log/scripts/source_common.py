#!/usr/bin/env python3
"""Shared storage primitives for note Workspace source data."""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from contextlib import ExitStack, contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional, Tuple


SCHEMA_VERSION = 1
PRODUCT_ID = "note-workspace"
INPUT_TYPES = {
    "text",
    "voice_transcript",
    "diary",
    "bullet_notes",
    "follow_up_answer",
    "other",
}
VISIBILITIES = {"private", "confirm_before_use", "public"}
CARD_KINDS = {
    "event",
    "observation",
    "emotion",
    "decision",
    "quote",
    "change",
    "question",
    "other",
}
STATEMENT_TYPES = {"fact", "experience", "inference", "unknown"}
CARD_STATUSES = {"active", "archived"}
KIND_LABELS = {
    "event": "出来事",
    "observation": "観察",
    "emotion": "感情",
    "decision": "判断",
    "quote": "発言",
    "change": "変化",
    "question": "問い",
    "other": "その他",
}
STATEMENT_LABELS = {
    "fact": "確認できた事実",
    "experience": "本人の経験",
    "inference": "推論",
    "unknown": "未確認",
}
SCOPE_LABELS = {
    "private": "非公開",
    "confirm_before_use": "使用前に確認",
    "public": "一般利用可能",
}
ID_PATTERN = re.compile(r"[a-z0-9][a-z0-9._:-]{7,127}")
LOG_ID_PATTERN = re.compile(r"log-[0-9]{8}-[a-z0-9]{8,24}")
CARD_ID_PATTERN = re.compile(r"src-[a-z0-9]{8,32}")
ARTICLE_ID_PATTERN = re.compile(r"article-[a-z0-9][a-z0-9-]{2,63}")
CONTEXT_PACK_EVENT_KEYS = {
    "schema_version",
    "event_type",
    "request_id",
    "article_id",
    "path",
    "created_at",
    "source_cards",
    "approved_for_article",
    "payload_sha256",
    "body_sha256",
    "pack_sha256",
    "event_sha256",
    "external_actions",
}


class SourceDataError(ValueError):
    """Raised when source data is invalid or a safe append cannot continue."""


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
        try:
            moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise SourceDataError("timestamp must be ISO 8601 with a timezone") from exc
        if moment.tzinfo is None:
            raise SourceDataError("timestamp must include a timezone")
        moment = moment.replace(microsecond=0)
    normalized = moment.isoformat()
    if normalized.endswith("+00:00"):
        normalized = normalized[:-6] + "Z"
    return normalized, moment


def require_id(value: Any, label: str, pattern: re.Pattern[str] = ID_PATTERN) -> str:
    if not isinstance(value, str) or not pattern.fullmatch(value):
        raise SourceDataError(f"{label} has an invalid format")
    return value


def require_text(
    value: Any,
    label: str,
    *,
    allow_empty: bool = False,
    preserve: bool = False,
    maximum: int = 20000,
) -> str:
    if not isinstance(value, str):
        raise SourceDataError(f"{label} must be a string")
    checked = value if preserve else value.strip()
    if not checked.strip() and not allow_empty:
        raise SourceDataError(f"{label} must not be empty")
    if len(checked) > maximum:
        raise SourceDataError(f"{label} is too long")
    return checked


def require_text_list(
    value: Any,
    label: str,
    *,
    allow_empty: bool = True,
    id_pattern: Optional[re.Pattern[str]] = None,
) -> List[str]:
    if not isinstance(value, list):
        raise SourceDataError(f"{label} must be an array")
    if not value and not allow_empty:
        raise SourceDataError(f"{label} must contain at least one item")
    output: List[str] = []
    for index, item in enumerate(value):
        if id_pattern is None:
            cleaned = require_text(item, f"{label}[{index}]", maximum=4000)
        else:
            cleaned = require_id(item, f"{label}[{index}]", id_pattern)
        if cleaned in output:
            raise SourceDataError(f"{label} must not contain duplicates")
        output.append(cleaned)
    return output


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
        raise SourceDataError(f"{label} has unknown fields: {', '.join(unknown)}")
    if missing:
        raise SourceDataError(f"{label} is missing fields: {', '.join(missing)}")


def load_json(path: str) -> Dict[str, Any]:
    if path == "-":
        value = json.load(sys.stdin)
    else:
        with Path(path).open("r", encoding="utf-8") as handle:
            value = json.load(handle)
    if not isinstance(value, dict):
        raise SourceDataError("config must be an object")
    return value


def read_text_input(path: str, label: str) -> str:
    if path == "-":
        value = sys.stdin.read()
    else:
        value = Path(path).read_text(encoding="utf-8")
    return require_text(value, label, preserve=True, maximum=100000)


def resolve_workspace(raw: str) -> Path:
    workspace = Path(raw).expanduser().resolve()
    if not workspace.is_dir():
        raise SourceDataError("workspace does not exist or is not a directory")
    manifest_path = workspace / "workspace.json"
    settings_path = workspace / "strategy/operating-settings.json"
    if (
        not manifest_path.is_file()
        or manifest_path.is_symlink()
        or not settings_path.is_file()
        or settings_path.is_symlink()
    ):
        raise SourceDataError("workspace manifest or operating settings is missing")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SourceDataError("workspace manifest or settings is invalid JSON") from exc
    if not isinstance(manifest, dict) or manifest.get("product_id") != PRODUCT_ID:
        raise SourceDataError("workspace product_id mismatch")
    if manifest.get("schema_version") != SCHEMA_VERSION:
        raise SourceDataError("workspace schema_version is not supported")
    if manifest.get("status") != "ready":
        raise SourceDataError("workspace is not ready; migration or hold must be resolved first")
    if manifest.get("data_owner") != "user":
        raise SourceDataError("workspace data_owner must be user")
    if not isinstance(settings, dict) or settings.get("workspace_id") != manifest.get("workspace_id"):
        raise SourceDataError("workspace ID mismatch")
    for relative in (
        "primary-log",
        "source-cards",
        "context-packs",
    ):
        path = workspace / relative
        if not path.is_dir() or path.is_symlink():
            raise SourceDataError(f"required directory is missing or unsafe: {relative}")
    return workspace


@contextmanager
def exclusive_lock(path: Path, created_at: str) -> Iterator[None]:
    payload = json.dumps(
        {"created_at": created_at, "pid": os.getpid()},
        ensure_ascii=False,
    ).encode("utf-8")
    try:
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise SourceDataError(
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
def exclusive_locks(paths: Iterable[Path], created_at: str) -> Iterator[None]:
    """Acquire storage locks in the caller-supplied global order."""
    with ExitStack() as stack:
        for path in paths:
            stack.enter_context(exclusive_lock(path, created_at))
        yield


def append_jsonl(path: Path, record: Dict[str, Any]) -> None:
    if not path.is_file() or path.is_symlink():
        raise SourceDataError(f"append target is missing or unsafe: {path}")
    data = (
        json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")
    with path.open("r+b") as handle:
        size = path.stat().st_size
        if 0 < size <= 4096:
            existing = handle.read()
            if not existing.strip():
                handle.seek(0)
                handle.truncate()
                size = 0
        if size > 0:
            handle.seek(-1, os.SEEK_END)
            if handle.read(1) != b"\n":
                handle.seek(0, os.SEEK_END)
                handle.write(b"\n")
        handle.seek(0, os.SEEK_END)
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())


def iter_jsonl(path: Path) -> Iterator[Tuple[int, Dict[str, Any]]]:
    try:
        handle = path.open("r", encoding="utf-8")
    except OSError as exc:
        raise SourceDataError(f"cannot read {path}: {exc}") from exc
    with handle:
        for number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise SourceDataError(f"{path}:{number} is invalid JSON") from exc
            if not isinstance(value, dict):
                raise SourceDataError(f"{path}:{number} must contain an object")
            yield number, value


def raw_log_payload(record: Dict[str, Any]) -> Dict[str, Any]:
    payload = {
        "input_type": record.get("input_type"),
        "original_text": record.get("original_text"),
        "parent_log_id": record.get("parent_log_id"),
        "follow_up_question": record.get("follow_up_question"),
        "visibility": record.get("visibility"),
    }
    if record.get("schema_version") == 2:
        payload.update({
            "schema_version": 2,
            "conversation_id": record.get("conversation_id"),
            "speaker": record.get("speaker"),
        })
    return payload


def load_log_records(workspace: Path) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []
    for path in sorted((workspace / "primary-log").glob("*/*.jsonl")):
        if path.is_symlink() or path.parent.is_symlink() or not path.is_file():
            raise SourceDataError(f"source log path is unsafe: {path}")
        for _, record in iter_jsonl(path):
            item = dict(record)
            item["_path"] = str(path.relative_to(workspace))
            records.append(item)
    return records


def validate_log_records(records: List[Dict[str, Any]]) -> List[str]:
    errors: List[str] = []
    ids: Dict[str, Dict[str, Any]] = {}
    positions: Dict[str, int] = {}
    requests: Dict[str, Dict[str, Any]] = {}
    required = {
        "schema_version",
        "log_id",
        "request_id",
        "recorded_at",
        "input_type",
        "original_text",
        "parent_log_id",
        "follow_up_question",
        "visibility",
        "status",
        "content_sha256",
        "payload_sha256",
    }
    for position, record in enumerate(records):
        path = record.get("_path", "primary-log")
        public_record = {key: value for key, value in record.items() if not key.startswith("_")}
        version = record.get("schema_version")
        expected_keys = required | {"conversation_id", "speaker"} if version == 2 else required
        if set(public_record) != expected_keys:
            errors.append(f"{path}: raw log fields do not match schema")
            continue
        log_id = record.get("log_id")
        request_id = record.get("request_id")
        if not isinstance(log_id, str) or not LOG_ID_PATTERN.fullmatch(log_id):
            errors.append(f"{path}: invalid log_id")
        elif log_id in ids:
            errors.append(f"{path}: duplicate log_id {log_id}")
        else:
            ids[log_id] = record
            positions[log_id] = position
        if not isinstance(request_id, str) or not ID_PATTERN.fullmatch(request_id):
            errors.append(f"{path}: invalid request_id")
        elif request_id in requests:
            errors.append(f"{path}: duplicate request_id {request_id}")
        else:
            requests[request_id] = record
        if type(version) is not int or version not in {1, 2}:
            errors.append(f"{path}: unsupported schema_version")
        if version == 2:
            conversation_id = record.get("conversation_id")
            if not isinstance(conversation_id, str) or not ID_PATTERN.fullmatch(conversation_id):
                errors.append(f"{path}: invalid conversation_id")
            if record.get("speaker") not in ("user", "assistant"):
                errors.append(f"{path}: invalid speaker")
            if record.get("follow_up_question") is not None:
                errors.append(f"{path}: conversation questions must be separate assistant records")
            if record.get("speaker") == "assistant" and record.get("input_type") != "text":
                errors.append(f"{path}: assistant records require text input_type")
            if record.get("speaker") == "assistant" and record.get("visibility") != "private":
                errors.append(f"{path}: assistant records must remain private")
        parsed_moment: Optional[datetime] = None
        try:
            _, parsed_moment = parse_timestamp(record.get("recorded_at"))
        except (SourceDataError, AttributeError):
            errors.append(f"{path}: invalid recorded_at")
        if parsed_moment is not None:
            expected_path = (
                f"primary-log/{parsed_moment.strftime('%Y')}/"
                f"{parsed_moment.strftime('%Y-%m')}.jsonl"
            )
            if path != expected_path:
                errors.append(f"{path}: recorded_at does not match monthly file")
        input_type = record.get("input_type")
        visibility = record.get("visibility")
        if not isinstance(input_type, str) or input_type not in INPUT_TYPES:
            errors.append(f"{path}: invalid input_type")
        if not isinstance(visibility, str) or visibility not in VISIBILITIES:
            errors.append(f"{path}: invalid visibility")
        if record.get("status") != "active":
            errors.append(f"{path}: raw log status must be active")
        original = record.get("original_text")
        if not isinstance(original, str) or not original.strip():
            errors.append(f"{path}: original_text must not be empty")
        else:
            if len(original) > 100000:
                errors.append(f"{path}: original_text is too long")
            if record.get("content_sha256") != text_hash(original):
                errors.append(f"{path}: content_sha256 mismatch")
        if record.get("payload_sha256") != canonical_hash(raw_log_payload(record)):
            errors.append(f"{path}: payload_sha256 mismatch")
        question = record.get("follow_up_question")
        if question is not None:
            if not isinstance(question, str) or not question.strip():
                errors.append(f"{path}: follow_up_question must be null or non-empty")
            elif len(question) > 100000:
                errors.append(f"{path}: follow_up_question is too long")
        parent = record.get("parent_log_id")
        if parent is not None and (
            not isinstance(parent, str) or not LOG_ID_PATTERN.fullmatch(parent)
        ):
            errors.append(f"{path}: parent_log_id is invalid")
        if record.get("input_type") == "follow_up_answer" and parent is None:
            errors.append(f"{path}: follow_up_answer requires parent_log_id")
        if version == 1 and record.get("input_type") != "follow_up_answer" and parent is not None:
            errors.append(f"{path}: only follow_up_answer may have parent_log_id")

    for record in records:
        parent = record.get("parent_log_id")
        if isinstance(parent, str) and parent not in ids:
            errors.append(f"{record.get('_path', 'primary-log')}: missing parent_log_id {parent}")
        if parent is not None and parent == record.get("log_id"):
            errors.append(f"{record.get('_path', 'primary-log')}: log cannot be its own parent")
        if isinstance(parent, str) and parent in ids:
            parent_record = ids[parent]
            if record.get("schema_version") == 2:
                if (parent_record.get("schema_version") != 2
                        or parent_record.get("conversation_id") != record.get("conversation_id")):
                    errors.append("parent_log_id must belong to the same conversation")
            elif parent_record.get("speaker", "user") != "user":
                errors.append("legacy follow_up_answer cannot reference an assistant record")
        record_log_id = record.get("log_id")
        if (
            isinstance(parent, str)
            and isinstance(record_log_id, str)
            and parent in positions
            and record_log_id in positions
            and positions[parent] >= positions[record_log_id]
        ):
            errors.append(
                f"{record.get('_path', 'primary-log')}: parent_log_id must precede its answer"
            )
    return errors


def card_payload(record: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "source_card_id": record.get("source_card_id"),
        "source_log_ids": record.get("source_log_ids"),
        "kind": record.get("kind"),
        "statement_type": record.get("statement_type"),
        "summary": record.get("summary"),
        "exact_words": record.get("exact_words"),
        "topics": record.get("topics"),
        "public_scope": record.get("public_scope"),
        "status": record.get("status"),
    }


def load_card_events(workspace: Path) -> List[Dict[str, Any]]:
    path = workspace / "source-cards/cards.jsonl"
    if not path.is_file() or path.is_symlink():
        raise SourceDataError("source-cards/cards.jsonl is missing or unsafe")
    records: List[Dict[str, Any]] = []
    for _, record in iter_jsonl(path):
        records.append(record)
    return records


def current_cards(events: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    current: Dict[str, Dict[str, Any]] = {}
    for event in events:
        card_id = event.get("source_card_id")
        revision = event.get("revision")
        if (
            not isinstance(card_id, str)
            or isinstance(revision, bool)
            or not isinstance(revision, int)
        ):
            continue
        previous = current.get(card_id)
        if previous is None or revision > previous.get("revision", 0):
            current[card_id] = event
    return current


def validate_card_events(
    events: List[Dict[str, Any]], logs: List[Dict[str, Any]]
) -> List[str]:
    errors: List[str] = []
    log_by_id = {
        record["log_id"]: record
        for record in logs
        if isinstance(record.get("log_id"), str)
    }
    by_card: Dict[str, List[Dict[str, Any]]] = {}
    request_ids: set[str] = set()
    event_ids: set[str] = set()
    required = {
        "schema_version",
        "event_id",
        "event_type",
        "request_id",
        "source_card_id",
        "revision",
        "source_log_ids",
        "kind",
        "statement_type",
        "summary",
        "exact_words",
        "topics",
        "public_scope",
        "status",
        "created_at",
        "updated_at",
        "payload_sha256",
    }
    for event in events:
        if set(event) != required:
            errors.append("source-cards/cards.jsonl: card fields do not match schema")
            continue
        card_id = event.get("source_card_id")
        if not isinstance(card_id, str) or not CARD_ID_PATTERN.fullmatch(card_id):
            errors.append("source-cards/cards.jsonl: invalid source_card_id")
            continue
        by_card.setdefault(card_id, []).append(event)
        event_id = event.get("event_id")
        if not isinstance(event_id, str) or not ID_PATTERN.fullmatch(event_id):
            errors.append(f"{card_id}: invalid event_id")
        elif event_id in event_ids:
            errors.append(f"{card_id}: duplicate event_id {event_id}")
        else:
            event_ids.add(event_id)
        request_id = event.get("request_id")
        if not isinstance(request_id, str) or not ID_PATTERN.fullmatch(request_id):
            errors.append(f"{card_id}: invalid request_id")
        elif request_id in request_ids:
            errors.append(f"{card_id}: duplicate request_id {request_id}")
        else:
            request_ids.add(request_id)
        if event.get("schema_version") != SCHEMA_VERSION:
            errors.append(f"{card_id}: unsupported schema_version")
        for timestamp_field in ("created_at", "updated_at"):
            try:
                parse_timestamp(event.get(timestamp_field))
            except (SourceDataError, AttributeError):
                errors.append(f"{card_id}: invalid {timestamp_field}")
        event_type = event.get("event_type")
        kind = event.get("kind")
        statement_type = event.get("statement_type")
        public_scope = event.get("public_scope")
        status = event.get("status")
        if not isinstance(event_type, str) or event_type not in {"created", "updated"}:
            errors.append(f"{card_id}: invalid event_type")
        if not isinstance(kind, str) or kind not in CARD_KINDS:
            errors.append(f"{card_id}: invalid kind")
        if not isinstance(statement_type, str) or statement_type not in STATEMENT_TYPES:
            errors.append(f"{card_id}: invalid statement_type")
        if not isinstance(public_scope, str) or public_scope not in VISIBILITIES:
            errors.append(f"{card_id}: invalid public_scope")
        if not isinstance(status, str) or status not in CARD_STATUSES:
            errors.append(f"{card_id}: invalid status")
        if not isinstance(event.get("summary"), str) or not event["summary"].strip():
            errors.append(f"{card_id}: summary must not be empty")
        elif len(event["summary"]) > 4000:
            errors.append(f"{card_id}: summary is too long")
        if event.get("payload_sha256") != canonical_hash(card_payload(event)):
            errors.append(f"{card_id}: payload_sha256 mismatch")
        source_ids = event.get("source_log_ids")
        if not isinstance(source_ids, list) or not source_ids:
            errors.append(f"{card_id}: source_log_ids must not be empty")
            source_ids = []
        else:
            source_id_strings = [value for value in source_ids if isinstance(value, str)]
            if len(source_ids) > 100:
                errors.append(f"{card_id}: source_log_ids must contain at most 100 items")
            if len(source_id_strings) != len(source_ids):
                errors.append(f"{card_id}: source_log_ids must contain only strings")
            if len(source_id_strings) != len(set(source_id_strings)):
                errors.append(f"{card_id}: source_log_ids must not contain duplicates")
        for log_id in source_ids:
            if not isinstance(log_id, str) or not LOG_ID_PATTERN.fullmatch(log_id):
                errors.append(f"{card_id}: invalid source log ID")
            elif log_id not in log_by_id:
                errors.append(f"{card_id}: missing source log {log_id}")
            elif log_by_id[log_id].get("speaker", "user") != "user":
                errors.append(f"{card_id}: assistant records cannot be source material")
        topics = event.get("topics")
        if (
            not isinstance(topics, list)
            or len(topics) > 20
            or any(
                not isinstance(value, str) or not value.strip() or len(value) > 4000
                for value in topics
            )
            or len(topics) != len(set(value for value in topics if isinstance(value, str)))
        ):
            errors.append(f"{card_id}: topics are invalid")
        revision = event.get("revision")
        if isinstance(revision, bool) or not isinstance(revision, int) or revision < 1:
            errors.append(f"{card_id}: revision must be a positive integer")
        exact_words = event.get("exact_words")
        if exact_words is not None:
            if not isinstance(exact_words, str) or not exact_words:
                errors.append(f"{card_id}: exact_words must be null or non-empty")
            elif len(exact_words) > 20000:
                errors.append(f"{card_id}: exact_words is too long")
            elif not any(
                exact_words in str(log_by_id[log_id].get("original_text", ""))
                for log_id in source_ids
                if isinstance(log_id, str) and log_id in log_by_id
            ):
                errors.append(f"{card_id}: exact_words not found in source logs")

    for card_id, revisions in by_card.items():
        if any(
            isinstance(item.get("revision"), bool)
            or not isinstance(item.get("revision"), int)
            or item.get("revision") < 1
            for item in revisions
        ):
            continue
        ordered = sorted(revisions, key=lambda item: item.get("revision", 0))
        numbers = [item.get("revision") for item in ordered]
        if numbers != list(range(1, len(ordered) + 1)):
            errors.append(f"{card_id}: revisions must be sequential from 1")
        for index, item in enumerate(ordered):
            expected_type = "created" if index == 0 else "updated"
            if item.get("event_type") != expected_type:
                errors.append(f"{card_id}: revision {index + 1} must be {expected_type}")
        created_values = [item.get("created_at") for item in ordered]
        if (
            any(not isinstance(value, str) for value in created_values)
            or len(set(value for value in created_values if isinstance(value, str))) != 1
        ):
            errors.append(f"{card_id}: created_at must remain stable")
        updated_values = [item.get("updated_at") for item in ordered]
        if all(isinstance(value, str) for value in updated_values):
            try:
                moments = [parse_timestamp(value)[1] for value in updated_values]
            except SourceDataError:
                moments = []
            if moments and moments != sorted(moments):
                errors.append(f"{card_id}: updated_at must not go backwards")
        if ordered and ordered[0].get("created_at") != ordered[0].get("updated_at"):
            errors.append(f"{card_id}: first revision must have matching timestamps")
    return errors


def escape_inline(value: str) -> str:
    cleaned = " ".join(value.split()).replace("<", "&lt;").replace(">", "&gt;")
    if cleaned.startswith(("#", ">", "- ", "* ", "+ ", "`")):
        return "\\" + cleaned
    return cleaned


def context_pack_payload(config: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "request_id": config["request_id"],
        "article_id": config["article_id"],
        "topic": config["topic"],
        "purpose": config["purpose"],
        "source_card_ids": config["source_card_ids"],
        "approved_for_article": config["approved_for_article"],
        "missing_information": config["missing_information"],
    }


def context_pack_source_cards(
    config: Dict[str, Any], cards: Dict[str, Dict[str, Any]]
) -> List[Dict[str, Any]]:
    return [
        {
            "source_card_id": card_id,
            "revision": cards[card_id]["revision"],
            "event_sha256": canonical_hash(cards[card_id]),
        }
        for card_id in config["source_card_ids"]
    ]


def render_card(card: Dict[str, Any], approval: str) -> str:
    exact = card.get("exact_words")
    exact_json = (
        json.dumps(exact, ensure_ascii=False)
        .replace("<", "\\u003c")
        .replace(">", "\\u003e")
    )
    exact_line = (
        f"- 本人の正確な言葉: {exact_json}\n"
        if exact is not None
        else ""
    )
    topics = "、".join(escape_inline(value) for value in card.get("topics", []))
    logs = "、".join(f"`{value}`" for value in card.get("source_log_ids", []))
    return (
        f"### {card['source_card_id']} / 第{card['revision']}版\n\n"
        f"- 種類: {KIND_LABELS[card['kind']]}\n"
        f"- 情報の扱い: {STATEMENT_LABELS[card['statement_type']]}\n"
        f"- 要約: {escape_inline(card['summary'])}\n"
        f"{exact_line}"
        f"- 話題: {topics or '未設定'}\n"
        f"- 元ログ: {logs}\n"
        f"- カードの公開範囲: {SCOPE_LABELS[card['public_scope']]}\n"
        f"- この記事での扱い: {approval}\n"
    )


def render_context_pack(
    config: Dict[str, Any],
    cards: Dict[str, Dict[str, Any]],
    created_at: str,
) -> Tuple[str, str]:
    input_payload = context_pack_payload(config)
    source_cards = context_pack_source_cards(config, cards)
    payload_hash = canonical_hash(
        {"input": input_payload, "source_cards": source_cards}
    )
    approved = set(config["approved_for_article"])
    usable: List[str] = []
    confirm: List[str] = []
    private: List[str] = []
    for card_id in config["source_card_ids"]:
        card = cards[card_id]
        if card_id in approved or card["public_scope"] == "public":
            usable.append(
                render_card(
                    card,
                    "この記事への使用確認済み"
                    if card_id in approved
                    else "一般利用可能として確認済み",
                )
            )
        elif card["public_scope"] == "confirm_before_use":
            confirm.append(render_card(card, "公開前確認が必要"))
        else:
            private.append(render_card(card, "記事へ使用しない背景"))

    def section(title: str, items: List[str], empty: str) -> str:
        body = "\n".join(items).rstrip() if items else empty
        return f"## {title}\n\n{body}\n"

    missing = (
        "\n".join(f"- {escape_inline(item)}" for item in config["missing_information"])
        if config["missing_information"]
        else "- 現時点では記録されていません。"
    )
    body = (
        f"# 記事別文脈パック: {escape_inline(config['topic'])}\n\n"
        + f"- 記事ID: `{config['article_id']}`\n"
        + f"- 作成日時: `{created_at}`\n"
        + f"- 目的: {escape_inline(config['purpose'])}\n\n"
        + section("記事へ使用できる材料", usable, "該当する材料はありません。")
        + "\n"
        + section("公開前確認が必要な材料", confirm, "該当する材料はありません。")
        + "\n"
        + section("記事へ使用しない背景", private, "該当する材料はありません。")
        + "\n"
        + "## まだ足りない情報\n\n"
        + missing
        + "\n"
    )
    metadata = {
        "schema_version": SCHEMA_VERSION,
        "request_id": config["request_id"],
        "payload_sha256": payload_hash,
        "body_sha256": text_hash(body),
        "article_id": config["article_id"],
        "created_at": created_at,
        "source_card_ids": config["source_card_ids"],
        "approved_for_article": config["approved_for_article"],
        "input": input_payload,
        "source_cards": source_cards,
    }
    content = (
        "<!-- note-workspace-context-pack: "
        + json.dumps(metadata, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + " -->\n\n"
        + body
    )
    return content, payload_hash


CONTEXT_METADATA_PATTERN = re.compile(
    r"^<!-- note-workspace-context-pack: (\{.*\}) -->$", re.MULTILINE
)


def parse_context_metadata_text(text: str, label: str) -> Dict[str, Any]:
    match = CONTEXT_METADATA_PATTERN.search(text)
    if not match:
        raise SourceDataError(f"context pack metadata is missing: {label}")
    try:
        value = json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        raise SourceDataError(f"context pack metadata is invalid: {label}") from exc
    if not isinstance(value, dict):
        raise SourceDataError(f"context pack metadata must be an object: {label}")
    return value


def read_context_metadata(path: Path) -> Dict[str, Any]:
    return parse_context_metadata_text(path.read_text(encoding="utf-8"), str(path))


def read_context_body(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    match = CONTEXT_METADATA_PATTERN.search(text)
    if not match:
        raise SourceDataError(f"context pack metadata is missing: {path}")
    end = match.end()
    if not text[end:].startswith("\n\n"):
        raise SourceDataError(f"context pack metadata separator is invalid: {path}")
    return text[end + 2 :]


def context_pack_registry_path(workspace: Path) -> Path:
    return workspace / "context-packs/registry.jsonl"


def context_pack_event_payload(event: Dict[str, Any]) -> Dict[str, Any]:
    return {key: event.get(key) for key in sorted(CONTEXT_PACK_EVENT_KEYS - {"event_sha256"})}


def build_context_pack_event(content: str, relative_path: str) -> Dict[str, Any]:
    metadata = parse_context_metadata_text(content, relative_path)
    event = {
        "schema_version": SCHEMA_VERSION,
        "event_type": "context_pack_created",
        "request_id": metadata["request_id"],
        "article_id": metadata["article_id"],
        "path": relative_path,
        "created_at": metadata["created_at"],
        "source_cards": metadata["source_cards"],
        "approved_for_article": metadata["approved_for_article"],
        "payload_sha256": metadata["payload_sha256"],
        "body_sha256": metadata["body_sha256"],
        "pack_sha256": text_hash(content),
        "external_actions": [],
    }
    event["event_sha256"] = canonical_hash(context_pack_event_payload(event))
    return event


def load_context_pack_events(workspace: Path) -> List[Dict[str, Any]]:
    path = context_pack_registry_path(workspace)
    if not path.is_file() or path.is_symlink() or path.parent.is_symlink():
        raise SourceDataError("context-packs/registry.jsonl is missing or unsafe")
    return [event for _, event in iter_jsonl(path)]


def validate_context_pack_events(events: List[Dict[str, Any]]) -> List[str]:
    errors: List[str] = []
    requests: set[str] = set()
    articles: set[str] = set()
    paths: set[str] = set()
    sha_pattern = re.compile(r"[0-9a-f]{64}")
    for index, event in enumerate(events, start=1):
        label = f"context-packs/registry.jsonl:{index}"
        if set(event) != CONTEXT_PACK_EVENT_KEYS:
            errors.append(f"{label}: fields do not match schema")
            continue
        if event.get("schema_version") != SCHEMA_VERSION:
            errors.append(f"{label}: unsupported schema_version")
        if event.get("event_type") != "context_pack_created":
            errors.append(f"{label}: invalid event_type")
        request_id = event.get("request_id")
        article_id = event.get("article_id")
        relative = event.get("path")
        if not isinstance(request_id, str) or not ID_PATTERN.fullmatch(request_id):
            errors.append(f"{label}: invalid request_id")
        elif request_id in requests:
            errors.append(f"{label}: duplicate request_id")
        else:
            requests.add(request_id)
        if not isinstance(article_id, str) or not ARTICLE_ID_PATTERN.fullmatch(article_id):
            errors.append(f"{label}: invalid article_id")
        elif article_id in articles:
            errors.append(f"{label}: duplicate article_id")
        else:
            articles.add(article_id)
        expected_path = f"context-packs/{article_id}.md" if isinstance(article_id, str) else None
        if relative != expected_path:
            errors.append(f"{label}: path does not match article_id")
        elif relative in paths:
            errors.append(f"{label}: duplicate path")
        else:
            paths.add(relative)
        try:
            parse_timestamp(event.get("created_at"))
        except (SourceDataError, AttributeError):
            errors.append(f"{label}: invalid created_at")
        source_cards = event.get("source_cards")
        if not isinstance(source_cards, list) or not source_cards:
            errors.append(f"{label}: source_cards must not be empty")
        else:
            seen_cards: set[str] = set()
            for card_index, reference in enumerate(source_cards):
                if not isinstance(reference, dict) or set(reference) != {
                    "source_card_id",
                    "revision",
                    "event_sha256",
                }:
                    errors.append(f"{label}: source_cards[{card_index}] is invalid")
                    continue
                card_id = reference.get("source_card_id")
                revision = reference.get("revision")
                event_hash = reference.get("event_sha256")
                if not isinstance(card_id, str) or not CARD_ID_PATTERN.fullmatch(card_id):
                    errors.append(f"{label}: source_cards[{card_index}] has invalid ID")
                elif card_id in seen_cards:
                    errors.append(f"{label}: source_cards contains duplicates")
                else:
                    seen_cards.add(card_id)
                if isinstance(revision, bool) or not isinstance(revision, int) or revision < 1:
                    errors.append(f"{label}: source_cards[{card_index}] has invalid revision")
                if not isinstance(event_hash, str) or not sha_pattern.fullmatch(event_hash):
                    errors.append(f"{label}: source_cards[{card_index}] has invalid hash")
        approved = event.get("approved_for_article")
        if (
            not isinstance(approved, list)
            or len(approved) > 100
            or any(not isinstance(value, str) or not CARD_ID_PATTERN.fullmatch(value) for value in approved)
            or len(approved) != len(set(value for value in approved if isinstance(value, str)))
        ):
            errors.append(f"{label}: approved_for_article is invalid")
        for field in (
            "payload_sha256",
            "body_sha256",
            "pack_sha256",
            "event_sha256",
        ):
            value = event.get(field)
            if not isinstance(value, str) or not sha_pattern.fullmatch(value):
                errors.append(f"{label}: invalid {field}")
        if event.get("event_sha256") != canonical_hash(context_pack_event_payload(event)):
            errors.append(f"{label}: event_sha256 mismatch")
        if event.get("external_actions") != []:
            errors.append(f"{label}: external_actions must be empty")
    return errors
