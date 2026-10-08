#!/usr/bin/env python3
"""Apply one explicitly approved strategy change to a local workspace."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Optional

from strategy_common import (
    StrategyDataError,
    atomic_replace_many,
    canonical_hash,
    exclusive_lock,
    load_json,
    load_strategy_history,
    normalize_strategy_change,
    parse_timestamp,
    read_strategy_state,
    render_strategy_updates,
    resolve_workspace,
    strategy_automation_follow_up,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Apply an approved note Workspace strategy change."
    )
    parser.add_argument(
        "workspace",
        help="Absolute path to the selected user workspace",
    )
    parser.add_argument(
        "--config",
        required=True,
        help="Strategy change JSON path, or - for stdin",
    )
    parser.add_argument(
        "--timestamp",
        help="ISO 8601 change timestamp override",
    )
    return parser


def _output(
    *,
    status: str,
    revision: int,
    event_id: str,
    changed_fields: list[str],
    automation_follow_up_required: bool,
) -> None:
    print(
        json.dumps(
            {
                "status": status,
                "revision": revision,
                "event_id": event_id,
                "changed_fields": changed_fields,
                "path": "strategy/change-history.jsonl",
                "validation": "pass",
                "automation_follow_up_required": (
                    automation_follow_up_required
                ),
                "external_actions": [],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        config = normalize_strategy_change(load_json(args.config))
        changed_at, changed_moment = parse_timestamp(args.timestamp)

        with exclusive_lock(
            workspace / "strategy/.change.lock",
            changed_at,
        ):
            (
                state,
                settings,
                manifest,
                profile_text,
                strategy_text,
            ) = read_strategy_state(workspace)
            events = load_strategy_history(
                workspace,
                state,
                settings,
                manifest,
            )
            for event in events:
                if event["request_id"] != config["request_id"]:
                    continue
                if canonical_hash(event["input"]) != canonical_hash(config):
                    raise StrategyDataError(
                        "request_id is already used for a different strategy change"
                    )
                _output(
                    status="duplicate",
                    revision=event["revision"],
                    event_id=event["event_id"],
                    changed_fields=sorted(config["changes"]),
                    automation_follow_up_required=(
                        strategy_automation_follow_up(settings)
                    ),
                )
                return 0

            if events:
                _, latest_moment = parse_timestamp(events[-1]["changed_at"])
                if changed_moment < latest_moment:
                    raise StrategyDataError(
                        "changed_at must not be earlier than the latest change"
                    )

            contents, event, _ = render_strategy_updates(
                workspace,
                config,
                changed_at,
                events,
                state,
                settings,
                manifest,
                profile_text,
                strategy_text,
            )
            atomic_replace_many(contents)

        _output(
            status="updated",
            revision=event["revision"],
            event_id=event["event_id"],
            changed_fields=sorted(config["changes"]),
            automation_follow_up_required=(
                strategy_automation_follow_up(settings)
            ),
        )
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(
            json.dumps(
                {"status": "error", "error": str(exc)},
                ensure_ascii=False,
            ),
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
