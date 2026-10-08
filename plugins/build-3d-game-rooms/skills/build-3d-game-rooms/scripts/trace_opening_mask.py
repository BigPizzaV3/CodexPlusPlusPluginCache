#!/usr/bin/env python3
"""Trace a strict black/white opening mask into portable cutter contours."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw


def fail(message):
    raise SystemExit(f"opening mask rejected: {message}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mask", type=Path)
    parser.add_argument("--id", required=True)
    parser.add_argument("--kind", required=True, choices=("door", "window", "deep_alcove"))
    parser.add_argument("--width-m", type=float, required=True)
    parser.add_argument("--height-m", type=float, required=True)
    parser.add_argument("--sill-m", type=float)
    parser.add_argument("--depth-m", type=float)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--preview", type=Path, required=True)
    parser.add_argument("--threshold", type=int, default=250)
    parser.add_argument("--simplify", type=float, default=0.0025)
    args = parser.parse_args()
    if args.width_m <= 0 or args.height_m <= 0:
        fail("dimensions must be positive")
    if args.kind == "window" and (args.sill_m is None or args.sill_m < 0):
        fail("windows require a non-negative sill")
    if args.kind == "deep_alcove":
        minimum = max(0.35, 0.15 * args.height_m)
        if args.depth_m is None or args.depth_m < minimum:
            fail(f"alcove depth must be at least {minimum:.3f} m")
    raw = args.mask.read_bytes()
    image = Image.open(args.mask)
    if image.mode in {"RGBA", "LA"} or "transparency" in image.info:
        alpha = np.asarray(image.convert("RGBA"))[:, :, 3]
        if np.any(alpha != 255):
            fail("transparency is not allowed")
    gray = np.asarray(image.convert("L"), dtype=np.uint8)
    if gray.shape[0] < 16 or gray.shape[1] < 16:
        fail("image must be at least 16x16")
    distance = np.minimum(gray, 255 - gray)
    if int(distance.max()) > 5:
        fail("mask contains grayscale or antialiased pixels; use only black and white")
    binary = np.where(gray >= args.threshold, 255, 0).astype(np.uint8)
    white = binary == 255
    if not np.any(white) or np.all(white):
        fail("mask must contain both retained black and removed white areas")
    if args.kind == "door" and not np.any(white[-1, :]):
        fail("door removal region must touch the bottom boundary")
    if args.kind != "door" and (np.any(white[0, :]) or np.any(white[-1, :]) or np.any(white[:, 0]) or np.any(white[:, -1])):
        fail("window and alcove removal regions must be closed inside the image")
    components, labels, stats, _ = cv2.connectedComponentsWithStats(white.astype(np.uint8), connectivity=8)
    areas = stats[1:, cv2.CC_STAT_AREA]
    significant = [int(area) for area in areas if area >= max(4, white.size * 0.0005)]
    if len(significant) != 1:
        fail(f"expected one connected removal region, found {len(significant)}")
    if len(areas) != 1:
        fail("edge noise or islands detected")
    contours, hierarchy = cv2.findContours(binary, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None:
        fail("no closed contour found")
    if any(int(item[3]) >= 0 for item in hierarchy[0]):
        fail("holes/islands inside an opening are not supported; use separate cutters")
    height, width = binary.shape
    result = []
    for index, contour in enumerate(contours):
        epsilon = args.simplify * cv2.arcLength(contour, True)
        simple = cv2.approxPolyDP(contour, epsilon, True).reshape(-1, 2)
        if len(simple) < 3:
            fail("contour collapsed during simplification")
        parent = int(hierarchy[0][index][3])
        points = [[round(float(x) / (width - 1), 7), round(1.0 - float(y) / (height - 1), 7)] for x, y in simple]
        result.append({"role": "outer" if parent < 0 else "hole", "points": points})
    if sum(1 for item in result if item["role"] == "outer") != 1:
        fail("mask must contain exactly one outer contour")
    payload = {
        "schema": "game-room.opening-cutter.v1", "id": args.id, "kind": args.kind,
        "widthMeters": args.width_m, "heightMeters": args.height_m,
        "sillMeters": args.sill_m, "depthMeters": args.depth_m,
        "source": args.mask.name, "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "imageSize": [width, height], "whitePixelRatio": round(float(np.mean(white)), 8),
        "contours": result
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    preview = image.convert("RGB").resize((width * 2, height * 2), Image.Resampling.NEAREST)
    draw = ImageDraw.Draw(preview)
    for contour in result:
        points = [(int(x * (width - 1) * 2), int((1 - y) * (height - 1) * 2)) for x, y in contour["points"]]
        draw.line(points + [points[0]], fill=(255, 0, 0) if contour["role"] == "outer" else (0, 128, 255), width=2)
    draw.rectangle((0, 0, preview.width - 1, preview.height - 1), outline=(255, 220, 0), width=2)
    draw.text((8, 8), f"{args.id} {args.kind} {args.width_m:.2f}x{args.height_m:.2f}m", fill=(255, 220, 0))
    args.preview.parent.mkdir(parents=True, exist_ok=True)
    preview.save(args.preview)
    print(json.dumps({"out": str(args.out), "preview": str(args.preview), "contours": len(result)}))


if __name__ == "__main__":
    main()
