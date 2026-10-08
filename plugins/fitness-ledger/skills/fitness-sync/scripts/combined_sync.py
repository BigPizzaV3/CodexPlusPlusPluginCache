"""Orchestration boundary for one nutrition + fitness synchronization run."""

from __future__ import annotations

from typing import Callable

from fitness_sync import sync_fitness_sources


def run_combined_sync(
    *,
    fetch_nutrition: Callable[[], object],
    fetch_caliber_workouts: Callable[[], list[dict]],
    fetch_apple_health_workouts: Callable[[], list[dict]],
    fetch_apple_health_activity: Callable[[], dict],
    existing_workouts: list[dict],
    caliber_steps: list[dict],
    dates: list[str],
) -> dict:
    """Run every source check for each sync, including on rest days.

    Connector functions are injected so orchestration is testable without live
    accounts. The returned nutrition payload is preserved for the caller's
    existing nutrition pipeline; fitness reconciliation is deterministic.
    """
    nutrition = fetch_nutrition()
    caliber_workouts = fetch_caliber_workouts()
    apple_health_workouts = fetch_apple_health_workouts()
    apple_health_activity = fetch_apple_health_activity()
    apple_steps = apple_health_activity.get("steps", [])
    health_response = apple_health_activity.get("response")
    result = sync_fitness_sources(
        caliber_workouts=caliber_workouts,
        apple_health_workouts=apple_health_workouts,
        existing_workouts=existing_workouts,
        caliber_steps=caliber_steps,
        apple_health_steps=apple_steps,
        dates=dates,
        apple_health_response=health_response,
        as_of=max(dates) if dates else None,
    )
    result["nutrition"] = nutrition
    result["source_runs"] = {
        "nutrition": "complete",
        "caliber_workouts": "complete",
        "apple_health_workouts": result["checks"]["apple_health_workouts"]["status"],
        "apple_health_activity": "complete",
    }
    return result
