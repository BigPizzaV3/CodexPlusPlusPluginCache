from __future__ import annotations

import json
import unittest
from pathlib import Path


class PackageContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.skill_root = Path(__file__).resolve().parents[1]
        self.plugin_root = self.skill_root.parents[1]

    def test_all_schema_files_are_valid_json(self) -> None:
        schemas = sorted((self.skill_root / "schemas").glob("*.json"))
        self.assertGreaterEqual(len(schemas), 4)
        for path in schemas:
            with self.subTest(path=path.name):
                json.loads(path.read_text(encoding="utf-8"))

    def test_skill_has_simple_first_interaction_and_safety_boundaries(self) -> None:
        text = (self.skill_root / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("Ask for the latest CV in one warm sentence", text)
        self.assertIn("do not inspect unrelated prior chats", text)
        self.assertIn("If the CV is pasted into the current message, analyse that text directly", text)
        self.assertIn("maximum of four items", text)
        self.assertIn("Never auto-submit", text)
        self.assertIn("Default application pack is CV plus cover letter", text)
        self.assertIn("Exact posting link: missing - not reviewed", text)
        self.assertIn("Your Career Centre is ready", text)
        self.assertIn("change my advanced preferences", text)
        self.assertIn("page 2 at least 80% filled", text)
        self.assertIn("Use global, market-aware defaults", text)
        self.assertIn("Any role identified by title, company or posting link", text)
        self.assertIn("including a weak candidate, inspected rejection, near miss or example", text)
        self.assertIn("exact employer posting is accessible, it is authoritative", text)
        self.assertIn("Never let a mirror override or relabel salary", text)
        self.assertIn("it is not a separate `reference CV`", text)
        self.assertIn("Create or refresh a CV base", text)
        self.assertIn("CV bases and reference-format documents", text)
        self.assertIn("Do not approve the document on the generic document capability's self-reported QA alone", text)
        self.assertIn("explicit stop boundary", text)
        self.assertIn("My recommendation", text)
        self.assertIn("orientation -> tension or trade-off -> recommendation -> one concrete next move", text)

    def test_skill_description_routes_cv_base_and_reference_format_language(self) -> None:
        text = (self.skill_root / "SKILL.md").read_text(encoding="utf-8")
        frontmatter = text.split("---", 2)[1]
        for phrase in (
            "Primary skill for any request about a person's own job search",
            "Must be used for creating a reusable CV base",
            "generic document tools may assist only after this career skill is loaded",
            '"create a CV base"',
            '"use this CV as my format"',
        ):
            with self.subTest(phrase=phrase):
                self.assertIn(phrase, frontmatter)

    def test_multi_cv_review_continuity_and_recovery_contracts_are_explicit(self) -> None:
        skill = (self.skill_root / "SKILL.md").read_text(encoding="utf-8")
        review = (self.skill_root / "references" / "09_CV_REVIEW_AND_CONTINUITY.md").read_text(encoding="utf-8")
        recovery = (self.skill_root / "references" / "08_RECOVERY.md").read_text(encoding="utf-8")
        self.assertIn("share the key versions together", skill)
        self.assertIn("Quick CV read", skill)
        self.assertIn("Overall CV strength", skill)
        self.assertIn("If you want, I can give you the deeper review after setup", review)
        self.assertIn("CV quality rating out of 10", skill)
        self.assertIn("Do not proactively suggest a reference template", skill)
        self.assertIn("portable Career Evidence File and history backup", skill)
        self.assertIn("separate new conversation may not inherit", skill)
        self.assertIn("Do not invent a universal ATS rating", review)
        self.assertIn("job description can never become evidence", review)
        self.assertIn("entire final CV in chat", recovery)

    def test_global_localisation_contract_covers_india_and_us_without_personal_data_defaults(self) -> None:
        skill = (self.skill_root / "SKILL.md").read_text(encoding="utf-8")
        text = (self.skill_root / "references" / "10_MARKET_LOCALISATION.md").read_text(encoding="utf-8")
        self.assertIn("Name the recognisable primary boards", skill)
        self.assertIn("## United States", text)
        self.assertIn("## India", text)
        self.assertIn("current CTC, expected CTC", text)
        self.assertIn("state/local pay-transparency", text)
        self.assertIn("Do not add a photograph", text)
        for source in ("LinkedIn India", "Naukri", "foundit", "iimjobs"):
            self.assertIn(source, text)
        for source in ("LinkedIn", "Indeed", "Built In", "USAJOBS"):
            self.assertIn(source, text)

    def test_passport_schema_supports_multiple_source_documents(self) -> None:
        schema = json.loads((self.skill_root / "schemas" / "career_passport.schema.json").read_text(encoding="utf-8"))
        source_schema = schema["$defs"]["source_document"]
        self.assertIn("source_documents", schema["properties"])
        self.assertIn("target_directions", source_schema["required"])
        self.assertIn("is_primary", source_schema["required"])
        self.assertIn("linkedin_export", source_schema["properties"]["source_type"]["enum"])

    def test_passport_schema_supports_document_history_and_global_writing_preferences(self) -> None:
        schema = json.loads((self.skill_root / "schemas" / "career_passport.schema.json").read_text(encoding="utf-8"))
        preferences = schema["properties"]["preferences"]["properties"]["document_preferences"]["properties"]
        version_schema = schema["$defs"]["document_version"]
        self.assertIn("document_versions", schema["properties"])
        self.assertIn("language", preferences)
        self.assertIn("regional_spelling", preferences)
        self.assertEqual(version_schema["properties"]["status"]["enum"], ["ready", "partial", "superseded"])
        self.assertIn("source_document_ids", version_schema["required"])

    def test_search_contract_has_provider_independent_source_ladder(self) -> None:
        text = (self.skill_root / "references" / "04_SEARCH_AND_DECISIONS.md").read_text(encoding="utf-8")
        self.assertIn("Use this source ladder", text)
        self.assertIn("Do not require a LinkedIn, Indeed, SEEK or other job-site plugin", text)
        self.assertIn("Do not scrape, bypass access controls", text)
        self.assertIn("Exact posting URL: https://", text)
        self.assertIn("external job ID without its URL does not satisfy", text)

    def test_automation_handoff_is_enforced_at_ready_search_pack_and_acceptance(self) -> None:
        skill = (self.skill_root / "SKILL.md").read_text(encoding="utf-8")
        scheduling = (self.skill_root / "references" / "06_SCHEDULING.md").read_text(encoding="utf-8")
        self.assertIn("recurring-search handoff as a required product deliverable", skill)
        self.assertIn("After this first search, I’ll ask whether you want me to make it a daily or weekday Scheduled task", skill)
        self.assertIn("Live-search response release gate", skill)
        self.assertIn("Want me to make this search automatic?", skill)
        self.assertIn("I can create a Scheduled Career Centre task here", skill)
        self.assertIn("Application-pack automation recovery gate", skill)
        self.assertIn("first completed application pack", skill)
        self.assertIn("use the host's scheduled-task capability immediately", skill)
        self.assertIn("create the Scheduled task immediately", scheduling)
        self.assertIn("Open **Work**", scheduling)
        self.assertIn("Optional Indeed discovery extension", scheduling)
        self.assertIn("@Indeed find me roles matching", scheduling)
        self.assertIn("Do not create a schedule", scheduling)
        self.assertIn("does not suppress this invitation", scheduling)
        self.assertIn("verify that the invitation is present once", scheduling)

    def test_open_door_assets_are_square_and_match_the_public_site(self) -> None:
        manifest = json.loads((self.plugin_root / ".codex-plugin" / "plugin.json").read_text(encoding="utf-8"))
        icon = self.plugin_root / "assets" / "icon.png"
        logo = self.plugin_root / "assets" / "logo.png"
        public_icon = self.plugin_root.parents[1] / "public-site" / "assets" / "icon.png"
        self.assertEqual(manifest["interface"]["composerIcon"], "./assets/icon.png")
        self.assertEqual(manifest["interface"]["logo"], "./assets/logo.png")
        self.assertEqual(icon.read_bytes(), logo.read_bytes())
        self.assertEqual(icon.read_bytes(), public_icon.read_bytes())
        self.assertGreater(len(icon.read_bytes()), 10_000)

    def test_release_tree_contains_no_compiled_or_html_artifacts(self) -> None:
        forbidden = [
            path
            for path in self.plugin_root.rglob("*")
            if path.is_file() and (path.suffix.casefold() in {".pyc", ".pyo", ".html", ".htm"} or "__pycache__" in path.parts)
        ]
        self.assertEqual(forbidden, [])

    def test_manifest_matches_plugin_folder(self) -> None:
        manifest = json.loads((self.plugin_root / ".codex-plugin" / "plugin.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["name"], self.plugin_root.name)
        self.assertEqual(manifest["interface"]["developerName"], "Amit Sharma")
        self.assertIsInstance(manifest["interface"]["defaultPrompt"], list)
        self.assertLessEqual(len(manifest["interface"]["defaultPrompt"]), 3)


if __name__ == "__main__":
    unittest.main()
