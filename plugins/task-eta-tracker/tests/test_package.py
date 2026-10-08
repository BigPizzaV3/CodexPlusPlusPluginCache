import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class PackageTests(unittest.TestCase):
    def test_plugin_manifest(self):
        manifest = json.loads((ROOT / ".codex-plugin/plugin.json").read_text())
        self.assertEqual(manifest["name"], "task-eta-tracker")
        self.assertRegex(manifest["version"], r"^\d+\.\d+\.\d+$")
        self.assertEqual(manifest["skills"].rstrip("/"), "./skills")
        self.assertEqual(manifest["license"], "MIT")
        interface = manifest["interface"]
        for field in (
            "displayName",
            "shortDescription",
            "longDescription",
            "developerName",
            "category",
            "websiteURL",
            "privacyPolicyURL",
            "termsOfServiceURL",
        ):
            self.assertTrue(interface[field])
        for asset in (interface["composerIcon"], interface["logo"]):
            self.assertTrue((ROOT / asset).is_file())

    def test_skill_frontmatter(self):
        skill = (ROOT / "skills/task-eta-tracker/SKILL.md").read_text()
        self.assertTrue(skill.startswith("---\n"))
        frontmatter = skill.split("---\n", 2)[1]
        self.assertRegex(frontmatter, r"(?m)^name: task-eta-tracker$")
        self.assertRegex(frontmatter, r"(?m)^description: .+\S$")
        placeholder = "[" + "".join(map(chr, (84, 79, 68, 79))) + ":"
        self.assertNotIn(placeholder, skill)

    def test_marketplace_entry(self):
        marketplace = json.loads((ROOT / ".agents/plugins/marketplace.json").read_text())
        entry = marketplace["plugins"][0]
        self.assertEqual(entry["name"], "task-eta-tracker")
        self.assertEqual(entry["source"], {"source": "local", "path": "./"})
        self.assertEqual(entry["policy"]["installation"], "AVAILABLE")
        self.assertEqual(entry["policy"]["authentication"], "ON_INSTALL")

    def test_submission_cases(self):
        cases = (ROOT / "docs/REVIEWER_TESTS.md").read_text()
        positive = re.search(r"## Positive cases(.*?)## Negative cases", cases, re.S)
        negative = cases.split("## Negative cases", 1)[1]
        self.assertEqual(len(re.findall(r"^### ", positive.group(1), re.M)), 5)
        self.assertEqual(len(re.findall(r"^### ", negative, re.M)), 3)

    def test_public_policy_files(self):
        for filename in ("README.md", "LICENSE", "PRIVACY.md", "SUPPORT.md", "TERMS.md"):
            text = (ROOT / filename).read_text()
            self.assertTrue(text.strip(), filename)
            placeholder = "[" + "".join(map(chr, (84, 79, 68, 79))) + ":"
            self.assertNotIn(placeholder, text)


if __name__ == "__main__":
    unittest.main()
