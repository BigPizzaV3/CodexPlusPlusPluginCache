#!/usr/bin/env python3
"""Shared validation and append-only storage for note metrics observations."""

from __future__ import annotations

import hashlib
import json
import re
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Tuple
from urllib.parse import unquote, urlparse, urlunparse


SCHEMA_VERSION = 1
CURRENT_METRICS_SCHEMA_VERSION = 2
SUPPORTED_METRICS_SCHEMA_VERSIONS = {1, CURRENT_METRICS_SCHEMA_VERSION}
REQUEST_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._:-]{7,127}$")
RUN_ID_PATTERN = re.compile(r"^run-[a-z0-9][a-z0-9._:-]{6,127}$")
ARTICLE_ID_PATTERN = re.compile(r"^article-[a-z0-9][a-z0-9-]{2,63}$")
HASH_PATTERN = re.compile(r"^[0-9a-f]{64}$")
LEGACY_METRIC_NAMES = ("views", "likes", "comments")
CURRENT_METRIC_NAMES = (
    "impressions",
    "page_views",
    "likes",
    "comments",
    "sales",
)
LEGACY_METRIC_STATUSES = {
    "available",
    "unavailable",
    "not_visible",
    "fetch_failed",
    "not_applicable",
}
CURRENT_METRIC_STATUSES = LEGACY_METRIC_STATUSES | {"not_collected"}
LEGACY_METRIC_SOURCES = {
    "note_public_page",
    "note_creator_dashboard",
    "manual_user_report",
    "not_observed",
}
CURRENT_METRIC_SOURCES = {
    "note_browser_dashboard",
    "manual_user_report",
    "not_observed",
}
INPUT_KEYS_V1 = (
    "schema_version",
    "request_id",
    "run_id",
    "collection_mode",
    "observed_at",
    "article",
    "metrics",
    "note",
)
INPUT_KEYS_V2 = (
    "schema_version",
    "request_id",
    "run_id",
    "collection_mode",
    "observed_at",
    "data_as_of",
    "dashboard_surface",
    "period",
    "scope",
    "metrics",
    "referrers",
    "note",
)
ARTICLE_KEYS = (
    "origin",
    "article_id",
    "article_revision",
    "registry_event_sha256",
    "title",
    "public_url",
    "published_at",
)
METRIC_KEYS = ("metric", "status", "value", "source", "reason")
PERIOD_KEYS = ("range_type", "start_date", "end_date", "completeness")
SCOPE_KEYS = ("type", "article")
REFERRERS_KEYS = ("status", "source", "items", "reason")
REFERRER_ITEM_KEYS = ("referrer", "page_views")
EVENT_KEYS_V1 = (
    "schema_version",
    "event_type",
    "request_id",
    "payload_sha256",
    "workspace_id",
    "run_id",
    "collection_mode",
    "observed_at",
    "recorded_at",
    "article",
    "metrics",
    "note",
    "external_actions",
)
EVENT_KEYS_V2 = (
    "schema_version",
    "event_type",
    "request_id",
    "payload_sha256",
    "workspace_id",
    "run_id",
    "collection_mode",
    "observed_at",
    "data_as_of",
    "recorded_at",
    "dashboard_surface",
    "period",
    "scope",
    "metrics",
    "referrers",
    "note",
    "external_actions",
)


class TrackerDataError(ValueError):
    """Raised when observation input or managed metric history is invalid."""


