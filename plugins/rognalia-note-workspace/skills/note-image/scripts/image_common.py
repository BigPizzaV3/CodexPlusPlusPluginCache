#!/usr/bin/env python3
"""Shared validation and storage helpers for note-image."""

from __future__ import annotations

import binascii
import hashlib
import json
import os
import re
import struct
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Sequence, Tuple

from png_resize import PngResizeError, resize_png_bytes


SCHEMA_VERSION = 1
MAX_IMAGE_BYTES = 50_000_000
REQUEST_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._:-]{7,127}$")
ARTICLE_ID_PATTERN = re.compile(r"^article-[a-z0-9][a-z0-9-]{2,63}$")
HASH_PATTERN = re.compile(r"^[0-9a-f]{64}$")
URL_PATTERN = re.compile(r"(?:https?://|www\.)", re.IGNORECASE)

BRIEF_INPUT_KEYS = {
    "schema_version",
    "request_id",
    "article_id",
    "article_revision",
    "article_metadata_path",
    "kind",
    "selected_title",
    "reader_reason",
    "article_hook",
    "subject_scene",
    "design_structure",
    "visual_style",
    "exact_copy",
    "copy_rendering",
    "forbidden_elements",
    "reference_image_count",
    "reference_guidance",
    "inline_approved",
    "insertion_heading",
    "insertion_after",
    "generation_capability",
}

BRIEF_KEYS = BRIEF_INPUT_KEYS | {
    "article_metadata_sha256",
    "brief_revision",
    "created_at",
    "status",
    "target_width",
    "target_height",
    "brief_path",
    "payload_sha256",
    "external_actions",
}

QA_KEYS = {
    "schema_version",
    "request_id",
    "brief_path",
    "generated_at",
    "reviewed_at",
    "generation_attempts",
    "generator_label",
    "visual_review_completed",
    "article_match",
    "anatomy_integrity",
    "crop_safety",
    "text_accuracy",
    "extra_text_absent",
    "small_preview_readability",
    "preview_sha256",
    "visual_copy_integration",
    "unresolved_issues",
    "caption",
    "alt",
}

ASSET_METADATA_KEYS = {
    "schema_version",
    "request_id",
    "payload_sha256",
    "article_id",
    "article_revision",
    "kind",
    "asset_revision",
    "generated_at",
    "saved_at",
    "status",
    "selected_title",
    "brief_path",
    "brief_sha256",
    "image_path",
    "image_sha256",
    "image_format",
    "width",
    "height",
    "preview_path",
    "preview_sha256",
    "preview_source_sha256",
    "preview_width",
    "preview_height",
    "generation_attempts",
    "generator_label",
    "reviewed_at",
    "visual_review_completed",
    "article_match",
    "anatomy_integrity",
    "crop_safety",
    "text_accuracy",
    "extra_text_absent",
    "small_preview_readability",
    "visual_copy_integration",
    "unresolved_issues",
    "insertion_heading",
    "insertion_after",
    "caption",
    "alt",
    "metadata_path",
    "external_actions",
}

IMAGE_EVENT_KEYS = {
    "schema_version",
    "event_type",
    "request_id",
    "payload_sha256",
    "article_id",
    "article_revision",
    "kind",
    "asset_revision",
    "generated_at",
    "reviewed_at",
    "saved_at",
    "status",
    "selected_title",
    "brief_path",
    "brief_sha256",
    "image_path",
    "image_sha256",
    "preview_path",
    "preview_sha256",
    "preview_source_sha256",
    "preview_width",
    "preview_height",
    "metadata_path",
    "metadata_sha256",
    "width",
    "height",
    "caption",
    "alt",
    "external_actions",
}


class ImageDataError(ValueError):
    """Raised when image data violates the local production contract."""


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
        raise ImageDataError(f"{label} must be an object")
    return value


def check_exact_keys(
    value: Dict[str, Any], *, label: str, expected: Sequence[str]
) -> None:
    expected_set = set(expected)
    actual = set(value)
    missing = sorted(expected_set - actual)
    extra = sorted(actual - expected_set)
    if missing:
        raise ImageDataError(f"{label} is missing fields: {', '.join(missing)}")
    if extra:
        raise ImageDataError(f"{label} has unexpected fields: {', '.join(extra)}")


def require_text(
    value: Any,
    label: str,
    *,
    maximum: int,
    one_line: bool = False,
) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ImageDataError(f"{label} must be non-empty text")
    normalized = value.strip()
    if len(normalized) > maximum:
        raise ImageDataError(f"{label} is too long")
    if one_line and any(character in normalized for character in ("\n", "\r")):
        raise ImageDataError(f"{label} must be one line")
    return normalized


def nullable_text(
    value: Any,
    label: str,
    *,
    maximum: int,
    one_line: bool = False,
) -> Optional[str]:
    if value is None:
        return None
    return require_text(value, label, maximum=maximum, one_line=one_line)


