from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path

SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
FIXTURE_ROOT = Path(__file__).resolve().parent / "fixtures"
sys.path.insert(0, str(SCRIPT_ROOT))
sys.path.insert(0, str(FIXTURE_ROOT))

from contracts import (  # noqa: E402
    validate_application_pack,
    validate_career_passport,
    validate_role_dossier,
    validate_run_result,
)
from factory import (  # noqa: E402
    application_pack,
    career_passport,
    earlycareer_application_pack,
    earlycareer_role_dossier,
    midcareer_role_dossier,
    role_dossier,
    run_result,
)


class ContractTests(unittest.TestCase):
    def test_valid_fixtures_pass(self) -> None:
        self.assertEqual(validate_career_passport(career_passport()), [])
        self.assertEqual(validate_role_dossier(role_dossier()), [])
        self.assertEqual(validate_application_pack(application_pack()), [])
        self.assertEqual(validate_run_result(run_result()), [])
        self.assertEqual(validate_role_dossier(midcareer_role_dossier()), [])
        self.assertEqual(validate_role_dossier(earlycareer_role_dossier()), [])
        self.assertEqual(validate_application_pack(earlycareer_application_pack()), [])

    def test_cv_claim_cannot_be_upgraded_to_verified_without_corroboration(self) -> None:
        data = career_passport()
        data["evidence"][0]["confidence"] = "externally_corroborated"
        errors = validate_career_passport(data)
        self.assertTrue(any("external corroboration" in error or "CV-derived" in error for error in errors), errors)

    def test_apply_rejects_generic_or_closed_posting(self) -> None:
        data = role_dossier()
        data["identity"]["synthetic"] = False
        data["identity"]["exact_posting_url"] = "https://company.invalid/careers"
        data["identity"]["posting_status"] = "closed"
        data["identity"]["link_status"] = "generic"
        errors = validate_role_dossier(data)
        self.assertTrue(any("generic" in error.casefold() for error in errors), errors)
        self.assertTrue(any("open posting" in error for error in errors), errors)

    def test_skip_requires_reason(self) -> None:
        data = role_dossier(decision="skip")
        data["skip_reason"] = None
        errors = validate_role_dossier(data)
        self.assertTrue(any("skip_reason" in error for error in errors), errors)

    def test_unknown_evidence_id_blocks_application_pack(self) -> None:
        data = application_pack()
        data["cv"]["sections"][0]["items"][0]["evidence_ids"] = ["EV-NOT-REAL"]
        errors = validate_application_pack(data)
        self.assertTrue(any("unknown evidence" in error for error in errors), errors)

    def test_missing_paired_cover_letter_is_invalid(self) -> None:
        data = application_pack()
        data["cover_letter"]["enabled"] = False
        errors = validate_application_pack(data)
        self.assertTrue(any("paired cover letter" in error for error in errors), errors)

    def test_two_page_pack_requires_one_controlled_break(self) -> None:
        data = application_pack(page_target=2)
        for section in data["cv"]["sections"]:
            section["page_break_before"] = False
        errors = validate_application_pack(data)
        self.assertTrue(any("controlled page break" in error for error in errors), errors)

    def test_duplicate_roles_are_rejected(self) -> None:
        data = run_result()
        data["roles"].append(copy.deepcopy(data["roles"][0]))
        errors = validate_run_result(data)
        self.assertTrue(any("duplicate" in error.casefold() for error in errors), errors)

    def test_success_no_pack_rejects_pack_request(self) -> None:
        data = run_result(status="SUCCESS_NO_PACK")
        errors = validate_run_result(data)
        self.assertTrue(any("SUCCESS_NO_PACK" in error for error in errors), errors)

    def test_reference_format_requires_a_named_reference(self) -> None:
        data = application_pack()
        data["document_settings"]["template"] = "reference"
        errors = validate_application_pack(data)
        self.assertTrue(any("reference_template_name" in error for error in errors), errors)

    def test_unconfirmed_feedback_is_valid_local_learning_state(self) -> None:
        data = career_passport()
        data["feedback"].append(
            {
                "feedback_id": "FB-SYNTH-001",
                "category": "document",
                "statement": "Consider moving projects above education.",
                "confirmed": False,
                "recorded_at": "2026-07-14T10:00:00+08:00",
            }
        )
        self.assertEqual(validate_career_passport(data), [])


if __name__ == "__main__":
    unittest.main()
