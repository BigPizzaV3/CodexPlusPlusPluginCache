#!/usr/bin/env python3
"""Save one approved note style-profile revision to a user workspace."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Optional

from style_common import (
    StyleProfileError,
    begin_style_transaction,
    build_event,
    build_metadata,
    history_dir,
    json_text,
    load_events,
    load_json_argument,
    normalize_config,
    parse_timestamp,
    payload_sha256,
    render_profile,
    recover_style_transaction,
    resolve_workspace,
    sha256_text,
    style_lock,
    validate_style_data,
)


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(
        description="Save an approved note Workspace style profile revision."
    )
    value.add_argument("workspace", help="Absolute path to the user workspace")
    value.add_argument("--config", required=True, help="Input JSON path or - for stdin")
    value.add_argument("--timestamp", help="ISO 8601 save time override")
    return value


def output(event: dict, status: str) -> dict:
    return {
        "status": status,
        "revision": event["revision"],
        "profile_path": "profile/style-profile.md",
        "history_profile_path": event["profile_path"],
        "metadata_path": event["metadata_path"],
        "validation": "pass",
        "external_actions": [],
    }


def main(argv: Optional[list[str]] = None) -> int:
    args = parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        config = normalize_config(load_json_argument(args.config))
        saved_at = parse_timestamp(args.timestamp)
        with style_lock(workspace, saved_at):
            recover_style_transaction(workspace)
            errors = validate_style_data(workspace)
            if errors:
                raise StyleProfileError(
                    "existing style profile data is invalid: " + "; ".join(errors)
                )
            events = load_events(workspace)
            payload_hash = payload_sha256(config)
            for event in events:
                if event["request_id"] != config["request_id"]:
                    continue
                if event["payload_sha256"] == payload_hash:
                    print(json.dumps(output(event, "duplicate"), ensure_ascii=False, indent=2))
                    return 0
                raise StyleProfileError(
                    "request_id is already used for a different style profile payload"
                )

            revision = len(events) + 1
            suffix = f"style-profile-r{revision:03d}"
            profile_relative = f"profile/style-profile-history/{suffix}.md"
            metadata_relative = f"profile/style-profile-history/{suffix}.json"
            profile_text = render_profile(config)
            profile_hash = sha256_text(profile_text)
            metadata = build_metadata(
                config,
                revision=revision,
                saved_at=saved_at,
                profile_path=profile_relative,
                profile_hash=profile_hash,
            )
            metadata_text = json_text(metadata)
            event = build_event(metadata, metadata_relative, sha256_text(metadata_text))
            directory = history_dir(workspace)
            if directory.exists() and (not directory.is_dir() or directory.is_symlink()):
                raise StyleProfileError("style profile history directory is unsafe")
            directory.mkdir(exist_ok=True)
            begin_style_transaction(
                workspace,
                profile_text=profile_text,
                metadata_text=metadata_text,
                event=event,
            )
            recovered = recover_style_transaction(workspace)
            if recovered != event:
                raise StyleProfileError("style profile transaction did not commit")
            errors = validate_style_data(workspace)
            if errors:
                raise StyleProfileError("saved style profile is invalid: " + "; ".join(errors))
            print(json.dumps(output(event, "saved"), ensure_ascii=False, indent=2))
            return 0
    except (OSError, StyleProfileError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
