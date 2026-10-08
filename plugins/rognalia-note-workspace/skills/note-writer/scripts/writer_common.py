#!/usr/bin/env python3
"""Shared validation and storage helpers for note-writer."""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Sequence, Tuple


SCHEMA_VERSION = 1
MAX_BODY_BYTES = 500_000
REQUEST_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._:-]{7,127}$")
ARTICLE_ID_PATTERN = re.compile(r"^article-[a-z0-9][a-z0-9-]{2,63}$")
CANDIDATE_ID_PATTERN = re.compile(r"^idea-[a-z0-9][a-z0-9-]{2,63}$")
HASH_PATTERN = re.compile(r"^[0-9a-f]{64}$")
WEEK_PATTERN = re.compile(r"^([0-9]{4})-W([0-9]{2})$")
WEEKLY_MARKER_PATTERN = re.compile(
    r"^<!-- note-workspace-weekly-plan-revision: ([A-Za-z0-9_-]+) -->$",
    re.MULTILINE,
)
TAG_PATTERN = re.compile(r"^[^#\s]{1,50}$")
URL_PATTERN = re.compile(r"^https?://", re.IGNORECASE)
CONTEXT_METADATA_PATTERN = re.compile(
    r"^<!-- note-workspace-context-pack: (\{.*\}) -->$", re.MULTILINE
)
CONTEXT_EVENT_KEYS = {
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

INPUT_KEYS = {
    "schema_version",
    "request_id",
    "article_id",
    "direction_source",
    "weekly_plan_week",
    "weekly_plan_path",
    "weekly_plan_revision",
    "weekly_plan_sha256",
    "weekly_record_type",
    "weekly_confirmed_by_user",
    "weekly_candidate_id",
    "topic",
    "audience",
    "purpose",
    "context_pack_path",
    "research_status",
    "research_sources",
    "interview_question_count",
    "approved_outline",
    "outline_approved",
    "tone",
    "tone_approved",
    "title_options",
    "selected_title",
    "note_tags",
    "x_post",
    "quality_gate_completed",
}

METADATA_KEYS = INPUT_KEYS | {
    "revision",
    "created_at",
    "status",
    "context_pack_sha256",
    "quality_gate",
    "body_sha256",
    "draft_sha256",
    "draft_path",
    "metadata_path",
    "payload_sha256",
}

EVENT_KEYS = {
    "schema_version",
    "event_type",
    "request_id",
    "payload_sha256",
    "article_id",
    "revision",
    "created_at",
    "status",
    "selected_title",
    "context_pack_path",
    "context_pack_sha256",
    "draft_path",
    "metadata_path",
    "draft_sha256",
    "metadata_sha256",
    "external_actions",
}


class WriterDataError(ValueError):
    """Raised when article data violates the public storage contract."""


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def canonical_hash(value: Any) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def require_object(value: Any, label: str) -> Dict[str, Any]:
    if not isinstance(value, dict):
        raise WriterDataError(f"{label} must be an object")
    return value


def check_exact_keys(
    value: Dict[str, Any],
    *,
    label: str,
    expected: Sequence[str],
) -> None:
    expected_set = set(expected)
    actual = set(value)
    missing = sorted(expected_set - actual)
    extra = sorted(actual - expected_set)
    if missing:
        raise WriterDataError(f"{label} is missing fields: {', '.join(missing)}")
    if extra:
        raise WriterDataError(f"{label} has unexpected fields: {', '.join(extra)}")


def require_text(
    value: Any,
    label: str,
    *,
    maximum: int,
    one_line: bool = False,
) -> str:
    if not isinstance(value, str) or not value.strip():
        raise WriterDataError(f"{label} must be non-empty text")
    normalized = value.strip()
    if len(normalized) > maximum:
        raise WriterDataError(f"{label} is too long")
    if one_line and any(character in normalized for character in ("\n", "\r")):
        raise WriterDataError(f"{label} must be one line")
    return normalized


def require_text_list(
    value: Any,
    label: str,
    *,
    minimum: int,
    maximum: int,
    item_maximum: int,
    pattern: Optional[re.Pattern[str]] = None,
) -> List[str]:
    if not isinstance(value, list):
        raise WriterDataError(f"{label} must be an array")
    if not minimum <= len(value) <= maximum:
        raise WriterDataError(
            f"{label} must contain between {minimum} and {maximum} items"
        )
    items: List[str] = []
    for index, item in enumerate(value):
        text = require_text(
            item,
            f"{label}[{index}]",
            maximum=item_maximum,
            one_line=True,
        )
        if pattern is not None and pattern.fullmatch(text) is None:
            raise WriterDataError(f"{label}[{index}] has invalid format")
        items.append(text)
    if len(items) != len(set(items)):
        raise WriterDataError(f"{label} must not contain duplicates")
    return items


def parse_timestamp(value: Optional[str]) -> str:
    if value is None:
        moment = datetime.now(timezone.utc).astimezone()
    else:
        normalized = value.strip().replace("Z", "+00:00")
        try:
            moment = datetime.fromisoformat(normalized)
        except ValueError as exc:
            raise WriterDataError("timestamp must be ISO 8601") from exc
        if moment.tzinfo is None:
            raise WriterDataError("timestamp must include a timezone")
    return moment.isoformat(timespec="seconds")


def load_json_argument(value: str) -> Dict[str, Any]:
    if value == "-":
        import sys

        text = sys.stdin.read()
    else:
        path = Path(value)
        if not path.is_file() or path.is_symlink():
            raise WriterDataError("config file is missing or unsafe")
        text = path.read_text(encoding="utf-8")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise WriterDataError("config is invalid JSON") from exc
    return require_object(parsed, "config")


def resolve_workspace(value: str) -> Path:
    candidate = Path(value)
    if not candidate.is_absolute():
        raise WriterDataError("workspace path must be absolute")
    if not candidate.is_dir() or candidate.is_symlink():
        raise WriterDataError("workspace path is missing or unsafe")
    workspace = candidate.resolve()
    manifest_path = workspace / "workspace.json"
    if not manifest_path.is_file() or manifest_path.is_symlink():
        raise WriterDataError("workspace.json is missing or unsafe")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise WriterDataError("workspace.json is invalid") from exc
    if not isinstance(manifest, dict) or manifest.get("product_id") != "note-workspace":
        raise WriterDataError("workspace is not a note Workspace")
    if manifest.get("schema_version") != SCHEMA_VERSION:
        raise WriterDataError("workspace schema_version is not supported")
    if manifest.get("status") != "ready":
        raise WriterDataError(
            "workspace is not ready; migration or hold must be resolved first"
        )
    if manifest.get("data_owner") != "user":
        raise WriterDataError("workspace data_owner must be user")
    for relative in ("context-packs", "articles", "articles/drafts"):
        path = workspace / relative
        if not path.is_dir() or path.is_symlink():
            raise WriterDataError(f"workspace path is missing or unsafe: {relative}")
    registry = workspace / "articles/registry.jsonl"
    if not registry.is_file() or registry.is_symlink():
        raise WriterDataError("articles/registry.jsonl is missing or unsafe")
    return workspace


def normalize_research_sources(value: Any) -> List[Dict[str, str]]:
    if not isinstance(value, list) or len(value) > 20:
        raise WriterDataError("research_sources must be an array with at most 20 items")
    sources: List[Dict[str, str]] = []
    seen_urls = set()
    for index, raw in enumerate(value):
        item = require_object(raw, f"research_sources[{index}]")
        check_exact_keys(
            item,
            label=f"research_sources[{index}]",
            expected=("title", "url", "retrieved_at"),
        )
        title = require_text(
            item.get("title"),
            f"research_sources[{index}].title",
            maximum=500,
            one_line=True,
        )
        url = require_text(
            item.get("url"),
            f"research_sources[{index}].url",
            maximum=4000,
            one_line=True,
        )
        if URL_PATTERN.match(url) is None:
            raise WriterDataError(f"research_sources[{index}].url must be http or https")
        retrieved_at = parse_timestamp(
            require_text(
                item.get("retrieved_at"),
                f"research_sources[{index}].retrieved_at",
                maximum=100,
                one_line=True,
            )
        )
        if url in seen_urls:
            raise WriterDataError("research_sources must not repeat a URL")
        seen_urls.add(url)
        sources.append(
            {"title": title, "url": url, "retrieved_at": retrieved_at}
        )
    return sources


def normalize_config(raw: Any) -> Dict[str, Any]:
    value = require_object(raw, "article package config")
    check_exact_keys(value, label="article package config", expected=INPUT_KEYS)
    if value.get("schema_version") != SCHEMA_VERSION:
        raise WriterDataError("schema_version is not supported")

    request_id = require_text(
        value.get("request_id"), "request_id", maximum=128, one_line=True
    )
    if REQUEST_ID_PATTERN.fullmatch(request_id) is None:
        raise WriterDataError("request_id has invalid format")
    article_id = require_text(
        value.get("article_id"), "article_id", maximum=72, one_line=True
    )
    if ARTICLE_ID_PATTERN.fullmatch(article_id) is None:
        raise WriterDataError("article_id has invalid format")

    direction_source = value.get("direction_source")
    if direction_source not in {"weekly_plan", "user_request", "existing_draft"}:
        raise WriterDataError("direction_source is invalid")
    weekly_candidate_id = value.get("weekly_candidate_id")
    weekly_plan_week = value.get("weekly_plan_week")
    weekly_plan_path = value.get("weekly_plan_path")
    weekly_plan_revision = value.get("weekly_plan_revision")
    weekly_plan_sha256 = value.get("weekly_plan_sha256")
    weekly_record_type = value.get("weekly_record_type")
    weekly_confirmed_by_user = value.get("weekly_confirmed_by_user")
    if direction_source == "weekly_plan":
        weekly_plan_week = require_text(
            weekly_plan_week, "weekly_plan_week", maximum=8, one_line=True
        )
        week_match = WEEK_PATTERN.fullmatch(weekly_plan_week)
        if week_match is None:
            raise WriterDataError("weekly_plan_week must use YYYY-Www")
        try:
            date.fromisocalendar(
                int(week_match.group(1)), int(week_match.group(2)), 1
            )
        except ValueError as exc:
            raise WriterDataError("weekly_plan_week is not a valid ISO week") from exc
        expected_weekly_path = f"plans/weekly/{weekly_plan_week}.md"
        if weekly_plan_path != expected_weekly_path:
            raise WriterDataError("weekly_plan_path does not match weekly_plan_week")
        if (
            isinstance(weekly_plan_revision, bool)
            or not isinstance(weekly_plan_revision, int)
            or weekly_plan_revision < 1
        ):
            raise WriterDataError("weekly_plan_revision must be a positive integer")
        if (
            not isinstance(weekly_plan_sha256, str)
            or HASH_PATTERN.fullmatch(weekly_plan_sha256) is None
        ):
            raise WriterDataError("weekly_plan_sha256 has invalid format")
        if weekly_record_type not in {"strategy_recommendation", "user_selection"}:
            raise WriterDataError("weekly_record_type is invalid")
        if not isinstance(weekly_confirmed_by_user, bool):
            raise WriterDataError("weekly_confirmed_by_user must be true or false")
        if (
            weekly_record_type == "strategy_recommendation"
            and weekly_confirmed_by_user is not False
        ) or (
            weekly_record_type == "user_selection"
            and weekly_confirmed_by_user is not True
        ):
            raise WriterDataError(
                "weekly record type and confirmed_by_user do not match"
            )
        weekly_candidate_id = require_text(
            weekly_candidate_id,
            "weekly_candidate_id",
            maximum=128,
            one_line=True,
        )
        if CANDIDATE_ID_PATTERN.fullmatch(weekly_candidate_id) is None:
            raise WriterDataError("weekly_candidate_id has invalid format")
    else:
        weekly_values = {
            "weekly_plan_week": weekly_plan_week,
            "weekly_plan_path": weekly_plan_path,
            "weekly_plan_revision": weekly_plan_revision,
            "weekly_plan_sha256": weekly_plan_sha256,
            "weekly_record_type": weekly_record_type,
            "weekly_confirmed_by_user": weekly_confirmed_by_user,
            "weekly_candidate_id": weekly_candidate_id,
        }
        populated = [name for name, item in weekly_values.items() if item is not None]
        if populated:
            raise WriterDataError(
                "weekly provenance must be null unless direction_source is weekly_plan"
            )

    context_pack_path = require_text(
        value.get("context_pack_path"),
        "context_pack_path",
        maximum=200,
        one_line=True,
    )
    if context_pack_path != f"context-packs/{article_id}.md":
        raise WriterDataError("context_pack_path must match article_id")

    research_status = value.get("research_status")
    if research_status not in {"completed", "not_needed", "unavailable"}:
        raise WriterDataError("research_status is invalid")
    research_sources = normalize_research_sources(value.get("research_sources"))
    if research_status == "completed" and not research_sources:
        raise WriterDataError("completed research requires at least one source")
    if research_status != "completed" and research_sources:
        raise WriterDataError(
            "research_sources must be empty unless research_status is completed"
        )

    question_count = value.get("interview_question_count")
    if (
        isinstance(question_count, bool)
        or not isinstance(question_count, int)
        or not 0 <= question_count <= 3
    ):
        raise WriterDataError("interview_question_count must be between 0 and 3")
    if value.get("outline_approved") is not True:
        raise WriterDataError("outline_approved must be true before saving")
    if value.get("tone_approved") is not True:
        raise WriterDataError("tone_approved must be true before saving")
    if value.get("quality_gate_completed") is not True:
        raise WriterDataError("quality_gate_completed must be true before saving")

    title_options = require_text_list(
        value.get("title_options"),
        "title_options",
        minimum=3,
        maximum=3,
        item_maximum=200,
    )
    selected_title = require_text(
        value.get("selected_title"),
        "selected_title",
        maximum=200,
        one_line=True,
    )
    if selected_title not in title_options:
        raise WriterDataError("selected_title must be one of title_options")

    return {
        "schema_version": SCHEMA_VERSION,
        "request_id": request_id,
        "article_id": article_id,
        "direction_source": direction_source,
        "weekly_plan_week": weekly_plan_week,
        "weekly_plan_path": weekly_plan_path,
        "weekly_plan_revision": weekly_plan_revision,
        "weekly_plan_sha256": weekly_plan_sha256,
        "weekly_record_type": weekly_record_type,
        "weekly_confirmed_by_user": weekly_confirmed_by_user,
        "weekly_candidate_id": weekly_candidate_id,
        "topic": require_text(value.get("topic"), "topic", maximum=300),
        "audience": require_text(value.get("audience"), "audience", maximum=1000),
        "purpose": require_text(value.get("purpose"), "purpose", maximum=1000),
        "context_pack_path": context_pack_path,
        "research_status": research_status,
        "research_sources": research_sources,
        "interview_question_count": question_count,
        "approved_outline": require_text_list(
            value.get("approved_outline"),
            "approved_outline",
            minimum=1,
            maximum=20,
            item_maximum=1000,
        ),
        "outline_approved": True,
        "tone": require_text(
            value.get("tone"), "tone", maximum=500, one_line=True
        ),
        "tone_approved": True,
        "title_options": title_options,
        "selected_title": selected_title,
        "note_tags": require_text_list(
            value.get("note_tags"),
            "note_tags",
            minimum=5,
            maximum=6,
            item_maximum=50,
            pattern=TAG_PATTERN,
        ),
        "x_post": require_text(value.get("x_post"), "x_post", maximum=1000),
        "quality_gate_completed": True,
    }


def _decode_weekly_metadata(token: str) -> Dict[str, Any]:
    padding = "=" * (-len(token) % 4)
    try:
        value = json.loads(
            base64.urlsafe_b64decode(token + padding).decode("utf-8")
        )
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise WriterDataError("weekly plan metadata is invalid") from exc
    return require_object(value, "weekly plan metadata")


def validate_weekly_plan_reference(
    workspace: Path, config: Dict[str, Any]
) -> None:
    if config["direction_source"] != "weekly_plan":
        return
    relative = Path(config["weekly_plan_path"])
    path = workspace / relative
    if not path.is_file() or path.is_symlink() or path.parent.is_symlink():
        raise WriterDataError("referenced weekly plan is missing or unsafe")
    text = path.read_text(encoding="utf-8")
    matches = list(WEEKLY_MARKER_PATTERN.finditer(text))
    if not matches:
        raise WriterDataError("referenced weekly plan has no revisions")
    target_metadata: Optional[Dict[str, Any]] = None
    target_body = ""
    target_segment = ""
    for index, match in enumerate(matches):
        body_start = match.end() + 2
        if text[match.end() : body_start] != "\n\n":
            raise WriterDataError("weekly plan revision separator is invalid")
        body_end = matches[index + 1].start() - 1 if index + 1 < len(matches) else len(text)
        body = text[body_start:body_end]
        metadata = _decode_weekly_metadata(match.group(1))
        if metadata.get("revision") == config["weekly_plan_revision"]:
            if target_metadata is not None:
                raise WriterDataError("weekly plan revision is duplicated")
            target_metadata = metadata
            target_body = body
            target_segment = text[match.start():body_end]
    if target_metadata is None:
        raise WriterDataError("referenced weekly plan revision does not exist")
    if target_metadata.get("week") != config["weekly_plan_week"]:
        raise WriterDataError("weekly plan week does not match provenance")
    if target_metadata.get("body_sha256") != sha256_text(target_body):
        raise WriterDataError("weekly plan body hash does not match")
    if sha256_text(target_segment) != config["weekly_plan_sha256"]:
        raise WriterDataError("weekly plan revision hash does not match provenance")
    plan = require_object(target_metadata.get("plan"), "weekly plan plan")
    if plan.get("record_type") != config["weekly_record_type"]:
        raise WriterDataError("weekly plan record_type does not match provenance")
    if plan.get("confirmed_by_user") is not config["weekly_confirmed_by_user"]:
        raise WriterDataError("weekly plan confirmation does not match provenance")
    expected_status = (
        "recommended"
        if config["weekly_record_type"] == "strategy_recommendation"
        else "paused"
        if plan.get("decision") == "pause"
        else "confirmed"
    )
    if target_metadata.get("status") != expected_status:
        raise WriterDataError("weekly plan status does not match provenance")
    candidates = plan.get("candidates")
    if not isinstance(candidates, list):
        raise WriterDataError("weekly plan candidates are invalid")
    matches_candidate = [
        item
        for item in candidates
        if isinstance(item, dict)
        and item.get("candidate_id") == config["weekly_candidate_id"]
    ]
    if len(matches_candidate) != 1:
        raise WriterDataError("weekly candidate does not exist exactly once in the plan")


def load_body_file(value: str) -> str:
    path = Path(value)
    if not path.is_file() or path.is_symlink():
        raise WriterDataError("body file is missing or unsafe")
    if path.stat().st_size > MAX_BODY_BYTES:
        raise WriterDataError("body file is too large")
    body = path.read_text(encoding="utf-8").replace("\r\n", "\n").strip()
    if not body:
        raise WriterDataError("body file is empty")
    last_line = next(
        (line.strip() for line in reversed(body.splitlines()) if line.strip()),
        "",
    )
    if re.fullmatch(r"(?:#[^#\s]+\s*){5,6}", last_line):
        raise WriterDataError("body file must not already include the note tag line")
    return body


def read_context_pack(
    workspace: Path, config: Dict[str, Any]
) -> Tuple[Path, str, Dict[str, Any], str]:
    relative = Path(config["context_pack_path"])
    if relative.is_absolute() or ".." in relative.parts:
        raise WriterDataError("context_pack_path is unsafe")
    path = workspace / relative
    if not path.is_file() or path.is_symlink() or path.parent.is_symlink():
        raise WriterDataError("context pack is missing or unsafe")
    text = path.read_text(encoding="utf-8")
    match = CONTEXT_METADATA_PATTERN.search(text)
    if match is None:
        raise WriterDataError("context pack metadata is missing")
    try:
        metadata = json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        raise WriterDataError("context pack metadata is invalid") from exc
    if not isinstance(metadata, dict):
        raise WriterDataError("context pack metadata must be an object")
    if metadata.get("schema_version") != SCHEMA_VERSION:
        raise WriterDataError("context pack schema_version is not supported")
    if metadata.get("article_id") != config["article_id"]:
        raise WriterDataError("context pack article_id does not match")
    if not text[match.end() :].startswith("\n\n"):
        raise WriterDataError("context pack metadata separator is invalid")
    body = text[match.end() + 2 :]
    if metadata.get("body_sha256") != sha256_text(body):
        raise WriterDataError("context pack body hash does not match")
    usable_marker = "## 記事へ使用できる材料\n\n"
    if usable_marker not in body:
        raise WriterDataError("context pack usable-material section is missing")
    usable = body.split(usable_marker, 1)[1].split("\n## ", 1)[0].strip()
    if not usable or usable == "該当する材料はありません。":
        raise WriterDataError("context pack has no usable article material")
    registry_path = workspace / "context-packs/registry.jsonl"
    if (
        not registry_path.is_file()
        or registry_path.is_symlink()
        or registry_path.parent.is_symlink()
    ):
        raise WriterDataError("context pack registry is missing or unsafe")
    relative_text = relative.as_posix()
    matching_events: List[Dict[str, Any]] = []
    with registry_path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                event_value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise WriterDataError(
                    f"context pack registry line {line_number} is invalid JSON"
                ) from exc
            event = require_object(
                event_value, f"context pack registry line {line_number}"
            )
            if event.get("path") == relative_text:
                matching_events.append(event)
    if len(matching_events) != 1:
        raise WriterDataError("context pack must have exactly one registry event")
    try:
        expected_event = {
            "schema_version": SCHEMA_VERSION,
            "event_type": "context_pack_created",
            "request_id": metadata["request_id"],
            "article_id": metadata["article_id"],
            "path": relative_text,
            "created_at": metadata["created_at"],
            "source_cards": metadata["source_cards"],
            "approved_for_article": metadata["approved_for_article"],
            "payload_sha256": metadata["payload_sha256"],
            "body_sha256": metadata["body_sha256"],
            "pack_sha256": sha256_text(text),
            "external_actions": [],
        }
    except KeyError as exc:
        raise WriterDataError(
            f"context pack metadata is missing registry field: {exc.args[0]}"
        ) from exc
    event_payload = {
        key: expected_event.get(key)
        for key in sorted(CONTEXT_EVENT_KEYS - {"event_sha256"})
    }
    expected_event["event_sha256"] = canonical_hash(event_payload)
    if set(matching_events[0]) != CONTEXT_EVENT_KEYS:
        raise WriterDataError("context pack registry event fields do not match schema")
    if matching_events[0] != expected_event:
        raise WriterDataError("context pack does not match its registry event")
    return path, text, metadata, sha256_text(text)


def render_draft(body: str, tags: Sequence[str]) -> str:
    tag_line = " ".join(f"#{tag}" for tag in tags)
    return body.rstrip() + "\n\n" + tag_line + "\n"


def article_payload_hash(
    config: Dict[str, Any], body_sha256: str, context_pack_sha256: str
) -> str:
    return canonical_hash(
        {
            "config": config,
            "body_sha256": body_sha256,
            "context_pack_sha256": context_pack_sha256,
        }
    )


def metadata_object(
    config: Dict[str, Any],
    *,
    revision: int,
    created_at: str,
    context_pack_sha256: str,
    body_sha256: str,
    draft_sha256: str,
    draft_path: str,
    metadata_path: str,
    payload_sha256: str,
) -> Dict[str, Any]:
    metadata = dict(config)
    metadata.update(
        {
            "revision": revision,
            "created_at": created_at,
            "status": "ready_for_image",
            "context_pack_sha256": context_pack_sha256,
            "quality_gate": "note-draft-quality",
            "body_sha256": body_sha256,
            "draft_sha256": draft_sha256,
            "draft_path": draft_path,
            "metadata_path": metadata_path,
            "payload_sha256": payload_sha256,
        }
    )
    return metadata


def registry_event(
    metadata: Dict[str, Any], metadata_sha256: str
) -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "event_type": "draft_saved",
        "request_id": metadata["request_id"],
        "payload_sha256": metadata["payload_sha256"],
        "article_id": metadata["article_id"],
        "revision": metadata["revision"],
        "created_at": metadata["created_at"],
        "status": metadata["status"],
        "selected_title": metadata["selected_title"],
        "context_pack_path": metadata["context_pack_path"],
        "context_pack_sha256": metadata["context_pack_sha256"],
        "draft_path": metadata["draft_path"],
        "metadata_path": metadata["metadata_path"],
        "draft_sha256": metadata["draft_sha256"],
        "metadata_sha256": metadata_sha256,
        "external_actions": [],
    }


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def iter_jsonl(path: Path) -> Iterator[Tuple[int, Dict[str, Any]]]:
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise WriterDataError(
                    f"articles/registry.jsonl:{line_number} is invalid JSON"
                ) from exc
            if not isinstance(value, dict):
                raise WriterDataError(
                    f"articles/registry.jsonl:{line_number} must be an object"
                )
            yield line_number, value


