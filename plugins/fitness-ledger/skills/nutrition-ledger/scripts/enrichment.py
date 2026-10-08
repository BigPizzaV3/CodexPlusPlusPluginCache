"""Keep reported label nutrients distinct from analytical enrichment."""

from __future__ import annotations

from typing import Any, Mapping


def select_nutrients(reported: Mapping[str, Any], analytical: Mapping[str, Any], *, overrides: Mapping[str, Any] | None = None) -> dict[str, dict[str, Any]]:
    """Select per nutrient while retaining both reported and inferred values."""
    overrides = overrides or {}
    result: dict[str, dict[str, Any]] = {}
    for nutrient in sorted(set(reported) | set(analytical) | set(overrides)):
        if nutrient in overrides:
            result[nutrient] = {"reported_value": reported.get(nutrient), "analytical_value": analytical.get(nutrient), "selected_value": overrides[nutrient], "selection_reason": "explicit user override", "confidence_tier": "A"}
        elif reported.get(nutrient) is not None:
            result[nutrient] = {"reported_value": reported[nutrient], "analytical_value": analytical.get(nutrient), "selected_value": reported[nutrient], "selection_reason": "authoritative reported value", "confidence_tier": "A"}
        elif analytical.get(nutrient) is not None:
            result[nutrient] = {"reported_value": None, "analytical_value": analytical[nutrient], "selected_value": analytical[nutrient], "selection_reason": "fills missing reported nutrient", "confidence_tier": "C"}
        else:
            result[nutrient] = {"reported_value": None, "analytical_value": None, "selected_value": None, "selection_reason": "unknown", "confidence_tier": "D"}
    return result
