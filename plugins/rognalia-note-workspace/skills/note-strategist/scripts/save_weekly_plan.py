#!/usr/bin/env python3
"""Save one strategy recommendation or user-selected weekly-plan revision."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

from strategy_common import (
    SCHEMA_VERSION,
    StrategyDataError,
    atomic_write_text,
    build_tracking_review,
    build_source_snapshots,
    exclusive_locks,
    load_all_weekly_plans,
    load_json,
    load_source_card_events,
    normalize_weekly_config,
    parse_timestamp,
    render_weekly_body,
    render_weekly_file,
    resolve_workspace,
    text_hash,
    weekly_payload_hash,
    weekly_plan_object,
    weekly_segment_sha256,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Save one note Workspace weekly recommendation or selection."
    )
    parser.add_argument(
        "workspace",
        help="Absolute path to the selected user workspace",
    )
    parser.add_argument(
        "--config",
        required=True,
        help="Weekly plan JSON path, or - for stdin",
    )
    parser.add_argument(
        "--timestamp",
        help="ISO 8601 record timestamp override",
    )
    return parser


def _output(
    *,
    status: str,
    week: str,
    revision: int,
    path: str,
    candidate_count: int,
    plan_sha256: str,
    record_type: str,
    confirmed_by_user: bool,
) -> None:
    print(
        json.dumps(
            {
                "status": status,
                "week": week,
                "revision": revision,
                "path": path,
                "candidate_count": candidate_count,
                "plan_sha256": plan_sha256,
                "record_type": record_type,
                "confirmed_by_user": confirmed_by_user,
                "validation": "pass",
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
        config = normalize_weekly_config(load_json(args.config))
        recorded_at, recorded_moment = parse_timestamp(args.timestamp)
        relative_path = f"plans/weekly/{config['week']}.md"
        target = workspace / relative_path
        payload_sha256 = weekly_payload_hash(config)

        with exclusive_locks(
            [
                workspace / "source-cards/.cards.lock",
                workspace / "metrics/.metrics.lock",
                workspace / "plans/weekly/.weekly-plan.lock",
            ],
            recorded_at,
        ):
            _, current_cards, source_by_revision = load_source_card_events(
                workspace
            )
            plans = load_all_weekly_plans(workspace, source_by_revision)

            for segments in plans.values():
                for metadata, body in segments:
                    if metadata["request_id"] != config["request_id"]:
                        continue
                    if metadata["payload_sha256"] != payload_sha256:
                        raise StrategyDataError(
                            "request_id is already used for a different weekly plan"
                        )
                    _output(
                        status="duplicate",
                        week=metadata["week"],
                        revision=metadata["revision"],
                        path=f"plans/weekly/{metadata['week']}.md",
                        candidate_count=len(
                            metadata["plan"]["candidates"]
                        ),
                        plan_sha256=weekly_segment_sha256(metadata, body),
                        record_type=metadata["plan"]["record_type"],
                        confirmed_by_user=metadata["plan"]["confirmed_by_user"],
                    )
                    return 0

            existing = plans.get(config["week"], [])
            if not existing:
                first_allowed = (
                    config["record_type"] == "strategy_recommendation"
                    or config["decision"] in {"adopt", "pause"}
                )
                if not first_allowed:
                    raise StrategyDataError(
                        "the first weekly revision must recommend, adopt, or pause"
                    )
            if existing:
                latest = existing[-1][0]
                latest_status = latest["status"]
                if (
                    config["record_type"] == "strategy_recommendation"
                    and latest_status in {"confirmed", "paused"}
                ):
                    raise StrategyDataError(
                        "a strategy recommendation cannot replace a user-confirmed weekly decision"
                    )
                if (
                    config["record_type"] == "user_selection"
                    and config["decision"] == "adopt"
                    and latest_status != "recommended"
                ):
                    raise StrategyDataError(
                        "adopt is only valid when confirming a recommendation"
                    )
                _, latest_moment = parse_timestamp(
                    latest["recorded_at"]
                )
                if recorded_moment < latest_moment:
                    raise StrategyDataError(
                        "recorded_at must not be earlier than the latest revision"
                    )

            snapshots = build_source_snapshots(config, current_cards)
            tracking_review = build_tracking_review(workspace, recorded_at)
            plan = weekly_plan_object(config, snapshots, tracking_review)
            revision = len(existing) + 1
            metadata = {
                "schema_version": SCHEMA_VERSION,
                "week": config["week"],
                "revision": revision,
                "request_id": config["request_id"],
                "recorded_at": recorded_at,
                "status": (
                    "recommended"
                    if config["record_type"] == "strategy_recommendation"
                    else (
                        "paused"
                        if config["decision"] == "pause"
                        else "confirmed"
                    )
                ),
                "payload_sha256": payload_sha256,
                "body_sha256": "",
                "plan": plan,
            }
            body = render_weekly_body(metadata)
            metadata["body_sha256"] = text_hash(body)
            segments = list(existing) + [(metadata, body)]
            atomic_write_text(
                target,
                render_weekly_file(config["week"], segments),
            )

        _output(
            status="created" if revision == 1 else "updated",
            week=config["week"],
            revision=revision,
            path=relative_path,
            candidate_count=len(config["candidates"]),
            plan_sha256=weekly_segment_sha256(metadata, body),
            record_type=config["record_type"],
            confirmed_by_user=config["confirmed_by_user"],
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
