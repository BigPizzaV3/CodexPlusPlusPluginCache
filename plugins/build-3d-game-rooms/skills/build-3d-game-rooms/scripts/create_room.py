#!/usr/bin/env python3
"""Create a portable room evidence package from the skill templates."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("room_id")
    parser.add_argument("--family", required=True, choices=("display-gallery", "gameplay-room", "social-hub", "custom"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not args.room_id or any(char not in "abcdefghijklmnopqrstuvwxyz0123456789-" for char in args.room_id):
        raise SystemExit("room_id must use lowercase letters, digits, and hyphens")
    if args.output.exists() and any(args.output.iterdir()):
        raise SystemExit(f"output must be absent or empty: {args.output}")
    templates = Path(__file__).resolve().parent.parent / "assets" / "templates"
    args.output.mkdir(parents=True, exist_ok=True)
    for name in ("images", "meshes", "masks", "renders", "runtime", "plans"):
        (args.output / name).mkdir()
    for source in templates.glob("*.json"):
        text = source.read_text(encoding="utf-8").replace("__ROOM_ID__", args.room_id).replace("__FAMILY__", args.family)
        (args.output / source.name).write_text(text, encoding="utf-8")
    print(args.output.resolve())


if __name__ == "__main__":
    main()
