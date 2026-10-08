#!/usr/bin/env python3
"""Save one immutable image brief for a validated article revision."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from image_common import (
    ImageDataError,
    brief_payload_hash,
    build_brief_metadata,
    image_lock,
    json_text,
    load_all_briefs,
    load_json_argument,
    normalize_brief_input,
    parse_timestamp,
    read_article_source,
    resolve_workspace,
    safe_article_directory,
    validate_brief_article_timeline,
    validate_image_data,
    write_new_text,
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Save one image brief without generating an image or taking external actions."
    )
    parser.add_argument("workspace", help="Absolute path to the selected workspace")
    parser.add_argument("--config", required=True, help="Image brief JSON path, or -")
    parser.add_argument("--timestamp", help="ISO 8601 timestamp override")
    return parser


def _output(brief: Dict[str, Any], status: str) -> Dict[str, Any]:
    return {
        "status": status,
        "brief_status": brief["status"],
        "article_id": brief["article_id"],
        "article_revision": brief["article_revision"],
        "kind": brief["kind"],
        "brief_revision": brief["brief_revision"],
        "brief_path": brief["brief_path"],
        "target_width": brief["target_width"],
        "target_height": brief["target_height"],
        "external_actions": [],
    }


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        config = normalize_brief_input(load_json_argument(args.config, "image brief config"))
        created_at = parse_timestamp(args.timestamp)
        article_metadata, _, article_hash = read_article_source(workspace, config)
        validate_brief_article_timeline(
            article_metadata, created_at, "image brief"
        )
        payload_hash = brief_payload_hash(config, article_hash)

        with image_lock(workspace, created_at):
            existing_errors = validate_image_data(workspace)
            if existing_errors:
                raise ImageDataError(
                    "existing image data is invalid: " + "; ".join(existing_errors)
                )
            briefs = load_all_briefs(workspace)
            for brief in briefs:
                if brief["request_id"] != config["request_id"]:
                    continue
                if brief["payload_sha256"] == payload_hash:
                    print(json.dumps(_output(brief, "duplicate"), ensure_ascii=False, indent=2))
                    return 0
                raise ImageDataError("request_id is already used for a different image brief")

            revisions = [
                int(brief["brief_revision"])
                for brief in briefs
                if brief["article_id"] == config["article_id"]
                and brief["kind"] == config["kind"]
            ]
            revision = max(revisions, default=0) + 1
            relative = (
                f"assets/{config['article_id']}/{config['kind']}"
                f"-brief-r{revision:03d}.json"
            )
            brief = build_brief_metadata(
                config,
                article_metadata_sha256=article_hash,
                brief_revision=revision,
                created_at=created_at,
                brief_path=relative,
                payload_sha256=payload_hash,
            )
            safe_article_directory(workspace, config["article_id"], create=True)
            path = workspace / relative
            write_new_text(path, json_text(brief))
            final_errors = validate_image_data(workspace)
            if final_errors:
                try:
                    path.unlink()
                except FileNotFoundError:
                    pass
                raise ImageDataError(
                    "saved image brief failed validation: " + "; ".join(final_errors)
                )

        print(json.dumps(_output(brief, "created"), ensure_ascii=False, indent=2))
        return 0
    except (OSError, UnicodeError, ImageDataError, json.JSONDecodeError) as exc:
        print(
            json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
