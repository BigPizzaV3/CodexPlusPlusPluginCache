#!/usr/bin/env python3
"""Privacy-preserving aggregate analysis for Antom Settlement Detail reports."""

from __future__ import annotations

import argparse
import json
import sys
import zipfile
from collections import Counter
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Dict, Iterable, List


SKILL_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SKILL_ROOT))

from scripts.core.constants import ALL_FEE_FIELDS  # noqa: E402
from scripts.core.parser import ReportTypeError, parse_reports  # noqa: E402
from scripts.core.validators import (  # noqa: E402
    compute_settlement_summary,
    detect_fee_model,
    validate_batch_formula,
)


MAX_FILES = 10
MAX_FILE_BYTES = 25 * 1024 * 1024
MAX_XLSX_ENTRIES = 500
MAX_XLSX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
MAX_XLSX_COMPRESSION_RATIO = 1000
MAX_INVALID_SAMPLES = 50

NUMERIC_FIELDS = (
    "transactionAmountValue",
    "settlementAmountValue",
    "convertedTransactionAmountValue",
    "quotePrice",
    *ALL_FEE_FIELDS,
)


def _json_default(value: Any) -> str:
    if isinstance(value, Decimal):
        return str(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def _strict_decimal(value: Any) -> Decimal | None:
    if value is None:
        return Decimal("0")
    text = str(value).strip()
    if not text:
        return Decimal("0")
    try:
        return Decimal(text)
    except (InvalidOperation, ValueError):
        return None


def _preflight_file(path: Path) -> None:
    if not path.is_file():
        raise ValueError(f"Input file does not exist: {path.name}")
    if path.suffix.lower() not in {".csv", ".xlsx"}:
        raise ValueError(f"Unsupported file extension for {path.name}; use CSV or XLSX")
    size = path.stat().st_size
    if size > MAX_FILE_BYTES:
        raise ValueError(f"{path.name} exceeds the 25 MiB public-plugin limit")

    if path.suffix.lower() != ".xlsx":
        return

    try:
        import openpyxl  # noqa: F401
    except ImportError as exc:
        raise RuntimeError(
            "XLSX support is unavailable in this runtime; export the report as CSV"
        ) from exc

    try:
        with zipfile.ZipFile(path) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_XLSX_ENTRIES:
                raise ValueError(f"{path.name} contains too many XLSX archive entries")
            total_uncompressed = sum(item.file_size for item in entries)
            total_compressed = sum(max(item.compress_size, 1) for item in entries)
            if total_uncompressed > MAX_XLSX_UNCOMPRESSED_BYTES:
                raise ValueError(f"{path.name} expands beyond the 100 MiB safety limit")
            if total_uncompressed / total_compressed > MAX_XLSX_COMPRESSION_RATIO:
                raise ValueError(f"{path.name} has an unsafe compression ratio")
    except zipfile.BadZipFile as exc:
        raise ValueError(f"{path.name} is not a valid XLSX archive") from exc


def _scan_invalid_numeric_fields(rows: Iterable[Dict[str, Any]]) -> Dict[str, Any]:
    count = 0
    by_field: Counter[str] = Counter()
    samples: List[Dict[str, Any]] = []
    for row_index, row in enumerate(rows):
        for field in NUMERIC_FIELDS:
            value = row.get(field)
            if value is None or not str(value).strip():
                continue
            if _strict_decimal(value) is not None:
                continue
            count += 1
            by_field[field] += 1
            if len(samples) < MAX_INVALID_SAMPLES:
                samples.append({"row_index": row_index, "field": field})
    return {
        "count": count,
        "by_field": dict(sorted(by_field.items())),
        "samples": samples,
        "samples_truncated": count > len(samples),
    }


def _fee_breakdown(rows: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[tuple, Dict[str, Any]] = {}
    for row in rows:
        key = (
            str(row.get("settlementCurrency", "")).strip() or "UNKNOWN",
            str(row.get("paymentMethodType", "")).strip() or "UNKNOWN",
            str(row.get("cardBrand", "")).strip(),
            str(row.get("cardCountry", "")).strip(),
        )
        bucket = grouped.setdefault(
            key,
            {"row_count": 0, "fee_total": Decimal("0"), "fees_by_field": {}},
        )
        bucket["row_count"] += 1
        for field in ALL_FEE_FIELDS:
            value = _strict_decimal(row.get(field))
            if value is None or value == 0:
                continue
            bucket["fee_total"] += value
            bucket["fees_by_field"][field] = (
                bucket["fees_by_field"].get(field, Decimal("0")) + value
            )

    result = []
    for key in sorted(grouped):
        currency, payment_method, card_brand, card_country = key
        bucket = grouped[key]
        result.append(
            {
                "settlement_currency": currency,
                "payment_method": payment_method,
                "card_brand": card_brand or None,
                "card_country": card_country or None,
                "row_count": bucket["row_count"],
                "fee_total": bucket["fee_total"],
                "fees_by_field": dict(sorted(bucket["fees_by_field"].items())),
            }
        )
    return result


def _sanitize_error(message: str, paths: Iterable[Path]) -> str:
    sanitized = message
    for path in paths:
        sanitized = sanitized.replace(str(path), path.name)
    return sanitized


def analyze(paths: List[Path]) -> Dict[str, Any]:
    if not paths:
        return {"success": False, "error": "NO_INPUT", "message": "Upload a report file"}
    if len(paths) > MAX_FILES:
        return {
            "success": False,
            "error": "TOO_MANY_FILES",
            "message": f"At most {MAX_FILES} report files can be analyzed at once",
        }

    try:
        for path in paths:
            _preflight_file(path)
        parsed = parse_reports([str(path) for path in paths])
    except ReportTypeError as exc:
        return {
            "success": False,
            "error": f"REPORT_TYPE_{exc.kind.upper()}",
            "message": _sanitize_error(exc.reason, paths),
        }
    except Exception as exc:
        return {
            "success": False,
            "error": type(exc).__name__,
            "message": _sanitize_error(str(exc), paths),
        }

    rows = parsed.get("data", [])
    metadata = parsed.get("metadata", {})
    safe_metadata = {
        "files": [path.name for path in paths],
        "file_count": metadata.get("file_count", len(paths)),
        "success_files": metadata.get("success_files", 0),
        "failed_files": metadata.get("failed_files", 0),
        "total_rows": metadata.get("total_rows", 0),
        "data_rows": metadata.get("data_rows", len(rows)),
        "end_marker_rows": metadata.get("end_marker_rows", 0),
        "empty_batch": len(rows) == 0,
    }

    if not parsed.get("success"):
        return {
            "success": False,
            "error": "PARSE_FAILED",
            "message": "No supplied Settlement Detail report could be parsed",
            "metadata": safe_metadata,
        }

    if not rows:
        return {
            "success": True,
            "conclusive": False,
            "reason": "No data rows were found; this package does not infer why the report is empty",
            "metadata": safe_metadata,
        }

    invalid_numeric = _scan_invalid_numeric_fields(rows)
    if invalid_numeric["count"]:
        return {
            "success": True,
            "conclusive": False,
            "reason": "Invalid numeric cells prevent reliable financial conclusions",
            "metadata": safe_metadata,
            "invalid_numeric_fields": invalid_numeric,
        }

    fee_models = Counter(detect_fee_model(row) for row in rows)
    return {
        "success": True,
        "conclusive": True,
        "scope": "local-settlement-detail",
        "metadata": safe_metadata,
        "fee_summary": parsed.get("fee_summary"),
        "settlement_summary": compute_settlement_summary(rows),
        "formula_validation": validate_batch_formula(rows),
        "fee_model_counts": dict(sorted(fee_models.items())),
        "fee_breakdown": _fee_breakdown(rows),
        "privacy": "Aggregate output only; raw report rows and identifiers are omitted",
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Analyze Antom Settlement Detail reports without emitting raw rows"
    )
    parser.add_argument("--files", nargs="+", required=True, help="CSV/XLSX report paths")
    parser.add_argument("--output", help="Optional JSON output path")
    args = parser.parse_args()

    paths = [Path(item).expanduser().resolve() for item in args.files]
    result = analyze(paths)
    payload = json.dumps(result, indent=2, ensure_ascii=False, default=_json_default)

    if args.output:
        output_path = Path(args.output).expanduser().resolve()
        output_path.write_text(payload + "\n", encoding="utf-8")
        print(json.dumps({"success": result.get("success", False), "output": str(output_path)}))
    else:
        print(payload)
    return 0 if result.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main())
