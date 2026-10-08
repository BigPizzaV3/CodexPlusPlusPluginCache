#!/usr/bin/env python3
"""Validate note draft registration packages, events, and saved results."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Optional

from draft_common import (
    DraftDataError,
    resolve_workspace,
    validate_note_draft_data,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate note draft local state.")
    parser.add_argument("workspace", help="Absolute path to the selected workspace")
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        errors, counts = validate_note_draft_data(workspace)
        result = {
            "status": "pass" if not errors else "error",
            **counts,
            "errors": errors,
            "external_actions": [],
        }
        print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
        return 0 if not errors else 2
    except (OSError, UnicodeError, DraftDataError, json.JSONDecodeError) as exc:
        print(
            json.dumps(
                {
                    "status": "error",
                    "registration_count": 0,
                    "started_count": 0,
                    "saved_count": 0,
                    "pending_count": 0,
                    "errors": [str(exc)],
                    "external_actions": [],
                },
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
