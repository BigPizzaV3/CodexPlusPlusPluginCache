#!/usr/bin/env python3
"""Save an immutable note article draft revision and registry event."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from writer_common import (
    WriterDataError,
    append_registry,
    article_lock,
    article_payload_hash,
    json_text,
    load_body_file,
    load_json_argument,
    load_registry,
    metadata_object,
    normalize_config,
    parse_timestamp,
    read_context_pack,
    registry_event,
    render_draft,
    resolve_workspace,
    sha256_text,
    validate_article_data,
    validate_weekly_plan_reference,
    write_new_text,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Save one validated note article draft revision without external actions."
    )
    parser.add_argument("workspace", help="Absolute path to the selected workspace")
    parser.add_argument("--config", required=True, help="Article package JSON path, or -")
    parser.add_argument("--body-file", required=True, help="UTF-8 body Markdown path")
    parser.add_argument("--timestamp", help="ISO 8601 timestamp override")
    return parser


def _output(event: Dict[str, Any], status: str) -> Dict[str, Any]:
    return {
        "status": status,
        "article_id": event["article_id"],
        "revision": event["revision"],
        "draft_path": event["draft_path"],
        "metadata_path": event["metadata_path"],
        "selected_title": event["selected_title"],
        "validation": "pass",
        "external_actions": [],
    }


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        config = normalize_config(load_json_argument(args.config))
        body = load_body_file(args.body_file)
        created_at = parse_timestamp(args.timestamp)
        validate_weekly_plan_reference(workspace, config)
        _, _, _, context_hash = read_context_pack(workspace, config)
        body_hash = sha256_text(body)
        payload_hash = article_payload_hash(config, body_hash, context_hash)

        with article_lock(workspace, created_at):
            existing_errors = validate_article_data(workspace)
            if existing_errors:
                raise WriterDataError(
                    "existing article data is invalid: " + "; ".join(existing_errors)
                )
            events = load_registry(workspace)
            for event in events:
                if event["request_id"] != config["request_id"]:
                    continue
                if event["payload_sha256"] == payload_hash:
                    print(json.dumps(_output(event, "duplicate"), ensure_ascii=False, indent=2))
                    return 0
                raise WriterDataError("request_id is already used for different article content")

            revisions = [
                int(event["revision"])
                for event in events
                if event["article_id"] == config["article_id"]
            ]
            revision = max(revisions, default=0) + 1
            stem = f"{config['article_id']}-r{revision:03d}"
            draft_relative = f"articles/drafts/{stem}.md"
            metadata_relative = f"articles/drafts/{stem}.json"
            draft_path = workspace / draft_relative
            metadata_path = workspace / metadata_relative
            draft = render_draft(body, config["note_tags"])
            draft_hash = sha256_text(draft)
            metadata = metadata_object(
                config,
                revision=revision,
                created_at=created_at,
                context_pack_sha256=context_hash,
                body_sha256=body_hash,
                draft_sha256=draft_hash,
                draft_path=draft_relative,
                metadata_path=metadata_relative,
                payload_sha256=payload_hash,
            )
            metadata_text = json_text(metadata)
            event = registry_event(metadata, sha256_text(metadata_text))

            created = []
            try:
                write_new_text(draft_path, draft)
                created.append(draft_path)
                write_new_text(metadata_path, metadata_text)
                created.append(metadata_path)
                append_registry(workspace / "articles/registry.jsonl", event)
            except Exception:
                for path in reversed(created):
                    try:
                        path.unlink()
                    except FileNotFoundError:
                        pass
                raise

        final_errors = validate_article_data(workspace)
        if final_errors:
            raise WriterDataError(
                "saved article failed validation: " + "; ".join(final_errors)
            )
        print(json.dumps(_output(event, "created"), ensure_ascii=False, indent=2))
        return 0
    except (OSError, UnicodeError, WriterDataError, json.JSONDecodeError) as exc:
        print(
            json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
