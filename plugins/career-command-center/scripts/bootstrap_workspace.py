#!/usr/bin/env python3
"""Create or upgrade a Career Command Center workspace without overwriting user evidence."""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parent.parent
REFERENCES = PLUGIN_ROOT / "references"


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def copy_if_missing(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        shutil.copy2(source, destination)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workspace", type=Path)
    args = parser.parse_args()
    workspace = args.workspace.expanduser().resolve()

    directories = [
        "Applications",
        "Automation",
        "Config",
        "Documents/CVs",
        "Documents/Transcripts",
        "Documents/Certificates",
        "Documents/Recommendations",
        "Documents/Portfolio and Work Samples",
        "Documents/Other",
        "Evidence_Bank",
        "Job_Postings",
        "Logs",
        "Projects",
        "State",
    ]
    for relative in directories:
        (workspace / relative).mkdir(parents=True, exist_ok=True)

    copy_if_missing(
        REFERENCES / "CV_GENERATION_STANDARD.md",
        workspace / "Evidence_Bank/CV_GENERATION_STANDARD.md",
    )
    copy_if_missing(
        REFERENCES / "WORKSPACE_CONTRACT.md",
        workspace / "Evidence_Bank/WORKSPACE_CONTRACT.md",
    )
    copy_if_missing(
        REFERENCES / "cv_quality_rules.json",
        workspace / "Evidence_Bank/cv_quality_rules.json",
    )
    copy_if_missing(
        REFERENCES / "PERSONALIZED_QUESTION_STANDARD.md",
        workspace / "Evidence_Bank/PERSONALIZED_QUESTION_STANDARD.md",
    )

    state_path = workspace / "State/cv_command_center_state.json"
    if not state_path.exists():
        write_json(
            state_path,
            {
                "version": 3,
                "created_at": timestamp(),
                "updated_at": timestamp(),
                "leads": [],
                "deleted_leads": [],
                "lead_tombstones": [],
                "notes": [],
            },
        )

    evidence_path = workspace / "Evidence_Bank/approved_evidence.json"
    evidence_was_present = evidence_path.exists()
    if not evidence_was_present:
        write_json(
            evidence_path,
            {
                "version": 2,
                "updated_at": timestamp(),
                "strategy_version": "2.0",
                "principles": [
                    "Use verified primary evidence and explicit user confirmation.",
                    "Start every tailored CV from one approved role-family master.",
                    "Keep measured, estimated, shared, and blocked claims distinct.",
                ],
                "approved_master_cvs": {},
                "role_families": {},
                "evidence_blocks": [],
            },
        )

    ledger_path = workspace / "Evidence_Bank/Verified_Evidence_Ledger.md"
    if not ledger_path.exists() and not evidence_was_present:
        ledger_path.write_text(
            "# Verified Evidence Ledger\n\n"
            "Status: Pending evidence audit\n\n"
            "Codex must review the document inbox, project material, and intake answers before approving facts or building master CVs.\n",
            encoding="utf-8",
        )

    questions_path = workspace / "Evidence_Bank/personalized_questions.json"
    if not questions_path.exists():
        write_json(
            questions_path,
            {
                "version": 1,
                "generation_id": "",
                "audit_status": "not_started",
                "source_change_note": "",
                "generated_at": "",
                "updated_at": timestamp(),
                "questions": [],
            },
        )

    print(
        json.dumps(
            {
                "workspace": str(workspace),
                "state": str(state_path),
                "config": str(workspace / "Config/command_center_config.json"),
                "strategy": str(workspace / "Evidence_Bank/CV_GENERATION_STANDARD.md"),
                "questions": str(questions_path),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
