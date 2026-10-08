#!/usr/bin/env python3
"""Validate role/task binding history and optional readiness completeness."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Optional

from task_binding_common import (
    PRIMARY_ROLES_BY_MODE,
    TaskBindingError,
    active_bindings,
    load_events,
    resolve_workspace,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate role/task bindings.")
    parser.add_argument("workspace", help="Absolute path to the user workspace")
    parser.add_argument(
        "--require-ready",
        action="store_true",
        help="Require every primary role selected by task_topology.mode",
    )
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace, manifest, settings = resolve_workspace(args.workspace)
        events = load_events(workspace, manifest, settings)
        mode = settings["task_topology"]["mode"]
        generation = settings["task_topology"]["binding_generation"]
        active = active_bindings(events, mode, generation)
        for (role, slot), event in active.items():
            if slot == "primary" and event["task_title"] != settings["task_names"][role]:
                raise TaskBindingError(
                    f"active binding title does not match operating settings: {role}:{slot}"
                )
        required = {(role, "primary") for role in PRIMARY_ROLES_BY_MODE[mode]}
        missing = sorted(required - set(active)) if args.require_ready else []
        if missing:
            labels = ", ".join(f"{role}:{slot}" for role, slot in missing)
            raise TaskBindingError(f"required ready bindings are missing: {labels}")
        print(
            json.dumps(
                {
                    "status": "pass",
                    "task_mode": mode,
                    "binding_generation": generation,
                    "event_count": len(events),
                    "active_binding_count": len(active),
                    "ready_complete": not missing and required.issubset(active),
                    "external_actions": [],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(
            json.dumps({"status": "fail", "error": str(exc)}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
