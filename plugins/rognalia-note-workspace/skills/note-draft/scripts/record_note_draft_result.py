#!/usr/bin/env python3
"""Record a verified private note draft result after a browser adapter succeeds."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Dict, Optional

from draft_common import (
    DraftDataError,
    append_jsonl,
    build_result,
    build_saved_event,
    draft_lock,
    ensure_store,
    expected_urls,
    json_text,
    load_all_results,
    load_json_argument,
    load_registration,
    normalize_result_input,
    parse_timestamp,
    read_events,
    resolve_workspace,
    result_payload_hash,
    sha256_text,
    truncate_file,
    validate_note_draft_data,
    write_new_text,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Record a verified private note draft result locally."
    )
    parser.add_argument("workspace", help="Absolute path to the selected workspace")
    parser.add_argument("--config", required=True, help="Result JSON path, or -")
    return parser


def _output(result: Dict[str, Any], status: str) -> Dict[str, Any]:
    return {
        "status": status,
        "draft_status": result["status"],
        "article_id": result["article_id"],
        "article_revision": result["article_revision"],
        "registration_revision": result["registration_revision"],
        "result_path": result["result_path"],
        "draft_url": result["draft_url"],
        "external_actions_performed_by_script": [],
        "recorded_external_actions": result["external_actions"],
    }


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        config = normalize_result_input(
            load_json_argument(args.config, "draft result config")
        )
        lock_time = parse_timestamp(config["completed_at"])
        with draft_lock(workspace, lock_time):
            errors, _ = validate_note_draft_data(workspace)
            if errors:
                raise DraftDataError(
                    "existing note draft data is invalid: " + "; ".join(errors)
                )
            package, _, registration_hash = load_registration(
                workspace, config["registration_path"]
            )
            if [item["url"] for item in config["url_results"]] != expected_urls(package):
                raise DraftDataError("url_results do not match expected URLs")
            payload_hash = result_payload_hash(config, registration_hash)
            for existing in load_all_results(workspace):
                if existing["request_id"] != config["request_id"]:
                    continue
                if existing["payload_sha256"] == payload_hash:
                    print(json.dumps(_output(existing, "duplicate"), ensure_ascii=False, indent=2))
                    return 0
                raise DraftDataError(
                    "request_id is already used for a different draft result"
                )

            events = read_events(workspace)
            started = any(
                event.get("event_type") == "note_draft_started"
                and event.get("registration_path") == package["registration_path"]
                for event in events
            )
            saved = any(
                event.get("event_type") == "note_draft_saved"
                and event.get("registration_path") == package["registration_path"]
                for event in events
            )
            if not started:
                raise DraftDataError("draft result cannot be recorded before start")
            if saved:
                raise DraftDataError("draft result is already recorded")

            relative = (
                f"articles/note-drafts/{package['article_id']}-result-r"
                f"{package['registration_revision']:03d}.json"
            )
            result = build_result(
                config,
                package,
                registration_sha256=registration_hash,
                result_path=relative,
            )
            result_text = json_text(result)
            result_hash = sha256_text(result_text)
            _, registry = ensure_store(workspace)
            result_path = workspace / relative
            write_new_text(result_path, result_text)
            previous_size = registry.stat().st_size
            try:
                event = build_saved_event(
                    package,
                    result,
                    registration_sha256=registration_hash,
                    result_sha256=result_hash,
                )
                previous_size = append_jsonl(registry, event)
                final_errors, _ = validate_note_draft_data(workspace)
                if final_errors:
                    raise DraftDataError(
                        "saved result failed validation: " + "; ".join(final_errors)
                    )
            except Exception:
                truncate_file(registry, previous_size)
                try:
                    result_path.unlink()
                except FileNotFoundError:
                    pass
                raise

        print(json.dumps(_output(result, "created"), ensure_ascii=False, indent=2))
        return 0
    except (OSError, UnicodeError, DraftDataError, json.JSONDecodeError) as exc:
        print(
            json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
