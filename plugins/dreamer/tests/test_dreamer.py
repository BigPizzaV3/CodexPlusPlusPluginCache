import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import dreamer


def receipt(sha="a" * 64):
    return {field: (sha if field == "destination_sha256" else field) for field in dreamer.RECEIPT_FIELDS}


class DreamerTests(unittest.TestCase):
    def test_missing_identity_is_unproven(self):
        value = receipt()
        value["owner_task_id"] = ""
        value["parent_task_id"] = ""
        self.assertEqual(dreamer.validate_receipt(value, current_sha256="a" * 64)["verdict"], "UNPROVEN")

    def test_invalid_previous_is_unproven_and_does_not_crash(self):
        result = dreamer.validate_receipt(receipt(), current_sha256="a" * 64, previous=["bad"])
        self.assertEqual(result["verdict"], "UNPROVEN")
        self.assertIn("previous:invalid", result["missing_fields"])

    def test_empty_or_incomplete_previous_cannot_compare(self):
        value = receipt()
        for previous in ({}, {"destination_sha256": "bad"}, None):
            result = dreamer.validate_receipt(value, current_sha256="a" * 64, previous=previous)
            self.assertNotEqual(result["verdict"], "SAME")
        card = dreamer.build_resume_card(dict(value, destination_sha256="not-a-digest"), "NEW")
        self.assertEqual(card["evidence"][0]["sha256"], "")
        self.assertEqual(dreamer.build_resume_card([], "private")["receipt_verdict"], "UNPROVEN")

    def test_verdicts(self):
        value = receipt()
        self.assertEqual(dreamer.validate_receipt(value)["verdict"], "UNPROVEN")
        self.assertEqual(dreamer.validate_receipt(value, current_sha256="b" * 64)["verdict"], "STALE_POINTER")
        previous = dict(value)
        previous["destination_sha256"] = "b" * 64
        self.assertEqual(dreamer.validate_receipt(value, current_sha256="a" * 64, previous=previous)["verdict"], "NEW")
        self.assertEqual(dreamer.validate_receipt(value, current_sha256="a" * 64, previous=value)["verdict"], "SAME")
        conflict = dict(value, destination_artifact="other")
        self.assertEqual(dreamer.validate_receipt(value, current_sha256="a" * 64, previous=conflict)["verdict"], "CONFLICT")

    def test_redaction_and_bounded_text(self):
        secret = '"api_key":"PRIVATE\\"SUFFIX" Bearer abc.def https://u:p@example.test/x?token=QUERY'
        redacted = dreamer.redact_text(secret)
        self.assertNotIn("PRIVATE", redacted)
        self.assertNotIn("abc.def", redacted)
        self.assertNotIn("QUERY", redacted)
        self.assertNotIn("SUFFIX", redacted)
        self.assertLessEqual(len(dreamer.redact_text("x" * 10000)), dreamer.MAX_TEXT_BYTES)

    def test_cli_hashes_explicit_artifact_and_does_not_echo_secret(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            artifact = base / "artifact"
            artifact.write_bytes(b"artifact")
            value = receipt()
            value["destination_sha256"] = hashlib.sha256(b"artifact").hexdigest()
            value["provenance"] = '"token":"TOP_SECRET"'
            receipt_path = base / "receipt.json"
            receipt_path.write_text(json.dumps(value), encoding="utf-8")
            result = subprocess.run(
                [sys.executable, str(ROOT / "scripts" / "dreamer.py"), "--receipt", str(receipt_path), "--artifact", str(artifact)],
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(result.returncode, 0)
            self.assertNotIn("TOP_SECRET", result.stdout)
            self.assertEqual(json.loads(result.stdout)["receipt"]["verdict"], "NEW")

    def test_cli_invalid_json_is_sanitized(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", encoding="utf-8") as handle:
            handle.write('{"secret":"DO_NOT_ECHO"')
            handle.flush()
            result = subprocess.run(
                [sys.executable, str(ROOT / "scripts" / "dreamer.py"), "--receipt", handle.name],
                capture_output=True, text=True, check=False,
            )
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout), {"error": "invalid input"})
        self.assertNotIn("DO_NOT_ECHO", result.stdout + result.stderr)

    def test_cli_rejects_null_previous_and_typed_receipt_values(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            valid = base / "valid.json"
            valid.write_text(json.dumps(receipt()), encoding="utf-8")
            null_previous = base / "null.json"
            null_previous.write_text("null", encoding="utf-8")
            typed = base / "typed.json"
            typed.write_text(json.dumps(dict(receipt(), state=3)), encoding="utf-8")
            for previous in (null_previous, None):
                command = [sys.executable, str(ROOT / "scripts" / "dreamer.py"), "--receipt", str(valid)]
                if previous:
                    command += ["--previous", str(previous)]
                result = subprocess.run(command, capture_output=True, text=True, check=False)
                if previous:
                    self.assertNotEqual(result.returncode, 0)
                    self.assertEqual(json.loads(result.stdout), {"error": "invalid input"})
            result = subprocess.run(
                [sys.executable, str(ROOT / "scripts" / "dreamer.py"), "--receipt", str(typed)],
                capture_output=True, text=True, check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(json.loads(result.stdout), {"error": "invalid input"})


if __name__ == "__main__":
    unittest.main()
