#!/usr/bin/env python3
"""Create one immutable, approved registration package without browser actions."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Dict, Optional

from draft_common import (
    DraftDataError,
    build_registration_package,
    build_registration_source,
    draft_lock,
    ensure_latest_article_revision,
    ensure_store,
    json_text,
    load_all_registrations,
    load_json_argument,
    normalize_registration_input,
    parse_timestamp,
    read_events,
    registration_payload_hash,
    resolve_workspace,
    validate_note_draft_data,
    validate_approval_timing,
    write_new_text,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Save an approved note draft registration package locally."
    )
    parser.add_argument("workspace", help="Absolute path to the selected workspace")
    parser.add_argument("--config", required=True, help="Registration JSON path, or -")
    parser.add_argument("--timestamp", help="ISO 8601 timestamp override")
    return parser


def _output(package: Dict[str, Any], status: str) -> Dict[str, Any]:
    return {
        "status": status,
        "registration_status": package["status"],
        "article_id": package["article_id"],
        "article_revision": package["article_revision"],
        "registration_revision": package["registration_revision"],
        "registration_path": package["registration_path"],
        "external_actions": [],
    }


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        config = normalize_registration_input(
            load_json_argument(args.config, "draft registration config")
        )
        created_at = parse_timestamp(args.timestamp)

        with draft_lock(workspace, created_at):
            errors, _ = validate_note_draft_data(workspace)
            if errors:
                raise DraftDataError(
                    "existing note draft data is invalid: " + "; ".join(errors)
                )
            ensure_latest_article_revision(
                workspace, config["article_id"], config["article_revision"]
            )
            source = build_registration_source(workspace, config)
            payload_hash = registration_payload_hash(config, source)
            registrations = load_all_registrations(workspace)
            for package in registrations:
                if package["request_id"] != config["request_id"]:
                    continue
                if package["payload_sha256"] == payload_hash:
                    print(json.dumps(_output(package, "duplicate"), ensure_ascii=False, indent=2))
                    return 0
                raise DraftDataError(
                    "request_id is already used for a different draft registration"
                )
            validate_approval_timing(config, source, created_at)

            started = set()
            saved = set()
            for event in read_events(workspace):
                key = (
                    event.get("article_id"),
                    event.get("article_revision"),
                    event.get("registration_path"),
                )
                if event.get("event_type") == "note_draft_started":
                    started.add(key)
                elif event.get("event_type") == "note_draft_saved":
                    saved.add(key)
            target_keys = {
                key
                for key in started | saved
                if key[0] == config["article_id"] and key[1] == config["article_revision"]
            }
            if any(key in saved for key in target_keys):
                raise DraftDataError(
                    "this article revision already has a saved private note draft"
                )
            if any(key in started and key not in saved for key in target_keys):
                raise DraftDataError(
                    "this article revision has an unresolved external write"
                )

            revisions = [
                int(package["registration_revision"])
                for package in registrations
                if package["article_id"] == config["article_id"]
            ]
            revision = max(revisions, default=0) + 1
            relative = (
                f"articles/note-drafts/{config['article_id']}"
                f"-registration-r{revision:03d}.json"
            )
            package = build_registration_package(
                config,
                source,
                registration_revision=revision,
                created_at=created_at,
                registration_path=relative,
            )
            ensure_store(workspace)
            path = workspace / relative
            write_new_text(path, json_text(package))
            final_errors, _ = validate_note_draft_data(workspace)
            if final_errors:
                try:
                    path.unlink()
                except FileNotFoundError:
                    pass
                raise DraftDataError(
                    "saved registration failed validation: " + "; ".join(final_errors)
                )

        print(json.dumps(_output(package, "created"), ensure_ascii=False, indent=2))
        return 0
    except (OSError, UnicodeError, DraftDataError, json.JSONDecodeError) as exc:
        print(
            json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