def positive_integer(value: Any, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ImageDataError(f"{label} must be a positive integer")
    return value


def bounded_integer(value: Any, label: str, minimum: int, maximum: int) -> int:
    if (
        isinstance(value, bool)
        or not isinstance(value, int)
        or not minimum <= value <= maximum
    ):
        raise ImageDataError(f"{label} must be between {minimum} and {maximum}")
    return value


def parse_timestamp(value: Optional[str]) -> str:
    if value is None:
        moment = datetime.now(timezone.utc).astimezone()
    else:
        normalized = value.strip().replace("Z", "+00:00")
        try:
            moment = datetime.fromisoformat(normalized)
        except ValueError as exc:
            raise ImageDataError("timestamp must be ISO 8601") from exc
        if moment.tzinfo is None:
            raise ImageDataError("timestamp must include a timezone")
    return moment.isoformat(timespec="seconds")


def timestamp_moment(value: str, label: str) -> datetime:
    try:
        moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (AttributeError, ValueError) as exc:
        raise ImageDataError(f"{label} must be ISO 8601") from exc
    if moment.tzinfo is None:
        raise ImageDataError(f"{label} must include a timezone")
    return moment


def load_json_argument(value: str, label: str) -> Dict[str, Any]:
    if value == "-":
        import sys

        text = sys.stdin.read()
    else:
        path = Path(value)
        if not path.is_file() or path.is_symlink():
            raise ImageDataError(f"{label} file is missing or unsafe")
        text = path.read_text(encoding="utf-8")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ImageDataError(f"{label} is invalid JSON") from exc
    return require_object(parsed, label)


def resolve_workspace(value: str) -> Path:
    candidate = Path(value)
    if not candidate.is_absolute():
        raise ImageDataError("workspace path must be absolute")
    if not candidate.is_dir() or candidate.is_symlink():
        raise ImageDataError("workspace path is missing or unsafe")
    workspace = candidate.resolve()
    manifest_path = workspace / "workspace.json"
    if not manifest_path.is_file() or manifest_path.is_symlink():
        raise ImageDataError("workspace.json is missing or unsafe")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ImageDataError("workspace.json is invalid") from exc
    if not isinstance(manifest, dict) or manifest.get("product_id") != "note-workspace":
        raise ImageDataError("workspace is not a note Workspace")
    if manifest.get("schema_version") != SCHEMA_VERSION:
        raise ImageDataError("workspace schema_version is not supported")
    if manifest.get("status") != "ready":
        raise ImageDataError(
            "workspace is not ready; migration or hold must be resolved first"
        )
    if manifest.get("data_owner") != "user":
        raise ImageDataError("workspace data_owner must be user")
    for relative in (
        "articles",
        "articles/drafts",
        "context-packs",
        "assets",
    ):
        path = workspace / relative
        if not path.is_dir() or path.is_symlink():
            raise ImageDataError(f"workspace path is missing or unsafe: {relative}")
    registry = workspace / "articles/registry.jsonl"
    if not registry.is_file() or registry.is_symlink():
        raise ImageDataError("articles/registry.jsonl is missing or unsafe")
    return workspace


def relative_path(
    value: Any,
    label: str,
    *,
    prefix: Tuple[str, ...],
) -> Path:
    text = require_text(value, label, maximum=400, one_line=True)
    relative = Path(text)
    if relative.is_absolute() or ".." in relative.parts:
        raise ImageDataError(f"{label} is unsafe")
    if relative.parts[: len(prefix)] != prefix:
        raise ImageDataError(f"{label} must be inside {'/'.join(prefix)}")
    return relative


def safe_workspace_file(
    workspace: Path,
    value: Any,
    label: str,
    *,
    prefix: Tuple[str, ...],
) -> Path:
    relative = relative_path(value, label, prefix=prefix)
    path = workspace / relative
    if not path.is_file() or path.is_symlink() or path.parent.is_symlink():
        raise ImageDataError(f"{label} is missing or unsafe")
    return path


def safe_article_directory(
    workspace: Path, article_id: str, *, create: bool = False
) -> Path:
    if ARTICLE_ID_PATTERN.fullmatch(article_id) is None:
        raise ImageDataError("article_id has invalid format")
    path = workspace / "assets" / article_id
    if path.is_symlink():
        raise ImageDataError("article asset directory is unsafe")
    if path.exists():
        if not path.is_dir():
            raise ImageDataError("article asset path is not a directory")
        return path
    if not create:
        raise ImageDataError("article asset directory is missing")
    try:
        path.mkdir(mode=0o700)
    except FileExistsError as exc:
        raise ImageDataError("article asset directory appeared during write") from exc
    if path.is_symlink() or not path.is_dir():
        raise ImageDataError("article asset directory is unsafe")
    return path


def iter_jsonl(path: Path) -> Iterator[Tuple[int, Dict[str, Any]]]:
    if not path.is_file() or path.is_symlink():
        raise ImageDataError(f"JSONL file is missing or unsafe: {path}")
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ImageDataError(f"{path}:{line_number} is invalid JSON") from exc
            if not isinstance(value, dict):
                raise ImageDataError(f"{path}:{line_number} must be an object")
            yield line_number, value


def read_article_source(
    workspace: Path, config: Dict[str, Any]
) -> Tuple[Dict[str, Any], str, str]:
    expected_metadata = (
        f"articles/drafts/{config['article_id']}-r"
        f"{config['article_revision']:03d}.json"
    )
    if config["article_metadata_path"] != expected_metadata:
        raise ImageDataError("article_metadata_path does not match article revision")
    path = safe_workspace_file(
        workspace,
        config["article_metadata_path"],
        "article_metadata_path",
        prefix=("articles", "drafts"),
    )
    text = path.read_text(encoding="utf-8")
    try:
        metadata = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ImageDataError("article metadata is invalid JSON") from exc
    metadata = require_object(metadata, "article metadata")
    if metadata.get("article_id") != config["article_id"]:
        raise ImageDataError("article metadata article_id does not match")
    if metadata.get("revision") != config["article_revision"]:
        raise ImageDataError("article metadata revision does not match")
    if metadata.get("selected_title") != config["selected_title"]:
        raise ImageDataError("selected_title does not match article metadata")
    if metadata.get("status") != "ready_for_image":
        raise ImageDataError("article is not ready_for_image")
    if metadata.get("quality_gate") != "note-draft-quality":
        raise ImageDataError("article quality gate is missing")

    metadata_hash = sha256_text(text)
    matching_event: Optional[Dict[str, Any]] = None
    for _, event in iter_jsonl(workspace / "articles/registry.jsonl"):
        if (
            event.get("event_type") == "draft_saved"
            and event.get("metadata_path") == config["article_metadata_path"]
        ):
            matching_event = event
            break
    if matching_event is None:
        raise ImageDataError("article registry event is missing")
    if matching_event.get("metadata_sha256") != metadata_hash:
        raise ImageDataError("article metadata hash does not match registry")
    if matching_event.get("selected_title") != config["selected_title"]:
        raise ImageDataError("article registry selected_title does not match")
    article_created_at = require_text(
        metadata.get("created_at"),
        "article metadata created_at",
        maximum=100,
        one_line=True,
    )
    parse_timestamp(article_created_at)
    if matching_event.get("created_at") != article_created_at:
        raise ImageDataError("article created_at does not match registry")

    draft_path = safe_workspace_file(
        workspace,
        metadata.get("draft_path"),
        "article draft_path",
        prefix=("articles", "drafts"),
    )
    draft_hash = sha256_bytes(draft_path.read_bytes())
    if draft_hash != metadata.get("draft_sha256"):
        raise ImageDataError("article draft hash does not match metadata")
    if draft_hash != matching_event.get("draft_sha256"):
        raise ImageDataError("article draft hash does not match registry")

    context_path = safe_workspace_file(
        workspace,
        metadata.get("context_pack_path"),
        "article context_pack_path",
        prefix=("context-packs",),
    )
    context_hash = sha256_bytes(context_path.read_bytes())
    if context_hash != metadata.get("context_pack_sha256"):
        raise ImageDataError("article context pack hash does not match metadata")
    return metadata, text, metadata_hash


def validate_brief_article_timeline(
    article_metadata: Dict[str, Any], brief_created_at: Any, label: str
) -> None:
    article_created_at = parse_timestamp(
        require_text(
            article_metadata.get("created_at"),
            f"{label}.article_created_at",
            maximum=100,
            one_line=True,
        )
    )
    normalized_brief_created_at = parse_timestamp(
        require_text(
            brief_created_at,
            f"{label}.brief_created_at",
            maximum=100,
            one_line=True,
        )
    )
    if timestamp_moment(
        normalized_brief_created_at, f"{label}.brief_created_at"
    ) < timestamp_moment(article_created_at, f"{label}.article_created_at"):
        raise ImageDataError(
            f"{label}.brief_created_at must not be earlier than article_created_at"
        )


def validate_generation_timeline(
    brief: Dict[str, Any], generated_at: Any, label: str
) -> None:
    brief_created_at = parse_timestamp(
        require_text(
            brief.get("created_at"),
            f"{label}.brief_created_at",
            maximum=100,
            one_line=True,
        )
    )
    normalized_generated_at = parse_timestamp(
        require_text(
            generated_at,
            f"{label}.generated_at",
            maximum=100,
            one_line=True,
        )
    )
    if timestamp_moment(
        normalized_generated_at, f"{label}.generated_at"
    ) <= timestamp_moment(brief_created_at, f"{label}.brief_created_at"):
        raise ImageDataError(
            f"{label}.generated_at must be later than brief_created_at"
        )


def normalize_text_list(
    value: Any,
    label: str,
    *,
    maximum_items: int,
    item_maximum: int,
) -> List[str]:
    if not isinstance(value, list) or len(value) > maximum_items:
        raise ImageDataError(f"{label} must be an array with at most {maximum_items} items")
    result: List[str] = []
    for index, item in enumerate(value):
        text = require_text(
            item,
            f"{label}[{index}]",
            maximum=item_maximum,
            one_line=True,
        )
        if text in result:
            raise ImageDataError(f"{label} must not contain duplicates")
        result.append(text)
    return result


def normalize_brief_input(raw: Any) -> Dict[str, Any]:
    value = require_object(raw, "image brief config")
    check_exact_keys(value, label="image brief config", expected=BRIEF_INPUT_KEYS)
    if value.get("schema_version") != SCHEMA_VERSION:
        raise ImageDataError("schema_version is not supported")

    request_id = require_text(
        value.get("request_id"), "request_id", maximum=128, one_line=True
    )
    if REQUEST_ID_PATTERN.fullmatch(request_id) is None:
        raise ImageDataError("request_id has invalid format")
    article_id = require_text(
        value.get("article_id"), "article_id", maximum=72, one_line=True
    )
    if ARTICLE_ID_PATTERN.fullmatch(article_id) is None:
        raise ImageDataError("article_id has invalid format")
    article_revision = positive_integer(
        value.get("article_revision"), "article_revision"
    )
    article_metadata_path = require_text(
        value.get("article_metadata_path"),
        "article_metadata_path",
        maximum=300,
        one_line=True,
    )
    relative_path(
        article_metadata_path,
        "article_metadata_path",
        prefix=("articles", "drafts"),
    )

    kind = value.get("kind")
    if kind not in {"thumbnail", "inline"}:
        raise ImageDataError("kind must be thumbnail or inline")
    exact_copy = nullable_text(
        value.get("exact_copy"), "exact_copy", maximum=32, one_line=True
    )
    copy_rendering = value.get("copy_rendering")
    if copy_rendering not in {"same_generation", "none"}:
        raise ImageDataError("copy_rendering is invalid")
    if exact_copy is None and copy_rendering != "none":
        raise ImageDataError("copy_rendering must be none when exact_copy is null")
    if exact_copy is not None and copy_rendering != "same_generation":
        raise ImageDataError(
            "copy must be rendered with the visual in the same image generation"
        )
    reference_count = bounded_integer(
        value.get("reference_image_count"),
        "reference_image_count",
        0,
        5,
    )
    reference_guidance = nullable_text(
        value.get("reference_guidance"),
        "reference_guidance",
        maximum=1000,
    )
    if reference_count == 0 and reference_guidance is not None:
        raise ImageDataError(
            "reference_guidance must be null when reference_image_count is zero"
        )
    if reference_count > 0 and reference_guidance is None:
        raise ImageDataError(
            "reference_guidance is required when reference images are used"
        )

    inline_approved = value.get("inline_approved")
    if not isinstance(inline_approved, bool):
        raise ImageDataError("inline_approved must be boolean")
    insertion_heading = nullable_text(
        value.get("insertion_heading"),
        "insertion_heading",
        maximum=300,
        one_line=True,
    )
    insertion_after = nullable_text(
        value.get("insertion_after"),
        "insertion_after",
        maximum=500,
        one_line=True,
    )
    if kind == "thumbnail":
        if inline_approved or insertion_heading is not None or insertion_after is not None:
            raise ImageDataError("thumbnail brief must not contain inline approval or position")
    else:
        if not inline_approved:
            raise ImageDataError("inline image requires inline_approved=true")
        if insertion_heading is None or insertion_after is None:
            raise ImageDataError("inline image requires a specific insertion position")
        if exact_copy is not None:
            raise ImageDataError("inline image must not contain title-style copy")

    capability = value.get("generation_capability")
    if capability not in {"available", "unavailable"}:
        raise ImageDataError("generation_capability is invalid")

    return {
        "schema_version": SCHEMA_VERSION,
        "request_id": request_id,
        "article_id": article_id,
        "article_revision": article_revision,
        "article_metadata_path": article_metadata_path,
        "kind": kind,
        "selected_title": require_text(
            value.get("selected_title"),
            "selected_title",
            maximum=200,
            one_line=True,
        ),
        "reader_reason": require_text(
            value.get("reader_reason"), "reader_reason", maximum=500
        ),
        "article_hook": require_text(
            value.get("article_hook"), "article_hook", maximum=1000
        ),
        "subject_scene": require_text(
            value.get("subject_scene"), "subject_scene", maximum=1000
        ),
        "design_structure": require_text(
            value.get("design_structure"), "design_structure", maximum=1000
        ),
        "visual_style": require_text(
            value.get("visual_style"), "visual_style", maximum=500
        ),
        "exact_copy": exact_copy,
        "copy_rendering": copy_rendering,
        "forbidden_elements": normalize_text_list(
            value.get("forbidden_elements"),
            "forbidden_elements",
            maximum_items=20,
            item_maximum=200,
        ),
        "reference_image_count": reference_count,
        "reference_guidance": reference_guidance,
        "inline_approved": inline_approved,
        "insertion_heading": insertion_heading,
        "insertion_after": insertion_after,
        "generation_capability": capability,
    }


def brief_dimensions(kind: str) -> Tuple[int, int]:
    return (1280, 670) if kind == "thumbnail" else (1280, 720)


def brief_payload_hash(config: Dict[str, Any], article_metadata_sha256: str) -> str:
    return canonical_hash(
        {
            "config": config,
            "article_metadata_sha256": article_metadata_sha256,
        }
    )


def build_brief_metadata(
    config: Dict[str, Any],
    *,
    article_metadata_sha256: str,
    brief_revision: int,
    created_at: str,
    brief_path: str,
    payload_sha256: str,
) -> Dict[str, Any]:
    width, height = brief_dimensions(config["kind"])
    value = dict(config)
    value.update(
        {
            "article_metadata_sha256": article_metadata_sha256,
            "brief_revision": brief_revision,
            "created_at": created_at,
            "status": (
                "ready_to_generate"
                if config["generation_capability"] == "available"
                else "generation_unavailable"
            ),
            "target_width": width,
            "target_height": height,
            "brief_path": brief_path,
            "payload_sha256": payload_sha256,
            "external_actions": [],
        }
    )
    return value


def validate_brief_object(
    workspace: Path, value: Dict[str, Any], label: str
) -> Dict[str, Any]:
    check_exact_keys(value, label=label, expected=BRIEF_KEYS)
    config = normalize_brief_input(
        {key: value.get(key) for key in BRIEF_INPUT_KEYS}
    )
    revision = positive_integer(value.get("brief_revision"), f"{label}.brief_revision")
    brief_created_at = parse_timestamp(
        require_text(value.get("created_at"), f"{label}.created_at", maximum=100)
    )
    expected_status = (
        "ready_to_generate"
        if config["generation_capability"] == "available"
        else "generation_unavailable"
    )
    if value.get("status") != expected_status:
        raise ImageDataError(f"{label}.status does not match generation capability")
    width, height = brief_dimensions(config["kind"])
    if value.get("target_width") != width or value.get("target_height") != height:
        raise ImageDataError(f"{label} target dimensions do not match kind")
    expected_path = (
        f"assets/{config['article_id']}/{config['kind']}-brief-r{revision:03d}.json"
    )
    if value.get("brief_path") != expected_path:
        raise ImageDataError(f"{label}.brief_path does not match revision")
    if value.get("external_actions") != []:
        raise ImageDataError(f"{label}.external_actions must be empty")
    article_hash = require_text(
        value.get("article_metadata_sha256"),
        f"{label}.article_metadata_sha256",
        maximum=64,
        one_line=True,
    )
    if HASH_PATTERN.fullmatch(article_hash) is None:
        raise ImageDataError(f"{label}.article_metadata_sha256 is invalid")
    article_metadata, _, current_article_hash = read_article_source(workspace, config)
    if current_article_hash != article_hash:
        raise ImageDataError(f"{label} article metadata hash does not match")
    validate_brief_article_timeline(article_metadata, brief_created_at, label)
    expected_payload = brief_payload_hash(config, article_hash)
    if value.get("payload_sha256") != expected_payload:
        raise ImageDataError(f"{label}.payload_sha256 does not match")
    return config


def load_brief(
    workspace: Path, brief_relative: str
) -> Tuple[Dict[str, Any], str, str]:
    path = safe_workspace_file(
        workspace,
        brief_relative,
        "brief_path",
        prefix=("assets",),
    )
    text = path.read_text(encoding="utf-8")
    try:
        value = json.loads(text)
    except json.JSONDecodeError as exc:
        raise ImageDataError("brief is invalid JSON") from exc
    brief = require_object(value, "brief")
    validate_brief_object(workspace, brief, "brief")
    if brief.get("brief_path") != brief_relative:
        raise ImageDataError("brief_path does not match requested brief")
    return brief, text, sha256_text(text)


def load_all_briefs(workspace: Path) -> List[Dict[str, Any]]:
    briefs: List[Dict[str, Any]] = []
    for path in sorted((workspace / "assets").glob("article-*/*-brief-r*.json")):
        if path.is_symlink() or path.parent.is_symlink():
            raise ImageDataError(f"brief file is unsafe: {path}")
        relative = path.relative_to(workspace).as_posix()
        brief, _, _ = load_brief(workspace, relative)
        briefs.append(brief)
    return briefs


def normalize_qa(raw: Any, brief: Dict[str, Any]) -> Dict[str, Any]:
    value = require_object(raw, "image QA config")
    check_exact_keys(value, label="image QA config", expected=QA_KEYS)
    if value.get("schema_version") != SCHEMA_VERSION:
        raise ImageDataError("QA schema_version is not supported")
    request_id = require_text(
        value.get("request_id"), "QA request_id", maximum=128, one_line=True
    )
    if REQUEST_ID_PATTERN.fullmatch(request_id) is None:
        raise ImageDataError("QA request_id has invalid format")
    brief_path = require_text(
        value.get("brief_path"), "QA brief_path", maximum=400, one_line=True
    )
    if brief_path != brief["brief_path"]:
        raise ImageDataError("QA brief_path does not match brief")
    generated_at = parse_timestamp(
        require_text(value.get("generated_at"), "generated_at", maximum=100)
    )
    reviewed_at = parse_timestamp(
        require_text(value.get("reviewed_at"), "reviewed_at", maximum=100)
    )
    if timestamp_moment(reviewed_at, "reviewed_at") <= timestamp_moment(
        generated_at, "generated_at"
    ):
        raise ImageDataError("reviewed_at must be later than generated_at")
    attempts = bounded_integer(
        value.get("generation_attempts"), "generation_attempts", 1, 2
    )
    generator_label = nullable_text(
        value.get("generator_label"),
        "generator_label",
        maximum=200,
        one_line=True,
    )
    if value.get("visual_review_completed") is not True:
        raise ImageDataError("visual_review_completed must be true")
    for field in ("article_match", "anatomy_integrity", "crop_safety"):
        if value.get(field) != "pass":
            raise ImageDataError(f"{field} must be pass")
    if value.get("extra_text_absent") is not True:
        raise ImageDataError("extra_text_absent must be true")
    unresolved = value.get("unresolved_issues")
    if unresolved != []:
        raise ImageDataError("unresolved_issues must be empty before saving")

    text_accuracy = value.get("text_accuracy")
    preview = value.get("small_preview_readability")
    preview_hash = value.get("preview_sha256")
    integration = value.get("visual_copy_integration")
    if text_accuracy not in {"pass", "not_applicable"}:
        raise ImageDataError("text_accuracy is invalid")
    if preview not in {"pass", "not_applicable"}:
        raise ImageDataError("small_preview_readability is invalid")
    if integration not in {"pass", "not_applicable"}:
        raise ImageDataError("visual_copy_integration is invalid")

    caption = nullable_text(
        value.get("caption"), "caption", maximum=300, one_line=True
    )
    alt = nullable_text(value.get("alt"), "alt", maximum=80, one_line=True)
    if brief["kind"] == "thumbnail":
        if preview != "pass":
            raise ImageDataError("thumbnail requires small preview readability pass")
        expected_text = "pass" if brief["exact_copy"] is not None else "not_applicable"
        if text_accuracy != expected_text or integration != expected_text:
            raise ImageDataError("thumbnail text QA does not match exact_copy")
        if caption is not None or alt is not None:
            raise ImageDataError("thumbnail must not contain caption or alt")
        if not isinstance(preview_hash, str) or HASH_PATTERN.fullmatch(preview_hash) is None:
            raise ImageDataError("thumbnail requires a valid preview_sha256")
    else:
        if preview != "not_applicable":
            raise ImageDataError("inline image preview QA must be not_applicable")
        if text_accuracy != "not_applicable" or integration != "not_applicable":
            raise ImageDataError("inline image text QA must be not_applicable")
        if caption is None or alt is None:
            raise ImageDataError("inline image requires caption and alt")
        if URL_PATTERN.search(alt):
            raise ImageDataError("inline image alt must not contain a URL")
        if preview_hash is not None:
            raise ImageDataError("inline image preview_sha256 must be null")

    return {
        "schema_version": SCHEMA_VERSION,
        "request_id": request_id,
        "brief_path": brief_path,
        "generated_at": generated_at,
        "reviewed_at": reviewed_at,
        "generation_attempts": attempts,
        "generator_label": generator_label,
        "visual_review_completed": True,
        "article_match": "pass",
        "anatomy_integrity": "pass",
        "crop_safety": "pass",
        "text_accuracy": text_accuracy,
        "extra_text_absent": True,
        "small_preview_readability": preview,
        "preview_sha256": preview_hash,
        "visual_copy_integration": integration,
        "unresolved_issues": [],
        "caption": caption,
        "alt": alt,
    }


def read_image(path_value: str, label: str) -> Tuple[Path, bytes, str, int, int]:
    path = Path(path_value)
    if not path.is_file() or path.is_symlink():
        raise ImageDataError(f"{label} is missing or unsafe")
    size = path.stat().st_size
    if size <= 0 or size > MAX_IMAGE_BYTES:
        raise ImageDataError(f"{label} has an invalid file size")
    data = path.read_bytes()
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        dimensions = png_dimensions(data)
        if dimensions is None:
            raise ImageDataError(f"{label} has an invalid PNG structure")
        return path, data, "png", dimensions[0], dimensions[1]
    if data[:2] == b"\xff\xd8":
        dimensions = jpeg_dimensions(data)
        if dimensions is None:
            raise ImageDataError(f"{label} has an invalid JPEG header")
        return path, data, "jpeg", dimensions[0], dimensions[1]
    raise ImageDataError(f"{label} must be PNG or JPEG")


def png_dimensions(data: bytes) -> Optional[Tuple[int, int]]:
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    offset = 8
    dimensions: Optional[Tuple[int, int]] = None
    saw_idat = False
    saw_iend = False
    while offset + 12 <= len(data):
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        kind = data[offset + 4 : offset + 8]
        end = offset + 12 + length
        if end > len(data):
            return None
        payload = data[offset + 8 : offset + 8 + length]
        stored_crc = struct.unpack(">I", data[offset + 8 + length : end])[0]
        computed_crc = binascii.crc32(kind + payload) & 0xFFFFFFFF
        if stored_crc != computed_crc:
            return None
        if offset == 8:
            if kind != b"IHDR" or length != 13:
                return None
            width, height = struct.unpack(">II", payload[:8])
            if width < 1 or height < 1:
                return None
            dimensions = (width, height)
        elif kind == b"IHDR":
            return None
        if kind == b"IDAT":
            saw_idat = True
        if kind == b"IEND":
            if length != 0 or end != len(data):
                return None
            saw_iend = True
            break
        offset = end
    if dimensions is None or not saw_idat or not saw_iend:
        return None
    return dimensions


def jpeg_dimensions(data: bytes) -> Optional[Tuple[int, int]]:
    if len(data) < 4 or data[:2] != b"\xff\xd8" or b"\xff\xd9" not in data[2:]:
        return None
    sof_markers = {
        0xC0,
        0xC1,
        0xC2,
        0xC3,
        0xC5,
        0xC6,
        0xC7,
        0xC9,
        0xCA,
        0xCB,
        0xCD,
        0xCE,
        0xCF,
    }
    offset = 2
    while offset + 4 <= len(data):
        if data[offset] != 0xFF:
            offset += 1
            continue
        while offset < len(data) and data[offset] == 0xFF:
            offset += 1
        if offset >= len(data):
            return None
        marker = data[offset]
        offset += 1
        if marker in {0xD8, 0xD9}:
            continue
        if marker == 0xDA or offset + 2 > len(data):
            return None
        length = struct.unpack(">H", data[offset : offset + 2])[0]
        if length < 2 or offset + length > len(data):
            return None
        if marker in sof_markers:
            if length < 7:
                return None
            height, width = struct.unpack(">HH", data[offset + 3 : offset + 7])
            return width, height
        offset += length
    return None


def asset_payload_hash(
    qa: Dict[str, Any], brief_sha256: str, image_sha256: str
) -> str:
    return canonical_hash(
        {
            "qa": qa,
            "brief_sha256": brief_sha256,
            "image_sha256": image_sha256,
        }
    )


def build_asset_metadata(
    brief: Dict[str, Any],
    qa: Dict[str, Any],
    *,
    asset_revision: int,
    saved_at: str,
    brief_sha256: str,
    image_path: str,
    image_sha256: str,
    image_format: str,
    width: int,
    height: int,
    preview_path: Optional[str],
    preview_sha256: Optional[str],
    preview_source_sha256: Optional[str],
    preview_width: Optional[int],
    preview_height: Optional[int],
    metadata_path: str,
    payload_sha256: str,
) -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "request_id": qa["request_id"],
        "payload_sha256": payload_sha256,
        "article_id": brief["article_id"],
        "article_revision": brief["article_revision"],
        "kind": brief["kind"],
        "asset_revision": asset_revision,
        "generated_at": qa["generated_at"],
        "reviewed_at": qa["reviewed_at"],
        "saved_at": saved_at,
        "status": "ready_for_draft",
        "selected_title": brief["selected_title"],
        "brief_path": brief["brief_path"],
        "brief_sha256": brief_sha256,
        "image_path": image_path,
        "image_sha256": image_sha256,
        "image_format": image_format,
        "width": width,
        "height": height,
        "preview_path": preview_path,
        "preview_sha256": preview_sha256,
        "preview_source_sha256": preview_source_sha256,
        "preview_width": preview_width,
        "preview_height": preview_height,
        "generation_attempts": qa["generation_attempts"],
        "generator_label": qa["generator_label"],
        "visual_review_completed": qa["visual_review_completed"],
        "article_match": qa["article_match"],
        "anatomy_integrity": qa["anatomy_integrity"],
        "crop_safety": qa["crop_safety"],
        "text_accuracy": qa["text_accuracy"],
        "extra_text_absent": qa["extra_text_absent"],
        "small_preview_readability": qa["small_preview_readability"],
        "visual_copy_integration": qa["visual_copy_integration"],
        "unresolved_issues": qa["unresolved_issues"],
        "insertion_heading": brief["insertion_heading"],
        "insertion_after": brief["insertion_after"],
        "caption": qa["caption"],
        "alt": qa["alt"],
        "metadata_path": metadata_path,
        "external_actions": [],
    }