def canonical_json(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def json_text(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def check_exact_keys(value: Dict[str, Any], *, label: str, expected: Tuple[str, ...]) -> None:
    unknown = sorted(set(value) - set(expected))
    missing = sorted(set(expected) - set(value))
    if unknown:
        raise TrackerDataError(f"{label} has unknown fields: {', '.join(unknown)}")
    if missing:
        raise TrackerDataError(f"{label} is missing fields: {', '.join(missing)}")


def require_object(value: Any, label: str) -> Dict[str, Any]:
    if not isinstance(value, dict):
        raise TrackerDataError(f"{label} must be an object")
    return value


def require_text(
    value: Any,
    label: str,
    *,
    maximum: int,
    one_line: bool = False,
) -> str:
    if not isinstance(value, str):
        raise TrackerDataError(f"{label} must be text")
    text = value.strip()
    if not text:
        raise TrackerDataError(f"{label} must not be empty")
    if len(text) > maximum:
        raise TrackerDataError(f"{label} is too long")
    if one_line and ("\n" in text or "\r" in text):
        raise TrackerDataError(f"{label} must be one line")
    return text


def parse_timestamp(value: Optional[str], label: str = "timestamp") -> str:
    if value is None:
        moment = datetime.now(timezone.utc).astimezone()
    else:
        if not isinstance(value, str):
            raise TrackerDataError(f"{label} must be ISO 8601 text")
        normalized = value.strip().replace("Z", "+00:00")
        try:
            moment = datetime.fromisoformat(normalized)
        except ValueError as exc:
            raise TrackerDataError(f"{label} must be ISO 8601") from exc
        if moment.tzinfo is None:
            raise TrackerDataError(f"{label} must include a timezone")
    return moment.isoformat(timespec="seconds")


def normalize_public_note_url(value: Any) -> str:
    if isinstance(value, str) and value != value.strip():
        raise TrackerDataError(
            "article.public_url must use the exact canonical URL without surrounding whitespace"
        )
    text = require_text(value, "article.public_url", maximum=1000, one_line=True)
    parsed = urlparse(text)
    hostname = (parsed.hostname or "").lower()
    if parsed.username is not None or parsed.password is not None:
        raise TrackerDataError(
            "article.public_url must not contain user information"
        )
    if parsed.scheme != "https" or hostname not in {"note.com", "www.note.com"}:
        raise TrackerDataError("article.public_url must be an https note.com URL")
    try:
        port = parsed.port
    except ValueError as exc:
        raise TrackerDataError("article.public_url has an invalid port") from exc
    if port is not None:
        raise TrackerDataError("article.public_url must not include an explicit port")
    decoded_path = unquote(parsed.path)
    if decoded_path != parsed.path:
        raise TrackerDataError("article.public_url must not use an encoded path")
    if re.fullmatch(
        r"/(?:[A-Za-z0-9_-]+/)?n/[A-Za-z0-9_-]+",
        decoded_path,
    ) is None:
        raise TrackerDataError("article.public_url must identify a public note article")
    canonical = urlunparse(("https", hostname, decoded_path, "", "", ""))
    if text != canonical:
        raise TrackerDataError(
            "article.public_url must be canonical without a trailing slash, query, or fragment"
        )
    return canonical


def normalize_article(value: Any) -> Dict[str, Any]:
    article = require_object(value, "article")
    check_exact_keys(article, label="article", expected=ARTICLE_KEYS)
    origin = article.get("origin")
    if origin not in {"workspace_draft", "existing_public_article"}:
        raise TrackerDataError("article.origin is invalid")
    article_id = require_text(
        article.get("article_id"), "article.article_id", maximum=72, one_line=True
    )
    if ARTICLE_ID_PATTERN.fullmatch(article_id) is None:
        raise TrackerDataError("article.article_id has invalid format")
    title = require_text(article.get("title"), "article.title", maximum=200, one_line=True)
    revision = article.get("article_revision")
    registry_hash = article.get("registry_event_sha256")
    if origin == "workspace_draft":
        if isinstance(revision, bool) or not isinstance(revision, int) or revision < 1:
            raise TrackerDataError("workspace_draft requires a positive article_revision")
        registry_hash = require_text(
            registry_hash,
            "article.registry_event_sha256",
            maximum=64,
            one_line=True,
        )
        if HASH_PATTERN.fullmatch(registry_hash) is None:
            raise TrackerDataError("article.registry_event_sha256 is invalid")
    else:
        if revision is not None or registry_hash is not None:
            raise TrackerDataError(
                "existing_public_article must not invent article_revision or registry hash"
            )
    published_at = article.get("published_at")
    if published_at is not None:
        published_at = parse_timestamp(published_at, "article.published_at")
    return {
        "origin": origin,
        "article_id": article_id,
        "article_revision": revision,
        "registry_event_sha256": registry_hash,
        "title": title,
        "public_url": normalize_public_note_url(article.get("public_url")),
        "published_at": published_at,
    }


def normalize_metrics(
    value: Any,
    *,
    names: Tuple[str, ...],
    statuses: set[str],
    sources: set[str],
) -> List[Dict[str, Any]]:
    expected_label = ", ".join(names)
    if not isinstance(value, list) or len(value) != len(names):
        raise TrackerDataError(f"metrics must contain {expected_label}")
    by_name: Dict[str, Dict[str, Any]] = {}
    for index, raw in enumerate(value):
        item = require_object(raw, f"metrics[{index}]")
        check_exact_keys(item, label=f"metrics[{index}]", expected=METRIC_KEYS)
        metric = item.get("metric")
        if metric not in names:
            raise TrackerDataError(f"metrics[{index}].metric is invalid")
        if metric in by_name:
            raise TrackerDataError("metrics must not repeat a metric")
        status = item.get("status")
        if status not in statuses:
            raise TrackerDataError(f"metrics[{index}].status is invalid")
        source = item.get("source")
        if source not in sources:
            raise TrackerDataError(f"metrics[{index}].source is invalid")
        raw_value = item.get("value")
        raw_reason = item.get("reason")
        if status == "available":
            if isinstance(raw_value, bool) or not isinstance(raw_value, int) or raw_value < 0:
                raise TrackerDataError(
                    f"metrics[{index}].value must be a non-negative integer when available"
                )
            if raw_reason is not None:
                raise TrackerDataError(f"metrics[{index}].reason must be null when available")
            if source == "not_observed":
                raise TrackerDataError(
                    f"metrics[{index}].source cannot be not_observed when available"
                )
            reason = None
        else:
            if raw_value is not None:
                raise TrackerDataError(
                    f"metrics[{index}].value must be null when status is {status}"
                )
            reason = require_text(
                raw_reason, f"metrics[{index}].reason", maximum=500, one_line=True
            )
        by_name[metric] = {
            "metric": metric,
            "status": status,
            "value": raw_value,
            "source": source,
            "reason": reason,
        }
    if set(by_name) != set(names):
        raise TrackerDataError(
            f"metrics must contain {expected_label} exactly once"
        )
    return [by_name[name] for name in names]


def require_date(value: Any, label: str) -> str:
    text = require_text(value, label, maximum=10, one_line=True)
    try:
        parsed = date.fromisoformat(text)
    except ValueError as exc:
        raise TrackerDataError(f"{label} must be YYYY-MM-DD") from exc
    if parsed.isoformat() != text:
        raise TrackerDataError(f"{label} must be normalized YYYY-MM-DD")
    return text


def normalize_period(value: Any, observed_at: str) -> Dict[str, Any]:
    period = require_object(value, "period")
    check_exact_keys(period, label="period", expected=PERIOD_KEYS)
    range_type = period.get("range_type")
    if range_type not in {"bounded", "all_time"}:
        raise TrackerDataError("period.range_type must be bounded or all_time")
    raw_start = period.get("start_date")
    if range_type == "bounded":
        start_date = require_date(raw_start, "period.start_date")
    else:
        if raw_start is not None:
            raise TrackerDataError("all_time period.start_date must be null")
        start_date = None
    end_date = require_date(period.get("end_date"), "period.end_date")
    if start_date is not None and start_date > end_date:
        raise TrackerDataError("period.start_date must not be after period.end_date")
    observed_day = datetime.fromisoformat(observed_at).date().isoformat()
    if end_date > observed_day:
        raise TrackerDataError("period.end_date must not be after observed_at")
    completeness = period.get("completeness")
    if completeness == "includes_current_day":
        if end_date != observed_day:
            raise TrackerDataError(
                "includes_current_day requires period.end_date to match observed_at"
            )
    elif completeness == "completed":
        if end_date >= observed_day:
            raise TrackerDataError(
                "completed period must end before the observed_at date"
            )
    else:
        raise TrackerDataError(
            "period.completeness must be completed or includes_current_day"
        )
    return {
        "range_type": range_type,
        "start_date": start_date,
        "end_date": end_date,
        "completeness": completeness,
    }


def normalize_scope(value: Any) -> Dict[str, Any]:
    scope = require_object(value, "scope")
    check_exact_keys(scope, label="scope", expected=SCOPE_KEYS)
    scope_type = scope.get("type")
    raw_article = scope.get("article")
    if scope_type == "article":
        article = normalize_article(raw_article)
    elif scope_type == "account":
        if raw_article is not None:
            raise TrackerDataError("account scope.article must be null")
        article = None
    else:
        raise TrackerDataError("scope.type must be article or account")
    return {"type": scope_type, "article": article}


def normalize_referrers(value: Any, *, scope_type: str) -> Dict[str, Any]:
    referrers = require_object(value, "referrers")
    check_exact_keys(referrers, label="referrers", expected=REFERRERS_KEYS)
    status = referrers.get("status")
    if status not in CURRENT_METRIC_STATUSES:
        raise TrackerDataError("referrers.status is invalid")
    source = referrers.get("source")
    if source not in CURRENT_METRIC_SOURCES:
        raise TrackerDataError("referrers.source is invalid")
    raw_items = referrers.get("items")
    raw_reason = referrers.get("reason")
    if not isinstance(raw_items, list) or len(raw_items) > 100:
        raise TrackerDataError("referrers.items must be an array of at most 100 items")
    items: List[Dict[str, Any]] = []
    seen = set()
    for index, raw_item in enumerate(raw_items):
        item = require_object(raw_item, f"referrers.items[{index}]")
        check_exact_keys(
            item,
            label=f"referrers.items[{index}]",
            expected=REFERRER_ITEM_KEYS,
        )
        referrer = require_text(
            item.get("referrer"),
            f"referrers.items[{index}].referrer",
            maximum=200,
            one_line=True,
        )
        key = referrer.casefold()
        if key in seen:
            raise TrackerDataError("referrers.items must not repeat a referrer")
        seen.add(key)
        page_views = item.get("page_views")
        if (
            isinstance(page_views, bool)
            or not isinstance(page_views, int)
            or page_views < 0
        ):
            raise TrackerDataError(
                f"referrers.items[{index}].page_views must be a non-negative integer"
            )
        items.append({"referrer": referrer, "page_views": page_views})
    if status == "available":
        if raw_reason is not None:
            raise TrackerDataError("referrers.reason must be null when available")
        if source == "not_observed":
            raise TrackerDataError(
                "referrers.source cannot be not_observed when available"
            )
        reason = None
    else:
        if items:
            raise TrackerDataError(
                "referrers.items must be empty when status is not available"
            )
        reason = require_text(
            raw_reason, "referrers.reason", maximum=500, one_line=True
        )
    if scope_type == "article":
        if status != "not_applicable" or source != "not_observed":
            raise TrackerDataError(
                "article scope referrers must be not_applicable and not_observed"
            )
    elif status == "not_applicable":
        raise TrackerDataError("account scope referrers must not be not_applicable")
    return {
        "status": status,
        "source": source,
        "items": items,
        "reason": reason,
    }


def normalize_config(value: Any) -> Dict[str, Any]:
    config = require_object(value, "config")
    schema_version = config.get("schema_version")
    if (
        isinstance(schema_version, bool)
        or schema_version not in SUPPORTED_METRICS_SCHEMA_VERSIONS
    ):
        raise TrackerDataError("schema_version must be 1 or 2")
    expected_keys = INPUT_KEYS_V1 if schema_version == 1 else INPUT_KEYS_V2
    check_exact_keys(config, label="config", expected=expected_keys)
    request_id = require_text(
        config.get("request_id"), "request_id", maximum=128, one_line=True
    )
    if REQUEST_ID_PATTERN.fullmatch(request_id) is None:
        raise TrackerDataError("request_id has invalid format")
    run_id = require_text(config.get("run_id"), "run_id", maximum=132, one_line=True)
    if RUN_ID_PATTERN.fullmatch(run_id) is None:
        raise TrackerDataError("run_id has invalid format")
    collection_mode = config.get("collection_mode")
    if collection_mode not in {"manual", "scheduled"}:
        raise TrackerDataError("collection_mode must be manual or scheduled")
    note = config.get("note")
    if note is not None:
        note = require_text(note, "note", maximum=500)
    raw_observed_at = config.get("observed_at")
    if not isinstance(raw_observed_at, str):
        raise TrackerDataError("observed_at must be an ISO 8601 timestamp")
    observed_at = parse_timestamp(raw_observed_at, "observed_at")
    normalized = {
        "schema_version": schema_version,
        "request_id": request_id,
        "run_id": run_id,
        "collection_mode": collection_mode,
        "observed_at": observed_at,
    }
    if schema_version == 1:
        normalized.update(
            {
                "article": normalize_article(config.get("article")),
                "metrics": normalize_metrics(
                    config.get("metrics"),
                    names=LEGACY_METRIC_NAMES,
                    statuses=LEGACY_METRIC_STATUSES,
                    sources=LEGACY_METRIC_SOURCES,
                ),
                "note": note,
            }
        )
        return normalized

    if config.get("dashboard_surface") != "note_browser_dashboard":
        raise TrackerDataError(
            "dashboard_surface must be note_browser_dashboard for schema version 2"
        )
    scope = normalize_scope(config.get("scope"))
    metrics = normalize_metrics(
        config.get("metrics"),
        names=CURRENT_METRIC_NAMES,
        statuses=CURRENT_METRIC_STATUSES,
        sources=CURRENT_METRIC_SOURCES,
    )
    referrers = normalize_referrers(
        config.get("referrers"), scope_type=scope["type"]
    )
    raw_data_as_of = config.get("data_as_of")
    if raw_data_as_of is None:
        data_as_of = None
    elif isinstance(raw_data_as_of, str):
        data_as_of = parse_timestamp(raw_data_as_of, "data_as_of")
    else:
        raise TrackerDataError("data_as_of must be an ISO 8601 timestamp or null")
    has_available_data = any(
        item["status"] == "available" for item in metrics
    ) or referrers["status"] == "available"
    if has_available_data and data_as_of is None:
        raise TrackerDataError("data_as_of is required when observed data is available")
    if data_as_of is not None:
        if datetime.fromisoformat(data_as_of) > datetime.fromisoformat(observed_at):
            raise TrackerDataError("data_as_of must not be after observed_at")
    normalized.update(
        {
            "data_as_of": data_as_of,
            "dashboard_surface": "note_browser_dashboard",
            "period": normalize_period(config.get("period"), observed_at),
            "scope": scope,
            "metrics": metrics,
            "referrers": referrers,
            "note": note,
        }
    )
    return normalized


def load_json_argument(value: str) -> Dict[str, Any]:
    if value == "-":
        import sys

        text = sys.stdin.read()
    else:
        path = Path(value)
        if not path.is_file() or path.is_symlink():
            raise TrackerDataError("config file is missing or unsafe")
        text = path.read_text(encoding="utf-8")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise TrackerDataError("config is invalid JSON") from exc
    return require_object(parsed, "config")


def resolve_workspace(value: str, *, require_enabled: bool) -> Tuple[Path, str]:
    candidate = Path(value)
    if not candidate.is_absolute():
        raise TrackerDataError("workspace path must be absolute")
    if not candidate.is_dir() or candidate.is_symlink():
        raise TrackerDataError("workspace path is missing or unsafe")
    workspace = candidate.resolve()
    manifest_path = workspace / "workspace.json"
    settings_path = workspace / "strategy/operating-settings.json"
    history_path = workspace / "metrics/history.jsonl"
    registry_path = workspace / "articles/registry.jsonl"
    for path, label in (
        (manifest_path, "workspace.json"),
        (settings_path, "strategy/operating-settings.json"),
        (history_path, "metrics/history.jsonl"),
        (registry_path, "articles/registry.jsonl"),
    ):
        if not path.is_file() or path.is_symlink() or path.parent.is_symlink():
            raise TrackerDataError(f"{label} is missing or unsafe")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        settings = json.loads(settings_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise TrackerDataError("workspace manifest or settings is invalid") from exc
    if not isinstance(manifest, dict) or manifest.get("product_id") != "note-workspace":
        raise TrackerDataError("workspace is not a note Workspace")
    if manifest.get("schema_version") != SCHEMA_VERSION:
        raise TrackerDataError("workspace schema_version is not supported")
    if manifest.get("status") != "ready":
        raise TrackerDataError(
            "workspace is not ready; migration or hold must be resolved first"
        )
    if manifest.get("data_owner") != "user":
        raise TrackerDataError("workspace data_owner must be user")
    workspace_id = manifest.get("workspace_id")
    if not isinstance(workspace_id, str) or not workspace_id.startswith("nw-"):
        raise TrackerDataError("workspace_id is invalid")
    try:
        metrics_settings = settings["features"]["metrics_tracking"]
    except (KeyError, TypeError) as exc:
        raise TrackerDataError("metrics tracking settings are missing") from exc
    if metrics_settings.get("unavailable_value") != "unavailable":
        raise TrackerDataError("metrics unavailable value contract is invalid")
    if require_enabled and metrics_settings.get("enabled") is not True:
        raise TrackerDataError("metrics tracking is disabled for this workspace")
    return workspace, workspace_id


def iter_jsonl(path: Path, label: str) -> Iterator[Tuple[int, Dict[str, Any]]]:
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                value = json.loads(line)
            except json.JSONDecodeError as exc:
                raise TrackerDataError(f"{label} line {line_number} is invalid JSON") from exc
            yield line_number, require_object(value, f"{label} line {line_number}")


def load_history(workspace: Path) -> List[Dict[str, Any]]:
    return [event for _, event in iter_jsonl(workspace / "metrics/history.jsonl", "metrics history")]


def validate_article_reference(workspace: Path, article: Dict[str, Any]) -> None:
    if article["origin"] == "existing_public_article":
        return
    matches = []
    for _, event in iter_jsonl(workspace / "articles/registry.jsonl", "article registry"):
        if (
            event.get("event_type") == "draft_saved"
            and event.get("article_id") == article["article_id"]
            and event.get("revision") == article["article_revision"]
        ):
            matches.append(event)
    if len(matches) != 1:
        raise TrackerDataError(
            "workspace_draft must match exactly one article registry event"
        )
    actual_hash = sha256_text(canonical_json(matches[0]))
    if actual_hash != article["registry_event_sha256"]:
        raise TrackerDataError("article registry event hash does not match")


def payload_sha256(workspace_id: str, config: Dict[str, Any]) -> str:
    return sha256_text(canonical_json({"workspace_id": workspace_id, "config": config}))


def build_event(
    workspace_id: str, config: Dict[str, Any], *, recorded_at: str
) -> Dict[str, Any]:
    if datetime.fromisoformat(recorded_at) < datetime.fromisoformat(
        config["observed_at"]
    ):
        raise TrackerDataError("recorded_at must not be before observed_at")
    common = {
        "schema_version": config["schema_version"],
        "event_type": "metrics_observed",
        "request_id": config["request_id"],
        "payload_sha256": payload_sha256(workspace_id, config),
        "workspace_id": workspace_id,
        "run_id": config["run_id"],
        "collection_mode": config["collection_mode"],
        "observed_at": config["observed_at"],
        "recorded_at": recorded_at,
    }
    if config["schema_version"] == 1:
        common.update(
            {
                "article": config["article"],
                "metrics": config["metrics"],
                "note": config["note"],
                "external_actions": [],
            }
        )
    else:
        common.update(
            {
                "data_as_of": config["data_as_of"],
                "dashboard_surface": config["dashboard_surface"],
                "period": config["period"],
                "scope": config["scope"],
                "metrics": config["metrics"],
                "referrers": config["referrers"],
                "note": config["note"],
                "external_actions": [],
            }
        )
    return common


def event_to_config(event: Dict[str, Any]) -> Dict[str, Any]:
    keys = INPUT_KEYS_V1 if event.get("schema_version") == 1 else INPUT_KEYS_V2
    return normalize_config({key: event.get(key) for key in keys})


def validate_event_shape(event: Dict[str, Any], label: str) -> None:
    schema_version = event.get("schema_version")
    if (
        isinstance(schema_version, bool)
        or schema_version not in SUPPORTED_METRICS_SCHEMA_VERSIONS
    ):
        raise TrackerDataError(f"{label}.schema_version is invalid")
    expected_keys = EVENT_KEYS_V1 if schema_version == 1 else EVENT_KEYS_V2
    check_exact_keys(event, label=label, expected=expected_keys)
    if event.get("event_type") != "metrics_observed":
        raise TrackerDataError(f"{label}.event_type is invalid")
    payload_hash = require_text(
        event.get("payload_sha256"), f"{label}.payload_sha256", maximum=64
    )
    if HASH_PATTERN.fullmatch(payload_hash) is None:
        raise TrackerDataError(f"{label}.payload_sha256 is invalid")
    require_text(event.get("workspace_id"), f"{label}.workspace_id", maximum=72)
    parse_timestamp(event.get("recorded_at"), f"{label}.recorded_at")
    if event.get("external_actions") != []:
        raise TrackerDataError(f"{label}.external_actions must be empty")


def config_article(config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if config["schema_version"] == 1:
        return config["article"]
    return config["scope"]["article"]


def observation_identity(config: Dict[str, Any]) -> Tuple[str, ...]:
    if config["schema_version"] == 1:
        return (
            "legacy_views_v1",
            config["article"]["article_id"],
            config["observed_at"],
        )
    scope = config["scope"]
    scope_id = (
        scope["article"]["article_id"]
        if scope["type"] == "article"
        else "account"
    )
    period = config["period"]
    return (
        "dashboard_metrics_v2",
        scope_id,
        period["range_type"],
        "" if period["start_date"] is None else period["start_date"],
        period["end_date"],
        period["completeness"],
        config["observed_at"],
    )


def validate_metrics_history(workspace: Path, workspace_id: str) -> List[str]:
    errors: List[str] = []
    try:
        events = load_history(workspace)
    except (OSError, TrackerDataError) as exc:
        return [str(exc)]
    seen_requests = set()
    seen_observations = set()
    article_identity: Dict[str, Tuple[str, str]] = {}
    for index, event in enumerate(events, start=1):
        label = f"metrics history event {index}"
        try:
            validate_event_shape(event, label)
            if event["workspace_id"] != workspace_id:
                raise TrackerDataError(f"{label}.workspace_id does not match workspace")
            config = event_to_config(event)
            if datetime.fromisoformat(
                parse_timestamp(event["recorded_at"], f"{label}.recorded_at")
            ) < datetime.fromisoformat(config["observed_at"]):
                raise TrackerDataError(
                    f"{label}.recorded_at must not be before observed_at"
                )
            if payload_sha256(workspace_id, config) != event["payload_sha256"]:
                raise TrackerDataError(f"{label}.payload_sha256 does not match")
            article = config_article(config)
            if article is not None:
                validate_article_reference(workspace, article)
            if config["request_id"] in seen_requests:
                raise TrackerDataError(f"{label}.request_id is duplicated")
            seen_requests.add(config["request_id"])
            observation_key = observation_identity(config)
            if observation_key in seen_observations:
                raise TrackerDataError(
                    f"{label} duplicates metric definition, scope, period, and observed_at"
                )
            seen_observations.add(observation_key)
            if article is not None:
                identity = (
                    article["origin"],
                    article["public_url"],
                )
                article_id = article["article_id"]
                if (
                    article_id in article_identity
                    and article_identity[article_id] != identity
                ):
                    raise TrackerDataError(
                        f"{label} changes origin or public_url for an existing article_id"
                    )
                article_identity[article_id] = identity
        except (OSError, TrackerDataError) as exc:
            errors.append(str(exc))
    return errors


@contextmanager
def metrics_lock(workspace: Path, recorded_at: str) -> Iterator[None]:
    path = workspace / "metrics/.metrics.lock"
    try:
        with path.open("x", encoding="utf-8") as handle:
            handle.write(json_text({"operation": "record_metrics", "started_at": recorded_at}))
    except FileExistsError as exc:
        raise TrackerDataError("metrics lock already exists; reconcile it first") from exc
    try:
        yield
    finally:
        try:
            path.unlink()
        except FileNotFoundError:
            pass


def append_history(workspace: Path, event: Dict[str, Any]) -> None:
    path = workspace / "metrics/history.jsonl"
    if not path.is_file() or path.is_symlink() or path.parent.is_symlink():
        raise TrackerDataError("metrics/history.jsonl is missing or unsafe")
    with path.open("a", encoding="utf-8", newline="\n") as handle:
        handle.write(canonical_json(event) + "\n")
