#!/usr/bin/env python3
"""Replace the approved current standing instruction set with history."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Optional

from standing_instruction_common import (
    SCHEMA_VERSION,
    StandingInstructionError,
    atomic_replace_many,
    canonical_hash,
    exclusive_lock,
    json_text,
    load_json,
    normalize_config,
    parse_timestamp,
    render_history,
    resolve_workspace,
    validate_data,
)
from workspace_common import render_standing_instructions


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Update approved standing instructions in one local workspace."
    )
    parser.add_argument("workspace", help="Absolute path to the user workspace")
    parser.add_argument("--config", required=True, help="Approved JSON path, or -")
    parser.add_argument("--timestamp", help="ISO 8601 change timestamp override")
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace, manifest = resolve_workspace(args.workspace)
        config = normalize_config(load_json(args.config))
        changed_at, moment = parse_timestamp(args.timestamp)
        payload_sha256 = canonical_hash(config)
        with exclusive_lock(
            workspace / "profile/.standing-instructions.lock", changed_at
        ):
            state, events = validate_data(workspace, manifest)
            for event in events:
                if event["request_id"] != config["request_id"]:
                    continue
                if event["payload_sha256"] != payload_sha256:
                    raise StandingInstructionError(
                        "request_id is already used for a different standing instruction update"
                    )
                print(
                    json.dumps(
                        {
                            "status": "duplicate",
                            "revision": event["revision"],
                            "instruction_count": len(event["after"]),
                            "validation": "pass",
                            "external_actions": [],
                        },
                        ensure_ascii=False,
                        indent=2,
                    )
                )
                return 0
            if config["instructions"] == state["instructions"]:
                raise StandingInstructionError("standing instructions have no effective change")
            _, latest_moment = parse_timestamp(state["updated_at"])
            if moment < latest_moment:
                raise StandingInstructionError(
                    "changed_at must not be earlier than the current state"
                )
            revision = state["revision"] + 1
            event_id = (
                "standing-"
                + moment.strftime("%Y%m%d")
                + "-"
                + canonical_hash(
                    {
                        "workspace_id": manifest["workspace_id"],
                        "revision": revision,
                        "changed_at": changed_at,
                        "config": config,
                    }
                )[:12]
            )
            event = {
                "schema_version": SCHEMA_VERSION,
                "event_id": event_id,
                "request_id": config["request_id"],
                "revision": revision,
                "changed_at": changed_at,
                "reason": config["reason"],
                "approved_by_user": True,
                "before": state["instructions"],
                "after": config["instructions"],
                "before_sha256": canonical_hash(state["instructions"]),
                "after_sha256": canonical_hash(config["instructions"]),
                "payload_sha256": payload_sha256,
            }
            new_state = {
                "schema_version": SCHEMA_VERSION,
                "workspace_id": manifest["workspace_id"],
                "revision": revision,
                "updated_at": changed_at,
                "latest_event_id": event_id,
                "instructions": config["instructions"],
            }
            atomic_replace_many(
                {
                    workspace / "profile/standing-instructions.md": (
                        render_standing_instructions(config["instructions"]).rstrip()
                        + "\n"
                    ).encode("utf-8"),
                    workspace / "profile/standing-instructions.json": json_text(
                        new_state
                    ).encode("utf-8"),
                    workspace
                    / "profile/standing-instructions-history.jsonl": render_history(
                        events + [event]
                    ),
                }
            )
            validate_data(workspace, manifest)
        print(
            json.dumps(
                {
                    "status": "updated",
                    "revision": revision,
                    "instruction_count": len(config["instructions"]),
                    "validation": "pass",
                    "external_actions": [],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(
            json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
