#!/usr/bin/env python3
"""Dependency-light regression tests for room contracts, masks, and lessons."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"


class RoomSystemTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="room-skill-test-"))

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_script(self, name, *args, success=True):
        result = subprocess.run([sys.executable, str(SCRIPTS / name), *map(str, args)], text=True, capture_output=True)
        if success and result.returncode:
            self.fail(result.stdout + result.stderr)
        if not success and result.returncode == 0:
            self.fail("expected failure")
        return result

    def mask(self, name, array):
        path = self.tmp / name
        Image.fromarray(array.astype(np.uint8), "L").save(path)
        return path

    def trace(self, mask, kind="door", success=True, extra=()):
        out = self.tmp / f"{mask.stem}.json"
        preview = self.tmp / f"{mask.stem}.preview.png"
        result = self.run_script("trace_opening_mask.py", mask, "--id", mask.stem, "--kind", kind, "--width-m", "1.2", "--height-m", "2.4", "--out", out, "--preview", preview, *extra, success=success)
        return result, out, preview

    def test_rectangular_and_arched_doors(self):
        rect = np.zeros((64, 64), np.uint8); rect[12:, 20:44] = 255
        _, out, preview = self.trace(self.mask("rect.png", rect))
        self.assertTrue(out.is_file() and preview.is_file())
        arch = np.zeros((64, 64), np.uint8); arch[26:, 18:46] = 255
        yy, xx = np.ogrid[:64, :64]; arch[((xx - 32) ** 2 + (yy - 26) ** 2 <= 14 ** 2) & (yy <= 26)] = 255
        self.trace(self.mask("arch.png", arch))

    def test_window_and_alcove(self):
        inner = np.zeros((64, 64), np.uint8); inner[16:48, 18:46] = 255
        self.trace(self.mask("window.png", inner), "window", extra=("--sill-m", "0.8"))
        self.trace(self.mask("alcove.png", inner), "deep_alcove", extra=("--depth-m", "0.5"))

    def test_holes_islands_grayscale_and_invalid_door_fail(self):
        island = np.zeros((64, 64), np.uint8); island[20:32, 12:24] = 255; island[20:32, 40:52] = 255
        self.trace(self.mask("islands.png", island), "window", success=False, extra=("--sill-m", "1"))
        hole = np.zeros((64, 64), np.uint8); hole[12:52, 12:52] = 255; hole[24:40, 24:40] = 0
        self.trace(self.mask("hole.png", hole), "window", success=False, extra=("--sill-m", "1"))
        gray = np.zeros((64, 64), np.uint8); gray[16:48, 16:48] = 240
        self.trace(self.mask("gray.png", gray), "window", success=False, extra=("--sill-m", "1"))
        closed = np.zeros((64, 64), np.uint8); closed[16:48, 16:48] = 255
        self.trace(self.mask("door.png", closed), "door", success=False)

    def test_package_starts_blocked(self):
        package = self.tmp / "room"
        self.run_script("create_room.py", "test-room", "--family", "display-gallery", "--output", package)
        brief = json.loads((package / "room-brief.json").read_text())
        self.assertEqual(brief["symmetry"], {"mode": "none", "order": 1, "appliesTo": [], "exceptions": []})
        result = self.run_script("validate_room.py", package, "--gate", "function", success=False)
        self.assertIn("explicit approval", result.stdout)

    def test_declared_symmetry_requires_complete_scope(self):
        package = self.tmp / "room"
        self.run_script("create_room.py", "test-room", "--family", "display-gallery", "--output", package)
        brief_path = package / "room-brief.json"
        brief = json.loads(brief_path.read_text())
        brief["symmetry"] = {"mode": "radial", "order": 8, "appliesTo": ["architecture"], "exceptions": []}
        brief_path.write_text(json.dumps(brief), encoding="utf-8")
        result = self.run_script("validate_room.py", package, "--gate", "function", success=False)
        self.assertIn("declared symmetry must apply", result.stdout)

    def test_plan_contract_defaults_to_engineering_layers(self):
        package = self.tmp / "room"
        self.run_script("create_room.py", "test-room", "--family", "display-gallery", "--output", package)
        plan = json.loads((package / "plan-metadata.json").read_text())
        self.assertEqual(plan["style"], "monochrome-engineering")
        self.assertEqual(plan["projectionSource"], "actual-meshes")
        self.assertEqual(plan["layers"], ["lower-room", "reflected-ceiling"])
        self.assertFalse(plan["aiInspirationIncluded"])
        props = json.loads((package / "props.json").read_text())
        self.assertEqual(props["generation"]["apiModel"], "meshy-5")
        layout = json.loads((package / "room-layout.json").read_text())
        self.assertEqual(layout["units"], "meters")
        self.assertTrue((package / "images").is_dir())
        self.assertTrue((package / "meshes").is_dir())

    def test_meshy_dry_run_is_pinned_and_needs_no_key(self):
        package = self.tmp / "room"
        self.run_script("create_room.py", "test-room", "--family", "display-gallery", "--output", package)
        image_path = package / "images" / "column.png"
        Image.new("RGB", (8, 8), (200, 180, 140)).save(image_path)
        reviews_path = package / "milestone-reviews.json"
        reviews = json.loads(reviews_path.read_text())
        reviews["function"]["status"] = "approved"
        reviews_path.write_text(json.dumps(reviews), encoding="utf-8")
        brief_path = package / "room-brief.json"
        brief = json.loads(brief_path.read_text())
        brief["creditBudget"]["maximumCredits"] = 30
        brief_path.write_text(json.dumps(brief), encoding="utf-8")
        props_path = package / "props.json"
        props = json.loads(props_path.read_text())
        props["generation"]["pricingVerifiedAt"] = datetime.now(timezone.utc).isoformat()
        props["generation"]["hardCreditCeiling"] = 30
        props["assets"] = [{
            "id": "column", "function": "support rhythm", "class": "reusable",
            "description": "stone column", "dimensionsMeters": [0.5, 0.5, 3],
            "attachmentFace": "floor", "semanticFront": "positive-y", "intendedInstances": 1,
            "image": {"prompt": "isolated stone column", "generator": "test", "model": "", "source": "images/column.png", "approved": True, "approvedBy": "reviewer"},
            "targetPolycount": 10000, "texturePrompt": "warm stone", "rejectionCriteria": ["missing back surface"],
            "attempts": [], "acceptedMesh": None,
        }]
        props_path.write_text(json.dumps(props), encoding="utf-8")
        result = self.run_script("meshy_image_to_3d.py", "submit", package, "--asset", "column", "--dry-run")
        payload = json.loads(result.stdout)
        self.assertEqual(payload["ai_model"], "meshy-5")
        self.assertEqual(payload["texture_resolution"], "2k")
        self.assertTrue(payload["enable_pbr"])
        self.assertNotIn("image_url", payload)

    def test_primary_arrival_requires_opening_or_exception(self):
        package = self.tmp / "room"
        self.run_script("create_room.py", "test-room", "--family", "custom", "--output", package)
        result = self.run_script("validate_room.py", package, "--gate", "function", success=False)
        self.assertIn("primary arrival opening or functional exception", result.stdout)

    def test_lessons_require_pending_decision(self):
        ledger = self.tmp / "lessons.json"
        ledger.write_text(json.dumps({"schema": "game-room.room-lessons.v1", "lessons": []}), encoding="utf-8")
        self.run_script("manage_lessons.py", "--ledger", ledger, "propose", "--id", "test", "--source-room", "room", "--observation", "obs", "--rule", "rule", "--scope", "all", "--pipeline-stages", "form")
        data = json.loads(ledger.read_text()); self.assertEqual(data["lessons"][0]["status"], "pending")
        self.run_script("manage_lessons.py", "--ledger", ledger, "decide", "--id", "test", "--decision", "approved", "--approved-by", "user")
        data = json.loads(ledger.read_text()); self.assertEqual(data["lessons"][0]["status"], "approved")
        self.run_script("manage_lessons.py", "--ledger", ledger, "decide", "--id", "test", "--decision", "rejected", "--approved-by", "user", success=False)


if __name__ == "__main__":
    unittest.main()
