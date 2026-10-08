#!/usr/bin/env python3
"""Initialize or inspect a Consultor workspace without creating empty strategy files."""

from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path


DIRECTORIES = (
    "consultor",
    "consultor/strategy",
    "consultor/marketing",
    "consultor/research",
    "consultor/sales",
    "consultor/experiments",
    "consultor/reports",
)

README = """# Consultor Workspace

This directory stores Consultor working documents for this project.

Principles:

- Use project files as memory.
- Keep current-state documents concise.
- Separate Verified, Assumption, and Hypothesis.
- Do not create empty strategy documents.
- Record important reversals in `decisions.md`.

Suggested structure:

```text
consultor/
|-- context.md
|-- assumptions.md
|-- decisions.md
|-- risks.md
|-- strategy/
|-- marketing/
|-- research/
|-- sales/
|-- experiments/
`-- reports/
```
"""

CONTEXT = """# Consultor Context

## Project

## Current Focus

## Workshop Phase

Allowed phases:

- Interrogation
- Contradictions
- Synthesis
- Artifacts
- Validation plan
- Resume

## Current Best Understanding

## Open Questions
"""

ASSUMPTIONS = """# Assumptions

## Active Assumptions

## Hypotheses to Validate

## Evidence Needed
"""

DECISIONS = """# Decisions

## Current Decisions

## Superseded Decisions

Use this section only when a decision has been intentionally replaced. Record the reason and date.

## Decision Log
"""

RISKS = """# Risks

## Strategic Risks

## Commercial Risks

## Validation Risks
"""

BASE_FILES = {
    "consultor/README.md": README,
    "consultor/context.md": CONTEXT,
    "consultor/assumptions.md": ASSUMPTIONS,
    "consultor/decisions.md": DECISIONS,
    "consultor/risks.md": RISKS,
}


def has_meaningful_consultor_content(root: Path) -> bool:
    consultor = root / "consultor"
    if not consultor.exists():
        return False
    base_contents = {content.strip() for content in BASE_FILES.values()}
    for path in consultor.rglob("*"):
        if path.is_file() and path.suffix.lower() in {".md", ".txt"}:
            if path.name == "README.md":
                continue
            content = path.read_text(encoding="utf-8", errors="replace").strip()
            if content and content not in base_contents:
                return True
    return False


def write_if_missing(path: Path, content: str, dry_run: bool) -> str:
    if path.exists():
        return f"exists {path}"
    if not dry_run:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content.rstrip() + "\n", encoding="utf-8")
    return f"create {path}"


def init_workspace(root: Path, dry_run: bool, with_base_files: bool) -> list[str]:
    actions: list[str] = []
    for dirname in DIRECTORIES:
        path = root / dirname
        if path.exists():
            actions.append(f"exists {path}")
        else:
            if not dry_run:
                path.mkdir(parents=True, exist_ok=True)
            actions.append(f"create {path}")

    if with_base_files:
        for filename, content in BASE_FILES.items():
            actions.append(write_if_missing(root / filename, content, dry_run))

    return actions


def build_resume_note(root: Path) -> str:
    now = dt.date.today().isoformat()
    meaningful = has_meaningful_consultor_content(root)
    status = "existing Consultor content found" if meaningful else "no meaningful Consultor content found yet"
    return "\n".join(
        [
            "# Consultor Resume Note",
            "",
            f"Generated: {now}",
            f"Root: {root}",
            f"Status: {status}",
            "",
            "Next recommended agent action:",
            "",
            "- If content exists, run `consultor_audit.py` before asking more questions.",
            "- If content does not exist, ask one high-leverage question and write only real decisions, hypotheses, evidence, risks, or next steps.",
            "",
        ]
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Initialize or inspect a Consultor workspace.")
    parser.add_argument("root", nargs="?", default=".", help="Project root.")
    parser.add_argument("--dry-run", action="store_true", help="Show actions without writing.")
    parser.add_argument("--base-files", action="store_true", help="Create base memory files if missing.")
    parser.add_argument("--resume-note", action="store_true", help="Print a resume note after init.")
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    actions = init_workspace(root, dry_run=args.dry_run, with_base_files=args.base_files)
    for action in actions:
        print(action)
    if args.resume_note:
        print()
        print(build_resume_note(root), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
