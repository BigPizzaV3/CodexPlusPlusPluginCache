#!/usr/bin/env python3
"""Record one prepared metrics observation in a user-owned workspace."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Optional

from tracker_common import (
    TrackerDataError,
    append_history,
    build_event,
    config_article,
    event_to_config,
    load_history,
    load_json_argument,
    metrics_lock,
    normalize_config,
    observation_identity,
    parse_timestamp,
    payload_sha256,
    resolve_workspace,
    validate_article_reference,
    validate_metrics_history,
)


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(
        description="Record one note Workspace metrics observation."
    )
    value.add_argument("workspace", help="Absolute path to the user workspace")
    value.add_argument("--config", required=True, help="Input JSON path or - for stdin")
    value.add_argument("--timestamp", help="ISO 8601 record time override")
    return value


def output(event: dict, status: str) -> dict:
    if event["schema_version"] == 1:
        scope_type = "article"
        article_id = event["article"]["article_id"]
    else:
        scope_type = event["scope"]["type"]
        article = event["scope"]["article"]
        article_id = None if article is None else article["article_id"]
    return {
        "status": status,
        "request_id": event["request_id"],
        "schema_version": event["schema_version"],
        "scope": scope_type,
        "article_id": article_id,
        "observed_at": event["observed_at"],
        "history_path": "metrics/history.jsonl",
        "validation": "pass",
        "external_actions_performed_by_script": [],
    }


def main(argv: Optional[list[str]] = None) -> int:
    args = parser().parse_args(argv)
    try:
        workspace, workspace_id = resolve_workspace(args.workspace, require_enabled=True)
        config = normalize_config(load_json_argument(args.config))
        recorded_at = parse_timestamp(args.timestamp)
        with metrics_lock(workspace, recorded_at):
            errors = validate_metrics_history(workspace, workspace_id)
            if errors:
                raise TrackerDataError(
                    "existing metrics history is invalid: " + "; ".join(errors)
                )
            article = config_article(config)
            if article is not None:
                validate_article_reference(workspace, article)
            payload_hash = payload_sha256(workspace_id, config)
            events = load_history(workspace)
            for event in events:
                if event["request_id"] != config["request_id"]:
                    continue
                if event["payload_sha256"] == payload_hash:
                    print(json.dumps(output(event, "duplicate"), ensure_ascii=False, indent=2))
                    return 0
                raise TrackerDataError(
                    "request_id is already used for a different metrics observation"
                )
            requested_identity = observation_identity(config)
            for event in events:
                if observation_identity(event_to_config(event)) == requested_identity:
                    raise TrackerDataError(
                        "metric definition, scope, period, and observed_at already identify another observation"
                    )
            event = build_event(workspace_id, config, recorded_at=recorded_at)
            append_history(workspace, event)
            errors = validate_metrics_history(workspace, workspace_id)
            if errors:
                raise TrackerDataError(
                    "saved metrics observation is invalid: " + "; ".join(errors)
                )
            print(json.dumps(output(event, "saved"), ensure_ascii=False, indent=2))
            return 0
    except (OSError, TrackerDataError) as exc:
        print(json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
