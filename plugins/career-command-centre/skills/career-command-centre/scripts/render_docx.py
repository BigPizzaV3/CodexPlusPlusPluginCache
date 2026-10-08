#!/usr/bin/env python3
"""Render a DOCX, measure page density and produce PNGs for human visual QA."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _tool(*names: str) -> str | None:
    for name in names:
        found = shutil.which(name)
        if found:
            return found
    return None


def _page_count(pdf: Path, pdfinfo: str) -> int:
    process = subprocess.run([pdfinfo, str(pdf)], check=True, capture_output=True, text=True, timeout=30)
    match = re.search(r"^Pages:\s+(\d+)\s*$", process.stdout, re.MULTILINE)
    if not match:
        raise RuntimeError("pdfinfo did not report a page count")
    return int(match.group(1))


def _density(pdf: Path, pdftotext: str) -> list[dict[str, float | int | None]]:
    with tempfile.NamedTemporaryFile(suffix=".html", delete=False) as handle:
        bbox_path = Path(handle.name)
    try:
        subprocess.run([pdftotext, "-bbox-layout", str(pdf), str(bbox_path)], check=True, capture_output=True, text=True, timeout=60)
        return _parse_density(bbox_path)
    finally:
        bbox_path.unlink(missing_ok=True)


def _parse_density(bbox_path: Path) -> list[dict[str, float | int | None]]:
    """Parse pdftotext bbox output using logical page numbers, not XML node indexes."""
    root = ET.parse(bbox_path).getroot()
    pages: list[dict[str, float | int | None]] = []
    for page_number, page in enumerate(
        (element for element in root.iter() if element.tag.endswith("page")),
        start=1,
    ):
            height = float(page.attrib.get("height", "0") or 0)
            top = 0.07 * height
            bottom = 0.92 * height
            boxes: list[tuple[float, float]] = []
            for word in page.iter():
                if not word.tag.endswith("word") or not (word.text or "").strip():
                    continue
                y_min = float(word.attrib.get("yMin", "0") or 0)
                y_max = float(word.attrib.get("yMax", "0") or 0)
                if y_max >= top and y_min <= bottom:
                    boxes.append((max(y_min, top), min(y_max, bottom)))
            first = min((box[0] for box in boxes), default=None)
            last = max((box[1] for box in boxes), default=None)
            fill = 0.0 if last is None or bottom <= top else max(0.0, min(1.0, (last - top) / (bottom - top)))
            pages.append(
                {
                    "page": page_number,
                    "body_fill_ratio": round(fill, 3),
                    "first_text_y": round(first, 1) if first is not None else None,
                    "last_text_y": round(last, 1) if last is not None else None,
                }
            )
    return pages


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("docx")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--expected-pages", type=int, required=True)
    parser.add_argument("--min-first-page-fill", type=float)
    parser.add_argument("--min-last-page-fill", type=float)
    parser.add_argument("--keep-pdf", action="store_true")
    args = parser.parse_args()

    docx = Path(args.docx).resolve()
    output = Path(args.output_dir).resolve()
    output.mkdir(parents=True, exist_ok=True)
    report_path = output / f"{docx.stem}_Render_Validation.json"
    if not docx.is_file():
        result = {
            "status": "failed",
            "source_docx": docx.name,
            "source_sha256": None,
            "layout_pass": False,
            "visual_inspection": "pending",
            "reasons": ["Source DOCX is missing."],
            "pages": [],
        }
        report_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(json.dumps(result, indent=2))
        return 2
    office = _tool("libreoffice", "soffice")
    pdftoppm = _tool("pdftoppm")
    pdftotext = _tool("pdftotext")
    pdfinfo = _tool("pdfinfo")
    missing = [name for name, value in (("LibreOffice/soffice", office), ("pdftoppm", pdftoppm), ("pdftotext", pdftotext), ("pdfinfo", pdfinfo)) if not value]
    if missing:
        result = {
            "status": "pending",
            "source_docx": docx.name,
            "source_sha256": _sha256(docx) if docx.exists() else None,
            "layout_pass": False,
            "visual_inspection": "pending",
            "reasons": ["Missing rendering dependency: " + ", ".join(missing)],
            "pages": [],
        }
        report_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(json.dumps(result, indent=2))
        return 2

    with tempfile.TemporaryDirectory() as temporary:
        environment = os.environ.copy()
        environment["HOME"] = temporary
        environment.setdefault("TMPDIR", "/private/tmp" if Path("/private/tmp").exists() else temporary)
        profile = Path(temporary) / "lo-profile"
        process = subprocess.run(
            [
                str(office),
                f"-env:UserInstallation=file://{profile}",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                str(output),
                str(docx),
            ],
            env=environment,
            capture_output=True,
            text=True,
            timeout=120,
        )
    pdf = output / f"{docx.stem}.pdf"
    if process.returncode != 0 or not pdf.exists():
        result = {
            "status": "failed",
            "source_docx": docx.name,
            "source_sha256": _sha256(docx),
            "layout_pass": False,
            "visual_inspection": "pending",
            "reasons": ["LibreOffice conversion failed."],
            "stdout": process.stdout,
            "stderr": process.stderr,
            "pages": [],
        }
        report_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(json.dumps(result, indent=2))
        return 1

    try:
        count = _page_count(pdf, str(pdfinfo))
        pages = _density(pdf, str(pdftotext))
        subprocess.run(
            [str(pdftoppm), "-png", "-r", "144", str(pdf), str(output / docx.stem)],
            check=True,
            capture_output=True,
            text=True,
            timeout=120,
        )
        images = sorted(output.glob(f"{docx.stem}-*.png"))
        for index, page in enumerate(pages):
            page["image"] = images[index].name if index < len(images) else None
    except Exception as exc:
        result = {
            "status": "failed",
            "source_docx": docx.name,
            "source_sha256": _sha256(docx),
            "layout_pass": False,
            "visual_inspection": "pending",
            "reasons": [f"PDF analysis failed: {exc}"],
            "pages": [],
        }
        report_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(json.dumps(result, indent=2))
        return 1

    minimum_last_fill = args.min_last_page_fill
    if minimum_last_fill is None:
        minimum_last_fill = 0.80 if args.expected_pages == 2 else 0.42
    minimum_first_fill = args.min_first_page_fill
    if minimum_first_fill is None:
        minimum_first_fill = 0.65 if args.expected_pages == 2 else None
    first_fill = float(pages[0]["body_fill_ratio"]) if pages else 0.0
    last_fill = float(pages[-1]["body_fill_ratio"]) if pages else 0.0
    reasons: list[str] = []
    warnings: list[str] = []
    if count != args.expected_pages:
        reasons.append(f"Expected {args.expected_pages} page(s); got {count}.")
    if minimum_first_fill is not None and first_fill < minimum_first_fill:
        reasons.append(f"First-page fill {first_fill:.0%} is below {minimum_first_fill:.0%}.")
    if last_fill < minimum_last_fill:
        reasons.append(f"Last-page fill {last_fill:.0%} is below {minimum_last_fill:.0%}.")
    if count >= 2 and first_fill > 0.97:
        warnings.append("Page 1 reaches beyond 97% of the usable body area; inspect for crowding.")
    result = {
        "status": "rendered",
        "source_docx": docx.name,
        "source_sha256": _sha256(docx),
        "pdf": pdf.name if args.keep_pdf else None,
        "page_count": count,
        "expected_pages": args.expected_pages,
        "first_page_fill_ratio": first_fill,
        "last_page_fill_ratio": last_fill,
        "minimum_first_page_fill": minimum_first_fill,
        "minimum_last_page_fill": minimum_last_fill,
        "layout_pass": not reasons,
        "visual_inspection": "pending",
        "visual_review_note": None,
        "reasons": reasons,
        "warnings": warnings,
        "pages": pages,
    }
    if not args.keep_pdf:
        pdf.unlink(missing_ok=True)
    report_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps(result, indent=2))
    return 0 if result["layout_pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
