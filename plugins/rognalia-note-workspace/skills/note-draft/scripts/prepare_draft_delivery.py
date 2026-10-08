#!/usr/bin/env python3
"""Inspect the latest completed article delivery before asking for approval."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Optional

from draft_common import (
    APPROVAL_PROMPT,
    DraftDataError,
    build_registration_source,
    delivery_manifest_sha256,
    ensure_latest_article_revision,
    load_json_argument,
    normalize_delivery_input,
    resolve_workspace,
    timestamp_moment,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Read and hash the completed article and QA-approved images."
    )
    parser.add_argument("workspace", help="Absolute path to the selected workspace")
    parser.add_argument("--config", required=True, help="Delivery JSON path, or -")
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        config = normalize_delivery_input(
            load_json_argument(args.config, "draft delivery config")
        )
        ensure_latest_article_revision(
            workspace, config["article_id"], config["article_revision"]
        )
        source = build_registration_source(workspace, config)
        completion_at = max(
            source["_completion_times"],
            key=lambda value: timestamp_moment(value, "completion timestamp"),
        )
        print(
            json.dumps(
                {
                    "status": "ready_for_approval",
                    "article_id": config["article_id"],
                    "article_revision": config["article_revision"],
                    "selected_title": source["selected_title"],
                    "delivery_sha256": delivery_manifest_sha256(source),
                    "completion_at": completion_at,
                    "thumbnail_path": source["thumbnail"]["image_path"],
                    "inline_image_count": len(source["inline_images"]),
                    "additional_link_count": len(source["additional_links"]),
                    "approval_prompt": APPROVAL_PROMPT,
                    "external_actions": [],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    except (OSError, UnicodeError, DraftDataError, json.JSONDecodeError) as exc:
        print(
            json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
