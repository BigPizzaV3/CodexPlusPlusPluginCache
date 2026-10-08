"""Nutrition record invariants and structured review issues."""

from __future__ import annotations

import math
from typing import Any, Iterable, Mapping


def validate_nutrition_record(record: Mapping[str, Any]) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []

    def issue(code: str, severity: str, message: str) -> None:
        issues.append({"code": code, "severity": severity, "message": message})

    for key, value in record.items():
        if isinstance(value, (int, float)) and (not math.isfinite(value) or value < 0):
            issue("invalid_numeric", "error", f"{key} must be finite and non-negative")
    fat = record.get("fat_g")
    saturated = record.get("saturated_fat_g")
    if fat is not None and saturated is not None and saturated > fat + 0.2:
        issue("saturated_exceeds_fat", "error", "saturated fat exceeds total fat")
    sugar = record.get("total_sugars_g")
    added = record.get("added_sugars_g")
    if sugar is not None and added is not None and added > sugar + 0.2:
        issue("added_exceeds_total_sugar", "error", "added sugar exceeds total sugar")
    calories = record.get("calories")
    macros = [record.get("protein_g"), record.get("carbohydrates_g"), record.get("fat_g")]
    if calories is not None and all(value is not None for value in macros):
        derived = 4 * float(macros[0]) + 4 * float(macros[1]) + 9 * float(macros[2])
        if abs(float(calories) - derived) > max(20.0, float(calories) * 0.25):
            issue("macro_calorie_mismatch", "warning", "macro-derived calories differ materially from reported calories")
    quantity = record.get("quantity")
    if quantity is not None and (not isinstance(quantity, (int, float)) or quantity <= 0):
        issue("invalid_quantity", "error", "quantity must be positive")
    return issues


def review_queue(records: Iterable[Mapping[str, Any]]) -> list[dict[str, Any]]:
    queue = []
    for record in records:
        issues = validate_nutrition_record(record)
        if issues:
            queue.append({"entry_id": record.get("entry_id"), "issues": issues})
    return queue
