#!/usr/bin/env python3
"""Shared validation and append-only storage helpers for note-draft."""

from __future__ import annotations

import hashlib
import json
import os
import re
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Sequence, Tuple
from urllib.parse import unquote, urlsplit, urlunsplit


SCHEMA_VERSION = 1
APPROVAL_PROMPT = "noteの下書き登録まで進めますか？ 公開はしません。"
REQUEST_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._:-]{7,127}$")
ARTICLE_ID_PATTERN = re.compile(r"^article-[a-z0-9][a-z0-9-]{2,63}$")
HASH_PATTERN = re.compile(r"^[0-9a-f]{64}$")
HEADING_PATTERN = re.compile(r"^\[(大見出し|小見出し)\]\s*(.*)$")
URL_TOKEN_PATTERN = re.compile(r"https?://[^\s<>]+", re.IGNORECASE)

REGISTRATION_INPUT_KEYS = {
    "schema_version",
    "request_id",
    "article_id",
    "article_revision",
    "article_metadata_path",
    "thumbnail_metadata_path",
    "inline_metadata_paths",
    "additional_links",
    "approval",
}
DELIVERY_INPUT_KEYS = REGISTRATION_INPUT_KEYS - {"request_id", "approval"}
APPROVAL_KEYS = {
    "confirmed",
    "prompt",
    "source",
    "approved_at",
    "scope",
    "delivery_sha256",
}
ADDITIONAL_LINK_KEYS = {"url", "insertion_heading", "insertion_after"}
HEADING_KEYS = {"kind", "text", "line_number"}
ASSET_SUMMARY_KEYS = {
    "kind",
    "asset_revision",
    "metadata_path",
    "metadata_sha256",
    "image_path",
    "image_sha256",
    "width",
    "height",
    "insertion_heading",
    "insertion_after",
    "caption",
    "alt",
}
PACKAGE_KEYS = {
    "schema_version",
    "request_id",
    "payload_sha256",
    "article_id",
    "article_revision",
    "registration_revision",
    "created_at",
    "status",
    "target",
    "approval",
    "selected_title",
    "article_metadata_path",
    "article_metadata_sha256",
    "draft_path",
    "draft_sha256",
    "body_char_count",
    "headings",
    "note_tags",
    "tag_line",
    "body_urls",
    "additional_links",
    "thumbnail",
    "inline_images",
    "registration_path",
    "external_actions",
}
RESULT_INPUT_KEYS = {
    "schema_version",
    "request_id",
    "registration_path",
    "completed_at",
    "adapter_label",
    "draft_url",
    "url_results",
    "title_verified",
    "body_start_verified",
    "body_end_verified",
    "headings_verified",
    "tags_verified",
    "thumbnail_verified",
    "inline_images_verified",
    "editor_closed",
    "private_draft_confirmed",
    "publish_screen_opened",
    "published",
    "scheduled",
    "existing_draft_overwritten",
}
URL_RESULT_KEYS = {"url", "display"}
RESULT_KEYS = RESULT_INPUT_KEYS | {
    "payload_sha256",
    "article_id",
    "article_revision",
    "registration_revision",
    "status",
    "registration_sha256",
    "result_path",
    "external_actions",
}
START_EVENT_KEYS = {
    "schema_version",
    "event_type",
    "request_id",
    "article_id",
    "article_revision",
    "registration_revision",
    "created_at",
    "status",
    "registration_path",
    "registration_sha256",
    "external_actions",
}
SAVED_EVENT_KEYS = {
    "schema_version",
    "event_type",
    "request_id",
    "article_id",
    "article_revision",
    "registration_revision",
    "created_at",
    "status",
    "registration_path",
    "registration_sha256",
    "result_path",
    "result_sha256",
    "draft_url",
    "external_actions",
}


class DraftDataError(ValueError):
    """Raised when note draft state violates the local contract."""


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_text(value: str) -> str:
    return sha256_bytes(value.encode("utf-8"))


def canonical_hash(value: Any) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return sha256_bytes(encoded)


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def require_object(value: Any, label: str) -> Dict[str, Any]:
    if not isinstance(value, dict):
        raise DraftDataError(f"{label} must be an object")
    return value


def check_exact_keys(
    value: Dict[str, Any], *, label: str, expected: Sequence[str]
) -> None:
    expected_set = set(expected)
    actual = set(value)
    missing = sorted(expected_set - actual)
    extra = sorted(actual - expected_set)
    if missing:
        raise DraftDataError(f"{label} is missing fields: {', '.join(missing)}")
    if extra:
        raise DraftDataError(f"{label} has unexpected fields: {', '.join(extra)}")


def require_text(
    value: Any, label: str, *, maximum: int, one_line: bool = False
) -> str:
    if not isinstance(value, str) or not value.strip():
        raise DraftDataError(f"{label} must be non-empty text")
    normalized = value.strip()
    if len(normalized) > maximum:
        raise DraftDataError(f"{label} is too long")
    if one_line and any(character in normalized for character in ("\n", "\r")):
        raise DraftDataError(f"{label} must be one line")
    return normalized