def build_image_event(
    metadata: Dict[str, Any], metadata_sha256: str
) -> Dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "event_type": "image_saved",
        "request_id": metadata["request_id"],
        "payload_sha256": metadata["payload_sha256"],
        "article_id": metadata["article_id"],
        "article_revision": metadata["article_revision"],
        "kind": metadata["kind"],
        "asset_revision": metadata["asset_revision"],
        "generated_at": metadata["generated_at"],
        "reviewed_at": metadata["reviewed_at"],
        "saved_at": metadata["saved_at"],
        "status": metadata["status"],
        "selected_title": metadata["selected_title"],
        "brief_path": metadata["brief_path"],
        "brief_sha256": metadata["brief_sha256"],
        "image_path": metadata["image_path"],
        "image_sha256": metadata["image_sha256"],
        "preview_path": metadata["preview_path"],
        "preview_sha256": metadata["preview_sha256"],
        "preview_source_sha256": metadata["preview_source_sha256"],
        "preview_width": metadata["preview_width"],
        "preview_height": metadata["preview_height"],
        "metadata_path": metadata["metadata_path"],
        "metadata_sha256": metadata_sha256,
        "width": metadata["width"],
        "height": metadata["height"],
        "caption": metadata["caption"],
        "alt": metadata["alt"],
        "external_actions": [],
    }


