from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any


class AdapterError(RuntimeError):
    """Raised when a remote application adapter cannot return valid JSON."""


def post_json(
    url: str,
    payload: dict[str, Any],
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 30.0,
) -> dict[str, Any]:
    request_headers = {"content-type": "application/json", **(headers or {})}
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=request_headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310
            data = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise AdapterError(f"HTTP adapter failed for {url}: {exc}") from exc
    if not isinstance(data, dict):
        raise AdapterError(f"HTTP adapter expected a JSON object from {url}")
    return data
