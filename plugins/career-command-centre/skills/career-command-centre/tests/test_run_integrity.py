from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT_ROOT = Path(__file__).resolve().parents[1] / "scripts"
FIXTURE_ROOT = Path(__file__).resolve().parent / "fixtures"
sys.path.insert(0, str(SCRIPT_ROOT))
sys.path.insert(0, str(FIXTURE_ROOT))

from factory import run_result  # noqa: E402
from validate_run import validate_run  # noqa: E402


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class RunIntegrityTests(unittest.TestCase):
    def _ready_run(self, root: Path) -> tuple[Path, Path, dict]:
        pack = root / "Application_Packs" / "ROLE-SYNTH-001"
        pack.mkdir(parents=True)
        cv = pack / "Candidate_CV.docx"
        cover = pack / "Candidate_Cover_Letter.docx"
        cv.write_bytes(b"synthetic cv fixture")
        cover.write_bytes(b"synthetic cover fixture")
        structural_names = ["CV_Structural_Validation.json", "Cover_Letter_Structural_Validation.json"]
        for name in structural_names:
            (pack / name).write_text(json.dumps({"passed": True, "errors": []}), encoding="utf-8")
        render_names: list[str] = []
        for folder, source in (("render/cv", cv.name), ("render/cover", cover.name)):
            report_path = pack / folder / f"{Path(source).stem}_Render_Validation.json"
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(
                json.dumps(
                    {
                        "source_docx": source,
                        "layout_pass": True,
                        "visual_inspection": "passed",
                        "errors": [],
                    }
                ),
                encoding="utf-8",
            )
            render_names.append(str(report_path.relative_to(pack)))
        tracked = [cv, cover, *(pack / name for name in structural_names), *(pack / name for name in render_names)]
        manifest = {
            "schema_version": "4.0",
            "role_id": "ROLE-SYNTH-001",
            "cv_only": False,
            "status": "READY",
            "visual_qa": "passed",
            "files": [
                {"name": path.name, "path": str(path.relative_to(pack)), "sha256": _sha256(path)}
                for path in tracked
            ],
            "cv": cv.name,
            "cover_letter": cover.name,
            "structural_reports": structural_names,
            "render_reports": render_names,
        }
        manifest_path = pack / "application_pack_manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        result = run_result()
        result["files"] = [str(manifest_path.relative_to(root)), str(cv.relative_to(root)), str(cover.relative_to(root))]
        result["validation_reports"] = [
            str((pack / name).relative_to(root)) for name in structural_names + render_names
        ]
        result_path = root / "Run_Result.json"
        result_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        return result_path, manifest_path, manifest

    def test_ready_paired_pack_passes(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result_path, _, _ = self._ready_run(root)
            report = validate_run(root, result_path)
        self.assertTrue(report["passed"], report)

    def test_success_is_rejected_when_cover_letter_is_missing(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result_path, _, _ = self._ready_run(root)
            (root / "Application_Packs/ROLE-SYNTH-001/Candidate_Cover_Letter.docx").unlink()
            report = validate_run(root, result_path)
        self.assertFalse(report["passed"])
        self.assertTrue(any("cover letter is missing" in error for error in report["errors"]), report)

    def test_success_is_rejected_after_checksum_tampering(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result_path, _, _ = self._ready_run(root)
            (root / "Application_Packs/ROLE-SYNTH-001/Candidate_CV.docx").write_bytes(b"tampered")
            report = validate_run(root, result_path)
        self.assertFalse(report["passed"])
        self.assertTrue(any("checksum mismatch" in error for error in report["errors"]), report)

    def test_success_is_rejected_when_visual_review_is_pending(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result_path, manifest_path, manifest = self._ready_run(root)
            manifest["visual_qa"] = "pending"
            manifest["status"] = "BUILT_STRUCTURAL_PASS"
            manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
            report = validate_run(root, result_path)
        self.assertFalse(report["passed"])
        self.assertTrue(any("visual QA is not passed" in error for error in report["errors"]), report)

    def test_html_output_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            result_path, _, _ = self._ready_run(root)
            (root / "dashboard.html").write_text("<html></html>", encoding="utf-8")
            report = validate_run(root, result_path)
        self.assertFalse(report["passed"])
        self.assertTrue(any("HTML output detected" in error for error in report["errors"]), report)


if __name__ == "__main__":
    unittest.main()
