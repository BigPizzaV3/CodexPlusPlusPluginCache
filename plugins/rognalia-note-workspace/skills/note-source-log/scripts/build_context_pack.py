#!/usr/bin/env python3
"""Build one immutable, traceable context pack for an article."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from source_common import (
    ARTICLE_ID_PATTERN,
    CARD_ID_PATTERN,
    SCHEMA_VERSION,
    SourceDataError,
    append_jsonl,
    build_context_pack_event,
    canonical_hash,
    check_exact_keys,
    context_pack_registry_path,
    context_pack_payload,
    current_cards,
    exclusive_locks,
    load_card_events,
    load_context_pack_events,
    load_json,
    load_log_records,
    parse_timestamp,
    read_context_metadata,
    read_context_body,
    render_context_pack,
    require_id,
    require_text,
    require_text_list,
    resolve_workspace,
    text_hash,
    validate_card_events,
    validate_context_pack_events,
    validate_log_records,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build a source-card context pack without overwriting."
    )
    parser.add_argument("workspace", help="Absolute path to the selected workspace")
    parser.add_argument("--config", required=True, help="Context pack JSON path, or - for stdin")
    parser.add_argument("--timestamp", help="ISO 8601 timestamp override")
    return parser


def _normalize(raw: Dict[str, Any]) -> Dict[str, Any]:
    required = {
        "schema_version",
        "request_id",
        "article_id",
        "topic",
        "purpose",
        "source_card_ids",
        "approved_for_article",
        "missing_information",
    }
    check_exact_keys(raw, label="context pack config", allowed=required, required=required)
    if raw["schema_version"] != SCHEMA_VERSION:
        raise SourceDataError("context pack schema_version is not supported")
    selected = require_text_list(
        raw["source_card_ids"],
        "source_card_ids",
        allow_empty=False,
        id_pattern=CARD_ID_PATTERN,
    )
    approved = require_text_list(
        raw["approved_for_article"],
        "approved_for_article",
        id_pattern=CARD_ID_PATTERN,
    )
    if not set(approved).issubset(selected):
        raise SourceDataError("approved_for_article must be a subset of source_card_ids")
    missing_information = require_text_list(raw["missing_information"], "missing_information")
    if len(selected) > 100 or len(missing_information) > 100:
        raise SourceDataError("context pack arrays must contain at most 100 items")
    return {
        "request_id": require_id(raw["request_id"], "request_id"),
        "article_id": require_id(raw["article_id"], "article_id", ARTICLE_ID_PATTERN),
        "topic": require_text(raw["topic"], "topic", maximum=300),
        "purpose": require_text(raw["purpose"], "purpose", maximum=1000),
        "source_card_ids": selected,
        "approved_for_article": approved,
        "missing_information": missing_information,
    }


def _write_new(path: Path, content: str) -> None:
    descriptor = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())


def _cards_from_references(
    events: list[Dict[str, Any]],
    references: Any,
    selected_ids: list[str],
    created_at: str,
) -> Dict[str, Dict[str, Any]]:
    if not isinstance(references, list):
        raise SourceDataError("context pack source card references are invalid")
    reference_ids = [
        item.get("source_card_id") for item in references if isinstance(item, dict)
    ]
    if len(reference_ids) != len(references) or reference_ids != selected_ids:
        raise SourceDataError("context pack source card references do not match input")
    _, created_moment = parse_timestamp(created_at)
    by_revision = {
        (event.get("source_card_id"), event.get("revision")): event
        for event in events
    }
    cards: Dict[str, Dict[str, Any]] = {}
    for reference in references:
        if set(reference) != {"source_card_id", "revision", "event_sha256"}:
            raise SourceDataError("context pack source card reference is invalid")
        card_id = reference["source_card_id"]
        revision = reference["revision"]
        card = by_revision.get((card_id, revision))
        if card is None or canonical_hash(card) != reference["event_sha256"]:
            raise SourceDataError("context pack source card reference does not match history")
        if card.get("status") != "active":
            raise SourceDataError("context pack source card reference is archived")
        eligible = []
        for candidate in events:
            if candidate.get("source_card_id") != card_id:
                continue
            _, updated_moment = parse_timestamp(candidate.get("updated_at"))
            if updated_moment <= created_moment:
                eligible.append(candidate.get("revision"))
        if not eligible or revision != max(eligible):
            raise SourceDataError(
                "context pack source card was not latest at the recorded creation time"
            )
        cards[card_id] = card
    return cards


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        config = _normalize(load_json(args.config))
        created_at, _ = parse_timestamp(args.timestamp)
        target = workspace / "context-packs" / f"{config['article_id']}.md"
        duplicate = False
        with exclusive_locks(
            [
                workspace / "primary-log/.append.lock",
                workspace / "source-cards/.cards.lock",
                workspace / "context-packs/.context-pack.lock",
            ],
            created_at,
        ):
            logs = load_log_records(workspace)
            events = load_card_events(workspace)
            errors = validate_log_records(logs) + validate_card_events(events, logs)
            if errors:
                raise SourceDataError("existing source data is invalid: " + "; ".join(errors))
            relative_path = f"context-packs/{config['article_id']}.md"
            registry_events = load_context_pack_events(workspace)
            registry_errors = validate_context_pack_events(registry_events)
            if registry_errors:
                raise SourceDataError(
                    "existing context pack registry is invalid: "
                    + "; ".join(registry_errors)
                )
            identity_event = None
            for registry_event in registry_events:
                if (
                    registry_event.get("request_id") == config["request_id"]
                    or registry_event.get("article_id") == config["article_id"]
                    or registry_event.get("path") == relative_path
                ):
                    if identity_event is not None:
                        raise SourceDataError("context pack registry identity is ambiguous")
                    identity_event = registry_event

            for existing_path in sorted((workspace / "context-packs").glob("*.md")):
                if existing_path.is_symlink():
                    raise SourceDataError(f"context pack path is unsafe: {existing_path}")
                metadata = read_context_metadata(existing_path)
                if (
                    metadata.get("request_id") == config["request_id"]
                    and existing_path != target
                ):
                    raise SourceDataError(
                        "request_id is already used for a different context pack"
                    )

            render_at = created_at
            cards: Dict[str, Dict[str, Any]]
            if identity_event is not None:
                if (
                    identity_event.get("request_id") != config["request_id"]
                    or identity_event.get("article_id") != config["article_id"]
                    or identity_event.get("path") != relative_path
                ):
                    raise SourceDataError(
                        "context pack registry identity is already used for different content"
                    )
                render_at = identity_event["created_at"]
                cards = _cards_from_references(
                    events,
                    identity_event["source_cards"],
                    config["source_card_ids"],
                    render_at,
                )
            elif target.exists() and target.is_file() and not target.is_symlink():
                existing_metadata = read_context_metadata(target)
                if existing_metadata.get("input") != context_pack_payload(config):
                    raise SourceDataError(
                        "context pack already exists; it was not overwritten"
                    )
                render_at = existing_metadata.get("created_at")
                cards = _cards_from_references(
                    events,
                    existing_metadata.get("source_cards"),
                    config["source_card_ids"],
                    render_at,
                )
            else:
                cards = current_cards(events)
                _, created_moment = parse_timestamp(render_at)
                for card_id in config["source_card_ids"]:
                    if card_id not in cards:
                        raise SourceDataError(f"source card does not exist: {card_id}")
                    if cards[card_id]["status"] != "active":
                        raise SourceDataError(f"source card is archived: {card_id}")
                    _, updated_moment = parse_timestamp(cards[card_id]["updated_at"])
                    if updated_moment > created_moment:
                        raise SourceDataError(
                            "context pack creation time is earlier than a selected "
                            "source card update"
                        )
            content, _ = render_context_pack(config, cards, render_at)
            expected_event = build_context_pack_event(content, relative_path)
            matching_event = None
            for registry_event in registry_events:
                same_identity = (
                    registry_event.get("request_id") == config["request_id"]
                    or registry_event.get("article_id") == config["article_id"]
                    or registry_event.get("path") == relative_path
                )
                if not same_identity:
                    continue
                if registry_event != expected_event:
                    raise SourceDataError(
                        "context pack registry identity is already used for different content"
                    )
                matching_event = registry_event

            if target.exists() or target.is_symlink():
                if not target.is_file() or target.is_symlink():
                    raise SourceDataError("context pack target is unsafe")
                existing_content = target.read_text(encoding="utf-8")
                if existing_content != content:
                    raise SourceDataError("context pack already exists; it was not overwritten")
                body = read_context_body(target)
                if read_context_metadata(target).get("body_sha256") != text_hash(body):
                    raise SourceDataError("existing context pack failed integrity validation")
                if matching_event is None:
                    append_jsonl(context_pack_registry_path(workspace), expected_event)
                duplicate = True
            elif matching_event is not None:
                _write_new(target, content)
                duplicate = True
            else:
                _write_new(target, content)
                append_jsonl(context_pack_registry_path(workspace), expected_event)

        if duplicate:
            print(
                json.dumps(
                    {
                        "status": "duplicate",
                        "article_id": config["article_id"],
                        "path": str(target.relative_to(workspace)),
                        "validation": "pass",
                        "external_actions": [],
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 0

        print(
            json.dumps(
                {
                    "status": "created",
                    "article_id": config["article_id"],
                    "path": str(target.relative_to(workspace)),
                    "validation": "pass",
                    "external_actions": [],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