def load_registry(workspace: Path) -> List[Dict[str, Any]]:
    return [event for _, event in iter_jsonl(workspace / "articles/registry.jsonl")]


def _positive_integer(value: Any, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise WriterDataError(f"{label} must be a positive integer")
    return value


def validate_event_shape(event: Dict[str, Any], label: str) -> None:
    check_exact_keys(event, label=label, expected=EVENT_KEYS)
    if event.get("schema_version") != SCHEMA_VERSION:
        raise WriterDataError(f"{label} has unsupported schema_version")
    if event.get("event_type") != "draft_saved":
        raise WriterDataError(f"{label} has unsupported event_type")
    if event.get("status") != "ready_for_image":
        raise WriterDataError(f"{label} has invalid status")
    _positive_integer(event.get("revision"), f"{label}.revision")
    for field in (
        "request_id",
        "payload_sha256",
        "article_id",
        "created_at",
        "selected_title",
        "context_pack_path",
        "context_pack_sha256",
        "draft_path",
        "metadata_path",
        "draft_sha256",
        "metadata_sha256",
    ):
        require_text(event.get(field), f"{label}.{field}", maximum=4000)
    if REQUEST_ID_PATTERN.fullmatch(event["request_id"]) is None:
        raise WriterDataError(f"{label}.request_id has invalid format")
    if ARTICLE_ID_PATTERN.fullmatch(event["article_id"]) is None:
        raise WriterDataError(f"{label}.article_id has invalid format")
    for field in (
        "payload_sha256",
        "context_pack_sha256",
        "draft_sha256",
        "metadata_sha256",
    ):
        if HASH_PATTERN.fullmatch(event[field]) is None:
            raise WriterDataError(f"{label}.{field} has invalid format")
    parse_timestamp(event["created_at"])
    if event.get("external_actions") != []:
        raise WriterDataError(f"{label}.external_actions must be empty")


def safe_managed_file(workspace: Path, relative_value: Any, label: str) -> Path:
    relative_text = require_text(relative_value, label, maximum=300, one_line=True)
    relative = Path(relative_text)
    if relative.is_absolute() or ".." in relative.parts:
        raise WriterDataError(f"{label} is unsafe")
    if relative.parts[:2] != ("articles", "drafts"):
        raise WriterDataError(f"{label} must be inside articles/drafts")
    path = workspace / relative
    if not path.is_file() or path.is_symlink() or path.parent.is_symlink():
        raise WriterDataError(f"{label} is missing or unsafe")
    return path


def validate_article_data(workspace: Path) -> List[str]:
    errors: List[str] = []
    try:
        events = load_registry(workspace)
    except (OSError, WriterDataError) as exc:
        return [str(exc)]

    request_ids = set()
    revisions: Dict[str, List[int]] = {}
    for index, event in enumerate(events, start=1):
        label = f"articles/registry.jsonl event {index}"
        try:
            validate_event_shape(event, label)
            if event["request_id"] in request_ids:
                raise WriterDataError(f"{label} repeats request_id")
            request_ids.add(event["request_id"])
            revisions.setdefault(event["article_id"], []).append(event["revision"])

            suffix = f"{event['article_id']}-r{event['revision']:03d}"
            expected_draft = f"articles/drafts/{suffix}.md"
            expected_metadata = f"articles/drafts/{suffix}.json"
            if event["draft_path"] != expected_draft:
                raise WriterDataError(f"{label}.draft_path does not match revision")
            if event["metadata_path"] != expected_metadata:
                raise WriterDataError(f"{label}.metadata_path does not match revision")

            draft_path = safe_managed_file(
                workspace, event["draft_path"], f"{label}.draft_path"
            )
            metadata_path = safe_managed_file(
                workspace, event["metadata_path"], f"{label}.metadata_path"
            )
            draft_text = draft_path.read_text(encoding="utf-8")
            metadata_text = metadata_path.read_text(encoding="utf-8")
            if sha256_text(draft_text) != event["draft_sha256"]:
                raise WriterDataError(f"{label} draft hash does not match")
            if sha256_text(metadata_text) != event["metadata_sha256"]:
                raise WriterDataError(f"{label} metadata hash does not match")
            try:
                metadata = json.loads(metadata_text)
            except json.JSONDecodeError as exc:
                raise WriterDataError(f"{label} metadata is invalid JSON") from exc
            metadata = require_object(metadata, f"{label} metadata")
            check_exact_keys(metadata, label=f"{label} metadata", expected=METADATA_KEYS)

            config = normalize_config(
                {key: metadata.get(key) for key in INPUT_KEYS}
            )
            for field in (
                "request_id",
                "payload_sha256",
                "article_id",
                "revision",
                "created_at",
                "status",
                "selected_title",
                "context_pack_path",
                "context_pack_sha256",
                "draft_path",
                "metadata_path",
                "draft_sha256",
            ):
                if metadata.get(field) != event.get(field):
                    raise WriterDataError(f"{label} metadata {field} does not match event")
            if metadata.get("quality_gate") != "note-draft-quality":
                raise WriterDataError(f"{label} quality_gate is invalid")

            _, _, _, context_hash = read_context_pack(workspace, config)
            if context_hash != event["context_pack_sha256"]:
                raise WriterDataError(f"{label} context pack hash does not match")
            validate_weekly_plan_reference(workspace, config)

            tag_line = " ".join(f"#{tag}" for tag in config["note_tags"])
            suffix_text = "\n\n" + tag_line + "\n"
            if not draft_text.endswith(suffix_text):
                raise WriterDataError(f"{label} draft tag line does not match metadata")
            body = draft_text[: -len(suffix_text)]
            body_hash = sha256_text(body)
            if body_hash != metadata.get("body_sha256"):
                raise WriterDataError(f"{label} body hash does not match")
            payload_hash = article_payload_hash(config, body_hash, context_hash)
            if payload_hash != event["payload_sha256"]:
                raise WriterDataError(f"{label} payload hash does not match")
        except (OSError, UnicodeError, WriterDataError) as exc:
            errors.append(str(exc))

    for article_id, numbers in revisions.items():
        if numbers != list(range(1, len(numbers) + 1)):
            errors.append(f"{article_id} revisions must be sequential from 1")
    return errors


@contextmanager
def article_lock(workspace: Path, created_at: str) -> Iterator[None]:
    path = workspace / "articles/.writer.lock"
    payload = json.dumps(
        {"created_at": created_at, "pid": os.getpid()}, ensure_ascii=False
    ).encode("utf-8")
    try:
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise WriterDataError(
            "another article write may be active; inspect articles/.writer.lock"
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


def write_new_text(path: Path, content: str) -> None:
    try:
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise WriterDataError(f"managed file already exists: {path.name}") from exc
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())


def append_registry(path: Path, event: Dict[str, Any]) -> None:
    if not path.is_file() or path.is_symlink():
        raise WriterDataError("articles/registry.jsonl is missing or unsafe")
    encoded = (
        json.dumps(event, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")
    with path.open("r+b") as handle:
        handle.seek(0, os.SEEK_END)
        size = handle.tell()
        if 0 < size <= 4096:
            handle.seek(0)
            existing = handle.read()
            if not existing.strip():
                handle.seek(0)
                handle.truncate()
                size = 0
        if size:
            handle.seek(-1, os.SEEK_END)
            if handle.read(1) != b"\n":
                handle.seek(0, os.SEEK_END)
                handle.write(b"\n")
        handle.seek(0, os.SEEK_END)
        handle.write(encoded)
        handle.flush()
        os.fsync(handle.fileno())
