#!/usr/bin/env python3
"""Compose approved opening previews into one labeled contact sheet."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("schedule", type=Path)
    parser.add_argument("--package", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    data = json.loads(args.schedule.read_text(encoding="utf-8"))
    openings = data.get("openings", [])
    if not openings:
        image = Image.new("RGB", (960, 240), "black")
        ImageDraw.Draw(image).text((24, 24), "NO STRUCTURAL OPENINGS DECLARED", fill="white")
        args.out.parent.mkdir(parents=True, exist_ok=True)
        image.save(args.out)
        return
    cell_w, cell_h = 480, 420
    columns = min(3, len(openings))
    rows = math.ceil(len(openings) / columns)
    sheet = Image.new("RGB", (columns * cell_w, rows * cell_h), (24, 24, 24))
    draw = ImageDraw.Draw(sheet)
    for index, opening in enumerate(openings):
        cutter = json.loads((args.package / opening["cutter"]).read_text(encoding="utf-8"))
        preview_path = args.package / Path(opening["cutter"]).with_suffix(".preview.png")
        if not preview_path.is_file():
            raise SystemExit(f"missing preview for {opening['id']}: {preview_path}")
        preview = Image.open(preview_path).convert("RGB")
        preview.thumbnail((cell_w - 24, cell_h - 100))
        x = (index % columns) * cell_w
        y = (index // columns) * cell_h
        sheet.paste(preview, (x + (cell_w - preview.width) // 2, y + 48))
        label = f"{opening['id']} | {opening['kind']} | {opening['widthMeters']:.2f} x {opening['heightMeters']:.2f} m"
        draw.text((x + 12, y + 12), label, fill=(255, 225, 80))
        draw.text((x + 12, y + cell_h - 34), f"to: {opening['destination']} | sha {cutter['sourceSha256'][:12]}", fill="white")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.out)
    print(args.out.resolve())


if __name__ == "__main__":
    main()
