#!/usr/bin/env python3
"""Diagnose workspace and app readiness for Career Command Center."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workspace", type=Path)
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()
    workspace = args.workspace.expanduser().resolve()
    errors: list[str] = []
    warnings: list[str] = []

    required = [
        "Config/command_center_config.json",
        "State/cv_command_center_state.json",
        "Evidence_Bank/CV_GENERATION_STANDARD.md",
        "Evidence_Bank/WORKSPACE_CONTRACT.md",
        "Evidence_Bank/PERSONALIZED_QUESTION_STANDARD.md",
        "Evidence_Bank/approved_evidence.json",
        "Evidence_Bank/personalized_questions.json",
    ]
    for relative in required:
        if not (workspace / relative).exists():
            errors.append(f"Missing {relative}")

    config: dict = {}
    config_path = workspace / "Config/command_center_config.json"
    if config_path.exists():
        try:
            config = json.loads(config_path.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"Invalid config JSON: {exc}")
    if config and not config.get("onboarding_completed"):
        errors.append("First-use onboarding is not complete")
    if config and not (config.get("profile") or {}).get("fullName"):
        errors.append("Candidate full name is missing")
    if config and not (config.get("search") or {}).get("countries"):
        errors.append("No target countries are configured")

    state_path = workspace / "State/cv_command_center_state.json"
    if state_path.exists():
        try:
            state = json.loads(state_path.read_text(encoding="utf-8"))
            if not isinstance(state.get("leads"), list):
                errors.append("State leads is not an array")
        except Exception as exc:
            errors.append(f"Invalid state JSON: {exc}")

    evidence_path = workspace / "Evidence_Bank/approved_evidence.json"
    masters: list[str] = []
    has_evidence_blocks = False
    if evidence_path.exists():
        try:
            evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
            registered = evidence.get("approved_master_cvs") or {}
            masters = list(registered.values()) if isinstance(registered, dict) else list(registered)
            has_evidence_blocks = bool(evidence.get("evidence_blocks"))
            if not has_evidence_blocks:
                warnings.append("Evidence audit has not approved any evidence blocks")
        except Exception as exc:
            errors.append(f"Invalid evidence JSON: {exc}")
    if not masters:
        masters = list((config.get("cv") or {}).get("selectedMasterPaths") or [])
    missing_masters = [path for path in masters if not Path(path).expanduser().exists()]
    if not masters:
        warnings.append("No approved role-family master CVs are registered")
    elif missing_masters:
        warnings.append(f"{len(missing_masters)} registered master CV path(s) do not exist")

    ledger_path = workspace / "Evidence_Bank/Verified_Evidence_Ledger.md"
    if not ledger_path.exists() and not has_evidence_blocks:
        warnings.append("Narrative evidence ledger has not been created")

    document_files = [path for path in (workspace / "Documents").rglob("*") if path.is_file()]
    project_files = [path for path in (workspace / "Projects").rglob("*") if path.is_file()]
    document_count = len(document_files)
    project_count = len(project_files)
    if document_count == 0 and project_count == 0 and not has_evidence_blocks:
        warnings.append("No source documents or project files have been imported")

    question_counts = {
        "open": 0,
        "answered": 0,
        "unable_to_verify": 0,
        "not_applicable": 0,
        "resolved": 0,
        "superseded": 0,
    }
    question_audit_status = "not_started"
    question_generated_at = ""
    missing_active_sources = 0
    questions_path = workspace / "Evidence_Bank/personalized_questions.json"
    if questions_path.exists():
        try:
            question_bank = json.loads(questions_path.read_text(encoding="utf-8"))
            if question_bank.get("version") != 1:
                errors.append("Personalized evidence questions must use version 1")
            question_audit_status = question_bank.get("audit_status", "not_started")
            question_generated_at = question_bank.get("generated_at", "")
            if question_audit_status not in {"not_started", "current", "needs_refresh"}:
                errors.append("Personalized evidence questions have an invalid audit status")
            questions = question_bank.get("questions")
            if not isinstance(questions, list):
                errors.append("Personalized evidence questions must contain a questions array")
            else:
                for index, question in enumerate(questions):
                    if not isinstance(question, dict):
                        errors.append(f"Personalized evidence question {index} is not an object")
                        continue
                    status = question.get("status")
                    if status not in question_counts:
                        errors.append(f"Personalized evidence question {index} has invalid status {status!r}")
                        continue
                    question_counts[status] += 1
                    if status in {"open", "answered", "unable_to_verify"}:
                        source_refs = question.get("source_refs")
                        if not isinstance(source_refs, list) or not source_refs:
                            errors.append(
                                f"Personalized evidence question {index} has no source references"
                            )
                        else:
                            for source in source_refs:
                                raw_path = source.get("path") if isinstance(source, dict) else None
                                if not isinstance(raw_path, str):
                                    errors.append(
                                        f"Personalized evidence question {index} has an invalid source path"
                                    )
                                    continue
                                relative = Path(raw_path)
                                if relative.is_absolute() or ".." in relative.parts:
                                    errors.append(
                                        f"Personalized evidence question {index} source is not workspace-relative"
                                    )
                                elif not (workspace / relative).is_file():
                                    missing_active_sources += 1
        except Exception as exc:
            errors.append(f"Invalid personalized questions JSON: {exc}")

    if question_counts["open"]:
        warnings.append(
            f"Personalized evidence questions still need answers: {question_counts['open']}"
        )
    awaiting_review = question_counts["answered"] + question_counts["unable_to_verify"]
    if awaiting_review:
        warnings.append(
            f"Personalized evidence answers await Codex review: {awaiting_review}"
        )
    if document_count + project_count > 0 and question_audit_status != "current":
        warnings.append("Personalized evidence audit needs refresh for imported source material")
    source_files = document_files + project_files
    intake_path = workspace / "Evidence_Bank/intake_answers.md"
    if intake_path.is_file():
        source_files.append(intake_path)
    if question_audit_status == "current" and source_files:
        try:
            audited_at = datetime.fromisoformat(question_generated_at.replace("Z", "+00:00"))
            newest_source = max(path.stat().st_mtime for path in source_files)
            if newest_source - audited_at.timestamp() > 2:
                warnings.append("Personalized evidence audit needs refresh for changed source files")
        except Exception as exc:
            errors.append(f"Invalid personalized question generation timestamp: {exc}")
    if missing_active_sources:
        warnings.append(
            f"Personalized evidence questions reference missing source files: {missing_active_sources}"
        )

    ready = not errors and not any(
        text.startswith("Evidence audit")
        or text.startswith("No approved")
        or text.startswith("Personalized evidence")
        for text in warnings
    )
    result = {
        "workspace": str(workspace),
        "ready_for_automation": ready,
        "errors": errors,
        "warnings": warnings,
        "documents": document_count,
        "project_files": project_count,
        "approved_masters": len(masters) - len(missing_masters),
        "question_counts": question_counts,
        "question_audit_status": question_audit_status,
    }
    print(json.dumps(result, indent=2))
    if errors:
        return 2
    if args.strict and warnings:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
