"""Interpretable confidence dimensions for nutrition records."""

from __future__ import annotations

from typing import Any, Mapping


_TIERS = {"A": 1.0, "B": 0.8, "C": 0.5, "D": 0.0}


def confidence_dimensions(record: Mapping[str, Any]) -> dict[str, str]:
    """Classify identity, portion, and composition independently.

    The labels are intentionally ordinal but not collapsed into one score.
    """
    identity = "high" if record.get("gtin") or record.get("food_master_id") else "moderate"
    if record.get("identity_ambiguous") or record.get("identity_status") in {"ambiguous", "unresolved"}:
        identity = "low"

    portion = "high" if record.get("amount_weight") or record.get("serving_count") else "moderate"
    if record.get("portion_uncertain"):
        portion = "low"

    provenance = record.get("nutrient_provenance") or {}
    tiers = [str(p.get("tier", "D")) for p in provenance.values() if isinstance(p, Mapping)]
    if not tiers:
        composition = "low"
    else:
        known = [t for t in tiers if t in _TIERS and t != "D"]
        ratio = len(known) / len(tiers)
        if ratio == 1 and all(t in {"A", "B"} for t in known):
            composition = "high"
        elif ratio >= 0.5:
            composition = "moderate"
        else:
            composition = "low"
    return {"identity_confidence": identity, "portion_confidence": portion, "composition_confidence": composition}


def explain_confidence(record: Mapping[str, Any]) -> str:
    dims = confidence_dimensions(record)
    return "; ".join(f"{key.removesuffix('_confidence')}: {value}" for key, value in dims.items())