def positive_integer(value: Any, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise DraftDataError(f"{label} must be a positive integer")
    return value


def parse_timestamp(value: Optional[str]) -> str:
    if value is None:
        moment = datetime.now(timezone.utc).astimezone()
    else:
        normalized = value.strip().replace("Z", "+00:00")
        try:
            moment = datetime.fromisoformat(normalized)
        except ValueError as exc:
            raise DraftDataError("timestamp must be ISO 8601") from exc
        if moment.tzinfo is None:
            raise DraftDataError("timestamp must include a timezone")
    return moment.isoformat(timespec="seconds")


def timestamp_moment(value: str, label: str) -> datetime:
    normalized = parse_timestamp(
        require_text(value, label, maximum=100, one_line=True)
    )
    return datetime.fromisoformat(normalized.replace("Z", "+00:00"))


def load_json_argument(value: str, label: str) -> Dict[str, Any]:
    if value == "-":
        import sys

        text = sys.stdin.read()
    else:
        path = Path(value)
        if not path.is_file() or path.is_symlink():
            raise DraftDataError(f"{label} file is missing or unsafe")
        text = path.read_text(encoding="utf-8")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise DraftDataError(f"{label} is invalid JSON") from exc
    return require_object(parsed, label)


def resolve_workspace(value: str) -> Path:
    candidate = Path(value)
    if not candidate.is_absolute():
        raise DraftDataError("workspace path must be absolute")
    if not candidate.is_dir() or candidate.is_symlink():
        raise DraftDataError("workspace path is missing or unsafe")
    workspace = candidate.resolve()
    manifest_path = workspace / "workspace.json"
    if not manifest_path.is_file() or manifest_path.is_symlink():
        raise DraftDataError("workspace.json is missing or unsafe")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise DraftDataError("workspace.json is invalid") from exc
    if not isinstance(manifest, dict) or manifest.get("product_id") != "note-workspace":
        raise DraftDataError("workspace is not a note Workspace")
    if manifest.get("schema_version") != SCHEMA_VERSION:
        raise DraftDataError("workspace schema_version is not supported")
    if manifest.get("status") != "ready":
        raise DraftDataError(
            "workspace is not ready; migration or hold must be resolved first"
        )
    if manifest.get("data_owner") != "user":
        raise DraftDataError("workspace data_owner must be user")
    for relative in ("articles", "articles/drafts", "assets"):
        path = workspace / relative
        if not path.is_dir() or path.is_symlink():
            raise DraftDataError(f"workspace path is missing or unsafe: {relative}")
    registry = workspace / "articles/registry.jsonl"
    if not registry.is_file() or registry.is_symlink():
        raise DraftDataError("articles/registry.jsonl is missing or unsafe")
    return workspace


def relative_path(value: Any, label: str, *, prefix: Tuple[str, ...]) -> Path:
    text = require_text(value, label, maximum=500, one_line=True)
    relative = Path(text)
    if relative.is_absolute() or ".." in relative.parts:
        raise DraftDataError(f"{label} is unsafe")
    if relative.parts[: len(prefix)] != prefix:
        raise DraftDataError(f"{label} must be inside {'/'.join(prefix)}")
    return relative


def safe_workspace_file(
    workspace: Path, value: Any, label: str, *, prefix: Tuple[str, ...]
) -> Path:
    relative = relative_path(value, label, prefix=prefix)
    path = workspace / relative
    if not path.is_file() or path.is_symlink() or path.parent.is_symlink():
        raise DraftDataError(f"{label} is missing or unsafe")
    try:
        path.resolve().relative_to(workspace)
    except ValueError as exc:
        raise DraftDataError(f"{label} is outside workspace") from exc
    return path


def read_json_file(path: Path, label: str) -> Tuple[Dict[str, Any], str, str]:
    text = path.read_text(encoding="utf-8")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise DraftDataError(f"{label} is invalid JSON") from exc
    return require_object(parsed, label), text, sha256_text(text)


def iter_jsonl(path: Path) -> Iterator[Tuple[int, Dict[str, Any]]]:
    if not path.is_file() or path.is_symlink():
        raise DraftDataError(f"JSONL file is missing or unsafe: {path}")
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise DraftDataError(f"{path}:{line_number} is invalid JSON") from exc
            if not isinstance(value, dict):
                raise DraftDataError(f"{path}:{line_number} must be an object")
            yield line_number, value


def normalize_url(value: Any, label: str, *, note_only: bool = False) -> str:
    if note_only and isinstance(value, str) and value != value.strip():
        raise DraftDataError(
            f"{label} must use the exact canonical URL without surrounding whitespace"
        )
    url = require_text(value, label, maximum=2000, one_line=True)
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise DraftDataError(f"{label} must be an absolute HTTP URL")
    if parsed.username is not None or parsed.password is not None:
        raise DraftDataError(f"{label} must not contain credentials")
    try:
        port = parsed.port
    except ValueError as exc:
        raise DraftDataError(f"{label} has an invalid port") from exc
    if note_only:
        hostname = parsed.hostname.lower()
        if parsed.scheme != "https" or hostname not in {"note.com", "www.note.com"}:
            raise DraftDataError(f"{label} must be an HTTPS note.com URL")
        if port is not None:
            raise DraftDataError(f"{label} must not include an explicit port")
        decoded_path = unquote(parsed.path)
        if decoded_path != parsed.path:
            raise DraftDataError(f"{label} must not use an encoded path")
        if re.fullmatch(r"/notes/[A-Za-z0-9_-]+/edit", decoded_path) is None:
            raise DraftDataError(f"{label} must identify one private note draft editor")
        if parsed.query or parsed.fragment:
            raise DraftDataError(f"{label} must not contain a query or fragment")
        canonical = urlunsplit(("https", hostname, decoded_path, "", ""))
        if url != canonical:
            raise DraftDataError(
                f"{label} must be canonical without a trailing slash, query, or fragment"
            )
        return canonical
    return url


def normalize_additional_links(value: Any) -> List[Dict[str, str]]:
    if not isinstance(value, list) or len(value) > 20:
        raise DraftDataError("additional_links must be an array with at most 20 items")
    normalized: List[Dict[str, str]] = []
    seen = set()
    for index, raw in enumerate(value):
        item = require_object(raw, f"additional_links[{index}]")
        check_exact_keys(
            item,
            label=f"additional_links[{index}]",
            expected=ADDITIONAL_LINK_KEYS,
        )
        result = {
            "url": normalize_url(item.get("url"), f"additional_links[{index}].url"),
            "insertion_heading": require_text(
                item.get("insertion_heading"),
                f"additional_links[{index}].insertion_heading",
                maximum=300,
                one_line=True,
            ),
            "insertion_after": require_text(
                item.get("insertion_after"),
                f"additional_links[{index}].insertion_after",
                maximum=500,
                one_line=True,
            ),
        }
        key = (result["url"], result["insertion_heading"], result["insertion_after"])
        if key in seen:
            raise DraftDataError("additional_links must not contain duplicates")
        seen.add(key)
        normalized.append(result)
    return normalized


def normalize_approval(value: Any) -> Dict[str, Any]:
    approval = require_object(value, "approval")
    check_exact_keys(approval, label="approval", expected=APPROVAL_KEYS)
    if approval.get("confirmed") is not True:
        raise DraftDataError("approval.confirmed must be true")
    if approval.get("prompt") != APPROVAL_PROMPT:
        raise DraftDataError("approval.prompt does not match the fixed approval question")
    if approval.get("source") not in {"prompt_response", "direct_request"}:
        raise DraftDataError("approval.source is invalid")
    if approval.get("scope") != "new_note_draft_once":
        raise DraftDataError("approval.scope must be new_note_draft_once")
    delivery_sha256 = require_text(
        approval.get("delivery_sha256"),
        "approval.delivery_sha256",
        maximum=64,
        one_line=True,
    )
    if HASH_PATTERN.fullmatch(delivery_sha256) is None:
        raise DraftDataError("approval.delivery_sha256 has invalid format")
    return {
        "confirmed": True,
        "prompt": APPROVAL_PROMPT,
        "source": approval["source"],
        "approved_at": parse_timestamp(
            require_text(
                approval.get("approved_at"),
                "approval.approved_at",
                maximum=100,
                one_line=True,
            )
        ),
        "scope": "new_note_draft_once",
        "delivery_sha256": delivery_sha256,
    }


def _normalize_delivery_fields(value: Dict[str, Any]) -> Dict[str, Any]:
    if value.get("schema_version") != SCHEMA_VERSION:
        raise DraftDataError("schema_version is not supported")
    article_id = require_text(
        value.get("article_id"), "article_id", maximum=72, one_line=True
    )
    if ARTICLE_ID_PATTERN.fullmatch(article_id) is None:
        raise DraftDataError("article_id has invalid format")
    article_revision = positive_integer(
        value.get("article_revision"), "article_revision"
    )
    expected_article = f"articles/drafts/{article_id}-r{article_revision:03d}.json"
    article_metadata_path = require_text(
        value.get("article_metadata_path"),
        "article_metadata_path",
        maximum=400,
        one_line=True,
    )
    if article_metadata_path != expected_article:
        raise DraftDataError("article_metadata_path does not match article revision")

    thumbnail = require_text(
        value.get("thumbnail_metadata_path"),
        "thumbnail_metadata_path",
        maximum=400,
        one_line=True,
    )
    expected_thumbnail = re.compile(
        rf"^assets/{re.escape(article_id)}/thumbnail-r[0-9]{{3}}\.json$"
    )
    if expected_thumbnail.fullmatch(thumbnail) is None:
        raise DraftDataError("thumbnail_metadata_path does not match article")

    raw_inline = value.get("inline_metadata_paths")
    if not isinstance(raw_inline, list) or len(raw_inline) > 10:
        raise DraftDataError("inline_metadata_paths must contain at most 10 items")
    inline: List[str] = []
    expected_inline = re.compile(
        rf"^assets/{re.escape(article_id)}/inline-r[0-9]{{3}}\.json$"
    )
    for index, item in enumerate(raw_inline):
        path = require_text(
            item,
            f"inline_metadata_paths[{index}]",
            maximum=400,
            one_line=True,
        )
        if expected_inline.fullmatch(path) is None:
            raise DraftDataError("inline metadata path does not match article")
        if path in inline:
            raise DraftDataError("inline_metadata_paths must not contain duplicates")
        inline.append(path)

    return {
        "schema_version": SCHEMA_VERSION,
        "article_id": article_id,
        "article_revision": article_revision,
        "article_metadata_path": article_metadata_path,
        "thumbnail_metadata_path": thumbnail,
        "inline_metadata_paths": inline,
        "additional_links": normalize_additional_links(value.get("additional_links")),
    }


def normalize_delivery_input(raw: Any) -> Dict[str, Any]:
    value = require_object(raw, "draft delivery config")
    check_exact_keys(
        value,
        label="draft delivery config",
        expected=DELIVERY_INPUT_KEYS,
    )
    return _normalize_delivery_fields(value)


def normalize_registration_input(raw: Any) -> Dict[str, Any]:
    value = require_object(raw, "draft registration config")
    check_exact_keys(
        value,
        label="draft registration config",
        expected=REGISTRATION_INPUT_KEYS,
    )
    request_id = require_text(
        value.get("request_id"), "request_id", maximum=128, one_line=True
    )
    if REQUEST_ID_PATTERN.fullmatch(request_id) is None:
        raise DraftDataError("request_id has invalid format")
    return {
        **_normalize_delivery_fields(value),
        "request_id": request_id,
        "approval": normalize_approval(value.get("approval")),
    }


def extract_headings(draft_text: str) -> List[Dict[str, Any]]:
    headings: List[Dict[str, Any]] = []
    for line_number, line in enumerate(draft_text.splitlines(), start=1):
        match = HEADING_PATTERN.fullmatch(line)
        if match is None:
            continue
        text = match.group(2).strip()
        if not text:
            raise DraftDataError(f"heading marker at line {line_number} has no text")
        if len(text) > 300:
            raise DraftDataError(f"heading at line {line_number} is too long")
        headings.append(
            {
                "kind": "large" if match.group(1) == "大見出し" else "small",
                "text": text,
                "line_number": line_number,
            }
        )
    return headings


def extract_urls(draft_text: str) -> List[str]:
    urls: List[str] = []
    trailing = ".,;:、。，；：!！?？)]}）］｝〉》」』\"'"
    for match in URL_TOKEN_PATTERN.finditer(draft_text):
        candidate = match.group(0).rstrip(trailing)
        url = normalize_url(candidate, "body URL")
        if url not in urls:
            urls.append(url)
    return urls


def read_article_source(workspace: Path, config: Dict[str, Any]) -> Dict[str, Any]:
    metadata_path = safe_workspace_file(
        workspace,
        config["article_metadata_path"],
        "article_metadata_path",
        prefix=("articles", "drafts"),
    )
    metadata, _, metadata_hash = read_json_file(
        metadata_path, "article metadata"
    )
    if metadata.get("article_id") != config["article_id"]:
        raise DraftDataError("article metadata article_id does not match")
    if metadata.get("revision") != config["article_revision"]:
        raise DraftDataError("article metadata revision does not match")
    if metadata.get("status") != "ready_for_image":
        raise DraftDataError("article is not ready for downstream use")
    if metadata.get("quality_gate") != "note-draft-quality":
        raise DraftDataError("article quality gate is missing")
    if metadata.get("quality_gate_completed") is not True:
        raise DraftDataError("article quality gate is incomplete")
    article_created_at = parse_timestamp(
        require_text(
            metadata.get("created_at"),
            "article created_at",
            maximum=100,
            one_line=True,
        )
    )
    selected_title = require_text(
        metadata.get("selected_title"),
        "article selected_title",
        maximum=200,
        one_line=True,
    )
    draft_relative = require_text(
        metadata.get("draft_path"), "article draft_path", maximum=400, one_line=True
    )
    expected_draft = (
        f"articles/drafts/{config['article_id']}-r"
        f"{config['article_revision']:03d}.md"
    )
    if draft_relative != expected_draft:
        raise DraftDataError("article draft_path does not match revision")
    draft_path = safe_workspace_file(
        workspace, draft_relative, "article draft_path", prefix=("articles", "drafts")
    )
    draft_text = draft_path.read_text(encoding="utf-8")
    draft_hash = sha256_text(draft_text)
    if metadata.get("draft_sha256") != draft_hash:
        raise DraftDataError("article draft hash does not match metadata")

    tags = metadata.get("note_tags")
    if not isinstance(tags, list) or not 5 <= len(tags) <= 6:
        raise DraftDataError("article note_tags must contain 5 or 6 items")
    normalized_tags: List[str] = []
    for index, tag in enumerate(tags):
        normalized = require_text(
            tag, f"article note_tags[{index}]", maximum=50, one_line=True
        )
        if normalized.startswith("#") or any(character.isspace() for character in normalized):
            raise DraftDataError("article note tag has invalid format")
        if normalized in normalized_tags:
            raise DraftDataError("article note tags must be unique")
        normalized_tags.append(normalized)
    tag_line = " ".join(f"#{tag}" for tag in normalized_tags)
    suffix = "\n\n" + tag_line + "\n"
    if not draft_text.endswith(suffix):
        raise DraftDataError("article draft tag line does not match metadata")
    body = draft_text[: -len(suffix)]
    if not body.strip():
        raise DraftDataError("article body is empty")

    matching_event: Optional[Dict[str, Any]] = None
    for _, event in iter_jsonl(workspace / "articles/registry.jsonl"):
        if (
            event.get("event_type") == "draft_saved"
            and event.get("article_id") == config["article_id"]
            and event.get("revision") == config["article_revision"]
        ):
            matching_event = event
            break
    if matching_event is None:
        raise DraftDataError("article registry event is missing")
    if matching_event.get("metadata_path") != config["article_metadata_path"]:
        raise DraftDataError("article registry metadata path does not match")
    if matching_event.get("metadata_sha256") != metadata_hash:
        raise DraftDataError("article metadata hash does not match registry")
    if matching_event.get("draft_sha256") != draft_hash:
        raise DraftDataError("article draft hash does not match registry")
    if matching_event.get("external_actions") != []:
        raise DraftDataError("article registry external_actions must be empty")

    return {
        "selected_title": selected_title,
        "article_metadata_path": config["article_metadata_path"],
        "article_metadata_sha256": metadata_hash,
        "draft_path": draft_relative,
        "draft_sha256": draft_hash,
        "body_char_count": len(body),
        "headings": extract_headings(body),
        "note_tags": normalized_tags,
        "tag_line": tag_line,
        "body_urls": extract_urls(body),
        "_article_created_at": article_created_at,
        "_body": body,
    }


def read_asset_source(
    workspace: Path,
    metadata_relative: str,
    *,
    config: Dict[str, Any],
    expected_kind: str,
    selected_title: str,
    article_created_at: str,
) -> Dict[str, Any]:
    metadata_path = safe_workspace_file(
        workspace,
        metadata_relative,
        f"{expected_kind} metadata",
        prefix=("assets", config["article_id"]),
    )
    metadata, _, metadata_hash = read_json_file(
        metadata_path, f"{expected_kind} metadata"
    )
    if metadata.get("article_id") != config["article_id"]:
        raise DraftDataError(f"{expected_kind} article_id does not match")
    if metadata.get("article_revision") != config["article_revision"]:
        raise DraftDataError(f"{expected_kind} article revision does not match")
    if metadata.get("kind") != expected_kind:
        raise DraftDataError(f"asset kind is not {expected_kind}")
    if metadata.get("status") != "ready_for_draft":
        raise DraftDataError(f"{expected_kind} is not ready_for_draft")
    if metadata.get("selected_title") != selected_title:
        raise DraftDataError(f"{expected_kind} title does not match article")
    if metadata.get("metadata_path") != metadata_relative:
        raise DraftDataError(f"{expected_kind} metadata_path does not match")
    if metadata.get("external_actions") != []:
        raise DraftDataError(f"{expected_kind} external_actions must be empty")
    generated_at = parse_timestamp(
        require_text(
            metadata.get("generated_at"),
            f"{expected_kind} generated_at",
            maximum=100,
            one_line=True,
        )
    )
    reviewed_at = parse_timestamp(
        require_text(
            metadata.get("reviewed_at"),
            f"{expected_kind} reviewed_at",
            maximum=100,
            one_line=True,
        )
    )
    saved_at = parse_timestamp(
        require_text(
            metadata.get("saved_at"),
            f"{expected_kind} saved_at",
            maximum=100,
            one_line=True,
        )
    )
    if not (
        timestamp_moment(article_created_at, "article created_at")
        < timestamp_moment(generated_at, f"{expected_kind} generated_at")
        < timestamp_moment(reviewed_at, f"{expected_kind} reviewed_at")
        <= timestamp_moment(saved_at, f"{expected_kind} saved_at")
    ):
        raise DraftDataError(
            f"{expected_kind} timestamps must satisfy article < generated_at < reviewed_at <= saved_at"
        )

    asset_revision = positive_integer(
        metadata.get("asset_revision"), f"{expected_kind} asset_revision"
    )
    width = positive_integer(metadata.get("width"), f"{expected_kind} width")
    height = positive_integer(metadata.get("height"), f"{expected_kind} height")
    expected_dimensions = (1280, 670) if expected_kind == "thumbnail" else (1280, 720)
    if (width, height) != expected_dimensions:
        raise DraftDataError(f"{expected_kind} dimensions do not match contract")

    image_relative = require_text(
        metadata.get("image_path"), f"{expected_kind} image_path", maximum=500
    )
    image_path = safe_workspace_file(
        workspace,
        image_relative,
        f"{expected_kind} image_path",
        prefix=("assets", config["article_id"]),
    )
    image_hash = sha256_bytes(image_path.read_bytes())
    if metadata.get("image_sha256") != image_hash:
        raise DraftDataError(f"{expected_kind} image hash does not match metadata")
    brief_relative = require_text(
        metadata.get("brief_path"), f"{expected_kind} brief_path", maximum=500
    )
    brief_path = safe_workspace_file(
        workspace,
        brief_relative,
        f"{expected_kind} brief_path",
        prefix=("assets", config["article_id"]),
    )
    if metadata.get("brief_sha256") != sha256_bytes(brief_path.read_bytes()):
        raise DraftDataError(f"{expected_kind} brief hash does not match metadata")

    registry = workspace / "assets" / config["article_id"] / "registry.jsonl"
    matching_event: Optional[Dict[str, Any]] = None
    for _, event in iter_jsonl(registry):
        if (
            event.get("event_type") == "image_saved"
            and event.get("kind") == expected_kind
            and event.get("asset_revision") == asset_revision
        ):
            matching_event = event
            break
    if matching_event is None:
        raise DraftDataError(f"{expected_kind} registry event is missing")
    if matching_event.get("metadata_path") != metadata_relative:
        raise DraftDataError(f"{expected_kind} registry metadata path does not match")
    if matching_event.get("metadata_sha256") != metadata_hash:
        raise DraftDataError(f"{expected_kind} metadata hash does not match registry")
    if matching_event.get("image_sha256") != image_hash:
        raise DraftDataError(f"{expected_kind} image hash does not match registry")
    if matching_event.get("external_actions") != []:
        raise DraftDataError(f"{expected_kind} registry external_actions must be empty")

    insertion_heading = metadata.get("insertion_heading")
    insertion_after = metadata.get("insertion_after")
    caption = metadata.get("caption")
    alt = metadata.get("alt")
    if expected_kind == "thumbnail":
        if any(item is not None for item in (insertion_heading, insertion_after, caption, alt)):
            raise DraftDataError("thumbnail must not contain inline placement fields")
    else:
        for label, item, maximum in (
            ("insertion_heading", insertion_heading, 300),
            ("insertion_after", insertion_after, 500),
            ("caption", caption, 300),
            ("alt", alt, 80),
        ):
            require_text(item, f"inline {label}", maximum=maximum, one_line=True)

    return {
        "kind": expected_kind,
        "asset_revision": asset_revision,
        "metadata_path": metadata_relative,
        "metadata_sha256": metadata_hash,
        "image_path": image_relative,
        "image_sha256": image_hash,
        "width": width,
        "height": height,
        "insertion_heading": insertion_heading,
        "insertion_after": insertion_after,
        "caption": caption,
        "alt": alt,
        "_generated_at": generated_at,
        "_reviewed_at": reviewed_at,
        "_saved_at": saved_at,
    }


def _public_asset_summary(asset: Dict[str, Any]) -> Dict[str, Any]:
    return {key: asset[key] for key in ASSET_SUMMARY_KEYS}


def _validate_insertion_anchor(
    body: str,
    headings: List[Dict[str, Any]],
    *,
    heading: str,
    after: str,
    label: str,
) -> None:
    if sum(item["text"] == heading for item in headings) != 1:
        raise DraftDataError(f"{label} heading must exist exactly once in the article")
    marker_pattern = re.compile(
        r"^\[(?:大見出し|小見出し)\]\s*" + re.escape(heading) + r"\s*$",
        re.MULTILINE,
    )
    marker_matches = list(marker_pattern.finditer(body))
    if len(marker_matches) != 1:
        raise DraftDataError(f"{label} heading marker is ambiguous")
    after_matches = list(re.finditer(re.escape(after), body))
    if len(after_matches) != 1:
        raise DraftDataError(f"{label} paragraph anchor must exist exactly once")
    heading_position = marker_matches[0].start()
    after_position = after_matches[0].start()
    if after_position <= marker_matches[0].end():
        raise DraftDataError(f"{label} paragraph anchor must follow its heading")
    heading_markers = list(
        re.finditer(r"^\[(?:大見出し|小見出し)\]\s*.*$", body, re.MULTILINE)
    )
    next_positions = [
        match.start() for match in heading_markers if match.start() > heading_position
    ]
    if next_positions and after_position >= min(next_positions):
        raise DraftDataError(f"{label} paragraph anchor must be inside its heading section")


def build_registration_source(workspace: Path, config: Dict[str, Any]) -> Dict[str, Any]:
    article = read_article_source(workspace, config)
    thumbnail_source = read_asset_source(
        workspace,
        config["thumbnail_metadata_path"],
        config=config,
        expected_kind="thumbnail",
        selected_title=article["selected_title"],
        article_created_at=article["_article_created_at"],
    )
    inline_sources = [
        read_asset_source(
            workspace,
            path,
            config=config,
            expected_kind="inline",
            selected_title=article["selected_title"],
            article_created_at=article["_article_created_at"],
        )
        for path in config["inline_metadata_paths"]
    ]
    positions = set()
    for image in inline_sources:
        position = (image["insertion_heading"], image["insertion_after"])
        if position in positions:
            raise DraftDataError("inline images must not share the same insertion position")
        positions.add(position)
        _validate_insertion_anchor(
            article["_body"],
            article["headings"],
            heading=image["insertion_heading"],
            after=image["insertion_after"],
            label="inline image insertion",
        )
    for link in config["additional_links"]:
        _validate_insertion_anchor(
            article["_body"],
            article["headings"],
            heading=link["insertion_heading"],
            after=link["insertion_after"],
            label="additional link insertion",
        )
    completion_times = [
        article["_article_created_at"],
        thumbnail_source["_saved_at"],
    ]
    for image in inline_sources:
        completion_times.append(image["_saved_at"])
    return {
        **article,
        "additional_links": config["additional_links"],
        "thumbnail": _public_asset_summary(thumbnail_source),
        "inline_images": [_public_asset_summary(image) for image in inline_sources],
        "_completion_times": completion_times,
    }


def validate_approval_timing(
    config: Dict[str, Any], source: Dict[str, Any], package_created_at: str
) -> None:
    expected_delivery = delivery_manifest_sha256(source)
    if config["approval"]["delivery_sha256"] != expected_delivery:
        raise DraftDataError(
            "approval delivery hash does not match the completed article and images"
        )
    approved = timestamp_moment(config["approval"]["approved_at"], "approval.approved_at")
    completion = max(
        timestamp_moment(value, "completion timestamp")
        for value in source["_completion_times"]
    )
    if approved <= completion:
        raise DraftDataError(
            "approval must be recorded after the article and every reviewed image is saved"
        )
    if timestamp_moment(package_created_at, "registration created_at") < approved:
        raise DraftDataError("registration created_at must not be earlier than approval")


def delivery_manifest(source: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "selected_title": source["selected_title"],
        "article_metadata_path": source["article_metadata_path"],
        "article_metadata_sha256": source["article_metadata_sha256"],
        "draft_path": source["draft_path"],
        "draft_sha256": source["draft_sha256"],
        "headings": source["headings"],
        "note_tags": source["note_tags"],
        "tag_line": source["tag_line"],
        "body_urls": source["body_urls"],
        "additional_links": source["additional_links"],
        "thumbnail": source["thumbnail"],
        "inline_images": source["inline_images"],
    }


def delivery_manifest_sha256(source: Dict[str, Any]) -> str:
    return canonical_hash(delivery_manifest(source))


def ensure_latest_article_revision(
    workspace: Path, article_id: str, article_revision: int
) -> None:
    revisions: List[int] = []
    for _, event in iter_jsonl(workspace / "articles/registry.jsonl"):
        if event.get("event_type") != "draft_saved" or event.get("article_id") != article_id:
            continue
        revision = event.get("revision")
        if isinstance(revision, bool) or not isinstance(revision, int):
            raise DraftDataError("article registry revision is invalid")
        revisions.append(revision)
    if not revisions or article_revision != max(revisions):
        raise DraftDataError(
            "only the latest article revision may receive a new note draft approval"
        )


def registration_payload_hash(config: Dict[str, Any], source: Dict[str, Any]) -> str:
    return canonical_hash({"config": config, "source": source})


def build_registration_package(
    config: Dict[str, Any],
    source: Dict[str, Any],
    *,
    registration_revision: int,
    created_at: str,
    registration_path: str,
) -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "request_id": config["request_id"],
        "payload_sha256": registration_payload_hash(config, source),
        "article_id": config["article_id"],
        "article_revision": config["article_revision"],
        "registration_revision": registration_revision,
        "created_at": created_at,
        "status": "approved_for_new_draft",
        "target": "new_note_draft",
        "approval": config["approval"],
        "selected_title": source["selected_title"],
        "article_metadata_path": source["article_metadata_path"],
        "article_metadata_sha256": source["article_metadata_sha256"],
        "draft_path": source["draft_path"],
        "draft_sha256": source["draft_sha256"],
        "body_char_count": source["body_char_count"],
        "headings": source["headings"],
        "note_tags": source["note_tags"],
        "tag_line": source["tag_line"],
        "body_urls": source["body_urls"],
        "additional_links": source["additional_links"],
        "thumbnail": source["thumbnail"],
        "inline_images": source["inline_images"],
        "registration_path": registration_path,
        "external_actions": [],
    }


