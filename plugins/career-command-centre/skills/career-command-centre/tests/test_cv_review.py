from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

from docx import Document

SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
sys.path.insert(0, str(SCRIPT_ROOT))

from review_cv_text import extract_text, review_text  # noqa: E402


class CVReviewTests(unittest.TestCase):
    def test_well_structured_cv_gets_observable_strengths_without_a_score(self) -> None:
        text = """Jordan Lee | jordan@example.com | +61 400 123 456
Professional Summary
Operations leader improving customer service and delivery routines across distributed teams.
Professional Experience
Operations Lead | Northstar | 2021–2026
• Led a 45-person service function across three sites and improved resolution time by 28%.
• Built weekly operating routines for leaders and frontline teams.
Service Manager | Harbour | 2017–2021
• Reduced escalation backlog by 35% through triage and ownership changes.
• Coached 12 team leaders in practical service reviews.
Core Skills
Service operations | Workflow improvement | Team leadership
Education
Bachelor of Business | 2016
"""
        report = review_text(text)
        self.assertTrue(report["no_universal_ats_score"])
        self.assertNotIn("score", report)
        self.assertGreaterEqual(len(report["strengths"]), 4)
        self.assertIn("experience", report["metrics"]["headings_found"])

    def test_duplicate_generic_and_long_content_becomes_actionable_findings(self) -> None:
        long_sentence = " ".join(["complex"] * 42) + "."
        repeated = "• Responsible for various stakeholders and delivered best-in-class outcomes."
        text = f"""Taylor Morgan | taylor@example.com
Professional Summary
Results-driven dynamic professional with a proven track record in fast-paced environment delivery.
Professional Experience
Role | Company | 2020–2026
{repeated}
{repeated}
• Delivered improvements for customers.
• Delivered updates for leaders.
• Delivered reports for teams.
{long_sentence}
Core Skills
Leadership
Education
Degree | 2019
"""
        report = review_text(text)
        categories = {item["category"] for item in report["findings"]}
        self.assertTrue({"repetition", "specificity", "readability", "writing variety"}.issubset(categories))
        repetition = next(item for item in report["findings"] if item["category"] == "repetition")
        self.assertEqual(repetition["impact"], "high")
        self.assertIn("Release-blocking duplication", repetition["recommendation"])
        self.assertEqual(report["status"], "needs_attention")

    def test_missing_selectable_contact_and_structure_are_high_impact(self) -> None:
        text = " ".join(["Experienced", "professional", "supporting", "teams", "and", "customers"] * 40)
        report = review_text(text)
        high_categories = {item["category"] for item in report["findings"] if item["impact"] == "high"}
        self.assertIn("contact details", high_categories)
        self.assertIn("structure", high_categories)

    def test_non_english_mode_preserves_global_names_without_english_style_claims(self) -> None:
        text = """José Álvarez | jose@example.es
Perfil profesional
Líder de operaciones con experiencia internacional y equipos multidisciplinares.
Experiencia profesional
Director de Operaciones | Ejemplo | 2020–2026
• Lideró equipos y mejoró procesos de atención al cliente.
• Diseñó rutinas de seguimiento y coordinación.
Educación
Máster en Gestión | 2019
""" + " experiencia liderazgo operaciones clientes" * 35
        report = review_text(text, language="es")
        self.assertEqual(report["metrics"]["headings_found"], [])
        self.assertFalse(any(item["category"] == "structure" for item in report["findings"]))
        self.assertTrue(any("without forcing English-only" in item for item in report["strengths"]))

    def test_docx_numbered_paragraphs_are_visible_as_bullets_to_the_diagnostic(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "list.docx"
            document = Document()
            document.add_paragraph("Delivered a verified customer-service improvement.", style="List Bullet")
            document.save(path)
            self.assertTrue(extract_text(path).startswith("• Delivered"))


if __name__ == "__main__":
    unittest.main()
