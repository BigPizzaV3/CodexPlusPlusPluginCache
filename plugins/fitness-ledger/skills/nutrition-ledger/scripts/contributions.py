"""Nutrient contribution analysis over active entries."""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable, Mapping


def top_sources(rows: Iterable[Mapping[str, Any]], nutrient: str, limit: int = 5) -> list[dict[str, Any]]:
    totals: dict[str, float] = defaultdict(float)
    for row in rows:
        if row.get("deleted_at") or row.get(nutrient) is None:
            continue
        label = str(row.get("food_product") or "Unknown food")
        totals[label] += float(row[nutrient])
    total = sum(totals.values())
    return [{"food": food, "amount": round(amount, 4), "proportion": round(amount / total, 4) if total else 0.0} for food, amount in sorted(totals.items(), key=lambda item: (-item[1], item[0]))[:limit]]
