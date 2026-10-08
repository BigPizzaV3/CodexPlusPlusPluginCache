#!/usr/bin/env python3
"""Normalize competitive research notes into a Markdown comparison table."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path


FIELDS = [
    "Competitor",
    "Type",
    "Audience",
    "Core Claim",
    "Offer",
    "Pricing",
    "Proof",
    "Opening",
    "Evidence",
    "Source",
]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8", errors="replace") as handle:
        reader = csv.DictReader(handle)
        rows = []
        for row in reader:
            rows.append({field: row.get(field, row.get(field.lower(), "")).strip() for field in FIELDS})
        return rows


def read_loose(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    current = {field: "" for field in FIELDS}
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#"):
            continue
        if ":" in line:
            key, value = line.split(":", 1)
            key_norm = key.strip().lower()
            for field in FIELDS:
                if key_norm == field.lower():
                    current[field] = value.strip()
                    break
        elif line.startswith("- "):
            if any(current.values()):
                rows.append(current)
            current = {field: "" for field in FIELDS}
            current["Competitor"] = line[2:].strip()
    if any(current.values()):
        rows.append(current)
    return rows


def table(rows: list[dict[str, str]]) -> str:
    lines = ["# Competitive Research Table", "", "| " + " | ".join(FIELDS) + " |", "|" + "|".join(["---"] * len(FIELDS)) + "|"]
    for row in rows:
        lines.append("| " + " | ".join((row.get(field) or "TBD").replace("|", "/") for field in FIELDS) + " |")
    lines.extend(["", "## Notes", "", "- Verify pricing and claims against current primary sources before making decisions.", ""])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a competitive research Markdown table from CSV or loose notes.")
    parser.add_argument("input", help="CSV or text/Markdown input.")
    parser.add_argument("-o", "--output", help="Markdown output path.")
    parser.add_argument("--stdout", action="store_true", help="Print output instead of writing.")
    args = parser.parse_args()

    source = Path(args.input).expanduser().resolve()
    rows = read_csv(source) if source.suffix.lower() == ".csv" else read_loose(source)
    output = table(rows)
    if args.stdout:
        print(output, end="")
    else:
        target = Path(args.output).expanduser().resolve() if args.output else source.with_suffix(".competitive-table.md")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(output, encoding="utf-8")
        print(target)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

