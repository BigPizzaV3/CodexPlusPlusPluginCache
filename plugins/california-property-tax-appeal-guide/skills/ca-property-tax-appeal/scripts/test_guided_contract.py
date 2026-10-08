#!/usr/bin/env python3

import json
import subprocess
import sys
import unittest
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_DIR = SCRIPT_DIR.parent
PLUGIN_DIR = SKILL_DIR.parent.parent


class GuidedConversationContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.skill = (SKILL_DIR / "SKILL.md").read_text(encoding="utf-8")
        cls.guide = (SKILL_DIR / "references" / "guided-conversation.md").read_text(
            encoding="utf-8"
        )
        cls.multilingual = (
            SKILL_DIR / "references" / "multilingual-support.md"
        ).read_text(encoding="utf-8")
        cls.packet = (SKILL_DIR / "templates" / "appeal-packet-checklist.md").read_text(
            encoding="utf-8"
        )
        cls.preparation = (
            SKILL_DIR / "templates" / "customer-preparation-checklist.md"
        ).read_text(encoding="utf-8")
        cls.county_routing = (
            SKILL_DIR / "references" / "county-filing-routing.md"
        ).read_text(encoding="utf-8")
        cls.county_index = json.loads(
            (SKILL_DIR / "references" / "county-web-index.json").read_text(
                encoding="utf-8"
            )
        )
        cls.case_state = (SKILL_DIR / "references" / "case-state.md").read_text(encoding="utf-8")
        cls.document_review = (SKILL_DIR / "references" / "document-and-receipt-review.md").read_text(encoding="utf-8")
        cls.deadline_followup = (SKILL_DIR / "references" / "deadline-follow-up.md").read_text(encoding="utf-8")
        cls.evals = (PLUGIN_DIR / "evals" / "cases.md").read_text(encoding="utf-8")
        cls.manifest = json.loads(
            (PLUGIN_DIR / ".codex-plugin" / "plugin.json").read_text(encoding="utf-8")
        )

    def test_skill_defaults_to_guided_mode(self):
        self.assertIn("one main question at a time", self.skill)
        self.assertIn("references/guided-conversation.md", self.skill)
        self.assertIn("templates/customer-preparation-checklist.md", self.skill)
        self.assertIn("references/multilingual-support.md", self.skill)
        self.assertIn("Fast Mode", self.guide)

    def test_language_menu_supports_common_and_custom_choices(self):
        for language in [
            "English",
            "简体中文",
            "繁體中文",
            "Español",
            "Tiếng Việt",
            "한국어",
            "Tagalog / Filipino",
            "Bilingual / 双语",
            "Another language",
        ]:
            self.assertIn(language, self.multilingual)

    def test_language_switch_preserves_case_progress(self):
        self.assertIn("change language", self.multilingual)
        self.assertIn("resume the same stage", self.multilingual)
        self.assertIn("Preserve all collected facts", self.multilingual)

    def test_official_terms_and_submission_language_are_protected(self):
        self.assertIn("Preserve exact English names", self.multilingual)
        self.assertIn("Do not assume a county accepts", self.multilingual)
        self.assertIn("Unofficial translation for understanding", self.multilingual)

    def test_preparation_screen_comes_before_property_questions(self):
        self.assertIn("## Preparation screen", self.guide)
        self.assertIn("Do not ask for the address until", self.guide)
        self.assertIn("address alone is enough", self.guide.lower())

    def test_all_eight_stages_exist(self):
        for stage in range(1, 9):
            self.assertIn(f"### {stage}.", self.guide)

    def test_each_turn_explains_reason_action_and_result(self):
        for marker in ["为什么", "现在怎么做", "问题", "不知道也没关系", "完成后"]:
            self.assertIn(marker, self.guide)

    def test_manifest_promises_guided_questions(self):
        interface = self.manifest["interface"]
        self.assertIn("preferred language", interface["longDescription"])
        self.assertIn("First show", interface["longDescription"])
        self.assertIn("one question at a time", interface["longDescription"])
        self.assertTrue(
            any("one question at a time" in prompt for prompt in interface["defaultPrompt"])
        )
        self.assertEqual("0.4.0+codex.20260913", self.manifest["version"])

    def test_plain_language_final_handoff_is_covered(self):
        self.assertIn("## Plain-language action page", self.packet)
        self.assertIn("break-even assessed-value reduction", self.packet)
        self.assertIn("## 18. Plain-language final outcomes", self.evals)

    def test_preparation_checklist_is_complete_but_not_mandatory(self):
        for heading in [
            "## The complete customer journey",
            "## Start with these",
            "## Helpful later",
            "## The plugin usually researches",
            "## Do not provide unless specifically required",
            "## What the customer receives",
        ]:
            self.assertIn(heading, self.preparation)
        for stage in range(1, 9):
            self.assertIn(f"### Step {stage}", self.preparation)
        self.assertIn("Only the address is required to begin", self.preparation)

    def test_evals_cover_preparation_flow(self):
        self.assertIn("## 20. Preparation data is mapped to steps", self.evals)
        self.assertIn("## 21. Address-only start remains possible", self.evals)
        self.assertIn("## 23. Deadline beats the welcome screen", self.evals)

    def test_evals_cover_multilingual_flow(self):
        self.assertIn("## 24. Clear-language auto detection", self.evals)
        self.assertIn("## 26. Mid-case language switch", self.evals)
        self.assertIn("## 28. Filing language is not assumed", self.evals)

    def test_notice_upload_fallback_is_guided_and_official(self):
        self.assertIn("#### Notice upload fallback", self.guide)
        self.assertIn("official County Assessor website", self.guide)
        self.assertIn("one item per turn", self.guide)
        self.assertIn("Do not call that record the user's mailed notice", self.guide)
        self.assertIn("## 29. Notice upload fails", self.evals)

    def test_online_filing_preference_is_verified_and_safe(self):
        self.assertIn("#### Online appeal filing preference", self.guide)
        self.assertIn("Santa Clara County", self.guide)
        self.assertIn("official filing page or portal", self.guide)
        self.assertIn("confirmation number", self.guide)
        self.assertIn("## 30. User prefers an online appeal", self.evals)
        self.assertIn("## 31. Online filing is not verified or portal fails", self.evals)
        capabilities = self.manifest["interface"]["capabilities"]
        self.assertIn(
            "Official website fallback when a notice cannot be uploaded", capabilities
        )
        self.assertIn("Verified county online-filing guidance", capabilities)

    def test_santa_clara_uses_official_instruction_and_portal_links(self):
        self.assertIn(
            "https://cob.santaclaracounty.gov/appeal-your-property-taxes",
            self.county_routing,
        )
        self.assertIn("https://sccgovaa.custhelp.com/", self.county_routing)
        self.assertNotIn("https://sccgovaa.custhelp.com/;", self.county_routing)
        self.assertIn("log in or create an account", self.county_routing)
        self.assertIn("## 32. Santa Clara official online route", self.evals)

    def test_other_counties_route_from_verified_address(self):
        self.assertIn("## Address-to-county routing", self.county_routing)
        self.assertIn("## Other California counties", self.county_routing)
        self.assertIn("official county page does not link to it", self.county_routing)
        self.assertIn("references/county-filing-routing.md", self.skill)
        self.assertIn("## 33. Address routes another county", self.evals)

    def test_all_58_california_counties_are_indexed_once(self):
        rows = self.county_index["counties"]
        names = [row["county"] for row in rows]
        self.assertEqual(58, len(rows))
        self.assertEqual(58, len(set(names)))
        self.assertTrue(all(row["assessor"].startswith("https://") for row in rows))
        self.assertTrue(
            all(row["appeals_office"].startswith("https://") for row in rows)
        )

    def test_county_lookup_returns_discovery_roots_and_refresh_warning(self):
        script = SCRIPT_DIR / "lookup_county_web.py"
        result = subprocess.run(
            [sys.executable, str(script), "Santa Clara County"],
            check=True,
            capture_output=True,
            text=True,
        )
        payload = json.loads(result.stdout)
        self.assertEqual("Santa Clara", payload["county"])
        self.assertEqual("https://sccgovaa.custhelp.com/", payload["online_portal"])
        self.assertTrue(payload["refresh_required"])

    def test_case_state_document_proof_and_reminder_contracts_exist(self):
        self.assertIn("references/case-state.md", self.skill)
        self.assertIn("validate_case_state.py", self.case_state)
        self.assertIn("draft_only", self.document_review)
        self.assertIn("confirmation_verified", self.document_review)
        self.assertIn("does not change the official deadline", self.deadline_followup.lower())
        for heading in ["## 39. Case state survives language change and restart", "## 40. Portal payment is not proof of filing", "## 42. Reminder is offered only for a verified date"]:
            self.assertIn(heading, self.evals)


if __name__ == "__main__":
    unittest.main()
