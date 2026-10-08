from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
FIXTURE_ROOT = Path(__file__).resolve().parent / "fixtures"
sys.path.insert(0, str(SCRIPT_ROOT))
sys.path.insert(0, str(FIXTURE_ROOT))

from contracts import validate_career_passport  # noqa: E402
from factory import career_passport  # noqa: E402


class PassportManagerTests(unittest.TestCase):
    def _run(self, passport: Path, *args: str) -> subprocess.CompletedProcess[str]:
        environment = dict(os.environ)
        environment["PYTHONDONTWRITEBYTECODE"] = "1"
        return subprocess.run(
            [sys.executable, str(SCRIPT_ROOT / "manage_passport.py"), str(passport), *args],
            check=False,
            capture_output=True,
            text=True,
            env=environment,
        )

    def test_feedback_and_advanced_preference_correction_persist_safely(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "Career_Passport.json"
            path.write_text(json.dumps(career_passport()), encoding="utf-8")
            feedback = self._run(
                path,
                "append-feedback",
                "--category",
                "document",
                "--statement",
                "Keep projects above education.",
                "--confirmed",
            )
            self.assertEqual(feedback.returncode, 0, feedback.stderr or feedback.stdout)
            correction = self._run(
                path,
                "correct",
                "--field",
                "preferences.document_preferences.section_order",
                "--value-json",
                '["Professional Summary", "Role-Match Experience", "Professional Experience", "Projects", "Core Skills", "Education"]',
            )
            self.assertEqual(correction.returncode, 0, correction.stderr or correction.stdout)
            data = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(validate_career_passport(data), [])
            self.assertTrue(data["feedback"][0]["confirmed"])
            self.assertEqual(data["feedback"][0]["statement"], "Keep projects above education.")
            self.assertEqual(data["corrections"][-1]["field"], "preferences.document_preferences.section_order")
            self.assertIn("Projects", data["preferences"]["document_preferences"]["section_order"])

    def test_field_level_cv_preferences_can_be_added_as_advanced_configuration(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "Career_Passport.json"
            path.write_text(json.dumps(career_passport()), encoding="utf-8")
            fields = {
                "contact_field_order": ["email", "linkedin"],
                "hidden_contact_fields": ["phone"],
                "show_location": True,
                "show_work_rights": False,
                "headline_mode": "role_specific",
                "date_style": "month_year",
                "section_label_overrides": {"Professional Experience": "Career Experience"},
                "notes": [],
            }
            result = self._run(
                path,
                "correct",
                "--field",
                "preferences.document_preferences.field_preferences",
                "--value-json",
                json.dumps(fields),
            )
            self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
            data = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual(validate_career_passport(data), [])
            self.assertEqual(data["preferences"]["document_preferences"]["field_preferences"], fields)

    def test_invalid_correction_fails_without_mutating_passport(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "Career_Passport.json"
            original = career_passport()
            path.write_text(json.dumps(original), encoding="utf-8")
            result = self._run(
                path,
                "correct",
                "--field",
                "preferences.currency",
                "--value-json",
                '"Australian dollars"',
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), original)

    def test_multiple_cv_sources_are_valid_and_duplicate_ids_fail(self) -> None:
        passport = career_passport()
        passport["source_documents"].append(
            {
                "source_id": "SRC-P01-AI",
                "name": "Synthetic AI transformation CV",
                "source_type": "current_cv",
                "target_directions": ["AI transformation"],
                "is_primary": True,
                "version_date": "2026-07-13",
                "content_fingerprint": "sha256:synthetic-cv-p01-ai",
                "notes": [],
                "ingested_at": "2026-07-14T09:31:00+08:00",
            }
        )
        self.assertEqual(validate_career_passport(passport), [])
        passport["source_documents"][1]["source_id"] = "SRC-P01-PRIMARY"
        errors = validate_career_passport(passport)
        self.assertTrue(any("duplicate value" in error for error in errors))

    def test_document_versions_require_valid_source_provenance_and_role_identity(self) -> None:
        passport = career_passport()
        passport["document_versions"].append(
            {
                "version_id": "DOC-P01-TAILORED-001",
                "document_type": "tailored_cv",
                "role_id": "ROLE-SYNTH-001",
                "file_name": "Maya_Patel_Atlas_Services_CV.docx",
                "source_document_ids": ["SRC-P01-PRIMARY"],
                "created_at": "2026-07-14T10:30:00+08:00",
                "status": "ready",
                "change_summary": ["Tailored the source CV to the verified role dossier."],
            }
        )
        self.assertEqual(validate_career_passport(passport), [])
        passport["document_versions"][-1]["source_document_ids"] = ["SRC-MISSING"]
        errors = validate_career_passport(passport)
        self.assertTrue(any("unknown source document" in error for error in errors))

    def test_language_and_regional_spelling_are_optional_advanced_preferences(self) -> None:
        passport = career_passport()
        passport["preferences"]["document_preferences"]["language"] = "en-CA"
        passport["preferences"]["document_preferences"]["regional_spelling"] = "Canadian English"
        self.assertEqual(validate_career_passport(passport), [])
        passport["preferences"]["document_preferences"]["language"] = "x"
        self.assertTrue(any("language" in error for error in validate_career_passport(passport)))


if __name__ == "__main__":
    unittest.main()
