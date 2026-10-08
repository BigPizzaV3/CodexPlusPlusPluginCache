#!/usr/bin/env python3

import json
import unittest
from datetime import date
from pathlib import Path

from audit_county_index import audit
from resolve_address_county import extract
from validate_case_state import validate


SCRIPT_DIR = Path(__file__).resolve().parent
INDEX = SCRIPT_DIR.parent / "references" / "county-web-index.json"


def base_case():
    return {
        "schema_version": 1,
        "language": "English",
        "stage": 2,
        "property": {"address": "1 Main St", "county": "Santa Clara", "apn": None, "parcel_status": "single_verified"},
        "appeal": {},
        "deadlines": [{"event": "formal filing", "date": "2026-09-15", "status": "verified", "source_url": "https://county.example.gov/deadlines", "verified_on": "2026-09-01", "reminder_offsets_days": [14, 7, 3, 1]}],
        "sources": [],
        "documents": [],
        "filing": {"method": None, "submission_status": "not_started", "proof_status": "none", "confirmation_number": None, "submitted_at": None},
        "unresolved_facts": [],
        "conflicts": [],
    }


class WorkflowToolsTest(unittest.TestCase):
    def test_case_state_rejects_ambiguous_parcel_after_stage_two(self):
        case = base_case()
        case["stage"] = 3
        case["property"]["parcel_status"] = "ambiguous"
        result = validate(case)
        self.assertFalse(result["valid"])
        self.assertTrue(any("single parcel" in error for error in result["errors"]))

    def test_case_state_rejects_verified_submission_without_proof(self):
        case = base_case()
        case["filing"]["submission_status"] = "submitted_verified"
        result = validate(case)
        self.assertFalse(result["valid"])
        self.assertTrue(any("confirmation_verified" in error for error in result["errors"]))

    def test_case_state_accepts_complete_confirmation(self):
        case = base_case()
        case["filing"].update({"submission_status": "submitted_verified", "proof_status": "confirmation_verified", "confirmation_number": "A-123", "submitted_at": "2026-09-10T10:30:00-07:00"})
        self.assertTrue(validate(case)["valid"])

    def test_census_result_extracts_california_county_candidate(self):
        payload = {"result": {"addressMatches": [{"matchedAddress": "1 MAIN ST, SAN JOSE, CA, 95113", "geographies": {"Counties": [{"NAME": "Santa Clara County", "STATE": "06", "COUNTY": "085"}]}}]}}
        result = extract(payload)
        self.assertEqual("matched", result["status"])
        self.assertEqual("Santa Clara", result["county"])
        self.assertTrue(result["is_california"])
        self.assertTrue(result["requires_county_record_confirmation"])

    def test_county_index_audit_reports_unverified_portals(self):
        data = json.loads(INDEX.read_text(encoding="utf-8"))
        result = audit(data, date(2026, 9, 13), 30)
        self.assertTrue(result["valid"])
        self.assertEqual(58, result["county_count"])
        self.assertTrue(any("unverified" in warning for warning in result["warnings"]))


if __name__ == "__main__":
    unittest.main()