def package_to_config(package: Dict[str, Any]) -> Dict[str, Any]:
    thumbnail = require_object(package.get("thumbnail"), "registration thumbnail")
    inline_images = package.get("inline_images")
    if not isinstance(inline_images, list):
        raise DraftDataError("registration inline_images must be an array")
    inline_paths: List[str] = []
    for index, item in enumerate(inline_images):
        asset = require_object(item, f"registration inline_images[{index}]")
        inline_paths.append(asset.get("metadata_path"))
    return normalize_registration_input(
        {
            "schema_version": package.get("schema_version"),
            "request_id": package.get("request_id"),
            "article_id": package.get("article_id"),
            "article_revision": package.get("article_revision"),
            "article_metadata_path": package.get("article_metadata_path"),
            "thumbnail_metadata_path": thumbnail.get("metadata_path"),
            "inline_metadata_paths": inline_paths,
            "additional_links": package.get("additional_links"),
            "approval": package.get("approval"),
        }
    )


def validate_registration_object(
    workspace: Path, package: Dict[str, Any], label: str
) -> Dict[str, Any]:
    check_exact_keys(package, label=label, expected=PACKAGE_KEYS)
    config = package_to_config(package)
    revision = positive_integer(
        package.get("registration_revision"), f"{label}.registration_revision"
    )
    parse_timestamp(
        require_text(package.get("created_at"), f"{label}.created_at", maximum=100)
    )
    if package.get("status") != "approved_for_new_draft":
        raise DraftDataError(f"{label}.status is invalid")
    if package.get("target") != "new_note_draft":
        raise DraftDataError(f"{label}.target must be new_note_draft")
    expected_path = (
        f"articles/note-drafts/{config['article_id']}-registration-r{revision:03d}.json"
    )
    if package.get("registration_path") != expected_path:
        raise DraftDataError(f"{label}.registration_path does not match revision")
    if package.get("external_actions") != []:
        raise DraftDataError(f"{label}.external_actions must be empty")

    source = build_registration_source(workspace, config)
    validate_approval_timing(config, source, package["created_at"])
    for field in (
        "selected_title",
        "article_metadata_path",
        "article_metadata_sha256",
        "draft_path",
        "draft_sha256",
        "body_char_count",
        "headings",
        "note_tags",
        "tag_line",
        "body_urls",
        "additional_links",
        "thumbnail",
        "inline_images",
    ):
        if package.get(field) != source[field]:
            raise DraftDataError(f"{label}.{field} does not match current source")
    expected_payload = registration_payload_hash(config, source)
    if package.get("payload_sha256") != expected_payload:
        raise DraftDataError(f"{label}.payload_sha256 does not match")
    return config


