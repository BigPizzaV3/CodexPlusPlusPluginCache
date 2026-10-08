#!/usr/bin/env python3
"""Validate note Workspace metrics history without external access."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Optional

from tracker_common import TrackerDataError, resolve_workspace, validate_metrics_history


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(description="Validate metrics/history.jsonl.")
    value.add_argument("workspace", help="Absolute path to the user workspace")
    return value


def main(argv: Optional[list[str]] = None) -> int:
    args = parser().parse_args(argv)
    try:
        workspace, workspace_id = resolve_workspace(args.workspace, require_enabled=False)
        errors = validate_metrics_history(workspace, workspace_id)
    except (OSError, TrackerDataError) as exc:
        errors = [str(exc)]
    payload = {
        "status": "pass" if not errors else "fail",
        "errors": errors,
        "external_actions": [],
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
