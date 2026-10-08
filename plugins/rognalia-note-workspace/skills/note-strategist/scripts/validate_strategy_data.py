#!/usr/bin/env python3
"""Validate weekly plans and strategy-change history in one workspace."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional

from strategy_common import (
    StrategyDataError,
    exclusive_locks,
    load_source_card_events,
    load_strategy_history,
    parse_timestamp,
    parse_weekly_file,
    read_strategy_state,
    resolve_workspace,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate note Workspace strategy data."
    )
    parser.add_argument(
        "workspace",
        help="Absolute path to the selected user workspace",
    )
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        validated_at, _ = parse_timestamp(None)
        errors: List[str] = []
        plan_files = 0
        plan_revisions = 0
        strategy_changes = 0

        with exclusive_locks(
            [
                workspace / "source-cards/.cards.lock",
                workspace / "plans/weekly/.weekly-plan.lock",
                workspace / "strategy/.change.lock",
            ],
            validated_at,
        ):
            _, _, source_by_revision = load_source_card_events(workspace)
            requests: Dict[str, str] = {}
            for path in sorted(
                (workspace / "plans/weekly").glob("*.md")
            ):
                plan_files += 1
                if path.is_symlink() or not path.is_file():
                    errors.append(
                        f"{path.relative_to(workspace)}: unsafe plan path"
                    )
                    continue
                try:
                    segments = parse_weekly_file(
                        path,
                        source_by_revision,
                    )
                except (OSError, ValueError, json.JSONDecodeError) as exc:
                    errors.append(str(exc))
                    continue
                plan_revisions += len(segments)
                for metadata, _ in segments:
                    request_id = metadata["request_id"]
                    if request_id in requests:
                        errors.append(
                            "duplicate weekly plan request_id across "
                            f"{requests[request_id]} and {path.stem}: "
                            f"{request_id}"
                        )
                    else:
                        requests[request_id] = path.stem

            try:
                (
                    state,
                    settings,
                    manifest,
                    _,
                    _,
                ) = read_strategy_state(workspace)
                events = load_strategy_history(
                    workspace,
                    state,
                    settings,
                    manifest,
                )
                strategy_changes = len(events)
            except (OSError, ValueError, json.JSONDecodeError) as exc:
                errors.append(str(exc))

        payload = {
            "status": "pass" if not errors else "fail",
            "workspace": str(workspace),
            "counts": {
                "plan_files": plan_files,
                "plan_revisions": plan_revisions,
                "strategy_changes": strategy_changes,
            },
            "errors": errors,
        }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0 if not errors else 1
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