def load_registration(
    workspace: Path, relative: str
) -> Tuple[Dict[str, Any], str, str]:
    path = safe_workspace_file(
        workspace,
        relative,
        "registration_path",
        prefix=("articles", "note-drafts"),
    )
    package, text, digest = read_json_file(path, "draft registration")
    validate_registration_object(workspace, package, "draft registration")
    if package.get("registration_path") != relative:
        raise DraftDataError("registration_path does not match requested package")
    return package, text, digest


def load_all_registrations(workspace: Path) -> List[Dict[str, Any]]:
    directory = workspace / "articles/note-drafts"
    if not directory.exists():
        return []
    if not directory.is_dir() or directory.is_symlink():
        raise DraftDataError("articles/note-drafts is unsafe")
    result: List[Dict[str, Any]] = []
    for path in sorted(directory.glob("article-*-registration-r*.json")):
        relative = path.relative_to(workspace).as_posix()
        package, _, _ = load_registration(workspace, relative)
        result.append(package)
    return result


def expected_urls(package: Dict[str, Any]) -> List[str]:
    result: List[str] = []
    for url in package["body_urls"]:
        if url not in result:
            result.append(url)
    for item in package["additional_links"]:
        if item["url"] not in result:
            result.append(item["url"])
    return result


def normalize_url_results(value: Any) -> List[Dict[str, str]]:
    if not isinstance(value, list) or len(value) > 70:
        raise DraftDataError("url_results must be an array with at most 70 items")
    result: List[Dict[str, str]] = []
    seen = set()
    for index, raw in enumerate(value):
        item = require_object(raw, f"url_results[{index}]")
        check_exact_keys(
            item, label=f"url_results[{index}]", expected=URL_RESULT_KEYS
        )
        url = normalize_url(item.get("url"), f"url_results[{index}].url")
        if url in seen:
            raise DraftDataError("url_results must not contain duplicate URLs")
        display = item.get("display")
        if display not in {"ogp", "link"}:
            raise DraftDataError("url result display must be ogp or link")
        seen.add(url)
        result.append({"url": url, "display": display})
    return result


