"""Pure source reconciliation for Caliber and Apple Health fitness data.

Connectors remain outside this module. They provide source snapshots; this module
normalizes, validates, and reconciles them deterministically so the workflow can
be tested without authenticated connector calls.
"""

from __future__ import annotations

import copy
from collections import defaultdict
from datetime import date


def _workout_id(workout: dict) -> str | None:
    return workout.get("workout_id") or workout.get("calendarItemId") or workout.get("id")


def _normalize_workout(workout: dict) -> dict:
    normalized = copy.deepcopy(workout)
    normalized["workout_id"] = _workout_id(workout)
    normalized["source"] = workout.get("source", "caliber")
    return normalized


def _workout_signature(workout: dict) -> dict:
    normalized = _normalize_workout(workout)
    normalized.pop("source", None)
    return normalized


def validate_workouts(workouts: list[dict], as_of: str | None = None) -> list[str]:
    """Return blocking errors for structurally or physically impossible workouts."""
    errors = []
    seen_workouts = set()
    for workout in workouts or []:
        wid = _workout_id(workout)
        if not wid:
            errors.append("missing stable workout ID")
        elif wid in seen_workouts:
            errors.append(f"duplicate workout ID {wid}")
        else:
            seen_workouts.add(wid)
        workout_date = workout.get("date")
        try:
            parsed_date = date.fromisoformat(workout_date)
        except (TypeError, ValueError):
            parsed_date = None
            errors.append(f"invalid workout date {workout_date!r}")
        if as_of and parsed_date and parsed_date > date.fromisoformat(as_of):
            errors.append(f"future workout date {workout_date}")
        duration = workout.get("durationSeconds")
        if isinstance(duration, (int, float)) and duration < 0:
            errors.append(f"negative duration for workout {wid}")
        for exercise in workout.get("exercises", []) or []:
            exercise_id = exercise.get("exerciseId") or exercise.get("exercise_id") or exercise.get("exerciseName")
            seen_sets = set()
            for index, item in enumerate(exercise.get("sets", []) or []):
                set_number = item.get("sortOrder", index)
                key = (wid, exercise_id, set_number)
                if key in seen_sets:
                    errors.append(f"duplicate set {key}")
                seen_sets.add(key)
                for field in ("actualWeight", "weight", "actualReps", "reps", "actualTime", "durationSeconds"):
                    value = item.get(field)
                    if isinstance(value, (int, float)) and value < 0:
                        errors.append(f"negative {field} in workout {wid}")
    return errors


def validate_health_response(response: dict, as_of: str | None = None) -> list[str]:
    """Return blocking errors for incomplete or temporally invalid Health pulls."""
    errors = []
    status = response.get("result_status", {})
    for metric, metric_status in status.get("metrics", {}).items():
        if not metric_status.get("complete", False):
            errors.append(f"incomplete Apple Health metric {metric}")
        if metric_status.get("row_limit_exceeded"):
            errors.append(f"row limit exceeded for Apple Health metric {metric}")
        if metric_status.get("response_budget_exceeded"):
            errors.append(f"response budget exceeded for Apple Health metric {metric}")
    if as_of:
        cutoff = date.fromisoformat(as_of)
        for metric, rows in (response.get("data") or {}).items():
            for row in rows or []:
                local = row.get("time_local") or row.get("start_time_local")
                if local and local[:10] > cutoff.isoformat():
                    errors.append(f"future Apple Health row in {metric}: {local[:10]}")
    return errors


