#!/usr/bin/env python3
"""Check exported icon PNGs for clipped alpha at the asset perimeter.

The alpha test is a HEURISTIC, applicable only when transparency isolates the
artwork. Per-file outcomes:

- pass:            transparent artwork with a safe perimeter inset;
- needs-review:    alpha touches an edge or the inset is under the threshold,
                   compare the source crop and the production render;
- not-applicable:  alpha does not isolate the artwork (e.g. a fully opaque
                   source), a visual source comparison is still required;
- error:           unreadable or empty asset.

Only `pass` exits 0. `needs-review` and `not-applicable` exit 1: they demand a
human disposition against the source and production Preview, and neither is
automatic approval. Never add transparent padding or alter approved brand
artwork merely to satisfy this heuristic.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:  # pragma: no cover - dependency failure is environment-specific
    print("Pillow is required: install the Python package 'Pillow'.", file=sys.stderr)
    raise SystemExit(2)


def _finish(result: dict[str, object]) -> dict[str, object]:
    # `passed` mirrors the outcome for older tooling: only `pass` is True.
    result["passed"] = result.get("outcome") == "pass"
    return result


def inspect_icon(path: Path, min_inset_pct: float) -> dict[str, object]:
    return _finish(_inspect(path, min_inset_pct))


def _inspect(path: Path, min_inset_pct: float) -> dict[str, object]:
    try:
        with Image.open(path) as source:
            rgba = source.convert("RGBA")
    except (OSError, ValueError) as exc:
        return {"path": str(path), "outcome": "error", "message": str(exc)}

    width, height = rgba.size
    alpha = rgba.getchannel("A")
    extrema = alpha.getextrema()
    if extrema is None or extrema[1] == 0:
        return {
            "path": str(path),
            "outcome": "error",
            "width": width,
            "height": height,
            "message": "No visible pixels were found.",
        }
    if extrema[0] == 255:
        return {
            "path": str(path),
            "outcome": "not-applicable",
            "width": width,
            "height": height,
            "alphaBounds": [0, 0, width, height],
            "message": ("Asset is fully opaque, so alpha cannot isolate the artwork; an "
                        "opaque asset is not evidence of a bad crop. Compare the source "
                        "crop and the production render manually."),
        }

    bbox = alpha.getbbox()
    left, top, right, bottom = bbox
    insets = {
        "left": left,
        "top": top,
        "right": width - right,
        "bottom": height - bottom,
    }
    minimum = min(insets.values())
    required = max(1, math.ceil(min(width, height) * min_inset_pct))
    touches_edge = minimum == 0
    if minimum >= required:
        outcome = "pass"
        message = "Transparent perimeter is safe."
    else:
        outcome = "needs-review"
        message = ("Visible alpha reaches the file edge; inspect the crop, the source "
                   "asset, and the production render before approving."
                   if touches_edge else
                   "Transparent inset is smaller than the threshold; compare against the "
                   "source before approving. A deliberately edge-reaching design may be "
                   "dispositioned as a documented visual exception.")
    return {
        "path": str(path),
        "outcome": outcome,
        "width": width,
        "height": height,
        "alphaBounds": [left, top, right, bottom],
        "transparentInsets": insets,
        "minimumInsetPx": minimum,
        "requiredInsetPx": required,
        "touchesEdge": touches_edge,
        "message": message,
    }


def self_test() -> int:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        safe_path = root / "safe.png"
        clipped_path = root / "clipped.png"
        opaque_path = root / "opaque.png"

        safe = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        ImageDraw.Draw(safe).ellipse((8, 8, 55, 55), fill=(20, 120, 80, 255))
        safe.save(safe_path)

        clipped = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        ImageDraw.Draw(clipped).ellipse((-4, 8, 43, 55), fill=(20, 120, 80, 255))
        clipped.save(clipped_path)

        # A valid opaque icon with a safely inset glyph: alpha covers the whole
        # file, which proves nothing about the crop (2026-08-30 review, F4).
        opaque = Image.new("RGBA", (64, 64), (245, 245, 245, 255))
        ImageDraw.Draw(opaque).ellipse((16, 16, 47, 47), fill=(20, 120, 80, 255))
        opaque.save(opaque_path)

        results = {
            "safe": inspect_icon(safe_path, 0.04),
            "clipped": inspect_icon(clipped_path, 0.04),
            "opaque": inspect_icon(opaque_path, 0.04),
        }
        expected = {"safe": "pass", "clipped": "needs-review", "opaque": "not-applicable"}
        for label, outcome in expected.items():
            if results[label].get("outcome") != outcome:
                print(json.dumps(results, indent=2))
                print(f"self-test failed: {label} expected {outcome}, "
                      f"got {results[label].get('outcome')}", file=sys.stderr)
                return 1
    print("check_icon_perimeter.py self-test passed")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("images", nargs="*", type=Path)
    parser.add_argument(
        "--min-inset-pct",
        type=float,
        default=0.04,
        help="Minimum transparent inset as a fraction of the shorter edge (default: 0.04).",
    )
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    if not args.images:
        parser.error("at least one image is required unless --self-test is used")
    if not 0 <= args.min_inset_pct < 0.5:
        parser.error("--min-inset-pct must be at least 0 and less than 0.5")

    results = [inspect_icon(path, args.min_inset_pct) for path in args.images]
    outcomes = {result.get("outcome") for result in results}
    all_pass = outcomes == {"pass"}
    print(json.dumps({
        "passed": all_pass,
        "note": ("Only 'pass' is automatic; needs-review and not-applicable require a "
                 "human comparison against the source and the production render."),
        "results": results,
    }, indent=2))
    if "error" in outcomes:
        return 2
    return 0 if all_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