def normalize_result_input(raw: Any) -> Dict[str, Any]:
    value = require_object(raw, "draft result config")
    check_exact_keys(value, label="draft result config", expected=RESULT_INPUT_KEYS)
    if value.get("schema_version") != SCHEMA_VERSION:
        raise DraftDataError("result schema_version is not supported")
    request_id = require_text(
        value.get("request_id"), "result request_id", maximum=128, one_line=True
    )
    if REQUEST_ID_PATTERN.fullmatch(request_id) is None:
        raise DraftDataError("result request_id has invalid format")
    checks_true = (
        "title_verified",
        "body_start_verified",
        "body_end_verified",
        "headings_verified",
        "tags_verified",
        "thumbnail_verified",
        "inline_images_verified",
        "editor_closed",
        "private_draft_confirmed",
    )
    for field in checks_true:
        if value.get(field) is not True:
            raise DraftDataError(f"{field} must be true before recording success")
    checks_false = (
        "publish_screen_opened",
        "published",
        "scheduled",
        "existing_draft_overwritten",
    )
    for field in checks_false:
        if value.get(field) is not False:
            raise DraftDataError(f"{field} must be false")
    registration_path = require_text(
        value.get("registration_path"),
        "registration_path",
        maximum=500,
        one_line=True,
    )
    relative_path(
        registration_path, "registration_path", prefix=("articles", "note-drafts")
    )
    result: Dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "request_id": request_id,
        "registration_path": registration_path,
        "completed_at": parse_timestamp(
            require_text(
                value.get("completed_at"),
                "completed_at",
                maximum=100,
                one_line=True,
            )
        ),
        "adapter_label": require_text(
            value.get("adapter_label"), "adapter_label", maximum=200, one_line=True
        ),
        "draft_url": normalize_url(value.get("draft_url"), "draft_url", note_only=True),
        "url_results": normalize_url_results(value.get("url_results")),
    }
    for field in checks_true:
        result[field] = True
    for field in checks_false:
        result[field] = False
    return result


