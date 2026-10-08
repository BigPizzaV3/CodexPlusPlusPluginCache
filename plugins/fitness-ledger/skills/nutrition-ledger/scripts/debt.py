"""Transparent food-master data-debt prioritization."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any, Iterable, Mapping


def prioritize_food_master_debt(masters: Iterable[Mapping[str, Any]], entries: Iterable[Mapping[str, Any]], *, now: datetime | None = None) -> list[dict[str, Any]]:
    entries = [e for e in entries if not e.get("deleted_at")]
    usage = Counter(e.get("food_master_id") for e in entries)
    calories = Counter()
    for e in entries:
        if e.get("food_master_id") and e.get("calories") is not None:
            calories[e["food_master_id"]] += float(e["calories"])
    current = now or datetime.now(timezone.utc)
    result = []
    for master in masters:
        mid = master.get("food_master_id")
        nutrient_values = master.get("nutrients") or master
        unknown = sum(value is None for key, value in nutrient_values.items() if key.endswith(("_mg", "_mcg", "_g")))
        stale = 1.0 if not master.get("last_verified_at") else 0.0
        if master.get("last_verified_at"):
            try:
                stamp = datetime.fromisoformat(str(master["last_verified_at"]).replace("Z", "+00:00"))
                if stamp.tzinfo is None: stamp = stamp.replace(tzinfo=timezone.utc)
                stale = 1.0 if (current - stamp).days > 180 else 0.0
            except ValueError:
                stale = 1.0
        score = (1 + usage[mid]) * (1 + unknown) * (1 + stale)
        result.append({"food_master_id": mid, "priority": round(score, 4), "usage_frequency": usage[mid], "calorie_contribution": round(calories[mid], 2), "unknown_nutrients": unknown, "stale_verification": bool(stale)})
    return sorted(result, key=lambda row: (-row["priority"], str(row["food_master_id"])))
