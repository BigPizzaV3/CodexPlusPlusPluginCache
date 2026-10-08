#!/usr/bin/env python3

"""Validate critical invariants in a California appeal case-state JSON file."""

import argparse
import json
from datetime import date
from pathlib import Path


REQUIRED = {"schema_version", "language", "stage", "property", "sources", "unresolved_facts", "deadlines", "documents", "filing"}
FILING_STATUSES = {"not_started", "draft", "submitted_user_reported", "submitted_verified", "rejected", "withdrawn"}
PROOF_STATUSES = {"none", "draft_only", "confirmation_unverified", "confirmation_verified"}


def is_iso_date(value):
    if not isinstance(value, str):
        return False
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def validate(data):
    errors, warnings = [], []
    missing = sorted(REQUIRED - set(data))
    if missing:
        errors.append(f"Missing required top-level fields: {', '.join(missing)}")
    if data.get("schema_version") != 1:
        errors.append("schema_version must be 1.")
    if not isinstance(data.get("stage"), int) or not 0 <= data.get("stage", -1) <= 8:
        errors.append("stage must be an integer from 0 through 8.")

    prop = data.get("property", {})
    parcel_status = prop.get("parcel_status")
    if parcel_status not in {"unknown", "single_verified", "ambiguous"}:
        errors.append("property.parcel_status is invalid.")
    if data.get("stage", 0) >= 3 and parcel_status != "single_verified":
        errors.append("A single parcel must be verified before Stage 3 or later.")

    for index, item in enumerate(data.get("deadlines", [])):
        status = item.get("status")
        if status == "verified":
            if not is_iso_date(item.get("date")):
                errors.append(f"deadlines[{index}] verified date must be YYYY-MM-DD.")
            if not str(item.get("source_url", "")).startswith("https://"):
                errors.append(f"deadlines[{index}] verified deadline needs an HTTPS source.")
            if not is_iso_date(item.get("verified_on")):
                errors.append(f"deadlines[{index}] verified_on must be YYYY-MM-DD.")

    filing = data.get("filing", {})
    submission = filing.get("submission_status")
    proof = filing.get("proof_status")
    if submission not in FILING_STATUSES:
        errors.append("filing.submission_status is invalid.")
    if proof not in PROOF_STATUSES:
        errors.append("filing.proof_status is invalid.")
    if submission == "submitted_verified" and proof != "confirmation_verified":
        errors.append("submitted_verified requires confirmation_verified proof.")
    if proof == "confirmation_verified":
        if not filing.get("confirmation_number"):
            errors.append("Verified filing proof requires a confirmation number or official case identifier.")
        if not filing.get("submitted_at"):
            errors.append("Verified filing proof requires submitted_at or received_at.")
    if submission == "draft" and proof == "confirmation_verified":
        errors.append("A draft cannot have verified filing proof.")

    if data.get("unresolved_facts"):
        warnings.append("Unresolved facts remain; disclose them before a conclusion or filing review.")
    return {"valid": not errors, "errors": errors, "warnings": warnings}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("case_json", type=Path)
    args = parser.parse_args()
    try:
        data = json.loads(args.case_json.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"valid": False, "errors": [str(exc)], "warnings": []}, indent=2))
        return 2
    result = validate(data) if isinstance(data, dict) else {"valid": False, "errors": ["Case state must be an object."], "warnings": []}
    print(json.dumps(result, indent=2))
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