def result_payload_hash(
    config: Dict[str, Any], registration_sha256: str
) -> str:
    return canonical_hash(
        {"config": config, "registration_sha256": registration_sha256}
    )


def build_result(
    config: Dict[str, Any],
    package: Dict[str, Any],
    *,
    registration_sha256: str,
    result_path: str,
) -> Dict[str, Any]:
    return {
        **config,
        "payload_sha256": result_payload_hash(config, registration_sha256),
        "article_id": package["article_id"],
        "article_revision": package["article_revision"],
        "registration_revision": package["registration_revision"],
        "status": "saved_private_draft",
        "registration_sha256": registration_sha256,
        "result_path": result_path,
        "external_actions": ["note:new_private_draft_saved"],
    }


def result_to_config(result: Dict[str, Any]) -> Dict[str, Any]:
    return normalize_result_input({key: result.get(key) for key in RESULT_INPUT_KEYS})


def validate_result_object(
    workspace: Path, result: Dict[str, Any], label: str
) -> Dict[str, Any]:
    check_exact_keys(result, label=label, expected=RESULT_KEYS)
    config = result_to_config(result)
    package, _, registration_hash = load_registration(
        workspace, config["registration_path"]
    )
    if result.get("article_id") != package["article_id"]:
        raise DraftDataError(f"{label}.article_id does not match registration")
    if result.get("article_revision") != package["article_revision"]:
        raise DraftDataError(f"{label}.article_revision does not match registration")
    if result.get("registration_revision") != package["registration_revision"]:
        raise DraftDataError(f"{label}.registration_revision does not match")
    if result.get("registration_sha256") != registration_hash:
        raise DraftDataError(f"{label}.registration_sha256 does not match")
    if result.get("status") != "saved_private_draft":
        raise DraftDataError(f"{label}.status is invalid")
    expected_result_path = (
        f"articles/note-drafts/{package['article_id']}-result-r"
        f"{package['registration_revision']:03d}.json"
    )
    if result.get("result_path") != expected_result_path:
        raise DraftDataError(f"{label}.result_path does not match registration")
    if result.get("external_actions") != ["note:new_private_draft_saved"]:
        raise DraftDataError(f"{label}.external_actions is invalid")
    if [item["url"] for item in config["url_results"]] != expected_urls(package):
        raise DraftDataError(f"{label}.url_results do not match expected URLs")
    expected_payload = result_payload_hash(config, registration_hash)
    if result.get("payload_sha256") != expected_payload:
        raise DraftDataError(f"{label}.payload_sha256 does not match")
    return config


