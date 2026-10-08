"""Coverage-aware longitudinal nutrient summaries."""

from __future__ import annotations

from statistics import mean, median
from typing import Any, Iterable, Mapping

from coverage import nutrient_coverage


def summarize_window(rows: Iterable[Mapping[str, Any]], nutrient: str, target: float | None = None) -> dict[str, Any]:
    records = tuple(row for row in rows if not row.get("deleted_at"))
    known = [float(row[nutrient]) for row in records if row.get(nutrient) is not None]
    coverage = nutrient_coverage(records, nutrient)
    if not known:
        return {"nutrient": nutrient, "days": 0, "mean": None, "median": None, "minimum": None, "maximum": None, "target_hit_frequency": None, "coverage": coverage, "interpretation": "insufficient data"}
    target_hits = sum(value >= target for value in known) / len(known) if target is not None else None
    interpretation = "insufficient data coverage to assess" if coverage["calorie_weighted"] < 0.8 else ("adequate trend" if target is None or mean(known) >= target else "possibly low")
    return {"nutrient": nutrient, "days": len(known), "mean": round(mean(known), 4), "median": round(median(known), 4), "minimum": min(known), "maximum": max(known), "target_hit_frequency": target_hits, "coverage": coverage, "interpretation": interpretation}
