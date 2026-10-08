"""Coverage-aware nutrient aggregation and interpretation."""

from __future__ import annotations

from typing import Any, Iterable, Mapping


_TIER_WEIGHT = {"A": 1.0, "B": 0.9, "C": 0.5, "D": 0.0}


def nutrient_coverage(rows: Iterable[Mapping[str, Any]], nutrient: str) -> dict[str, float | int]:
    """Return item, calorie, and provenance-weighted coverage for a nutrient."""
    records = tuple(row for row in rows if not row.get("deleted_at"))
    if not records:
        return {"items_total": 0, "items_known": 0, "item_weighted": 0.0, "calorie_weighted": 0.0, "confidence_weighted": 0.0}
    known = [row for row in records if row.get(nutrient) is not None]
    item_weighted = len(known) / len(records)
    total_calories = sum(float(row.get("calories") or 0) for row in records)
    known_calories = sum(float(row.get("calories") or 0) for row in known)
    calorie_weighted = known_calories / total_calories if total_calories else item_weighted
    confidence_total = sum(_TIER_WEIGHT.get(str((row.get("nutrient_provenance") or {}).get(nutrient, {}).get("tier", "D")), 0.0) for row in records)
    return {
        "items_total": len(records),
        "items_known": len(known),
        "item_weighted": round(item_weighted, 4),
        "calorie_weighted": round(calorie_weighted, 4),
        "confidence_weighted": round(confidence_total / len(records), 4),
    }


def classify_with_coverage(total: float | None, target: float | None, coverage: Mapping[str, Any], *, minimum_coverage: float = 0.8) -> str:
    """Gate adequacy classifications when too much intake is unknown."""
    if target is None or total is None:
        return "insufficient data"
    if float(coverage.get("calorie_weighted", 0.0)) < minimum_coverage:
        return "insufficient data coverage to assess"
    return "intake appears low" if total < target else "intake appears adequate"