def load_result(
    workspace: Path, relative: str
) -> Tuple[Dict[str, Any], str, str]:
    path = safe_workspace_file(
        workspace,
        relative,
        "result_path",
        prefix=("articles", "note-drafts"),
    )
    result, text, digest = read_json_file(path, "draft result")
    validate_result_object(workspace, result, "draft result")
    if result.get("result_path") != relative:
        raise DraftDataError("result_path does not match requested result")
    return result, text, digest


def load_all_results(workspace: Path) -> List[Dict[str, Any]]:
    directory = workspace / "articles/note-drafts"
    if not directory.exists():
        return []
    result: List[Dict[str, Any]] = []
    for path in sorted(directory.glob("article-*-result-r*.json")):
        relative = path.relative_to(workspace).as_posix()
        value, _, _ = load_result(workspace, relative)
        result.append(value)
    return result


def build_start_event(
    package: Dict[str, Any], registration_sha256: str, created_at: str
) -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "event_type": "note_draft_started",
        "request_id": package["request_id"],
        "article_id": package["article_id"],
        "article_revision": package["article_revision"],
        "registration_revision": package["registration_revision"],
        "created_at": created_at,
        "status": "external_write_started",
        "registration_path": package["registration_path"],
        "registration_sha256": registration_sha256,
        "external_actions": [],
    }


def build_saved_event(
    package: Dict[str, Any],
    result: Dict[str, Any],
    *,
    registration_sha256: str,
    result_sha256: str,
) -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "event_type": "note_draft_saved",
        "request_id": result["request_id"],
        "article_id": package["article_id"],
        "article_revision": package["article_revision"],
        "registration_revision": package["registration_revision"],
        "created_at": result["completed_at"],
        "status": "saved_private_draft",
        "registration_path": package["registration_path"],
        "registration_sha256": registration_sha256,
        "result_path": result["result_path"],
        "result_sha256": result_sha256,
        "draft_url": result["draft_url"],
        "external_actions": ["note:new_private_draft_saved"],
    }


def validate_event(
    workspace: Path, event: Dict[str, Any], label: str
) -> str:
    event_type = event.get("event_type")
    if event_type == "note_draft_started":
        check_exact_keys(event, label=label, expected=START_EVENT_KEYS)
        if event.get("status") != "external_write_started":
            raise DraftDataError(f"{label}.status is invalid")
        if event.get("external_actions") != []:
            raise DraftDataError(f"{label}.external_actions must be empty")
    elif event_type == "note_draft_saved":
        check_exact_keys(event, label=label, expected=SAVED_EVENT_KEYS)
        if event.get("status") != "saved_private_draft":
            raise DraftDataError(f"{label}.status is invalid")
        if event.get("external_actions") != ["note:new_private_draft_saved"]:
            raise DraftDataError(f"{label}.external_actions is invalid")
    else:
        raise DraftDataError(f"{label}.event_type is invalid")

    request_id = require_text(
        event.get("request_id"), f"{label}.request_id", maximum=128, one_line=True
    )
    if REQUEST_ID_PATTERN.fullmatch(request_id) is None:
        raise DraftDataError(f"{label}.request_id has invalid format")
    parse_timestamp(
        require_text(event.get("created_at"), f"{label}.created_at", maximum=100)
    )
    package, _, package_hash = load_registration(
        workspace,
        require_text(
            event.get("registration_path"),
            f"{label}.registration_path",
            maximum=500,
        ),
    )
    for field in ("article_id", "article_revision", "registration_revision"):
        if event.get(field) != package[field]:
            raise DraftDataError(f"{label}.{field} does not match registration")
    if event.get("registration_sha256") != package_hash:
        raise DraftDataError(f"{label}.registration_sha256 does not match")
    if event_type == "note_draft_started":
        if event.get("request_id") != package["request_id"]:
            raise DraftDataError(f"{label}.request_id does not match registration")
    else:
        result, _, result_hash = load_result(
            workspace,
            require_text(event.get("result_path"), f"{label}.result_path", maximum=500),
        )
        if event.get("request_id") != result["request_id"]:
            raise DraftDataError(f"{label}.request_id does not match result")
        if event.get("result_sha256") != result_hash:
            raise DraftDataError(f"{label}.result_sha256 does not match")
        if event.get("draft_url") != result["draft_url"]:
            raise DraftDataError(f"{label}.draft_url does not match result")
    return event_type


