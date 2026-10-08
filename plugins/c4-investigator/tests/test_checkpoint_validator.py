from __future__ import annotations

import importlib.util
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "skills/c4-fake-trading-app-investigator/scripts/validate_case_checkpoint.py"
SPEC = importlib.util.spec_from_file_location("checkpoint_validator", SCRIPT)
assert SPEC and SPEC.loader
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)


class CheckpointValidatorTests(unittest.TestCase):
    def load_fixture(self, name: str):
        path = ROOT / "tests/fixtures" / name
        return json.loads(path.read_text(encoding="utf-8"))

    def test_valid_checkpoint_passes(self):
        errors, warnings = VALIDATOR.validate(self.load_fixture("valid_checkpoint.json"))
        self.assertEqual(errors, [])
        self.assertEqual(warnings, [])

    def test_invalid_checkpoint_reports_structural_errors(self):
        errors, warnings = VALIDATOR.validate(self.load_fixture("invalid_checkpoint.json"))
        self.assertTrue(any("findings[0].id" in error for error in errors))
        self.assertTrue(any("must cite evidence_ids" in error for error in errors))
        self.assertIn("no limitations recorded", warnings)


if __name__ == "__main__":
    unittest.main()
