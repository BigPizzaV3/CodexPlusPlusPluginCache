#!/usr/bin/env python3
"""Fail-closed run validator for Career Centre v4."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any

from contracts import load_json, validate_run_result


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _read_report(path: Path) -> tuple[bool, list[str]]:
    try:
        report = load_json(path)
    except Exception as exc:
        return False, [f"could not read validation report {path.name}: {exc}"]
    reasons: list[str] = []
    if report.get("passed") is False:
        reasons.append(f"{path.name} reports passed=false")
    if report.get("errors"):
        reasons.append(f"{path.name} contains validation errors")
    if "layout_pass" in report and report.get("layout_pass") is not True:
        reasons.append(f"{path.name} reports layout_pass=false")
    if "visual_inspection" in report and report.get("visual_inspection") != "passed":
        reasons.append(f"{path.name} lacks passed visual inspection")
    return not reasons, reasons


def _validate_pack(manifest_path: Path) -> list[str]:
    errors: list[str] = []
    try:
        manifest = load_json(manifest_path)
    except Exception as exc:
        return [f"{manifest_path}: could not read application manifest: {exc}"]
    pack_dir = manifest_path.parent
    if manifest.get("status") != "READY":
        errors.append(f"{manifest_path}: application pack status is not READY")
    if manifest.get("visual_qa") != "passed":
        errors.append(f"{manifest_path}: visual QA is not passed")
    cv_name = manifest.get("cv")
    cover_name = manifest.get("cover_letter")
    if not cv_name or not (pack_dir / cv_name).exists():
        errors.append(f"{manifest_path}: CV is missing")
    if not manifest.get("cv_only") and (not cover_name or not (pack_dir / cover_name).exists()):
        errors.append(f"{manifest_path}: paired cover letter is missing")
    for item in manifest.get("files", []):
        raw_path = Path(str(item.get("path", "")))
        path = raw_path if raw_path.is_absolute() else pack_dir / raw_path
        if not path.exists():
            errors.append(f"{manifest_path}: listed file is missing: {path}")
            continue
        if item.get("sha256") and _sha256(path) != item["sha256"]:
            errors.append(f"{manifest_path}: checksum mismatch: {path.name}")
    for report_name in manifest.get("structural_reports", []):
        report_path = pack_dir / report_name
        if not report_path.exists():
            errors.append(f"{manifest_path}: structural report is missing: {report_name}")
            continue
        passed, reasons = _read_report(report_path)
        if not passed:
            errors.extend(f"{manifest_path}: {reason}" for reason in reasons)
    render_reports = manifest.get("render_reports", [])
    if not render_reports:
        errors.append(f"{manifest_path}: no render reports are recorded")
    passed_sources: set[str] = set()
    for report_name in render_reports:
        report_path = pack_dir / report_name
        if not report_path.exists():
            errors.append(f"{manifest_path}: render report is missing: {report_name}")
            continue
        passed, reasons = _read_report(report_path)
        if not passed:
            errors.extend(f"{manifest_path}: {reason}" for reason in reasons)
        else:
            report = load_json(report_path)
            passed_sources.add(Path(str(report.get("source_docx", ""))).name)
    required_sources = {str(cv_name)}
    if not manifest.get("cv_only"):
        required_sources.add(str(cover_name))
    missing_sources = sorted(required_sources - passed_sources)
    if missing_sources:
        errors.append(f"{manifest_path}: no passed render review for {', '.join(missing_sources)}")
    return errors


def validate_run(run_dir: Path, result_path: Path) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    try:
        result = load_json(result_path)
    except Exception as exc:
        return {"passed": False, "errors": [f"Run result could not be read: {exc}"], "warnings": []}
    errors.extend(validate_run_result(result))
    files = [path for path in run_dir.rglob("*") if path.is_file()]
    if any(path.suffix.casefold() in {".html", ".htm"} for path in files):
        errors.append("HTML output detected; v4 does not generate a dashboard by default.")
    if any(path.suffix.casefold() in {".pyc", ".pyo"} or "__pycache__" in path.parts for path in files):
        errors.append("Compiled Python cache artifacts detected in the run.")
    for relative in result.get("files", []):
        path = run_dir / str(relative)
        if not path.exists():
            errors.append(f"Run result lists a missing file: {relative}")
    for relative in result.get("validation_reports", []):
        path = run_dir / str(relative)
        if not path.exists():
            errors.append(f"Run result lists a missing validation report: {relative}")
            continue
        passed, reasons = _read_report(path)
        if not passed:
            errors.extend(reasons)

    manifests = sorted(run_dir.rglob("application_pack_manifest.json"))
    pack_by_role: dict[str, Path] = {}
    for manifest_path in manifests:
        try:
            role_id = str(load_json(manifest_path).get("role_id", ""))
        except Exception:
            role_id = ""
        if role_id in pack_by_role:
            errors.append(f"Duplicate application pack manifest for role_id {role_id}")
        pack_by_role[role_id] = manifest_path
        errors.extend(_validate_pack(manifest_path))
    requested = result.get("request", {}).get("application_packs_requested", [])
    for role_id in requested:
        if str(role_id) not in pack_by_role:
            errors.append(f"Requested application pack is missing for role_id {role_id}")
    unexpected = sorted(set(pack_by_role) - {str(value) for value in requested})
    if unexpected:
        errors.append("Application packs were built without being requested for role_id(s): " + ", ".join(unexpected))
    maximum = result.get("limits", {}).get("max_application_packs")
    if isinstance(maximum, int) and len(manifests) > maximum:
        errors.append("Generated application-pack count exceeds max_application_packs")
    status = result.get("status")
    if status == "SUCCESS" and not manifests:
        errors.append("SUCCESS requires at least one READY application pack")
    if status == "SUCCESS_NO_PACK" and manifests:
        errors.append("SUCCESS_NO_PACK cannot contain application packs")
    report = {
        "run_dir": str(run_dir),
        "result_file": str(result_path),
        "status": status,
        "role_count": len(result.get("roles", [])),
        "application_pack_count": len(manifests),
        "errors": errors,
        "warnings": warnings,
        "passed": not errors,
    }
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-dir", required=True)
    parser.add_argument("--result", required=True)
    parser.add_argument("--json-out")
    args = parser.parse_args()
    report = validate_run(Path(args.run_dir).resolve(), Path(args.result).resolve())
    payload = json.dumps(report, indent=2)
    if args.json_out:
        Path(args.json_out).write_text(payload, encoding="utf-8")
    print(payload)
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
