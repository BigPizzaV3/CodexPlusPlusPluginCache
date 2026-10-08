#!/usr/bin/env python3
"""Validate a note Workspace without modifying it."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Optional

from workspace_common import validate_workspace


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate a note Workspace.")
    parser.add_argument("workspace", help="Path to the workspace")
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    workspace = Path(args.workspace).expanduser().resolve()
    errors = validate_workspace(workspace)
    result = {
        "status": "pass" if not errors else "fail",
        "workspace": str(workspace),
        "errors": errors,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