def note_draft_directory(workspace: Path, *, create: bool = False) -> Path:
    path = workspace / "articles/note-drafts"
    if path.exists():
        if not path.is_dir() or path.is_symlink():
            raise DraftDataError("articles/note-drafts is unsafe")
        return path
    if not create:
        raise DraftDataError("articles/note-drafts is missing")
    path.mkdir(mode=0o700)
    return path


def ensure_store(workspace: Path) -> Tuple[Path, Path]:
    directory = note_draft_directory(workspace, create=True)
    registry = directory / "registry.jsonl"
    if registry.exists():
        if not registry.is_file() or registry.is_symlink():
            raise DraftDataError("note draft registry is unsafe")
    else:
        write_new_text(registry, "\n")
    return directory, registry


def read_events(workspace: Path) -> List[Dict[str, Any]]:
    directory = workspace / "articles/note-drafts"
    if not directory.exists():
        return []
    registry = directory / "registry.jsonl"
    if not registry.is_file() or registry.is_symlink():
        raise DraftDataError("note draft registry is missing or unsafe")
    return [event for _, event in iter_jsonl(registry)]


def validate_note_draft_data(workspace: Path) -> Tuple[List[str], Dict[str, int]]:
    errors: List[str] = []
    counts = {
        "registration_count": 0,
        "started_count": 0,
        "saved_count": 0,
        "pending_count": 0,
    }
    directory = workspace / "articles/note-drafts"
    if not directory.exists():
        return errors, counts
    if not directory.is_dir() or directory.is_symlink():
        return ["articles/note-drafts is unsafe"], counts

    known_json = set()
    try:
        registrations = load_all_registrations(workspace)
        counts["registration_count"] = len(registrations)
        known_json.update(package["registration_path"] for package in registrations)
    except (OSError, UnicodeError, DraftDataError, json.JSONDecodeError) as exc:
        errors.append(str(exc))
        registrations = []
    try:
        results = load_all_results(workspace)
        known_json.update(result["result_path"] for result in results)
    except (OSError, UnicodeError, DraftDataError, json.JSONDecodeError) as exc:
        errors.append(str(exc))
        results = []

    for path in directory.glob("*.json"):
        relative = path.relative_to(workspace).as_posix()
        if relative not in known_json:
            errors.append(f"unexpected note draft JSON file: {relative}")

    revisions: Dict[str, List[int]] = {}
    registration_requests = set()
    for package in registrations:
        request_id = package["request_id"]
        if request_id in registration_requests:
            errors.append(f"duplicate registration request_id: {request_id}")
        registration_requests.add(request_id)
        revisions.setdefault(package["article_id"], []).append(
            package["registration_revision"]
        )
    for article_id, values in revisions.items():
        ordered = sorted(values)
        if ordered != list(range(1, len(ordered) + 1)):
            errors.append(f"registration revisions are not contiguous: {article_id}")

    result_by_registration: Dict[str, Dict[str, Any]] = {}
    result_requests = set()
    for result in results:
        if result["request_id"] in result_requests:
            errors.append(f"duplicate result request_id: {result['request_id']}")
        result_requests.add(result["request_id"])
        registration_path = result["registration_path"]
        if registration_path in result_by_registration:
            errors.append(f"multiple results for registration: {registration_path}")
        result_by_registration[registration_path] = result

    try:
        events = read_events(workspace)
    except (OSError, UnicodeError, DraftDataError, json.JSONDecodeError) as exc:
        errors.append(str(exc))
        events = []

    started = set()
    saved = set()
    event_requests = set()
    for index, event in enumerate(events, start=1):
        label = f"note draft registry event {index}"
        try:
            event_type = validate_event(workspace, event, label)
        except (OSError, UnicodeError, DraftDataError, json.JSONDecodeError) as exc:
            errors.append(str(exc))
            continue
        request_key = (event_type, event["request_id"])
        if request_key in event_requests:
            errors.append(f"duplicate event request: {event_type} {event['request_id']}")
        event_requests.add(request_key)
        path = event["registration_path"]
        if event_type == "note_draft_started":
            if path in started:
                errors.append(f"registration started more than once: {path}")
            if path in saved:
                errors.append(f"registration started after save: {path}")
            started.add(path)
        else:
            if path not in started:
                errors.append(f"registration saved without start: {path}")
            if path in saved:
                errors.append(f"registration saved more than once: {path}")
            saved.add(path)

    for registration_path in result_by_registration:
        if registration_path not in saved:
            errors.append(f"result has no saved registry event: {registration_path}")
    for registration_path in saved:
        if registration_path not in result_by_registration:
            errors.append(f"saved registry event has no result: {registration_path}")

    counts["started_count"] = len(started)
    counts["saved_count"] = len(saved)
    counts["pending_count"] = len(started - saved)
    return errors, counts


def write_new_text(path: Path, text: str) -> None:
    if path.exists() or path.is_symlink():
        raise DraftDataError(f"refusing to overwrite existing file: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8") as handle:
        handle.write(text)
        handle.flush()
        os.fsync(handle.fileno())


def append_jsonl(path: Path, value: Dict[str, Any]) -> int:
    if not path.is_file() or path.is_symlink():
        raise DraftDataError("registry is missing or unsafe")
    previous_size = path.stat().st_size
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(value, ensure_ascii=False, sort_keys=True) + "\n")
        handle.flush()
        os.fsync(handle.fileno())
    return previous_size


def truncate_file(path: Path, size: int) -> None:
    with path.open("r+b") as handle:
        handle.truncate(size)
        handle.flush()
        os.fsync(handle.fileno())


@contextmanager
def draft_lock(workspace: Path, created_at: str) -> Iterator[None]:
    lock = workspace / "articles/.note-draft.lock"
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise DraftDataError("another note draft write is already in progress") from exc
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(created_at + "\n")
            handle.flush()
            os.fsync(handle.fileno())
        yield
    finally:
        try:
            lock.unlink()
        except FileNotFoundError:
            pass
