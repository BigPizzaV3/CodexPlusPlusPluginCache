#!/usr/bin/env python3
"""Record one ready user-visible task binding in a local workspace."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

from task_binding_common import (
    SCHEMA_VERSION,
    TaskBindingError,
    atomic_write_events,
    canonical_hash,
    consume_verified_challenge,
    exclusive_lock,
    load_events,
    load_json,
    normalize_input,
    parse_timestamp,
    expected_replacement,
    require_verified_challenge,
    resolve_workspace,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Record one ready role/task binding after external task setup."
    )
    parser.add_argument("workspace", help="Absolute path to the user workspace")
    parser.add_argument("--config", required=True, help="Binding JSON path, or - for stdin")
    parser.add_argument("--timestamp", help="ISO 8601 binding timestamp override")
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace, manifest, settings = resolve_workspace(args.workspace)
        config = normalize_input(
            load_json(args.config), settings, workspace, manifest
        )
        bound_at, moment = parse_timestamp(args.timestamp)
        registry = workspace / "strategy/role-task-bindings.jsonl"
        mode = settings["task_topology"]["mode"]
        generation = settings["task_topology"]["binding_generation"]
        _, ready_moment = parse_timestamp(
            config["ready_receipt"]["observed_at"]
        )
        _, verified_moment = parse_timestamp(
            config["ready_receipt"]["verified_at"]
        )
        if ready_moment > moment:
            raise TaskBindingError(
                "ready receipt must be observed before the binding is recorded"
            )
        if verified_moment > moment:
            raise TaskBindingError(
                "ready receipt must be verified before the binding is recorded"
            )
        payload_sha256 = canonical_hash(
            {
                "task_mode": mode,
                "binding_generation": generation,
                "binding": config,
            }
        )
        with exclusive_lock(workspace / "strategy/.task-binding.lock", bound_at):
            events = load_events(workspace, manifest, settings)
            if any(
                event["binding_generation"] == generation
                and event["task_mode"] != mode
                for event in events
            ):
                raise TaskBindingError(
                    "task mode changed without incrementing binding_generation"
                )
            for event in events:
                if event["request_id"] != config["request_id"]:
                    continue
                if event["payload_sha256"] != payload_sha256:
                    raise TaskBindingError(
                        "request_id is already used for a different binding"
                    )
                challenge = require_verified_challenge(
                    workspace,
                    manifest,
                    settings,
                    config,
                    allow_consumed_event_id=event["event_id"],
                )
                if challenge["status"] == "verified":
                    consume_verified_challenge(
                        workspace,
                        challenge,
                        event_id=event["event_id"],
                        consumed_at=event["bound_at"],
                    )
                print(
                    json.dumps(
                        {
                            "status": "duplicate",
                            "event_id": event["event_id"],
                            "role": event["role"],
                            "slot": event["slot"],
                            "validation": "pass",
                            "external_actions": [],
                        },
                        ensure_ascii=False,
                        indent=2,
                    )
                )
                return 0
            challenge_proof = config["ready_receipt"]["challenge_proof_sha256"]
            if any(
                event["ready_receipt"]["challenge_proof_sha256"]
                == challenge_proof
                for event in events
            ):
                raise TaskBindingError(
                    "ready challenge proof is already used by another binding"
                )
            challenge = require_verified_challenge(
                workspace, manifest, settings, config
            )
            current = expected_replacement(events, config, mode, generation)
            if current is None and config["replaces_event_id"] is not None:
                raise TaskBindingError("replaces_event_id refers to no active binding")
            if current is not None:
                if config["replaces_event_id"] != current["event_id"]:
                    raise TaskBindingError(
                        "replacing an active slot or reusing an active task requires its event_id"
                    )
            event_id = (
                "task-binding-"
                + moment.strftime("%Y%m%d")
                + "-"
                + canonical_hash(
                    {
                        "workspace_id": manifest["workspace_id"],
                        "bound_at": bound_at,
                        "task_mode": mode,
                        "binding_generation": generation,
                        "config": config,
                    }
                )[:12]
            )
            event = {
                **config,
                "schema_version": SCHEMA_VERSION,
                "event_id": event_id,
                "workspace_id": manifest["workspace_id"],
                "task_mode": mode,
                "binding_generation": generation,
                "bound_at": bound_at,
                "payload_sha256": payload_sha256,
            }
            candidate = events + [event]
            atomic_write_events(registry, candidate)
            load_events(workspace, manifest, settings)
            consume_verified_challenge(
                workspace,
                challenge,
                event_id=event_id,
                consumed_at=bound_at,
            )
        print(
            json.dumps(
                {
                    "status": "created" if current is None else "replaced",
                    "event_id": event_id,
                    "role": config["role"],
                    "slot": config["slot"],
                    "binding_generation": generation,
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