def validate_image_event_shape(event: Dict[str, Any], label: str) -> None:
    check_exact_keys(event, label=label, expected=IMAGE_EVENT_KEYS)
    if event.get("schema_version") != SCHEMA_VERSION:
        raise ImageDataError(f"{label}.schema_version is unsupported")
    if event.get("event_type") != "image_saved":
        raise ImageDataError(f"{label}.event_type is unsupported")
    if event.get("status") != "ready_for_draft":
        raise ImageDataError(f"{label}.status is invalid")
    request_id = require_text(
        event.get("request_id"), f"{label}.request_id", maximum=128
    )
    if REQUEST_ID_PATTERN.fullmatch(request_id) is None:
        raise ImageDataError(f"{label}.request_id is invalid")
    article_id = require_text(
        event.get("article_id"), f"{label}.article_id", maximum=72
    )
    if ARTICLE_ID_PATTERN.fullmatch(article_id) is None:
        raise ImageDataError(f"{label}.article_id is invalid")
    positive_integer(event.get("article_revision"), f"{label}.article_revision")
    positive_integer(event.get("asset_revision"), f"{label}.asset_revision")
    if event.get("kind") not in {"thumbnail", "inline"}:
        raise ImageDataError(f"{label}.kind is invalid")
    generated_at = parse_timestamp(
        require_text(event.get("generated_at"), f"{label}.generated_at", maximum=100)
    )
    reviewed_at = parse_timestamp(
        require_text(event.get("reviewed_at"), f"{label}.reviewed_at", maximum=100)
    )
    saved_at = parse_timestamp(
        require_text(event.get("saved_at"), f"{label}.saved_at", maximum=100)
    )
    if not (
        timestamp_moment(generated_at, f"{label}.generated_at")
        < timestamp_moment(reviewed_at, f"{label}.reviewed_at")
        <= timestamp_moment(saved_at, f"{label}.saved_at")
    ):
        raise ImageDataError(
            f"{label} timestamps must satisfy generated_at < reviewed_at <= saved_at"
        )
    for field in (
        "payload_sha256",
        "brief_sha256",
        "image_sha256",
        "metadata_sha256",
    ):
        value = require_text(event.get(field), f"{label}.{field}", maximum=64)
        if HASH_PATTERN.fullmatch(value) is None:
            raise ImageDataError(f"{label}.{field} is invalid")
    for field in (
        "selected_title",
        "brief_path",
        "image_path",
        "metadata_path",
    ):
        require_text(event.get(field), f"{label}.{field}", maximum=4000)
    positive_integer(event.get("width"), f"{label}.width")
    positive_integer(event.get("height"), f"{label}.height")
    if event.get("kind") == "thumbnail":
        for field in ("preview_sha256", "preview_source_sha256"):
            value = require_text(event.get(field), f"{label}.{field}", maximum=64)
            if HASH_PATTERN.fullmatch(value) is None:
                raise ImageDataError(f"{label}.{field} is invalid")
        require_text(event.get("preview_path"), f"{label}.preview_path", maximum=4000)
        if event.get("preview_width") != 320 or event.get("preview_height") != 168:
            raise ImageDataError(f"{label} preview dimensions are invalid")
    elif any(
        event.get(field) is not None
        for field in (
            "preview_path",
            "preview_sha256",
            "preview_source_sha256",
            "preview_width",
            "preview_height",
        )
    ):
        raise ImageDataError(f"{label} inline preview fields must be null")
    if event.get("external_actions") != []:
        raise ImageDataError(f"{label}.external_actions must be empty")


