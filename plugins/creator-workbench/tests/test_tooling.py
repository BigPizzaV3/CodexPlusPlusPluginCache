import json, subprocess, sys, tempfile, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PY = sys.executable

class ToolingTests(unittest.TestCase):
    def test_public_package_contract(self):
        manifest = json.loads((ROOT / ".codex-plugin/plugin.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["name"], "creator-workbench")
        self.assertRegex(manifest["version"], r"^\d+\.\d+\.\d+$")
        self.assertEqual(manifest["skills"], "./skills/")
        self.assertEqual(
            sorted(p.name for p in (ROOT / ".codex-plugin").iterdir()),
            ["plugin.json"],
        )
        for field in ("logo", "composerIcon"):
            relative = manifest["interface"][field]
            self.assertTrue(relative.startswith("./assets/"))
            self.assertTrue((ROOT / relative[2:]).is_file())

    def test_skill_surface_and_direct_invocation(self):
        skills = sorted(p for p in (ROOT / "skills").iterdir() if p.is_dir())
        self.assertEqual(len(skills), 29)
        for skill in skills:
            self.assertTrue((skill / "SKILL.md").is_file(), skill.name)
            self.assertTrue((skill / "agents/openai.yaml").is_file(), skill.name)
        router = (ROOT / "skills/creator-router/SKILL.md").read_text(encoding="utf-8")
        self.assertIn("@Creator Workspace", router)
        self.assertIn("direct invocation", router)
        self.assertIn("workspace-recall", router)
        recall = ROOT / "skills/workspace-recall"
        self.assertTrue((recall / "SKILL.md").is_file())
        self.assertTrue((recall / "agents/openai.yaml").is_file())

    def test_discovery_fixture_covers_starter_prompts(self):
        manifest = json.loads((ROOT / ".codex-plugin/plugin.json").read_text(encoding="utf-8"))
        cases = json.loads((ROOT / "tests/discovery_cases.json").read_text(encoding="utf-8"))
        prompts = [case["prompt"] for case in cases["positive"]]
        self.assertIn(
            "@Creator Workspace Set up my second brain from these exports and research files.",
            prompts,
        )
        recall_cases = [case for case in cases["positive"] if "workspace-recall" in case.get("expected", [])]
        self.assertGreaterEqual(len(recall_cases), 2)
        self.assertGreaterEqual(len(cases["positive"]), 5)
        self.assertGreaterEqual(len(cases["negative"]), 3)
        self.assertEqual(len(manifest["interface"]["defaultPrompt"]), 3)

    def test_openai_skill_metadata_contract(self):
        import yaml
        for skill in sorted(p for p in (ROOT / "skills").iterdir() if p.is_dir()):
            data = yaml.safe_load((skill / "agents/openai.yaml").read_text(encoding="utf-8"))
            interface = data["interface"]
            policy = data["policy"]
            self.assertIn(f"${skill.name}", interface["default_prompt"], skill.name)
            self.assertGreaterEqual(len(interface["short_description"]), 25, skill.name)
            self.assertLessEqual(len(interface["short_description"]), 64, skill.name)
            self.assertEqual(set(policy), {"allow_implicit_invocation"}, skill.name)
            self.assertIsInstance(policy["allow_implicit_invocation"], bool, skill.name)

    def test_workspace_smoke(self):
        r = subprocess.run([PY, str(ROOT/"scripts/workspace_smoke.py")], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
        data = json.loads(r.stdout)
        self.assertTrue(data["ok"])
        self.assertTrue(data["marker_recalled"])

    def test_importer_chatgpt_shape(self):
        with tempfile.TemporaryDirectory() as td:
            d = Path(td)
            src = d / "conversations.json"
            out = d / "out"
            fixture = [{
                "title": "Test conversation",
                "create_time": 1700000000,
                "mapping": {
                    "a": {"message": {"create_time": 1, "author": {"role": "user"}, "content": {"parts": ["hello"]}}},
                    "b": {"message": {"create_time": 2, "author": {"role": "assistant"}, "content": {"parts": ["world"]}}}
                }
            }]
            src.write_text(json.dumps(fixture), encoding="utf-8")
            r = subprocess.run([PY, str(ROOT/"scripts/conversation_importer.py"), str(src), str(out)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
            files = list(out.glob("*.md"))
            self.assertEqual(len(files), 1)
            txt = files[0].read_text()
            self.assertIn("## user", txt)
            self.assertIn("## assistant", txt)

    def test_wiki_index(self):
        with tempfile.TemporaryDirectory() as td:
            d = Path(td)
            wiki = d / "wiki"
            wiki.mkdir()
            (wiki / "alpha.md").write_text("# Alpha\n\nText", encoding="utf-8")
            (wiki / "beta.md").write_text("# Beta\n\nText", encoding="utf-8")
            out = d / "index.md"
            r = subprocess.run([PY, str(ROOT/"scripts/wiki_index.py"), str(wiki), str(out)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
            txt = out.read_text()
            self.assertIn("2 pages.", txt)
            self.assertIn("[Alpha](alpha.md)", txt)

    def test_voice_trace(self):
        with tempfile.TemporaryDirectory() as td:
            d = Path(td)
            transcript = d / "transcript.txt"
            draft = d / "draft.md"
            sentence = "I started using a simple notebook because I kept losing the useful details from every project."
            transcript.write_text((sentence + " ") * 8, encoding="utf-8")
            draft.write_text("# Draft\n\n" + sentence + " " + sentence, encoding="utf-8")
            r = subprocess.run([PY, str(ROOT/"scripts/voiceprint_trace.py"), str(draft), str(transcript)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
            data = json.loads(r.stdout)
            self.assertGreaterEqual(data["traceable_percent"], 85)

if __name__ == "__main__":
    unittest.main()
