"""Barcode-first food-master lookup with verification-age handling."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Iterable, Mapping

from product_identity import normalized_gtin, formulation_fingerprint
from resolver import resolve_candidates


def verification_is_stale(last_verified_at: str | None, *, now: datetime | None = None, max_age_days: int = 180) -> bool:
    if not last_verified_at:
        return True
    try:
        stamp = datetime.fromisoformat(last_verified_at.replace("Z", "+00:00"))
    except ValueError:
        return True
    if stamp.tzinfo is None:
        stamp = stamp.replace(tzinfo=timezone.utc)
    current = now or datetime.now(timezone.utc)
    return current - stamp > timedelta(days=max_age_days)


def barcode_fast_path(gtin: str, masters: Iterable[Mapping[str, Any]], authoritative: Iterable[Mapping[str, Any]] = (), *, now: datetime | None = None, max_age_days: int = 180) -> dict[str, Any]:
    normalized = normalized_gtin({"gtin": gtin})
    local = [m for m in masters if normalized_gtin(m) == normalized]
    if len(local) == 1 and not verification_is_stale(local[0].get("last_verified_at"), now=now, max_age_days=max_age_days):
        return {"status": "reused", "selected": local[0], "reason": "verified local food master is fresh"}
    candidates = list(authoritative)
    if candidates:
        result = resolve_candidates({"gtin": normalized}, candidates)
        if result["status"] == "resolved":
            selected = dict(result["selected"])
            selected["formulation_hash"] = selected.get("formulation_hash") or formulation_fingerprint(selected)
            return {**result, "status": "revalidated", "selected": selected, "reason": "local master was missing/stale and authoritative data was available"}
    if len(local) == 1:
        return {"status": "stale_local", "selected": local[0], "reason": "no authoritative refresh available; reuse requires explicit stale-data acceptance"}
    if len(local) > 1:
        return {"status": "ambiguous", "selected": None, "reason": "multiple local masters share the barcode"}
    return {"status": "unresolved", "selected": None, "reason": "barcode not found and no authoritative source available"}
