#!/usr/bin/env python3
"""Validate a C4 fake-trading-app case checkpoint using the standard library."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


ID_PATTERNS = {
    "evidence": re.compile(r"^EV-\d{3,}$"),
    "entities": re.compile(r"^ENT-\d{3,}$"),
    "iocs": re.compile(r"^IOC-\d{3,}$"),
    "transactions": re.compile(r"^TX-\d{3,}$"),
    "findings": re.compile(r"^F-\d{3,}$"),
    "actions": re.compile(r"^ACT-\d{3,}$"),
}

REQUIRED_TOP_LEVEL = {
    "schema_version", "case", "allegation_summary", "evidence", "entities",
    "iocs", "transactions", "timeline", "hypotheses", "findings",
    "legal_candidates", "actions", "contradictions", "limitations",
    "open_questions", "readiness",
}

READY_STATUS = "Ready for supervisory/legal review"


def validate(data: Any) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not isinstance(data, dict):
        return ["checkpoint root must be a JSON object"], warnings

    missing = sorted(REQUIRED_TOP_LEVEL - data.keys())
    if missing:
        errors.append("missing top-level fields: " + ", ".join(missing))

    ids: dict[str, set[str]] = {}
    for section, pattern in ID_PATTERNS.items():
        items = data.get(section, [])
        if not isinstance(items, list):
            errors.append(f"{section} must be a list")
            continue
        found: set[str] = set()
        for index, item in enumerate(items):
            if not isinstance(item, dict):
                errors.append(f"{section}[{index}] must be an object")
                continue
            item_id = item.get("id")
            if not isinstance(item_id, str) or not pattern.fullmatch(item_id):
                errors.append(f"{section}[{index}].id must match {pattern.pattern}")
            elif item_id in found:
                errors.append(f"duplicate ID in {section}: {item_id}")
            else:
                found.add(item_id)
        ids[section] = found

    evidence_ids = ids.get("evidence", set())
    for index, finding in enumerate(data.get("findings", [])):
        if not isinstance(finding, dict):
            continue
        finding_type = finding.get("type")
        if finding_type not in {"fact", "reported", "inference", "unknown"}:
            errors.append(f"findings[{index}].type is invalid")
        cited = finding.get("evidence_ids", [])
        if finding_type != "unknown" and not cited:
            errors.append(f"findings[{index}] must cite evidence_ids")
        for evidence_id in cited if isinstance(cited, list) else []:
            if evidence_id not in evidence_ids:
                errors.append(f"findings[{index}] cites unknown evidence ID {evidence_id}")
        if finding_type == "inference":
            if finding.get("confidence") not in {"high", "medium", "low"}:
                errors.append(f"findings[{index}] inference needs high/medium/low confidence")
            if not finding.get("rationale"):
                errors.append(f"findings[{index}] inference needs a rationale")

    for index, candidate in enumerate(data.get("legal_candidates", [])):
        if not isinstance(candidate, dict):
            continue
        for key in ("provision", "official_source_url", "verified_at", "elements"):
            if not candidate.get(key):
                errors.append(f"legal_candidates[{index}] missing {key}")
        if not str(candidate.get("official_source_url", "")).startswith("https://"):
            errors.append(f"legal_candidates[{index}].official_source_url must use https")
        if not isinstance(candidate.get("elements", []), list):
            errors.append(f"legal_candidates[{index}].elements must be a list")

    case = data.get("case", {}) if isinstance(data.get("case"), dict) else {}
    readiness = data.get("readiness", {}) if isinstance(data.get("readiness"), dict) else {}
    status = readiness.get("status", case.get("status"))
    if status == READY_STATUS:
        required_case = ("purpose", "investigator_role", "authority_basis", "incident_start", "checkpoint_at")
        for key in required_case:
            if not case.get(key):
                errors.append(f"ready case requires case.{key}")
        jurisdiction = case.get("jurisdiction", {})
        if not isinstance(jurisdiction, dict) or not jurisdiction.get("state_or_ut"):
            errors.append("ready case requires case.jurisdiction.state_or_ut")
        if not readiness.get("investigator_confirmed"):
            errors.append("ready case requires readiness.investigator_confirmed=true")
        checks = readiness.get("checks", {})
        if not isinstance(checks, dict) or not checks or not all(checks.values()):
            errors.append("ready case requires non-empty readiness.checks with all values true")
        if not data.get("evidence"):
            errors.append("ready case requires evidence")
        if not data.get("findings"):
            errors.append("ready case requires findings")
        if not readiness.get("rationale"):
            errors.append("ready case requires readiness.rationale")

    if not data.get("limitations"):
        warnings.append("no limitations recorded")
    if data.get("transactions") and not data.get("timeline"):
        warnings.append("transactions exist but timeline is empty")
    if not data.get("hypotheses"):
        warnings.append("no competing hypotheses recorded")
    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("checkpoint", type=Path)
    args = parser.parse_args()
    try:
        data = json.loads(args.checkpoint.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERROR: {exc}")
        return 2

    errors, warnings = validate(data)
    for message in errors:
        print(f"ERROR: {message}")
    for message in warnings:
        print(f"WARNING: {message}")
    if errors:
        print(f"FAIL: {len(errors)} error(s), {len(warnings)} warning(s)")
        return 1
    print(f"PASS: 0 errors, {len(warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
