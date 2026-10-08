#!/usr/bin/env python3
"""Validate traceability and integrity of source data in one workspace."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List, Optional

from source_common import (
    ARTICLE_ID_PATTERN,
    CARD_ID_PATTERN,
    ID_PATTERN,
    SCHEMA_VERSION,
    SourceDataError,
    build_context_pack_event,
    canonical_hash,
    current_cards,
    exclusive_locks,
    load_card_events,
    load_context_pack_events,
    load_log_records,
    parse_timestamp,
    read_context_body,
    read_context_metadata,
    render_context_pack,
    resolve_workspace,
    text_hash,
    validate_card_events,
    validate_context_pack_events,
    validate_log_records,
)


SHA256_PATTERN = re.compile(r"[0-9a-f]{64}")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate note Workspace source data.")
    parser.add_argument("workspace", help="Absolute path to the selected workspace")
    return parser


def _validate_context_packs(workspace: Path, events: List[dict]) -> List[str]:
    errors: List[str] = []
    request_paths: Dict[str, Path] = {}
    try:
        registry_events = load_context_pack_events(workspace)
    except SourceDataError as exc:
        return [str(exc)]
    errors.extend(validate_context_pack_events(registry_events))
    registry_by_path = {
        event.get("path"): event
        for event in registry_events
        if isinstance(event.get("path"), str)
    }
    pack_paths = {
        str(path.relative_to(workspace))
        for path in (workspace / "context-packs").glob("*.md")
        if path.is_file() and not path.is_symlink()
    }
    for relative in sorted(set(registry_by_path) - pack_paths):
        errors.append(f"{relative}: context pack registry points to a missing pack")
    cards_by_revision = {
        (event.get("source_card_id"), event.get("revision")): event
        for event in events
        if isinstance(event.get("source_card_id"), str)
        and isinstance(event.get("revision"), int)
        and not isinstance(event.get("revision"), bool)
    }
    required = {
        "schema_version",
        "request_id",
        "payload_sha256",
        "body_sha256",
        "article_id",
        "created_at",
        "source_card_ids",
        "approved_for_article",
        "input",
        "source_cards",
    }
    for path in sorted((workspace / "context-packs").glob("*.md")):
        relative = str(path.relative_to(workspace))
        if path.is_symlink() or not path.is_file():
            errors.append(f"{relative}: context pack path is unsafe")
            continue
        try:
            metadata = read_context_metadata(path)
            body = read_context_body(path)
            full_text = path.read_text(encoding="utf-8")
        except (OSError, SourceDataError) as exc:
            errors.append(str(exc))
            continue
        if set(metadata) != required:
            errors.append(f"{relative}: metadata fields do not match schema")
            continue
        article_id = metadata.get("article_id")
        request_id = metadata.get("request_id")
        if not isinstance(article_id, str) or not ARTICLE_ID_PATTERN.fullmatch(article_id):
            errors.append(f"{relative}: invalid article_id")
        elif path.stem != article_id:
            errors.append(f"{relative}: article_id does not match filename")
        if not isinstance(request_id, str) or not ID_PATTERN.fullmatch(request_id):
            errors.append(f"{relative}: invalid request_id")
        elif request_id in request_paths:
            errors.append(f"{relative}: duplicate request_id {request_id}")
        else:
            request_paths[request_id] = path
        if metadata.get("schema_version") != SCHEMA_VERSION:
            errors.append(f"{relative}: unsupported schema_version")
        for hash_field in ("payload_sha256", "body_sha256"):
            value = metadata.get(hash_field)
            if not isinstance(value, str) or not SHA256_PATTERN.fullmatch(value):
                errors.append(f"{relative}: invalid {hash_field}")
        if metadata.get("body_sha256") != text_hash(body):
            errors.append(f"{relative}: body_sha256 mismatch")
        created_moment = None
        try:
            _, created_moment = parse_timestamp(metadata.get("created_at"))
        except (SourceDataError, AttributeError):
            errors.append(f"{relative}: invalid created_at")
        registry_event = registry_by_path.get(relative)
        if registry_event is None:
            errors.append(f"{relative}: context pack has no registry event")
        else:
            try:
                expected_registry_event = build_context_pack_event(full_text, relative)
                if registry_event != expected_registry_event:
                    errors.append(f"{relative}: context pack does not match registry event")
            except (KeyError, SourceDataError, TypeError) as exc:
                errors.append(f"{relative}: context pack registry binding is invalid: {exc}")
        selected = metadata.get("source_card_ids")
        approved = metadata.get("approved_for_article")
        if not isinstance(selected, list) or not selected:
            errors.append(f"{relative}: source_card_ids must not be empty")
            selected = []
        if not isinstance(approved, list):
            errors.append(f"{relative}: approved_for_article must be an array")
            approved = []
        if len(selected) > 100 or len(approved) > 100:
            errors.append(f"{relative}: card ID arrays must contain at most 100 items")
        selected_strings = [value for value in selected if isinstance(value, str)]
        approved_strings = [value for value in approved if isinstance(value, str)]
        if len(selected_strings) != len(selected) or len(approved_strings) != len(approved):
            errors.append(f"{relative}: card ID arrays must contain only strings")
        if (
            len(selected_strings) != len(set(selected_strings))
            or len(approved_strings) != len(set(approved_strings))
        ):
            errors.append(f"{relative}: card ID arrays must not contain duplicates")
        if not set(approved_strings).issubset(set(selected_strings)):
            errors.append(f"{relative}: approved cards must be selected")
        input_value = metadata.get("input")
        input_keys = {
            "schema_version",
            "request_id",
            "article_id",
            "topic",
            "purpose",
            "source_card_ids",
            "approved_for_article",
            "missing_information",
        }
        input_valid = isinstance(input_value, dict) and set(input_value) == input_keys
        if not input_valid:
            errors.append(f"{relative}: input metadata fields do not match schema")
        else:
            if input_value.get("schema_version") != SCHEMA_VERSION:
                errors.append(f"{relative}: input schema_version is unsupported")
            if input_value.get("request_id") != request_id:
                errors.append(f"{relative}: input request_id does not match")
            if input_value.get("article_id") != article_id:
                errors.append(f"{relative}: input article_id does not match")
            if input_value.get("source_card_ids") != selected:
                errors.append(f"{relative}: input source_card_ids do not match")
            if input_value.get("approved_for_article") != approved:
                errors.append(f"{relative}: input approved_for_article does not match")
            for field, maximum in (("topic", 300), ("purpose", 1000)):
                value = input_value.get(field)
                if not isinstance(value, str) or not value.strip() or len(value) > maximum:
                    errors.append(f"{relative}: input {field} is invalid")
            missing = input_value.get("missing_information")
            if (
                not isinstance(missing, list)
                or len(missing) > 100
                or any(
                    not isinstance(value, str)
                    or not value.strip()
                    or len(value) > 4000
                    for value in missing
                )
                or len(missing) != len(set(value for value in missing if isinstance(value, str)))
            ):
                errors.append(f"{relative}: input missing_information is invalid")

        source_refs = metadata.get("source_cards")
        refs_valid = isinstance(source_refs, list) and len(source_refs) == len(selected_strings)
        referenced_cards: Dict[str, dict] = {}
        if not refs_valid:
            errors.append(f"{relative}: source_cards metadata does not match selection")
            source_refs = []
        for index, reference in enumerate(source_refs):
            if not isinstance(reference, dict) or set(reference) != {
                "source_card_id",
                "revision",
                "event_sha256",
            }:
                errors.append(f"{relative}: source_cards[{index}] is invalid")
                refs_valid = False
                continue
            card_id = reference.get("source_card_id")
            revision = reference.get("revision")
            event_hash = reference.get("event_sha256")
            if index >= len(selected_strings) or card_id != selected_strings[index]:
                errors.append(f"{relative}: source_cards order does not match selection")
                refs_valid = False
                continue
            if isinstance(revision, bool) or not isinstance(revision, int) or revision < 1:
                errors.append(f"{relative}: source card revision is invalid")
                refs_valid = False
                continue
            if not isinstance(event_hash, str) or not SHA256_PATTERN.fullmatch(event_hash):
                errors.append(f"{relative}: source card event_sha256 is invalid")
                refs_valid = False
                continue
            card = cards_by_revision.get((card_id, revision))
            if card is None:
                errors.append(f"{relative}: referenced source card revision is missing")
                refs_valid = False
                continue
            if canonical_hash(card) != event_hash:
                errors.append(f"{relative}: source card event_sha256 mismatch")
                refs_valid = False
                continue
            if card.get("status") != "active":
                errors.append(f"{relative}: referenced source card revision is archived")
                refs_valid = False
                continue
            if created_moment is not None:
                eligible_revisions = []
                for candidate in events:
                    if candidate.get("source_card_id") != card_id:
                        continue
                    try:
                        _, updated_moment = parse_timestamp(candidate.get("updated_at"))
                    except (SourceDataError, AttributeError):
                        continue
                    candidate_revision = candidate.get("revision")
                    if (
                        updated_moment <= created_moment
                        and isinstance(candidate_revision, int)
                        and not isinstance(candidate_revision, bool)
                    ):
                        eligible_revisions.append(candidate_revision)
                if not eligible_revisions or revision != max(eligible_revisions):
                    errors.append(
                        f"{relative}: referenced source card was not the latest revision at creation"
                    )
                    refs_valid = False
                    continue
            referenced_cards[card_id] = card

        for card_id in selected:
            if not isinstance(card_id, str) or not CARD_ID_PATTERN.fullmatch(card_id):
                errors.append(f"{relative}: invalid source card ID")
        if input_valid and refs_valid and len(referenced_cards) == len(selected_strings):
            expected_payload_hash = canonical_hash(
                {"input": input_value, "source_cards": source_refs}
            )
            if metadata.get("payload_sha256") != expected_payload_hash:
                errors.append(f"{relative}: payload_sha256 mismatch")
            try:
                expected_content, rendered_payload_hash = render_context_pack(
                    input_value,
                    referenced_cards,
                    metadata.get("created_at"),
                )
                _, expected_body = expected_content.split("\n\n", 1)
                if rendered_payload_hash != expected_payload_hash:
                    errors.append(f"{relative}: rendered payload hash mismatch")
                if body != expected_body:
                    errors.append(f"{relative}: body does not match recorded inputs")
            except (KeyError, TypeError, ValueError) as exc:
                errors.append(f"{relative}: recorded inputs cannot rebuild body: {exc}")
    return errors


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        validated_at, _ = parse_timestamp(None)
        with exclusive_locks(
            [
                workspace / "primary-log/.append.lock",
                workspace / "source-cards/.cards.lock",
                workspace / "context-packs/.context-pack.lock",
            ],
            validated_at,
        ):
            logs = load_log_records(workspace)
            events = load_card_events(workspace)
            cards = current_cards(events)
            errors = validate_log_records(logs)
            errors += validate_card_events(events, logs)
            errors += _validate_context_packs(workspace, events)
        payload = {
            "status": "pass" if not errors else "fail",
            "counts": {
                "log_records": len(logs),
                "card_events": len(events),
                "current_cards": len(cards),
                "context_packs": len(list((workspace / "context-packs").glob("*.md"))),
            },
            "errors": errors,
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0 if not errors else 1
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
