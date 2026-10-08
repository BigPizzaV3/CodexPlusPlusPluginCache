#!/usr/bin/env python3
"""Validate the structural evidence contract of a Tahr review JSON file."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


TOP_LEVEL = {
    "schema_version",
    "target",
    "review_mode",
    "summary",
    "coverage",
    "findings",
    "candidates",
    "tested_no_issue",
    "attack_chains",
    "unresolved",
}
FINDING_FIELDS = {
    "id",
    "title",
    "class",
    "status",
    "severity",
    "locations",
    "claim_under_test",
    "required_proof",
    "positive_evidence",
    "negative_evidence",
    "contradiction_verdict",
    "controls_checked",
    "preconditions",
    "impact",
    "confidence",
    "limitations",
    "remediation_target",
    "regression_test",
}
STATUSES = {"verified", "potential", "static-confirmed", "needs-runtime"}
SEVERITIES = {"critical", "high", "medium", "low", "informational"}
COVERAGE = {"complete", "partial", "blocked", "skipped-with-reason", "not-applicable"}
CONTRADICTIONS = {
    "not-contradicted",
    "contradicted",
    "partially-contradicted",
    "insufficient-evidence",
}
SECRET_PATTERNS = [
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{30,}\b"),
    re.compile(r"\bxox[abprs]-[0-9A-Za-z-]{20,}\b"),
    re.compile(r"\bBearer\s+[A-Za-z0-9._~+/=-]{20,}", re.IGNORECASE),
]


def nonempty_list(value: Any) -> bool:
    return isinstance(value, list) and bool(value)


def validate(data: Any, strict: bool) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    if not isinstance(data, dict):
        return ["top level must be an object"], warnings

    missing = sorted(TOP_LEVEL - data.keys())
    if missing:
        errors.append(f"missing top-level fields: {', '.join(missing)}")

    if not isinstance(data.get("target"), dict):
        errors.append("target must be an object")
    if data.get("review_mode") not in {"deep", "focused", "challenge", "diff", "retest"}:
        errors.append("review_mode must be deep, focused, challenge, diff, or retest")

    coverage = data.get("coverage")
    if not isinstance(coverage, list) or not coverage:
        errors.append("coverage must be a non-empty array")
    else:
        lanes: set[str] = set()
        for index, row in enumerate(coverage):
            prefix = f"coverage[{index}]"
            if not isinstance(row, dict):
                errors.append(f"{prefix} must be an object")
                continue
            lane = row.get("lane")
            if not isinstance(lane, str) or not lane.strip():
                errors.append(f"{prefix}.lane must be non-empty")
            elif lane in lanes:
                errors.append(f"duplicate coverage lane: {lane}")
            else:
                lanes.add(lane)
            status = row.get("status")
            if status not in COVERAGE:
                errors.append(f"{prefix}.status is invalid")
            gaps = row.get("gaps")
            if not isinstance(gaps, list):
                errors.append(f"{prefix}.gaps must be an array")
            if status in {"partial", "blocked"} and not gaps:
                errors.append(f"{prefix} needs a concrete gap for {status} status")
            if strict and status in {"partial", "blocked"}:
                errors.append(f"strict review has unresolved coverage lane: {lane}")

    findings = data.get("findings")
    if not isinstance(findings, list):
        errors.append("findings must be an array")
        findings = []
    seen_ids: set[str] = set()
    for index, finding in enumerate(findings):
        prefix = f"findings[{index}]"
        if not isinstance(finding, dict):
            errors.append(f"{prefix} must be an object")
            continue
        absent = sorted(FINDING_FIELDS - finding.keys())
        if absent:
            errors.append(f"{prefix} missing fields: {', '.join(absent)}")
        finding_id = finding.get("id")
        if not isinstance(finding_id, str) or not finding_id.strip():
            errors.append(f"{prefix}.id must be non-empty")
        elif finding_id in seen_ids:
            errors.append(f"duplicate finding id: {finding_id}")
        else:
            seen_ids.add(finding_id)
        status = finding.get("status")
        if status not in STATUSES:
            errors.append(f"{prefix}.status is invalid")
        if finding.get("severity") not in SEVERITIES:
            errors.append(f"{prefix}.severity is invalid")
        if finding.get("contradiction_verdict") not in CONTRADICTIONS:
            errors.append(f"{prefix}.contradiction_verdict is invalid")
        for field in ("locations", "positive_evidence", "negative_evidence", "controls_checked", "preconditions", "limitations"):
            if not isinstance(finding.get(field), list):
                errors.append(f"{prefix}.{field} must be an array")
        if status in {"verified", "potential", "static-confirmed"} and not nonempty_list(finding.get("positive_evidence")):
            errors.append(f"{prefix} requires positive evidence for {status}")
        if status == "verified" and not finding.get("required_proof"):
            errors.append(f"{prefix} verified claim must state required proof")
        if status in {"potential", "needs-runtime"} and not nonempty_list(finding.get("limitations")):
            errors.append(f"{prefix} must name missing proof or limitation")
        if finding.get("severity") in {"critical", "high"} and not finding.get("impact"):
            errors.append(f"{prefix} high-impact claim must state concrete impact")

    for field in ("candidates", "tested_no_issue", "attack_chains", "unresolved"):
        if not isinstance(data.get(field), list):
            errors.append(f"{field} must be an array")

    unresolved = data.get("unresolved")
    if strict and isinstance(unresolved, list) and unresolved:
        errors.append("strict review cannot contain unresolved items")

    serialized = json.dumps(data, sort_keys=True)
    if any(pattern.search(serialized) for pattern in SECRET_PATTERNS):
        errors.append("report appears to contain an unredacted secret or bearer token")

    if not findings:
        warnings.append("review contains no findings; verify that coverage gaps are explicit")
    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()

    try:
        data = json.loads(args.report.read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"ERROR: file not found: {args.report}", file=sys.stderr)
        return 2
    except json.JSONDecodeError as exc:
        print(f"ERROR: invalid JSON: {exc}", file=sys.stderr)
        return 2

    errors, warnings = validate(data, args.strict)
    for warning in warnings:
        print(f"WARNING: {warning}")
    for error in errors:
        print(f"ERROR: {error}")
    if errors:
        print(f"FAIL: {len(errors)} error(s), {len(warnings)} warning(s)")
        return 1
    print(f"PASS: review contract valid ({len(warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
