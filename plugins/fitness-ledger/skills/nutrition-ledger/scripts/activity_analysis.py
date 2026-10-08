"""Derived nutrition/activity joins without mutating source datasets."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Any, Iterable, Mapping


def pre_workout_rows(entries: Iterable[Mapping[str, Any]], workout_at: datetime, hours: int) -> list[Mapping[str, Any]]:
    start = workout_at - timedelta(hours=hours)
    return [entry for entry in entries if not entry.get("deleted_at") and _timestamp(entry) is not None and start <= _timestamp(entry) < workout_at]


def _timestamp(entry: Mapping[str, Any]) -> datetime | None:
    raw = entry.get("logged_at") or entry.get("timestamp")
    if not raw:
        return None
    try:
        stamp = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    return stamp if stamp.tzinfo else stamp.replace(tzinfo=timezone.utc)


def compare_training_rest(daily: Iterable[Mapping[str, Any]], metric: str) -> dict[str, Any]:
    training = [float(row[metric]) for row in daily if row.get("training_day") is True and row.get(metric) is not None]
    rest = [float(row[metric]) for row in daily if row.get("training_day") is False and row.get(metric) is not None]
    return {"metric": metric, "training_days": len(training), "rest_days": len(rest), "training_mean": mean(training) if training else None, "rest_mean": mean(rest) if rest else None, "interpretation": "associated with" if training and rest else "insufficient evidence"}
