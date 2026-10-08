#!/usr/bin/env python3
"""Regression tests for the Claude Code plugin surface: manifests, agents, commands and hooks."""
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HANDLERS = ROOT / "hooks" / "handlers"


def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def frontmatter(path):
    text = path.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if not match:
        return {}
    fields = {}
    for line in match.group(1).splitlines():
        if ":" in line and not line.startswith(" "):
            key, value = line.split(":", 1)
            fields[key.strip()] = value.strip()
    return fields


def run_hook(script, event):
    result = subprocess.run(
        [sys.executable, str(HANDLERS / script)],
        input=json.dumps(event),
        capture_output=True,
        text=True,
        timeout=30,
    )
    return result.returncode, result.stdout.strip()


class ManifestTests(unittest.TestCase):
    def test_versions_stay_in_sync(self):
        plugin = load(".claude-plugin/plugin.json")
        market = load(".claude-plugin/marketplace.json")
        entry = next(p for p in market["plugins"] if p["name"] == plugin["name"])
        versions = {
            "plugin.json": plugin["version"],
            "marketplace metadata": market["metadata"]["version"],
            "marketplace entry": entry["version"],
            "package.json": load("package.json")["version"],
            ".skills.json": load(".skills.json")["version"],
            ".codex-plugin": load(".codex-plugin/plugin.json")["version"],
            "root plugin.json": load("plugin.json")["version"],
        }
        skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        versions["SKILL.md"] = re.search(r'version:\s*"([^"]+)"', skill).group(1)
        self.assertEqual(len(set(versions.values())), 1, versions)

    def test_marketplace_points_at_repo_root(self):
        market = load(".claude-plugin/marketplace.json")
        self.assertEqual(market["plugins"][0]["source"], "./")
        self.assertIn("name", market["owner"])

    def test_agents_have_required_frontmatter(self):
        agents = sorted((ROOT / "agents").glob("*.md"))
        self.assertGreaterEqual(len(agents), 4)
        for agent in agents:
            fields = frontmatter(agent)
            self.assertEqual(fields.get("name"), agent.stem, agent.name)
            self.assertGreater(len(fields.get("description", "")), 80, agent.name)
            self.assertIn("tools", fields, agent.name)

    def test_commands_reference_existing_agents(self):
        agent_names = {path.stem for path in (ROOT / "agents").glob("*.md")}
        for command in (ROOT / "commands").glob("*.md"):
            self.assertIn("description", frontmatter(command), command.name)
            for name in re.findall(r"`(meme-[a-z-]+)` subagent", command.read_text(encoding="utf-8")):
                self.assertIn(name, agent_names, f"{command.name} references {name}")

    def test_hook_commands_point_at_real_files(self):
        hooks = load("hooks/hooks.json")["hooks"]
        for groups in hooks.values():
            for group in groups:
                for hook in group["hooks"]:
                    match = re.search(r"\$\{CLAUDE_PLUGIN_ROOT\}/([^\"]+)", hook["command"])
                    self.assertIsNotNone(match, hook["command"])
                    self.assertTrue((ROOT / match.group(1)).is_file(), match.group(1))


class ValidateHookTests(unittest.TestCase):
    def event(self, file_path):
        return {"cwd": str(ROOT), "tool_name": "Write", "tool_input": {"file_path": file_path}}

    def test_blocks_invalid_batch(self):
        code, out = run_hook("validate_meme_batch.py", self.event("evals/fixtures/invalid.json"))
        self.assertEqual(code, 0)
        payload = json.loads(out)
        self.assertEqual(payload["decision"], "block")
        self.assertIn("promotional element", payload["reason"])

    def test_confirms_valid_batch(self):
        code, out = run_hook("validate_meme_batch.py", self.event(str(ROOT / "evals/fixtures/valid.json")))
        self.assertEqual(code, 0)
        payload = json.loads(out)
        self.assertNotIn("decision", payload)
        self.assertIn("passed structural checks", payload["hookSpecificOutput"]["additionalContext"])

    def test_ignores_unrelated_json(self):
        self.assertEqual(run_hook("validate_meme_batch.py", self.event("package.json")), (0, ""))

    def test_ignores_non_json_and_missing_files(self):
        self.assertEqual(run_hook("validate_meme_batch.py", self.event("README.md")), (0, ""))
        self.assertEqual(run_hook("validate_meme_batch.py", self.event("nope/missing.json")), (0, ""))

    def test_fails_open_on_garbage_input(self):
        result = subprocess.run(
            [sys.executable, str(HANDLERS / "validate_meme_batch.py")],
            input="not json", capture_output=True, text=True, timeout=30,
        )
        self.assertEqual((result.returncode, result.stdout), (0, ""))


class TasteProfileHookTests(unittest.TestCase):
    def test_silent_without_profile(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(run_hook("load_taste_profile.py", {"cwd": tmp}), (0, ""))

    def test_silent_with_empty_default_profile(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / ".claude" / "meme-marketing"
            target.mkdir(parents=True)
            (target / "taste-profile.json").write_text(
                (ROOT / "assets/taste-profile.json").read_text(encoding="utf-8"), encoding="utf-8"
            )
            self.assertEqual(run_hook("load_taste_profile.py", {"cwd": tmp}), (0, ""))

    def test_injects_confirmed_and_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / ".claude" / "meme-marketing"
            target.mkdir(parents=True)
            profile = load("assets/taste-profile.json")
            profile["confirmed"] = [{"id": "m1", "note": "deadpan for devs"}]
            profile["rejected"] = [{"id": "m2", "note": "drake feels stale"}]
            (target / "taste-profile.json").write_text(json.dumps(profile), encoding="utf-8")
            code, out = run_hook("load_taste_profile.py", {"cwd": tmp})
            self.assertEqual(code, 0)
            context = json.loads(out)["hookSpecificOutput"]["additionalContext"]
            self.assertIn("m1 (deadpan for devs)", context)
            self.assertIn("drake feels stale", context)


class TuneCommandTests(unittest.TestCase):
    def test_tune_writes_project_profile(self):
        bun = next((p for p in os.environ.get("PATH", "").split(os.pathsep) if (Path(p) / "bun").exists()), None)
        if bun is None:
            self.skipTest("bun not installed")
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(
                [str(Path(bun) / "bun"), str(ROOT / "bin/cli.js"), "tune", "--accept", "m1", "--note", "deadpan"],
                cwd=tmp, check=True, capture_output=True, timeout=60,
            )
            profile = json.loads((Path(tmp) / ".claude/meme-marketing/taste-profile.json").read_text(encoding="utf-8"))
            self.assertEqual(profile["confirmed"][0]["id"], "m1")
            code, out = run_hook("load_taste_profile.py", {"cwd": tmp})
            self.assertIn("m1 (deadpan)", out)


if __name__ == "__main__":
    unittest.main(verbosity=2)
