#!/usr/bin/env python3
"""Regression tests for meme brief structure, failure cases and eval fixtures."""
import json
import sys
import unittest
from copy import deepcopy
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
from validate import check


class MemeValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.good = json.loads((ROOT / "evals/fixtures/valid.json").read_text(encoding="utf-8"))
        cls.bad = json.loads((ROOT / "evals/fixtures/invalid.json").read_text(encoding="utf-8"))

    def test_valid_structured_brief(self):
        self.assertEqual(check(self.good), [])

    def test_invalid_examples_exercise_real_failures(self):
        failures = check(self.bad)
        self.assertTrue(any("promotional element" in f for f in failures))
        self.assertTrue(any("repeated copy" in f for f in failures))
        self.assertTrue(any("fallback" in f for f in failures))
        self.assertTrue(any("freshness" in f for f in failures))

    def test_text_free_form_is_permitted(self):
        payload = deepcopy(self.good)
        payload["memes"][0]["on_image_text"] = ""
        payload["memes"][0]["image_text_relation"] = "text_free"
        self.assertEqual(check(payload), [])

    def test_does_not_require_numeric_receipt(self):
        payload = deepcopy(self.good)
        payload["memes"][0]["evidence"]["receipt"] = "the rejection email"
        self.assertEqual(check(payload), [])

    def test_duplicate_moments_are_flagged(self):
        payload = deepcopy(self.good)
        payload["memes"].append(deepcopy(payload["memes"][0]))
        self.assertTrue(any("duplicate moment" in f for f in check(payload)))

    def test_malformed_fields_report_errors_instead_of_crashing(self):
        payload = deepcopy(self.good)
        payload["memes"][0]["moment"] = None
        self.assertTrue(any("moment" in f for f in check(payload)))

    def test_future_trend_verification_date_is_rejected(self):
        payload = deepcopy(self.good)
        payload["memes"][0]["visual"]["freshness"] = {"status": "verified_recent", "verified_at": "9999-12-31"}
        self.assertTrue(any("cannot be in the future" in f for f in check(payload)))

    def test_eval_corpus_coverage(self):
        corpus = json.loads((ROOT / "evals/evals.json").read_text(encoding="utf-8"))
        self.assertEqual(corpus["skill_name"], "meme-marketing")
        cases = corpus["evals"]
        self.assertGreaterEqual(len(cases), 8)
        self.assertEqual(len({case["id"] for case in cases}), len(cases))
        for case in cases:
            self.assertTrue(case["prompt"].strip())
            self.assertTrue(case["assertions"])

if __name__ == "__main__":
    unittest.main()