def load_image_events(workspace: Path) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    for path in sorted((workspace / "assets").glob("article-*/registry.jsonl")):
        if path.parent.is_symlink():
            raise ImageDataError(f"image registry directory is unsafe: {path.parent}")
        events.extend(event for _, event in iter_jsonl(path))
    return events


def validate_image_data(workspace: Path) -> List[str]:
    errors: List[str] = []
    brief_map: Dict[str, Tuple[Dict[str, Any], str]] = {}
    brief_request_ids = set()
    brief_revisions: Dict[Tuple[str, str], List[int]] = {}
    for path in sorted((workspace / "assets").glob("article-*/*-brief-r*.json")):
        relative = path.relative_to(workspace).as_posix()
        try:
            brief, text, _ = load_brief(workspace, relative)
            if brief["request_id"] in brief_request_ids:
                raise ImageDataError(f"{relative} repeats brief request_id")
            brief_request_ids.add(brief["request_id"])
            key = (brief["article_id"], brief["kind"])
            brief_revisions.setdefault(key, []).append(brief["brief_revision"])
            brief_map[relative] = (brief, text)
        except (OSError, UnicodeError, ImageDataError) as exc:
            errors.append(str(exc))

    for (article_id, kind), numbers in brief_revisions.items():
        if sorted(numbers) != list(range(1, len(numbers) + 1)):
            errors.append(f"{article_id} {kind} brief revisions must be sequential from 1")

    request_ids = set()
    revisions: Dict[Tuple[str, str], List[int]] = {}
    for registry_path in sorted(
        (workspace / "assets").glob("article-*/registry.jsonl")
    ):
        if registry_path.parent.is_symlink():
            errors.append(f"image registry directory is unsafe: {registry_path.parent}")
            continue
        try:
            registry_events = list(iter_jsonl(registry_path))
        except (OSError, UnicodeError, ImageDataError) as exc:
            errors.append(str(exc))
            continue
        for line_number, event in registry_events:
            relative_registry = registry_path.relative_to(workspace).as_posix()
            label = f"{relative_registry}:{line_number}"
            try:
                validate_image_event_shape(event, label)
                if event["request_id"] in request_ids:
                    raise ImageDataError(f"{label} repeats request_id")
                request_ids.add(event["request_id"])
                key = (event["article_id"], event["kind"])
                revisions.setdefault(key, []).append(event["asset_revision"])
                if registry_path.parent.name != event["article_id"]:
                    raise ImageDataError(f"{label} article_id does not match registry path")

                brief_entry = brief_map.get(event["brief_path"])
                if brief_entry is None:
                    raise ImageDataError(f"{label} brief is missing or invalid")
                brief, brief_text = brief_entry
                brief_hash = sha256_text(brief_text)
                if brief_hash != event["brief_sha256"]:
                    raise ImageDataError(f"{label} brief hash does not match")
                if event["article_id"] != brief["article_id"]:
                    raise ImageDataError(f"{label} article_id does not match brief")
                if event["article_revision"] != brief["article_revision"]:
                    raise ImageDataError(f"{label} article revision does not match brief")
                if event["kind"] != brief["kind"]:
                    raise ImageDataError(f"{label} kind does not match brief")
                if event["selected_title"] != brief["selected_title"]:
                    raise ImageDataError(f"{label} selected_title does not match brief")
                validate_generation_timeline(brief, event["generated_at"], label)

                extension = ".png"
                expected_stem = (
                    f"{event['kind']}-r{event['asset_revision']:03d}"
                )
                image_path = safe_workspace_file(
                    workspace,
                    event["image_path"],
                    f"{label}.image_path",
                    prefix=("assets", event["article_id"]),
                )
                _, image_data, image_format, width, height = read_image(
                    str(image_path), f"{label}.image_path"
                )
                extension = ".png" if image_format == "png" else ".jpg"
                expected_image = (
                    f"assets/{event['article_id']}/{expected_stem}{extension}"
                )
                expected_metadata = (
                    f"assets/{event['article_id']}/{expected_stem}.json"
                )
                if event["image_path"] != expected_image:
                    raise ImageDataError(f"{label}.image_path does not match revision")
                if event["metadata_path"] != expected_metadata:
                    raise ImageDataError(f"{label}.metadata_path does not match revision")
                image_hash = sha256_bytes(image_data)
                if image_hash != event["image_sha256"]:
                    raise ImageDataError(f"{label} image hash does not match")
                if width != event["width"] or height != event["height"]:
                    raise ImageDataError(f"{label} image dimensions do not match")
                target_width, target_height = brief_dimensions(event["kind"])
                if (width, height) != (target_width, target_height):
                    raise ImageDataError(f"{label} image has wrong target dimensions")

                if event["kind"] == "thumbnail":
                    expected_preview_path = (
                        f"assets/{event['article_id']}/{expected_stem}-preview.png"
                    )
                    if event["preview_path"] != expected_preview_path:
                        raise ImageDataError(f"{label}.preview_path does not match revision")
                    preview_path = safe_workspace_file(
                        workspace,
                        event["preview_path"],
                        f"{label}.preview_path",
                        prefix=("assets", event["article_id"]),
                    )
                    _, preview_data, preview_format, preview_width, preview_height = read_image(
                        str(preview_path), f"{label}.preview_path"
                    )
                    if preview_format != "png" or (preview_width, preview_height) != (320, 168):
                        raise ImageDataError(f"{label} preview format or dimensions are invalid")
                    preview_hash = sha256_bytes(preview_data)
                    if preview_hash != event["preview_sha256"]:
                        raise ImageDataError(f"{label} preview hash does not match")
                    if event["preview_source_sha256"] != image_hash:
                        raise ImageDataError(f"{label} preview source hash does not match image")
                    try:
                        expected_preview = resize_png_bytes(image_data, 320, 168)
                    except PngResizeError as exc:
                        raise ImageDataError(
                            f"{label} thumbnail cannot reproduce preview: {exc}"
                        ) from exc
                    if preview_data != expected_preview:
                        raise ImageDataError(
                            f"{label} preview was not derived from the final image"
                        )

                metadata_path = safe_workspace_file(
                    workspace,
                    event["metadata_path"],
                    f"{label}.metadata_path",
                    prefix=("assets", event["article_id"]),
                )
                metadata_text = metadata_path.read_text(encoding="utf-8")
                if sha256_text(metadata_text) != event["metadata_sha256"]:
                    raise ImageDataError(f"{label} metadata hash does not match")
                try:
                    metadata = json.loads(metadata_text)
                except json.JSONDecodeError as exc:
                    raise ImageDataError(f"{label} metadata is invalid JSON") from exc
                metadata = require_object(metadata, f"{label} metadata")
                check_exact_keys(
                    metadata,
                    label=f"{label} metadata",
                    expected=ASSET_METADATA_KEYS,
                )
                for field in (
                    "request_id",
                    "payload_sha256",
                    "article_id",
                    "article_revision",
                    "kind",
                    "asset_revision",
                    "generated_at",
                    "reviewed_at",
                    "saved_at",
                    "status",
                    "selected_title",
                    "brief_path",
                    "brief_sha256",
                    "image_path",
                    "image_sha256",
                    "preview_path",
                    "preview_sha256",
                    "preview_source_sha256",
                    "preview_width",
                    "preview_height",
                    "metadata_path",
                    "width",
                    "height",
                    "caption",
                    "alt",
                ):
                    if metadata.get(field) != event.get(field):
                        raise ImageDataError(f"{label} metadata {field} does not match")
                if metadata.get("schema_version") != SCHEMA_VERSION:
                    raise ImageDataError(f"{label} metadata schema_version is unsupported")
                if metadata.get("external_actions") != []:
                    raise ImageDataError(f"{label} metadata external_actions must be empty")
                if metadata.get("insertion_heading") != brief["insertion_heading"]:
                    raise ImageDataError(f"{label} insertion_heading does not match brief")
                if metadata.get("insertion_after") != brief["insertion_after"]:
                    raise ImageDataError(f"{label} insertion_after does not match brief")
                if metadata.get("image_format") != image_format:
                    raise ImageDataError(f"{label} metadata image_format does not match")
                qa = normalize_qa(
                    {
                        "schema_version": metadata.get("schema_version"),
                        "request_id": metadata.get("request_id"),
                        "brief_path": metadata.get("brief_path"),
                        "generated_at": metadata.get("generated_at"),
                        "reviewed_at": metadata.get("reviewed_at"),
                        "generation_attempts": metadata.get("generation_attempts"),
                        "generator_label": metadata.get("generator_label"),
                        "visual_review_completed": metadata.get(
                            "visual_review_completed"
                        ),
                        "article_match": metadata.get("article_match"),
                        "anatomy_integrity": metadata.get("anatomy_integrity"),
                        "crop_safety": metadata.get("crop_safety"),
                        "text_accuracy": metadata.get("text_accuracy"),
                        "extra_text_absent": metadata.get("extra_text_absent"),
                        "small_preview_readability": metadata.get(
                            "small_preview_readability"
                        ),
                        "preview_sha256": metadata.get("preview_sha256"),
                        "visual_copy_integration": metadata.get(
                            "visual_copy_integration"
                        ),
                        "unresolved_issues": metadata.get("unresolved_issues"),
                        "caption": metadata.get("caption"),
                        "alt": metadata.get("alt"),
                    },
                    brief,
                )
                expected_payload = asset_payload_hash(qa, brief_hash, image_hash)
                if expected_payload != event["payload_sha256"]:
                    raise ImageDataError(f"{label} payload hash does not match")
            except (OSError, UnicodeError, ImageDataError) as exc:
                errors.append(str(exc))

    for (article_id, kind), numbers in revisions.items():
        if numbers != list(range(1, len(numbers) + 1)):
            errors.append(f"{article_id} {kind} asset revisions must be sequential from 1")
    return errors


@contextmanager
def image_lock(workspace: Path, created_at: str) -> Iterator[None]:
    path = workspace / "assets/.image.lock"
    payload = json.dumps(
        {"created_at": created_at, "pid": os.getpid()}, ensure_ascii=False
    ).encode("utf-8")
    try:
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise ImageDataError(
            "another image write may be active; inspect assets/.image.lock"
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
    if not path.parent.is_dir() or path.parent.is_symlink():
        raise ImageDataError("managed file parent is missing or unsafe")
    try:
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise ImageDataError(f"managed file already exists: {path.name}") from exc
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())


def write_new_bytes(path: Path, content: bytes) -> None:
    if not path.parent.is_dir() or path.parent.is_symlink():
        raise ImageDataError("managed file parent is missing or unsafe")
    try:
        descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise ImageDataError(f"managed file already exists: {path.name}") from exc
    with os.fdopen(descriptor, "wb") as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())


def append_image_registry(path: Path, event: Dict[str, Any]) -> None:
    encoded = (
        json.dumps(event, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")
    if not path.exists():
        write_new_bytes(path, encoded)
        return
    if not path.is_file() or path.is_symlink():
        raise ImageDataError("image registry is unsafe")
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
