"""Explicit, best-effort Sentry Logs for Python Rosalind plugin servers."""

from __future__ import annotations

import json
import math
import os
import re
from collections.abc import Mapping
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal
from urllib.parse import urlsplit
from uuid import uuid4

from sentry_sdk import Client, Scope, logger
from sentry_sdk.scope import use_scope
from sentry_sdk.transport import HttpTransport, Transport

if TYPE_CHECKING:
    from sentry_sdk._types import Hint, Log

# Public ingestion DSN, matching @openai/rosalind-logging's default.
DEFAULT_DSN = "https://2a6c350b16cbab5dea93410086036f4a@o33249.ingest.us.sentry.io/4512206511144960"
APPROVED_ATTRIBUTES = frozenset(
    {
        "plugin_id",
        "plugin_version",
        "component",
        "version",
        "errorCode",
        "errorName",
        "failureCode",
        "jobId",
        "renderKind",
        "workflowKind",
        "sentry.release",
        "sentry.sdk.name",
        "sentry.sdk.version",
    }
)
Scalar = str | int | float | bool


class BoundedHttpTransport(HttpTransport):
    """Retain SDK batching/rate limits with a bounded, non-retrying HTTP transport."""

    TIMEOUT = 2

    def _get_pool_options(self) -> dict[str, Any]:
        return {**super()._get_pool_options(), "retries": False}


def _is_public_dsn(dsn: str) -> bool:
    try:
        url = urlsplit(dsn)
        return (
            url.scheme == "https"
            and bool(url.hostname)
            and url.password is None
            and re.fullmatch(r"[a-zA-Z0-9]+", url.username or "") is not None
            and re.fullmatch(r"/\d+", url.path) is not None
            and not url.query
            and not url.fragment
        )
    except ValueError:
        return False


def _before_send_log(log: Log, _hint: Hint) -> Log:
    # SDK-added hostname/user/scope metadata must pass the same allowlist.
    log["attributes"] = {
        key: attribute
        for key, attribute in log["attributes"].items()
        if key in APPROVED_ATTRIBUTES and isinstance(attribute, (str, int, float, bool))
    }
    # Keep the protocol trace ID independent of ambient scientific activity.
    log["trace_id"] = uuid4().hex
    log["span_id"] = None
    return log


class SentryServerLogger:
    def __init__(
        self,
        component: str,
        version: str,
        *,
        dsn: str | None = None,
        enabled: bool | None = None,
        transport: type[Transport] = BoundedHttpTransport,
    ) -> None:
        self.component = component
        self.version = version
        self.client: Client | None = None
        self.scope = Scope()
        destination = os.environ.get("ROSALIND_SENTRY_DSN", DEFAULT_DSN) if dsn is None else dsn
        active = os.environ.get("ROSALIND_SENTRY_ENABLED") != "0" if enabled is None else enabled
        if not active or not _is_public_dsn(destination):
            return
        try:
            self.client = Client(
                dsn=destination,
                release=f"ngs-analysis-workbench@{version}",
                enable_logs=True,
                default_integrations=False,
                auto_enabling_integrations=False,
                integrations=[],
                auto_session_tracking=False,
                enable_backpressure_handling=False,
                send_default_pii=False,
                send_client_reports=False,
                include_local_variables=False,
                include_source_context=False,
                before_send=lambda _event, _hint: None,
                before_send_transaction=lambda _event, _hint: None,
                before_send_log=_before_send_log,
                transport=transport,
                transport_queue_size=10,
                shutdown_timeout=2,
            )
            self.scope.set_client(self.client)
        except Exception:
            # Telemetry setup cannot prevent a scientific MCP server from starting.
            self.client = None

    def info(self, message: str, metadata: Mapping[str, Scalar] | None = None) -> None:
        self._log("info", message, metadata)

    def error(self, message: str, metadata: Mapping[str, Scalar] | None = None) -> None:
        self._log("error", message, metadata)

    def _log(
        self,
        level: Literal["info", "error"],
        message: str,
        metadata: Mapping[str, Scalar] | None,
    ) -> None:
        if self.client is None:
            return
        attributes: dict[str, Scalar] = {
            "plugin_id": "ngs-analysis-workbench",
            "plugin_version": self.version,
            "component": self.component,
        }
        for key, value in (metadata or {}).items():
            if key not in APPROVED_ATTRIBUTES or key in attributes:
                continue
            if isinstance(value, str):
                attributes[key] = value[:200]
            elif isinstance(value, (int, float, bool)) and math.isfinite(value):
                attributes[key] = value
        try:
            with use_scope(self.scope):
                if level == "error":
                    logger.error(message[:1000], attributes=attributes)
                else:
                    logger.info(message[:1000], attributes=attributes)
        except Exception:
            pass

    def close(self) -> None:
        try:
            if self.client is not None:
                self.client.close(timeout=2)
        except Exception:
            pass


@lru_cache(maxsize=4)
def get_server_logger(component: str) -> SentryServerLogger:
    manifest = Path(__file__).resolve().parents[2] / ".codex-plugin/plugin.json"
    version = json.loads(manifest.read_text(encoding="utf-8"))["version"]
    return SentryServerLogger(component, version)
