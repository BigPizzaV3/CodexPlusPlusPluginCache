#!/usr/bin/env python3
"""Validate current standing instructions and their append-only history."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Optional

from standing_instruction_common import (
    exclusive_lock,
    parse_timestamp,
    resolve_workspace,
    validate_data,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate standing instructions.")
    parser.add_argument("workspace", help="Absolute path to the user workspace")
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace, manifest = resolve_workspace(args.workspace)
        validated_at, _ = parse_timestamp(None)
        with exclusive_lock(
            workspace / "profile/.standing-instructions.lock", validated_at
        ):
            state, events = validate_data(workspace, manifest)
        print(
            json.dumps(
                {
                    "status": "pass",
                    "revision": state["revision"],
                    "instruction_count": len(state["instructions"]),
                    "history_count": len(events),
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
