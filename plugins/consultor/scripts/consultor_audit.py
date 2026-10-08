#!/usr/bin/env python3
"""Audit Consultor working documents and produce a strategy clarity report."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


KNOWN_DIRS = (
    "consultor",
    "marketing",
    "strategy",
    "brand",
    "go-to-market",
    "campaigns",
)

SKIP_DIRS = {
    ".git",
    ".hg",
    ".svn",
    ".next",
    ".cache",
    "node_modules",
    "vendor",
    "__pycache__",
}

SKIP_FILE_NAMES = {
    "consultor-audit.md",
    "final-consulting-report.md",
}

CATEGORIES = {
    "decisions": (
        "decision",
        "decisions",
        "decisio",
        "decisiones",
        "decisions confirmades",
        "confirmed decisions",
    ),
    "hypotheses": (
        "hypothesis",
        "hypotheses",
        "hipotesi",
        "hipotesis",
        "assumption",
        "assumptions",
        "suposicio",
        "suposiciones",
    ),
    "evidence": (
        "evidence",
        "verified",
        "proof",
        "prova",
        "proves",
        "evidencia",
        "evidencias",
    ),
    "risks": (
        "risk",
        "risks",
        "risc",
        "riscos",
        "amenaca",
        "amenaces",
        "threat",
        "threats",
    ),
    "questions": (
        "question",
        "questions",
        "open questions",
        "pregunta",
        "preguntes",
        "preguntas",
        "tbd",
    ),
    "experiments": (
        "experiment",
        "experiments",
        "test",
        "tests",
        "validacio",
        "validacion",
        "validation",
    ),
    "actions": (
        "action",
        "actions",
        "next step",
        "next steps",
        "seguent",
        "siguiente",
        "accio",
        "acciones",
    ),
}

CLARITY_SIGNALS = {
    "audience": ("audience", "segment", "persona", "icp", "public", "cliente"),
    "problem": ("problem", "pain", "job", "need", "problema", "dolor", "necessitat"),
    "alternative": ("alternative", "competitor", "substitute", "competidor", "alternativa"),
    "differentiation": ("different", "differentiation", "positioning", "diferenci", "posicion"),
    "offer": ("offer", "product", "service", "oferta", "producto", "servei", "servicio"),
    "proof": ("proof", "evidence", "verified", "testimonial", "prova", "evidencia"),
    "channel": ("channel", "funnel", "distribution", "canal", "embut", "distribuc"),
    "validation": ("experiment", "validation", "metric", "test", "validacio", "validacion"),
}

RISK_CATEGORIES = {
    "market": ("market", "competitor", "category", "demand", "mercat", "competidor", "categoria"),
    "customer": ("customer", "buyer", "segment", "persona", "client", "comprador"),
    "offer": ("offer", "scope", "deliverable", "oferta", "abast", "lliurable"),
    "pricing": ("price", "pricing", "margin", "discount", "preu", "marge", "descompte"),
    "channel": ("channel", "funnel", "distribution", "canal", "embut", "distribuc"),
    "proof": ("proof", "evidence", "trust", "prova", "evidencia", "confianca"),
    "delivery": ("delivery", "operations", "support", "fulfillment", "lliurament", "operacions"),
    "validation": ("experiment", "validation", "metric", "test", "validacio"),
}

AREA_SIGNALS = {
    "Strategy": ("audience", "problem", "alternative", "differentiation"),
    "Offer": ("offer", "proof"),
    "Go To Market": ("channel", "validation"),
    "Validation": ("proof", "validation"),
}


@dataclass
class Item:
    category: str
    text: str
    source: Path
    line: int


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def discover_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for dirname in KNOWN_DIRS:
        base = root / dirname
        if base.exists():
            files.extend(markdown_files(base))
    if files:
        return sorted(set(files))
    return sorted(set(markdown_files(root)))


def markdown_files(base: Path) -> Iterable[Path]:
    for path in base.rglob("*"):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.name in SKIP_FILE_NAMES:
            continue
        if path.is_file() and path.suffix.lower() in {".md", ".markdown", ".txt"}:
            yield path


def heading_category(heading: str) -> str | None:
    normalized = normalize(heading.lstrip("#").strip())
    for category, terms in CATEGORIES.items():
        if any(term in normalized for term in terms):
            return category
    return None


def line_category(line: str) -> str | None:
    normalized = normalize(line)
    for category, terms in CATEGORIES.items():
        if any(normalized.startswith(f"{term}:") for term in terms):
            return category
    return None


def clean_item(line: str) -> str:
    line = re.sub(r"^\s*[-*+]\s+", "", line.strip())
    line = re.sub(r"^\s*\d+[.)]\s+", "", line)
    return line.strip()


def is_empty_label(line: str) -> bool:
    return bool(re.match(r"^[^\W\d_][\w /_-]{1,48}:\s*$", line.strip()))


def parse_file(path: Path) -> list[Item]:
    items: list[Item] = []
    current_category: str | None = None
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    for index, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("#"):
            current_category = heading_category(stripped)
            continue
        category = line_category(stripped) or current_category
        if not category:
            continue
        if stripped.startswith("```"):
            continue
        if is_empty_label(stripped):
            continue
        cleaned = clean_item(stripped)
        if cleaned and cleaned not in {"TBD", "TODO", "..."}:
            items.append(Item(category=category, text=cleaned, source=path, line=index))
    return items


def collect_items(files: list[Path]) -> list[Item]:
    items: list[Item] = []
    for path in files:
        items.extend(parse_file(path))
    return items


def detect_signal_coverage(files: list[Path]) -> dict[str, bool]:
    text = "\n".join(
        path.read_text(encoding="utf-8", errors="replace").lower() for path in files
    )
    return {
        signal: any(term in text for term in terms)
        for signal, terms in CLARITY_SIGNALS.items()
    }


def clarity_score(coverage: dict[str, bool], grouped: dict[str, list[Item]]) -> int:
    signal_points = sum(coverage.values()) * 8
    evidence_points = min(len(grouped.get("evidence", [])), 5) * 3
    decision_points = min(len(grouped.get("decisions", [])), 5) * 2
    validation_points = min(len(grouped.get("experiments", [])), 5) * 2
    penalty = 0
    if not grouped.get("risks"):
        penalty += 6
    if not grouped.get("hypotheses"):
        penalty += 6
    return max(0, min(100, signal_points + evidence_points + decision_points + validation_points - penalty))


def area_scores(coverage: dict[str, bool], grouped: dict[str, list[Item]]) -> dict[str, int]:
    scores: dict[str, int] = {}
    for area, signals in AREA_SIGNALS.items():
        signal_score = sum(1 for signal in signals if coverage.get(signal)) / len(signals)
        evidence_bonus = min(len(grouped.get("evidence", [])), 3) / 10
        scores[area] = max(0, min(100, round((signal_score + evidence_bonus) * 100)))
    return scores


def risk_categories(risks: list[Item]) -> dict[str, list[Item]]:
    categorized: dict[str, list[Item]] = {category: [] for category in RISK_CATEGORIES}
    categorized["uncategorized"] = []
    for risk in risks:
        normalized = normalize(risk.text)
        matched = False
        for category, terms in RISK_CATEGORIES.items():
            if any(term in normalized for term in terms):
                categorized[category].append(risk)
                matched = True
        if not matched:
            categorized["uncategorized"].append(risk)
    return categorized


def group_items(items: list[Item]) -> dict[str, list[Item]]:
    grouped: dict[str, list[Item]] = {category: [] for category in CATEGORIES}
    for item in items:
        grouped.setdefault(item.category, []).append(item)
    return grouped


def find_potential_contradictions(items: list[Item]) -> list[str]:
    lines: list[str] = []
    for item in items:
        normalized = normalize(item.text)
        if any(word in normalized for word in ("contradiction", "conflict", "inconsistent", "contradic", "conflicte", "conflicto")):
            lines.append(format_source_item(item))
    return lines[:12]


def evidence_map(grouped: dict[str, list[Item]]) -> list[str]:
    assumptions = grouped.get("hypotheses", [])[:8]
    risks = grouped.get("risks", [])[:8]
    experiments = grouped.get("experiments", [])[:8]
    evidence = grouped.get("evidence", [])[:8]
    rows: list[str] = []
    max_len = max(len(assumptions), len(risks), len(experiments), 1)
    for index in range(max_len):
        assumption = assumptions[index].text if index < len(assumptions) else "Missing assumption"
        ev = evidence[index].text if index < len(evidence) else "Missing evidence"
        risk = risks[index].text if index < len(risks) else "Missing risk"
        experiment = experiments[index].text if index < len(experiments) else "Missing experiment"
        rows.append(f"- Assumption: {assumption} -> Evidence: {ev} -> Risk: {risk} -> Experiment: {experiment}")
    return rows


def format_source_item(item: Item) -> str:
    return f"- {item.text} ({item.source}:{item.line})"


def section(title: str, lines: list[str]) -> str:
    if not lines:
        lines = ["- None found."]
    return f"## {title}\n\n" + "\n".join(lines) + "\n"


def build_report(root: Path, files: list[Path], grouped: dict[str, list[Item]], coverage: dict[str, bool], mode: str = "full") -> str:
    score = clarity_score(coverage, grouped)
    missing = [signal for signal, present in coverage.items() if not present]
    present = [signal for signal, present in coverage.items() if present]
    contradictions = find_potential_contradictions([item for items in grouped.values() for item in items])
    areas = area_scores(coverage, grouped)
    categorized_risks = risk_categories(grouped.get("risks", []))
    today = dt.date.today().isoformat()

    parts = [
        "# Consultor Audit",
        "",
        f"Generated: {today}",
        f"Root: {root}",
        f"Files scanned: {len(files)}",
        "",
        "## Clarity Score",
        "",
        f"Score: {score}/100",
        "",
        "Present signals: " + (", ".join(present) if present else "none"),
        "Missing signals: " + (", ".join(missing) if missing else "none"),
        "",
    ]

    parts.append(section("Area Scores", [f"- {area}: {area_score}/100" for area, area_score in areas.items()]))
    if mode in {"executive", "workshop"}:
        parts.append(section("Workshop Prep", [
            f"- Start with missing signal: {missing[0]}" if missing else "- No missing core signal detected.",
            "- Review risks and contradictions before asking the next question.",
            "- Ask one question tied to the weakest decision branch.",
        ]))

    parts.append(section("Confirmed Decisions", [format_source_item(i) for i in grouped.get("decisions", [])[:20]]))
    parts.append(section("Active Hypotheses", [format_source_item(i) for i in grouped.get("hypotheses", [])[:20]]))
    parts.append(section("Evidence", [format_source_item(i) for i in grouped.get("evidence", [])[:20]]))
    parts.append(section("Risks", [format_source_item(i) for i in grouped.get("risks", [])[:20]]))
    parts.append(section("Risks by Category", [
        f"- {category}: {len(items)}" for category, items in categorized_risks.items() if items
    ]))
    parts.append(section("Open Questions", [format_source_item(i) for i in grouped.get("questions", [])[:20]]))
    parts.append(section("Experiments", [format_source_item(i) for i in grouped.get("experiments", [])[:20]]))
    parts.append(section("Immediate Actions", [format_source_item(i) for i in grouped.get("actions", [])[:20]]))
    parts.append(section("Potential Contradictions", contradictions))
    parts.append(section("Assumption -> Evidence -> Risk -> Experiment", evidence_map(grouped)))

    if mode != "executive":
        parts.extend(
            [
                "## Files Scanned",
                "",
                *[f"- {path}" for path in files],
                "",
            ]
        )
    return "\n".join(parts).rstrip() + "\n"


def write_json(path: Path, files: list[Path], grouped: dict[str, list[Item]], coverage: dict[str, bool]) -> None:
    payload = {
        "files": [str(path) for path in files],
        "coverage": coverage,
        "clarity_score": clarity_score(coverage, grouped),
        "area_scores": area_scores(coverage, grouped),
        "risk_categories": {
            category: [
                {"text": item.text, "source": str(item.source), "line": item.line}
                for item in items
            ]
            for category, items in risk_categories(grouped.get("risks", [])).items()
        },
        "items": {
            category: [
                {"text": item.text, "source": str(item.source), "line": item.line}
                for item in items
            ]
            for category, items in grouped.items()
        },
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def default_output(root: Path) -> Path:
    consultor_dir = root / "consultor"
    if consultor_dir.exists() or not (root / "marketing").exists():
        return consultor_dir / "reports" / "consultor-audit.md"
    return root / "marketing" / "reports" / "consultor-audit.md"


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit Consultor strategy documents.")
    parser.add_argument("root", nargs="?", default=".", help="Project root to scan.")
    parser.add_argument("-o", "--output", help="Markdown report path. Defaults to consultor/reports/consultor-audit.md.")
    parser.add_argument("--mode", choices=("full", "executive", "workshop"), default="full", help="Report mode.")
    parser.add_argument("--stdout", action="store_true", help="Print report instead of writing it.")
    parser.add_argument("--json", dest="json_path", help="Optional JSON output path.")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    files = discover_files(root)
    grouped = group_items(collect_items(files))
    coverage = detect_signal_coverage(files) if files else {signal: False for signal in CLARITY_SIGNALS}
    report = build_report(root, files, grouped, coverage, mode=args.mode)

    if args.stdout:
        print(report, end="")
    else:
        output = Path(args.output).expanduser().resolve() if args.output else default_output(root).resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(report, encoding="utf-8")
        print(output)

    if args.json_path:
        write_json(Path(args.json_path).expanduser().resolve(), files, grouped, coverage)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