def sync_workouts(caliber_workouts: list[dict] | None, apple_health_workouts: list[dict] | None, existing: list[dict]) -> dict:
    """Reconcile workouts without deleting records when a source returns zero rows."""
    caliber_workouts = caliber_workouts or []
    apple_health_workouts = apple_health_workouts or []
    validation_errors = validate_workouts(caliber_workouts) + validate_workouts(apple_health_workouts)
    if validation_errors:
        raise ValueError("invalid workout source payload: " + "; ".join(validation_errors))
    incoming = [_normalize_workout(w) for w in caliber_workouts]
    # Apple Health workouts are retained as observations for future source
    # precedence, but Caliber remains the workout-detail canonical source today.
    incoming.extend(_normalize_workout({**w, "source": "apple_health"}) for w in apple_health_workouts)

    existing_by_id = {_workout_id(w): w for w in existing if _workout_id(w)}
    canonical = []
    counts = {"new": 0, "updated": 0, "unchanged": 0}
    seen = set()
    for workout in incoming:
        wid = workout["workout_id"]
        if not wid or wid in seen:
            continue
        seen.add(wid)
        prior = existing_by_id.get(wid)
        if prior is None:
            counts["new"] += 1
            canonical.append(workout)
        elif _workout_signature(prior) == _workout_signature(workout):
            counts["unchanged"] += 1
            canonical.append(_normalize_workout(prior))
        else:
            counts["updated"] += 1
            canonical.append(workout)

    # Preserve existing records not present in this pull. A source may return a
    # valid empty window, and absence is not evidence of deletion.
    for prior in existing:
        wid = _workout_id(prior)
        if wid and wid not in seen:
            canonical.append(_normalize_workout(prior))

    return {
        "status": "complete",
        "canonical": canonical,
        "counts": counts,
        "caliber_workouts": len(caliber_workouts),
        "apple_health_workouts": len(apple_health_workouts),
        "apple_health_check": {"complete": True, "status": "complete_zero" if not apple_health_workouts else "complete"},
    }


def _group_steps(rows: list[dict], source: str) -> dict[str, dict]:
    grouped = defaultdict(list)
    for row in rows or []:
        if row.get("date") is not None and row.get("steps") is not None:
            grouped[row["date"]].append(row)
    result = {}
    for date, values in grouped.items():
        # Multiple rows from the same source are treated as competing snapshots;
        # do not sum them because that risks double-counting overlapping devices.
        chosen = max(values, key=lambda row: row["steps"])
        result[date] = {"steps": chosen["steps"], "source": source, "complete": chosen.get("complete", True)}
    return result


def reconcile_steps(caliber_steps: list[dict] | None, apple_health_steps: list[dict] | None, manual_overrides: list[dict] | None = None) -> dict:
    caliber = _group_steps(caliber_steps or [], "caliber")
    apple = _group_steps(apple_health_steps or [], "apple_health")
    overrides = _group_steps(manual_overrides or [], "manual_override")
    by_date = {}
    # Caliber steps are diagnostic only. Caliber often reflects a stale Apple
    # Health handoff until its app is opened, so it is never canonical—even
    # when Apple Health has no value for that date.
    for date in sorted(set(apple) | set(overrides)):
        if date in overrides:
            selected = copy.deepcopy(overrides[date])
        else:
            selected = copy.deepcopy(apple[date])
        conflicts = {}
        if date in caliber and date in apple and caliber[date]["steps"] != apple[date]["steps"]:
            conflicts = {"caliber": caliber[date]["steps"], "apple_health": apple[date]["steps"]}
        if conflicts:
            selected["conflict"] = conflicts
        by_date[date] = selected
    return {
        "by_date": by_date,
        "ignored_sources": {"caliber": {date: row["steps"] for date, row in caliber.items()}},
        "source_checks": {"caliber": {"complete": True, "role": "diagnostic_only"}, "apple_health": {"complete": True, "role": "canonical"}},
    }


def sync_fitness_sources(*, caliber_workouts, apple_health_workouts, existing_workouts, caliber_steps, apple_health_steps, manual_step_overrides=None, dates=None, apple_health_response=None, as_of=None) -> dict:
    if apple_health_response is not None:
        response_errors = validate_health_response(apple_health_response, as_of=as_of)
        if response_errors:
            raise ValueError("invalid Apple Health response: " + "; ".join(response_errors))
    workouts = sync_workouts(caliber_workouts, apple_health_workouts, existing_workouts)
    steps = reconcile_steps(caliber_steps, apple_health_steps, manual_step_overrides)
    dates = sorted(set(dates or []) | set(steps["by_date"]) | {w.get("date") for w in workouts["canonical"] if w.get("date")})
    workout_dates = {w.get("date") for w in workouts["canonical"] if w.get("date")}
    daily = {
        date: {
            "date": date,
            "steps": steps["by_date"].get(date, {}).get("steps"),
            "step_source": steps["by_date"].get(date, {}).get("source"),
            "training_day": date in workout_dates,
            "workout_count": sum(1 for w in workouts["canonical"] if w.get("date") == date),
        }
        for date in dates
    }
    return {
        "workouts": workouts,
        "steps": steps,
        "daily": daily,
        "checks": {"apple_health_workouts": workouts["apple_health_check"]},
    }
