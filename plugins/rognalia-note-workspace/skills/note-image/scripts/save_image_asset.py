#!/usr/bin/env python3
"""Save one QA-passed image asset and its immutable metadata."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from image_common import (
    ImageDataError,
    append_image_registry,
    asset_payload_hash,
    brief_dimensions,
    build_asset_metadata,
    build_image_event,
    image_lock,
    json_text,
    load_brief,
    load_image_events,
    load_json_argument,
    normalize_qa,
    parse_timestamp,
    read_image,
    resolve_workspace,
    safe_article_directory,
    sha256_bytes,
    sha256_text,
    timestamp_moment,
    validate_generation_timeline,
    validate_image_data,
    write_new_bytes,
    write_new_text,
)
from png_resize import PngResizeError, resize_png_bytes


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Save one QA-passed note image without external actions."
    )
    parser.add_argument("workspace", help="Absolute path to the selected workspace")
    parser.add_argument("--brief", required=True, help="Workspace-relative brief path")
    parser.add_argument("--image-file", required=True, help="Absolute final image path")
    parser.add_argument("--qa", required=True, help="Image QA JSON path, or -")
    parser.add_argument("--timestamp", help="ISO 8601 timestamp override")
    return parser


def _outside_workspace(path: Path, workspace: Path, label: str) -> None:
    if not path.is_absolute():
        raise ImageDataError(f"{label} must be an absolute path")
    try:
        path.resolve().relative_to(workspace)
    except ValueError:
        return
    raise ImageDataError(f"{label} must be outside the managed workspace")


def _output(event: Dict[str, Any], status: str) -> Dict[str, Any]:
    return {
        "status": status,
        "asset_status": event["status"],
        "article_id": event["article_id"],
        "article_revision": event["article_revision"],
        "kind": event["kind"],
        "asset_revision": event["asset_revision"],
        "image_path": event["image_path"],
        "preview_path": event["preview_path"],
        "metadata_path": event["metadata_path"],
        "width": event["width"],
        "height": event["height"],
        "caption": event["caption"],
        "alt": event["alt"],
        "external_actions": [],
    }


def main(argv: Optional[list[str]] = None) -> int:
    args = _parser().parse_args(argv)
    try:
        workspace = resolve_workspace(args.workspace)
        brief, _, brief_hash = load_brief(workspace, args.brief)
        if brief["status"] != "ready_to_generate":
            raise ImageDataError("image generation was unavailable for this brief")

        source_path = Path(args.image_file)
        _outside_workspace(source_path, workspace, "image_file")
        _, image_data, image_format, width, height = read_image(
            args.image_file, "image_file"
        )
        target_width, target_height = brief_dimensions(brief["kind"])
        if (width, height) != (target_width, target_height):
            raise ImageDataError(
                f"image_file must be {target_width}x{target_height} pixels"
            )

        qa = normalize_qa(load_json_argument(args.qa, "image QA config"), brief)
        validate_generation_timeline(brief, qa["generated_at"], "image asset")
        saved_at = parse_timestamp(args.timestamp)
        if timestamp_moment(qa["reviewed_at"], "reviewed_at") > timestamp_moment(
            saved_at, "saved_at"
        ):
            raise ImageDataError("saved_at must not be earlier than reviewed_at")
        image_hash = sha256_bytes(image_data)
        preview_data: Optional[bytes] = None
        preview_hash: Optional[str] = None
        if brief["kind"] == "thumbnail":
            if image_format != "png":
                raise ImageDataError(
                    "thumbnail image_file must be PNG so its reviewed preview can be reproduced"
                )
            try:
                preview_data = resize_png_bytes(image_data, 320, 168)
            except PngResizeError as exc:
                raise ImageDataError(
                    "thumbnail PNG cannot create the required 320x168 preview: " + str(exc)
                ) from exc
            preview_hash = sha256_bytes(preview_data)
            if qa["preview_sha256"] != preview_hash:
                raise ImageDataError(
                    "preview_sha256 does not match the preview derived from image_file"
                )
        payload_hash = asset_payload_hash(qa, brief_hash, image_hash)

        with image_lock(workspace, saved_at):
            existing_errors = validate_image_data(workspace)
            if existing_errors:
                raise ImageDataError(
                    "existing image data is invalid: " + "; ".join(existing_errors)
                )
            events = load_image_events(workspace)
            for event in events:
                if event["request_id"] != qa["request_id"]:
                    continue
                if event["payload_sha256"] == payload_hash:
                    print(json.dumps(_output(event, "duplicate"), ensure_ascii=False, indent=2))
                    return 0
                raise ImageDataError("request_id is already used for a different image asset")

            revisions = [
                int(event["asset_revision"])
                for event in events
                if event["article_id"] == brief["article_id"]
                and event["kind"] == brief["kind"]
            ]
            revision = max(revisions, default=0) + 1
            stem = f"{brief['kind']}-r{revision:03d}"
            extension = ".png" if image_format == "png" else ".jpg"
            image_relative = f"assets/{brief['article_id']}/{stem}{extension}"
            preview_relative = (
                f"assets/{brief['article_id']}/{stem}-preview.png"
                if preview_data is not None
                else None
            )
            metadata_relative = f"assets/{brief['article_id']}/{stem}.json"
            metadata = build_asset_metadata(
                brief,
                qa,
                asset_revision=revision,
                saved_at=saved_at,
                brief_sha256=brief_hash,
                image_path=image_relative,
                image_sha256=image_hash,
                image_format=image_format,
                width=width,
                height=height,
                preview_path=preview_relative,
                preview_sha256=preview_hash,
                preview_source_sha256=image_hash if preview_data is not None else None,
                preview_width=320 if preview_data is not None else None,
                preview_height=168 if preview_data is not None else None,
                metadata_path=metadata_relative,
                payload_sha256=payload_hash,
            )
            metadata_text = json_text(metadata)
            event = build_image_event(metadata, sha256_text(metadata_text))
            article_directory = safe_article_directory(
                workspace, brief["article_id"], create=False
            )
            image_path = workspace / image_relative
            preview_path = workspace / preview_relative if preview_relative else None
            metadata_path = workspace / metadata_relative
            registry_path = article_directory / "registry.jsonl"
            created_paths = []
            try:
                write_new_bytes(image_path, image_data)
                created_paths.append(image_path)
                if preview_path is not None and preview_data is not None:
                    write_new_bytes(preview_path, preview_data)
                    created_paths.append(preview_path)
                write_new_text(metadata_path, metadata_text)
                created_paths.append(metadata_path)
                append_image_registry(registry_path, event)
            except Exception:
                for path in reversed(created_paths):
                    try:
                        path.unlink()
                    except FileNotFoundError:
                        pass
                raise

            final_errors = validate_image_data(workspace)
            if final_errors:
                raise ImageDataError(
                    "saved image asset failed validation: " + "; ".join(final_errors)
                )

        print(json.dumps(_output(event, "created"), ensure_ascii=False, indent=2))
        return 0
    except (OSError, UnicodeError, ImageDataError, json.JSONDecodeError) as exc:
        print(
            json.dumps({"status": "error", "error": str(exc)}, ensure_ascii=False),
            file=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
