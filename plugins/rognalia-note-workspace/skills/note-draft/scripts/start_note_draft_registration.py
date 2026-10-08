#!/usr/bin/env python3
"""Record the boundary immediately before the first external editor write."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Dict, Optional

from draft_common import (
    DraftDataError,
    append_jsonl,
    build_start_event,
    draft_lock,
    ensure_latest_article_revision,
    ensure_store,
    load_all_registrations,
    load_registration,
    parse_timestamp,
    read_events,
    resolve_workspace,
    truncate_file,
    validate_note_draft_data,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Record a note draft external-write start without opening a browser."
    )
    parser.add_argument("workspace", help="Absolute path to the selected workspace")
    parser.add_argument("--registration", required=True, help="Workspace-relative package path")
    parser.add_argument("--timestamp", help="ISO 8601 timestamp override")
    return parser


def _output(
    package: Dict[str, Any], status: str, *, reconciliation: bool
) -> Dict[str, Any]:
    return {
        "status": status,
        "registration_status": (
            "external_write_started" if status != "already_saved" else "saved_private_draft"
        ),
        "article_id": package["article_id"],
        "article_revision": package["article_revision"],
        "registration_revision": package["registration_revision"],
        "registration_path": package["registration_path"],
        "requires_reconciliation": reconciliation,
        "external_actions": [],
    }


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        created_at = parse_timestamp(args.timestamp)
        with draft_lock(workspace, created_at):
            errors, _ = validate_note_draft_data(workspace)
            if errors:
                raise DraftDataError(
                    "existing note draft data is invalid: " + "; ".join(errors)
                )
            package, _, registration_hash = load_registration(
                workspace, args.registration
            )
            ensure_latest_article_revision(
                workspace, package["article_id"], package["article_revision"]
            )
            events = read_events(workspace)
            started_paths = {
                event["registration_path"]
                for event in events
                if event.get("event_type") == "note_draft_started"
            }
            saved_paths = {
                event["registration_path"]
                for event in events
                if event.get("event_type") == "note_draft_saved"
            }
            if package["registration_path"] in saved_paths:
                print(
                    json.dumps(
                        _output(package, "already_saved", reconciliation=False),
                        ensure_ascii=False,
                        indent=2,
                    )
                )
                return 0
            if package["registration_path"] in started_paths:
                print(
                    json.dumps(
                        _output(package, "already_started", reconciliation=True),
                        ensure_ascii=False,
                        indent=2,
                    )
                )
                return 0

            registrations = load_all_registrations(workspace)
            latest = max(
                item["registration_revision"]
                for item in registrations
                if item["article_id"] == package["article_id"]
            )
            if package["registration_revision"] != latest:
                raise DraftDataError("only the latest registration package may be started")

            for event in events:
                if (
                    event.get("article_id") == package["article_id"]
                    and event.get("article_revision") == package["article_revision"]
                ):
                    if event.get("event_type") == "note_draft_saved":
                        raise DraftDataError(
                            "this article revision already has a saved private note draft"
                        )
                    if event.get("event_type") == "note_draft_started":
                        raise DraftDataError(
                            "this article revision has another unresolved external write"
                        )

            _, registry = ensure_store(workspace)
            event = build_start_event(package, registration_hash, created_at)
            previous_size = append_jsonl(registry, event)
            final_errors, _ = validate_note_draft_data(workspace)
            if final_errors:
                truncate_file(registry, previous_size)
                raise DraftDataError(
                    "start event failed validation: " + "; ".join(final_errors)
                )

        print(
            json.dumps(
                _output(package, "started", reconciliation=False),
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    except (OSError, UnicodeError, DraftDataError, json.JSONDecodeError) as exc:
        print(
            json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
