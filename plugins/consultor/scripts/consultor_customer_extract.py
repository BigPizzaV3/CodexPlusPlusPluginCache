#!/usr/bin/env python3
"""Extract customer research signals from text notes into Markdown."""

from __future__ import annotations

import argparse
import re
from pathlib import Path


SIGNALS = {
    "Jobs": ("job", "trying to", "need to", "goal", "objectiu", "necessito", "quiero"),
    "Pains": ("pain", "problem", "frustrat", "frustrated", "difficult", "hard", "cost", "problema", "dolor"),
    "Gains": ("gain", "want", "better", "faster", "easier", "millor", "quiero", "m'agradaria"),
    "Triggers": ("when", "after", "before", "trigger", "decided", "quan", "cuando", "despres"),
    "Alternatives": ("instead", "alternative", "spreadsheet", "agency", "manual", "abans", "alternativa"),
    "Objections": ("but", "expensive", "risk", "not sure", "too much", "pero", "car", "riesgo"),
    "Pricing Signals": ("price", "budget", "pay", "cost", "preu", "presupuesto", "pagar"),
}


def sentences(text: str) -> list[str]:
    chunks = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [chunk.strip() for chunk in chunks if chunk.strip()]


def quoted_lines(text: str) -> list[str]:
    quoted = re.findall(r'"([^"]+)"', text)
    return [quote.strip() for quote in quoted if quote.strip()]


def extract(path: Path) -> str:
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = ["# Customer Research Extraction", "", f"Source: {path}", ""]
    all_sentences = sentences(text)
    for title, terms in SIGNALS.items():
        matches = [
            sentence for sentence in all_sentences
            if any(term.lower() in sentence.lower() for term in terms)
        ][:12]
        lines.extend([f"## {title}", ""])
        lines.extend([f"- {match}" for match in matches] or ["- None found."])
        lines.append("")
    quotes = quoted_lines(text)[:20]
    lines.extend(["## Exact Quotes", ""])
    lines.extend([f"- \"{quote}\"" for quote in quotes] or ["- None found."])
    lines.extend([
        "",
        "## Analyst Notes",
        "",
        "- Label each extracted signal as Verified, Assumption, or Hypothesis before using it in strategy.",
        "- Do not treat future intent as purchase evidence.",
        "",
    ])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract customer research signals from a text file.")
    parser.add_argument("input", help="Input transcript, note, review export, or text file.")
    parser.add_argument("-o", "--output", help="Markdown output path.")
    parser.add_argument("--stdout", action="store_true", help="Print output instead of writing.")
    args = parser.parse_args()

    source = Path(args.input).expanduser().resolve()
    output = extract(source)
    if args.stdout:
        print(output, end="")
    else:
        target = Path(args.output).expanduser().resolve() if args.output else source.with_suffix(".customer-research.md")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(output, encoding="utf-8")
        print(target)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

