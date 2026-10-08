#!/usr/bin/env python3
"""Generate a final Consultor Markdown report from live project documents."""

from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
AUDIT_PATH = SCRIPT_DIR / "consultor_audit.py"


def load_audit_module():
    spec = importlib.util.spec_from_file_location("consultor_audit", AUDIT_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {AUDIT_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def read_doc(path: Path, max_chars: int) -> str:
    text = path.read_text(encoding="utf-8", errors="replace").strip()
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip() + "\n\n[Truncated]"


def bullet_items(items, limit: int = 12) -> list[str]:
    if not items:
        return ["- None documented."]
    return [f"- {item.text}" for item in items[:limit]]


def section(title: str, lines: list[str]) -> str:
    return f"## {title}\n\n" + "\n".join(lines) + "\n"


def source_section(files: list[Path], max_chars: int) -> str:
    parts = ["## Source Document Appendix", ""]
    for path in files:
        parts.extend(
            [
                f"### {path}",
                "",
                "```markdown",
                read_doc(path, max_chars),
                "```",
                "",
            ]
        )
    return "\n".join(parts)


def mode_sections(mode: str) -> list[str]:
    sections = {
        "compact": ["Confirmed Decisions", "Strategic Risks", "Next Experiments", "Immediate Actions"],
        "workshop": ["Confirmed Decisions", "Active Hypotheses", "Strategic Risks", "Open Questions", "Next Experiments"],
        "board": ["Executive Snapshot", "Confirmed Decisions", "Evidence", "Strategic Risks", "Immediate Actions"],
        "investor": ["Executive Snapshot", "Current Best Understanding", "Evidence", "Strategic Risks", "Next Experiments"],
        "launch": ["Current Best Understanding", "Confirmed Decisions", "Open Questions", "Next Experiments", "Immediate Actions"],
        "full": [],
    }
    return sections.get(mode, [])


def build_report(root: Path, include_sources: bool, max_source_chars: int, mode: str) -> str:
    audit = load_audit_module()
    files = audit.discover_files(root)
    grouped = audit.group_items(audit.collect_items(files))
    coverage = audit.detect_signal_coverage(files) if files else {signal: False for signal in audit.CLARITY_SIGNALS}
    score = audit.clarity_score(coverage, grouped)
    today = dt.date.today().isoformat()
    present = [signal for signal, value in coverage.items() if value]
    missing = [signal for signal, value in coverage.items() if not value]

    wanted = mode_sections(mode)
    all_sections = {
        "Current Best Understanding": section("Current Best Understanding", ["- Synthesize this section from the confirmed decisions and evidence before sharing externally."]),
        "Confirmed Decisions": section("Confirmed Decisions", bullet_items(grouped.get("decisions", []))),
        "Active Hypotheses": section("Active Hypotheses", bullet_items(grouped.get("hypotheses", []))),
        "Evidence": section("Evidence", bullet_items(grouped.get("evidence", []))),
        "Strategic Risks": section("Strategic Risks", bullet_items(grouped.get("risks", []))),
        "Open Questions": section("Open Questions", bullet_items(grouped.get("questions", []))),
        "Next Experiments": section("Next Experiments", bullet_items(grouped.get("experiments", []))),
        "Immediate Actions": section("Immediate Actions", bullet_items(grouped.get("actions", []))),
    }
    parts = [
        "# Final Consultor Report",
        "",
        f"Generated: {today}",
        f"Root: {root}",
        f"Files scanned: {len(files)}",
        "",
        "## Executive Snapshot",
        "",
        f"- Clarity score: {score}/100",
        "- Present signals: " + (", ".join(present) if present else "none"),
        "- Missing signals: " + (", ".join(missing) if missing else "none"),
        "",
    ]
    for title, content in all_sections.items():
        if not wanted or title in wanted:
            parts.append(content)
    parts.append(section("Consultant Notes", [
        "- Replace placeholder synthesis with judgment before sending this report to a client or stakeholder.",
        "- Keep Verified, Assumption, and Hypothesis clearly separated.",
        "- Do not hide missing evidence; make validation work explicit.",
    ]))

    if include_sources:
        parts.append(source_section(files, max_source_chars))

    return "\n".join(parts).rstrip() + "\n"


def default_output(root: Path) -> Path:
    return root / "consultor" / "reports" / "final-consulting-report.md"


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a final Consultor Markdown report.")
    parser.add_argument("root", nargs="?", default=".", help="Project root.")
    parser.add_argument("-o", "--output", help="Report output path.")
    parser.add_argument("--stdout", action="store_true", help="Print report instead of writing it.")
    parser.add_argument("--mode", choices=("full", "compact", "workshop", "board", "investor", "launch"), default="full", help="Report mode.")
    parser.add_argument("--include-sources", action="store_true", help="Append source document excerpts.")
    parser.add_argument("--max-source-chars", type=int, default=2500, help="Maximum characters per source appendix entry.")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    report = build_report(root, include_sources=args.include_sources, max_source_chars=args.max_source_chars, mode=args.mode)

    if args.stdout:
        print(report, end="")
    else:
        output = Path(args.output).expanduser().resolve() if args.output else default_output(root).resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(report, encoding="utf-8")
        print(output)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
