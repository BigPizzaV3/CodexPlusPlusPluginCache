"""Smoothed body-weight trend helpers."""

from statistics import mean
from typing import Any, Iterable, Mapping


def smoothed_weights(weights: Iterable[Mapping[str, Any]], window: int = 7) -> list[dict[str, Any]]:
    rows = sorted((w for w in weights if w.get("weight_lb") is not None), key=lambda w: str(w.get("date")))
    result = []
    for index, row in enumerate(rows):
        values = [float(item["weight_lb"]) for item in rows[max(0, index - window + 1):index + 1]]
        result.append({"date": row.get("date"), "weight_lb": row.get("weight_lb"), "smoothed_weight_lb": round(mean(values), 3), "sample_size": len(values)})
    return result
