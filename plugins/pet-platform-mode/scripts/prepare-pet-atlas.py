"""Convert a Codex v2 pet atlas into the PNG format required by WPF."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

from PIL import Image


EXPECTED_SIZE = (1536, 2288)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    source = Path(args.source).resolve()
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as image:
        image.load()
        if image.size != EXPECTED_SIZE:
            raise SystemExit(
                f"Pet atlas must be a v2 {EXPECTED_SIZE[0]}x{EXPECTED_SIZE[1]} image; "
                f"got {image.width}x{image.height}."
            )
        converted = image.convert("RGBA")

    temporary = output.with_suffix(output.suffix + ".tmp")
    converted.save(temporary, format="PNG", optimize=True)
    os.replace(temporary, output)
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
