"""Deterministic product identity and formulation-version primitives.

These helpers are intentionally independent of persistence. Callers can use
the result to decide whether to reuse a food master, create a new version, or
ask for clarification before mutating the canonical ledger.
"""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
import re
from typing import Any, Iterable, Mapping


_FORMULATION_FIELDS = (
    "serving_size",
    "serving_unit",
    "serving_weight_g",
    "calories",
    "protein_g",
    "carbohydrates_g",
    "fat_g",
    "fiber_g",
    "total_sugars_g",
    "added_sugars_g",
    "saturated_fat_g",
    "sodium_mg",
    "potassium_mg",
    "ingredients",
)


def _clean(value: Any) -> Any:
    if isinstance(value, str):
        return re.sub(r"\s+", " ", value.strip()).casefold()
    if isinstance(value, float):
        return round(value, 6)
    if isinstance(value, Mapping):
        return {str(k): _clean(value[k]) for k in sorted(value)}
    if isinstance(value, (list, tuple)):
        return [_clean(item) for item in value]
    return value


def normalized_gtin(record: Mapping[str, Any]) -> str | None:
    """Return a digits-only GTIN/UPC, or ``None`` when absent/invalid."""
    raw = record.get("gtin") or record.get("upc")
    if raw is None:
        return None
    digits = re.sub(r"\D", "", str(raw))
    return digits or None


def formulation_fingerprint(record: Mapping[str, Any]) -> str:
    """Create a stable change-detection fingerprint for declared formulation."""
    payload = {field: _clean(record.get(field)) for field in _FORMULATION_FIELDS}
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def identity_key(record: Mapping[str, Any]) -> tuple[Any, ...]:
    """Return normalized identity attributes used for deterministic matching."""
    return (
        normalized_gtin(record),
        _clean(record.get("brand_owner") or record.get("brand")),
        _clean(record.get("manufacturer")),
        _clean(record.get("product_name") or record.get("food_name") or record.get("food_product")),
        _clean(record.get("variant")),
        _clean(record.get("package_size")),
    )


def _identity_without_gtin(record: Mapping[str, Any]) -> tuple[Any, ...]:
    return identity_key(record)[1:]


@dataclass(frozen=True)
class IdentityResolution:
    status: str
    selected: Mapping[str, Any] | None
    candidates: tuple[Mapping[str, Any], ...]
    reason: str


def resolve_identity(query: Mapping[str, Any], masters: Iterable[Mapping[str, Any]]) -> IdentityResolution:
    """Resolve a query against masters without guessing through ambiguity."""
    records = tuple(masters)
    gtin = normalized_gtin(query)
    if gtin:
        gtin_matches = tuple(m for m in records if normalized_gtin(m) == gtin)
        if len(gtin_matches) == 1:
            match = gtin_matches[0]
            if query.get("formulation_hash") and query["formulation_hash"] != match.get("formulation_hash"):
                return IdentityResolution("changed_formulation", None, gtin_matches, "GTIN matches but formulation fingerprint changed")
            return IdentityResolution("exact", match, gtin_matches, "exact GTIN match")
        if len(gtin_matches) > 1:
            return IdentityResolution("ambiguous", None, gtin_matches, "duplicate masters share the same GTIN")

    key = identity_key(query)
    matches = tuple(m for m in records if key[0] is None and _identity_without_gtin(m) == _identity_without_gtin(query))
    if len(matches) == 1:
        return IdentityResolution("exact", matches[0], matches, "exact non-GTIN identity match")
    if len(matches) > 1:
        return IdentityResolution("ambiguous", None, matches, "multiple masters match without a barcode")
    return IdentityResolution("unresolved", None, (), "insufficient identity evidence")


def version_master(master: Mapping[str, Any], observed: Mapping[str, Any]) -> dict[str, Any]:
    """Return a versioned master, preserving the prior master when formulation changes."""
    old = dict(master)
    old_hash = old.get("formulation_hash") or formulation_fingerprint(old)
    new = dict(observed)
    new_hash = new.get("formulation_hash") or formulation_fingerprint(new)
    if old_hash == new_hash:
        old["formulation_hash"] = old_hash
        return old
    new["formulation_hash"] = new_hash
    prior_id = old.get("food_master_id")
    new.setdefault("food_master_version", int(old.get("food_master_version") or 1) + 1)
    if new.get("food_master_id") in (None, prior_id):
        new["food_master_id"] = f"{prior_id or 'fm'}-v{new['food_master_version']}"
    new["supersedes_food_master_id"] = prior_id
    new["status"] = new.get("status", "active")
    return new
