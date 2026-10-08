"""Offline-safe source fallback policy."""

from typing import Any, Mapping


def resolve_with_fallback(local_master: Mapping[str, Any] | None, external_result: Mapping[str, Any] | None) -> dict[str, Any]:
    if external_result and external_result.get("status") == "resolved":
        return {"status": "external", "record": external_result.get("selected"), "verification": "fresh"}
    if local_master:
        return {"status": "local_fallback", "record": local_master, "verification": "age-limited"}
    return {"status": "unresolved", "record": None, "verification": "unknown"}
