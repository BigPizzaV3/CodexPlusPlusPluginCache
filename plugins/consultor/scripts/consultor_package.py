#!/usr/bin/env python3
"""Package Consultor project documents into a handoff ZIP."""

from __future__ import annotations

import argparse
import datetime as dt
import zipfile
from pathlib import Path


INCLUDE_DIRS = ("consultor", "marketing", "strategy", "brand", "go-to-market", "campaigns")
SKIP_NAMES = {".git", "__pycache__", "node_modules", "vendor"}


def default_output(root: Path) -> Path:
    stamp = dt.datetime.now(dt.UTC).strftime("%Y%m%d-%H%M%S")
    return root / "consultor" / "reports" / f"consultor-handoff-{stamp}.zip"


def iter_files(root: Path):
    for dirname in INCLUDE_DIRS:
        base = root / dirname
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if any(part in SKIP_NAMES for part in path.parts):
                continue
            if path.is_file() and path.suffix.lower() in {".md", ".txt", ".json", ".csv"}:
                yield path


def package(root: Path, output: Path) -> Path:
    output.parent.mkdir(parents=True, exist_ok=True)
    files = sorted(set(iter_files(root)))
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            if path.resolve() == output.resolve():
                continue
            archive.write(path, path.relative_to(root))
        manifest = "\n".join([
            "# Consultor Handoff",
            "",
            f"Generated: {dt.date.today().isoformat()}",
            f"Root: {root}",
            f"Files included: {len(files)}",
            "",
        ])
        archive.writestr("CONSULTOR-HANDOFF.md", manifest)
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Package Consultor documents into a handoff ZIP.")
    parser.add_argument("root", nargs="?", default=".", help="Project root.")
    parser.add_argument("-o", "--output", help="Output ZIP path.")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    output = Path(args.output).expanduser().resolve() if args.output else default_output(root).resolve()
    print(package(root, output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
