#!/usr/bin/env python3
"""Validate image briefs, assets, metadata, and registries in a workspace."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Optional

from image_common import (
    ImageDataError,
    load_all_briefs,
    load_image_events,
    resolve_workspace,
    validate_image_data,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate all locally managed note image data."
    )
    parser.add_argument("workspace", help="Absolute path to the selected workspace")
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        errors = validate_image_data(workspace)
        if errors:
            result = {
                "status": "error",
                "valid": False,
                "brief_count": len(
                    list((workspace / "assets").glob("article-*/*-brief-r*.json"))
                ),
                "asset_count": sum(
                    len(list((workspace / "assets").glob(pattern)))
                    for pattern in (
                        "article-*/thumbnail-r[0-9][0-9][0-9].json",
                        "article-*/inline-r[0-9][0-9][0-9].json",
                    )
                ),
                "errors": errors,
                "external_actions": [],
            }
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 2
        result = {
            "status": "pass",
            "valid": True,
            "brief_count": len(load_all_briefs(workspace)),
            "asset_count": len(load_image_events(workspace)),
            "errors": [],
            "external_actions": [],
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (OSError, UnicodeError, ImageDataError, json.JSONDecodeError) as exc:
        print(
            json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
