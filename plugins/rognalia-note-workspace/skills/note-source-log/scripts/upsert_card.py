#!/usr/bin/env python3
"""Append a new source-card revision without rewriting history."""

from __future__ import annotations

import argparse
import json
import sys
import uuid
from typing import Any, Dict, Optional

from source_common import (
    CARD_ID_PATTERN,
    CARD_KINDS,
    CARD_STATUSES,
    LOG_ID_PATTERN,
    SCHEMA_VERSION,
    STATEMENT_TYPES,
    VISIBILITIES,
    SourceDataError,
    append_jsonl,
    canonical_hash,
    card_payload,
    check_exact_keys,
    current_cards,
    exclusive_locks,
    load_card_events,
    load_json,
    load_log_records,
    parse_timestamp,
    require_id,
    require_text,
    require_text_list,
    resolve_workspace,
    validate_card_events,
    validate_log_records,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create or revise one source card in a note Workspace."
    )
    parser.add_argument("workspace", help="Absolute path to the selected workspace")
    parser.add_argument("--config", required=True, help="Card JSON path, or - for stdin")
    parser.add_argument("--timestamp", help="ISO 8601 timestamp override")
    return parser


def _normalize(raw: Dict[str, Any]) -> Dict[str, Any]:
    required = {
        "schema_version",
        "request_id",
        "source_log_ids",
        "kind",
        "statement_type",
        "summary",
        "topics",
        "public_scope",
    }
    check_exact_keys(
        raw,
        label="card config",
        allowed=required | {"source_card_id", "exact_words", "status"},
        required=required,
    )
    if raw["schema_version"] != SCHEMA_VERSION:
        raise SourceDataError("card config schema_version is not supported")
    kind = raw["kind"]
    statement_type = raw["statement_type"]
    public_scope = raw["public_scope"]
    status = raw.get("status", "active")
    if kind not in CARD_KINDS:
        raise SourceDataError("kind is invalid")
    if statement_type not in STATEMENT_TYPES:
        raise SourceDataError("statement_type is invalid")
    if public_scope not in VISIBILITIES:
        raise SourceDataError("public_scope is invalid")
    if status not in CARD_STATUSES:
        raise SourceDataError("status is invalid")
    topics = require_text_list(raw["topics"], "topics")
    if len(topics) > 20:
        raise SourceDataError("topics must contain at most 20 items")
    exact_words = raw.get("exact_words")
    if exact_words is not None:
        exact_words = require_text(exact_words, "exact_words", preserve=True, maximum=20000)
    card_id = raw.get("source_card_id")
    if card_id is not None:
        card_id = require_id(card_id, "source_card_id", CARD_ID_PATTERN)
    source_log_ids = require_text_list(
        raw["source_log_ids"],
        "source_log_ids",
        allow_empty=False,
        id_pattern=LOG_ID_PATTERN,
    )
    if len(source_log_ids) > 100:
        raise SourceDataError("source_log_ids must contain at most 100 items")
    return {
        "request_id": require_id(raw["request_id"], "request_id"),
        "source_card_id": card_id,
        "source_log_ids": source_log_ids,
        "kind": kind,
        "statement_type": statement_type,
        "summary": require_text(raw["summary"], "summary", maximum=4000),
        "exact_words": exact_words,
        "topics": topics,
        "public_scope": public_scope,
        "status": status,
    }


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        config = _normalize(load_json(args.config))
        updated_at, _ = parse_timestamp(args.timestamp)
        target = workspace / "source-cards/cards.jsonl"
        with exclusive_locks(
            [
                workspace / "primary-log/.append.lock",
                workspace / "source-cards/.cards.lock",
            ],
            updated_at,
        ):
            logs = load_log_records(workspace)
            log_errors = validate_log_records(logs)
            events = load_card_events(workspace)
            card_errors = validate_card_events(events, logs)
            if log_errors or card_errors:
                raise SourceDataError(
                    "existing source data is invalid: " + "; ".join(log_errors + card_errors)
                )
            log_ids = {record["log_id"] for record in logs}
            missing = [value for value in config["source_log_ids"] if value not in log_ids]
            if missing:
                raise SourceDataError("source_log_ids do not exist: " + ", ".join(missing))
            assistant_ids = {
                record["log_id"] for record in logs
                if record.get("speaker", "user") != "user"
            }
            if assistant_ids.intersection(config["source_log_ids"]):
                raise SourceDataError("assistant records cannot be source material")

            by_request = {event["request_id"]: event for event in events}
            existing_request = by_request.get(config["request_id"])
            if existing_request is not None:
                if config["source_card_id"] is None:
                    config["source_card_id"] = existing_request["source_card_id"]
                prospective_hash = canonical_hash(card_payload(config))
                if (
                    config["source_card_id"] != existing_request["source_card_id"]
                    or prospective_hash != existing_request["payload_sha256"]
                ):
                    raise SourceDataError("request_id is already used for a different card change")
                print(
                    json.dumps(
                        {
                            "status": "duplicate",
                            "source_card_id": existing_request["source_card_id"],
                            "revision": existing_request["revision"],
                            "path": "source-cards/cards.jsonl",
                            "validation": "pass",
                            "external_actions": [],
                        },
                        ensure_ascii=False,
                        indent=2,
                    )
                )
                return 0

            card_id = config["source_card_id"] or f"src-{uuid.uuid4().hex[:12]}"
            require_id(card_id, "source_card_id", CARD_ID_PATTERN)
            cards = current_cards(events)
            previous = cards.get(card_id)
            revision = previous["revision"] + 1 if previous is not None else 1
            event = {
                "schema_version": SCHEMA_VERSION,
                "event_id": f"evt-{uuid.uuid4().hex[:12]}",
                "event_type": "updated" if previous is not None else "created",
                "request_id": config["request_id"],
                "source_card_id": card_id,
                "revision": revision,
                "source_log_ids": config["source_log_ids"],
                "kind": config["kind"],
                "statement_type": config["statement_type"],
                "summary": config["summary"],
                "exact_words": config["exact_words"],
                "topics": config["topics"],
                "public_scope": config["public_scope"],
                "status": config["status"],
                "created_at": previous["created_at"] if previous is not None else updated_at,
                "updated_at": updated_at,
            }
            event["payload_sha256"] = canonical_hash(card_payload(event))
            exact_words = event["exact_words"]
            log_by_id = {record["log_id"]: record for record in logs}
            if exact_words is not None and not any(
                exact_words in log_by_id[log_id]["original_text"]
                for log_id in event["source_log_ids"]
            ):
                raise SourceDataError("exact_words is not present in the referenced source logs")
            append_jsonl(target, event)

        print(
            json.dumps(
                {
                    "status": "created" if revision == 1 else "updated",
                    "source_card_id": card_id,
                    "revision": revision,
                    "path": "source-cards/cards.jsonl",
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
