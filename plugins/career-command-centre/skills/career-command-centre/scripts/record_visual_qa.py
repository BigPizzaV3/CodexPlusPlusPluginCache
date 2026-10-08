#!/usr/bin/env python3
"""Record a human/agent visual review and reconcile an application-pack manifest."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", required=True)
    parser.add_argument("--status", choices=["passed", "failed"], required=True)
    parser.add_argument("--reviewer", required=True)
    parser.add_argument("--note", required=True)
    parser.add_argument("--manifest")
    args = parser.parse_args()
    report_path = Path(args.report).resolve()
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if args.status == "passed" and not report.get("layout_pass"):
        raise SystemExit("Cannot record visual pass when automated layout checks failed.")
    images = [
        (Path(str(page.get("image"))) if Path(str(page.get("image"))).is_absolute() else report_path.parent / str(page.get("image")))
        for page in report.get("pages", [])
        if page.get("image")
    ]
    missing_images = [str(path) for path in images if not path.exists()]
    if args.status == "passed" and (not images or missing_images):
        raise SystemExit("Cannot record visual pass without all rendered page images.")
    report["visual_inspection"] = args.status
    report["visual_reviewer"] = args.reviewer
    report["visual_review_note"] = args.note
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    manifest_path = Path(args.manifest).resolve() if args.manifest else report_path.parent.parent / "application_pack_manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        render_reports = set(manifest.get("render_reports", []))
        relative_report = str(report_path.relative_to(manifest_path.parent))
        render_reports.add(relative_report)
        manifest["render_reports"] = sorted(render_reports)
        def resolved_file(item: dict[str, str]) -> Path:
            raw = Path(str(item.get("path", "")))
            return raw if raw.is_absolute() else manifest_path.parent / raw

        files = [item for item in manifest.get("files", []) if resolved_file(item).resolve() != report_path]
        files.append({"name": report_path.name, "path": relative_report, "sha256": _sha256(report_path)})
        manifest["files"] = sorted(files, key=lambda item: item["path"])
        required_docx = [manifest.get("cv")]
        if not manifest.get("cv_only"):
            required_docx.append(manifest.get("cover_letter"))
        required_docx = [name for name in required_docx if name]
        passed_sources: set[str] = set()
        all_reports_pass = True
        for relative in manifest["render_reports"]:
            candidate_path = manifest_path.parent / relative
            if not candidate_path.exists():
                all_reports_pass = False
                continue
            candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
            source_name = Path(str(candidate.get("source_docx", ""))).name
            if candidate.get("layout_pass") and candidate.get("visual_inspection") == "passed":
                passed_sources.add(source_name)
            else:
                all_reports_pass = False
        if all_reports_pass and set(required_docx).issubset(passed_sources):
            manifest["visual_qa"] = "passed"
            if manifest.get("status") == "BUILT_STRUCTURAL_PASS":
                manifest["status"] = "READY"
        elif args.status == "failed":
            manifest["visual_qa"] = "failed"
            manifest["status"] = "FAILED_VISUAL_QA"
        else:
            manifest["visual_qa"] = "pending"
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0 if args.status == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
