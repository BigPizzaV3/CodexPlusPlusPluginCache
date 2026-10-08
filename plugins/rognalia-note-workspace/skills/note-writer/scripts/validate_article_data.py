#!/usr/bin/env python3
"""Validate note-writer draft files, metadata, registry, and context links."""

from __future__ import annotations

import argparse
import json
from typing import Optional

from writer_common import WriterDataError, load_registry, resolve_workspace, validate_article_data


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate local article draft history without changing files."
    )
    parser.add_argument("workspace", help="Absolute path to the selected workspace")
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        errors = validate_article_data(workspace)
        events = load_registry(workspace) if not errors else []
        articles = {event["article_id"] for event in events}
        result = {
            "status": "pass" if not errors else "error",
            "article_count": len(articles),
            "revision_count": len(events),
            "errors": errors,
            "external_actions": [],
        }
        print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
        return 0 if not errors else 1
    except (OSError, UnicodeError, WriterDataError, json.JSONDecodeError) as exc:
        print(
            json.dumps(
                {
                    "status": "error",
                    "article_count": 0,
                    "revision_count": 0,
                    "errors": [str(exc)],
                    "external_actions": [],
                },
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
