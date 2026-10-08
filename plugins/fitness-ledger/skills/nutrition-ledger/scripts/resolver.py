"""Deterministic multi-source food resolution."""

from __future__ import annotations

from typing import Any, Iterable, Mapping

from product_identity import normalized_gtin


SOURCE_PRIORITY = {
    "user_label": 0,
    "manufacturer": 1,
    "usda_branded": 2,
    "verified_local": 3,
    "open_food_facts": 4,
    "usda_analogue": 5,
    "reconstruction": 6,
}


def _name(record: Mapping[str, Any]) -> str:
    parts = []
    for key in ("brand_owner", "product_name", "variant", "package_size"):
        parts.extend(str(record.get(key) or "").strip().casefold().split())
    return " ".join(parts).strip()


def resolve_candidates(query: Mapping[str, Any], candidates: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
    records = tuple(candidates)
    gtin = normalized_gtin(query)
    matching = [c for c in records if gtin and normalized_gtin(c) == gtin]
    if not matching and not gtin:
        qname = _name(query)
        matching = [c for c in records if qname and _name(c) == qname]
    if not matching:
        return {"status": "unresolved", "selected": None, "candidates": [], "source": None, "reason": "no defensible identity match"}
    ordered = sorted(matching, key=lambda c: (SOURCE_PRIORITY.get(str(c.get("source")), 99), str(c.get("source_id") or "")))
    best_priority = SOURCE_PRIORITY.get(str(ordered[0].get("source")), 99)
    tied = [c for c in ordered if SOURCE_PRIORITY.get(str(c.get("source")), 99) == best_priority]
    if len(tied) > 1:
        return {"status": "ambiguous", "selected": None, "candidates": tied, "source": None, "reason": "conflicting candidates at the same source priority"}
    selected = ordered[0]
    return {"status": "resolved", "selected": selected, "candidates": ordered, "source": selected.get("source"), "source_id": selected.get("source_id"), "reason": f"selected highest-priority {selected.get('source')} candidate"}
