#!/usr/bin/env python3
"""Validate note Workspace style-profile revisions and current state."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Optional

from style_common import StyleProfileError, resolve_workspace, validate_style_data


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(description="Validate style profile data.")
    value.add_argument("workspace", help="Absolute path to the user workspace")
    return value


def main(argv: Optional[list[str]] = None) -> int:
    args = parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        errors = validate_style_data(workspace)
    except (OSError, StyleProfileError) as exc:
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
