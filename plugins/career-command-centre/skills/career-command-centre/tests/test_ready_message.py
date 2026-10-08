from __future__ import annotations

import copy
import sys
import unittest
from pathlib import Path

SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
FIXTURE_ROOT = Path(__file__).resolve().parent / "fixtures"
sys.path.insert(0, str(SCRIPT_ROOT))
sys.path.insert(0, str(FIXTURE_ROOT))

from build_ready_message import build_ready_lines, build_ready_message  # noqa: E402
from factory import career_passport, load_persona  # noqa: E402


def passport_for_persona(name: str) -> dict:
    persona = load_persona(name)
    return {
        "schema_version": "4.0",
        "profile": copy.deepcopy(persona["profile"]),
        "preferences": copy.deepcopy(persona["preferences"]),
        "evidence": copy.deepcopy(persona["evidence"]),
        "role_history": [],
        "application_events": [],
        "corrections": [],
        "feedback": [],
        "updated_at": "2026-07-14T09:30:00+08:00",
    }


class ReadyMessageTests(unittest.TestCase):
    def test_senior_ready_message_has_seven_compact_assumptions(self) -> None:
        message = build_ready_message(career_passport())
        bullets = [line for line in message.splitlines() if line.startswith("- ")]
        self.assertEqual(len(bullets), 7)
        self.assertEqual(
            [line[2:].split(":", 1)[0] for line in bullets],
            ["Target", "Geography", "Sources", "Compensation", "CV", "Sections", "Application pack"],
        )
        self.assertIn("Your Career Centre is ready", message)
        self.assertIn("AUD 180,000+", message)
        self.assertIn("page 2 at least 80% filled", message)
        self.assertIn("Professional Summary", message)
        self.assertIn("submit every application manually", message)
        self.assertIn("change my advanced preferences", message)
        self.assertIn("I’ve prepared your Career Passport", message)

    def test_canadian_persona_does_not_inherit_australian_defaults(self) -> None:
        message = build_ready_message(passport_for_persona("midcareer_operations"))
        self.assertIn("Toronto", message)
        self.assertIn("CAD 115,000+", message)
        self.assertIn("Canadian citizen", message)
        self.assertNotIn("Australia", message)
        self.assertNotIn("AUD", message)

    def test_early_career_global_default_is_one_strong_page(self) -> None:
        message = build_ready_message(passport_for_persona("earlycareer_marketing"))
        self.assertIn("Manchester", message)
        self.assertIn("GBP 32,000+", message)
        self.assertIn("one strong Word page", message)
        self.assertIn("Projects", message)
        self.assertNotIn("Australia", message)

    def test_reference_format_and_section_changes_are_reflected(self) -> None:
        data = career_passport()
        docs = data["preferences"]["document_preferences"]
        docs["format_mode"] = "reference"
        docs["reference_template_name"] = "Reference_CV.docx"
        docs["section_order"] = ["Professional Summary", "Projects", "Professional Experience", "Education"]
        docs["additional_sections"] = []
        docs["omitted_sections"] = ["Core Skills"]
        lines = build_ready_lines(data)
        message = "\n".join(lines)
        self.assertIn("Reference_CV.docx", message)
        self.assertIn("Professional Summary; Projects; Professional Experience; Education", message)
        self.assertNotIn("Sections: Core Skills", message)

    def test_optional_field_preferences_are_visible_without_changing_evidence(self) -> None:
        data = career_passport()
        data["preferences"]["document_preferences"]["field_preferences"] = {
            "contact_field_order": ["email", "linkedin"],
            "hidden_contact_fields": ["phone"],
            "show_location": False,
            "show_work_rights": True,
            "headline_mode": "preserve",
            "date_style": "month_year",
            "section_label_overrides": {"Professional Experience": "Career Experience"},
            "notes": ["Keep dates right-aligned."],
        }
        message = build_ready_message(data)
        self.assertIn("Fields: hide phone; show work rights; hide location; preserve headline", message)
        self.assertEqual(data["evidence"][0]["confidence"], "source_only")

    def test_compensation_uses_local_india_units_and_preserves_basis(self) -> None:
        data = career_passport()
        data["preferences"]["currency"] = "INR"
        data["preferences"]["salary_minimum"] = 3_200_000
        data["preferences"]["salary_basis"] = "fixed"
        message = build_ready_message(data)
        self.assertIn("INR 32 lakh+ fixed compensation", message)
        self.assertNotIn("INR 3,200,000", message)

    def test_us_base_salary_basis_is_explicit(self) -> None:
        data = career_passport()
        data["preferences"]["currency"] = "USD"
        data["preferences"]["salary_minimum"] = 160_000
        data["preferences"]["salary_basis"] = "base"
        self.assertIn("USD 160,000+ base salary", build_ready_message(data))


if __name__ == "__main__":
    unittest.main()
