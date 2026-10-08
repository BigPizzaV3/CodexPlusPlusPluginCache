"""Exercise the actual SDK envelope and MCP failure boundary without network I/O."""

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import Mock, patch

from rosalind_logging import DEFAULT_DSN, SentryServerLogger
from rosalind_logging.mcp import LoggedFastMCP
from sentry_sdk import get_client, get_current_scope, isolation_scope
from sentry_sdk.envelope import Envelope
from sentry_sdk.tracing import Span
from sentry_sdk.transport import Transport


class MemoryTransport(Transport):
    envelopes: list[Envelope] = []

    def capture_envelope(self, envelope: Envelope) -> None:
        self.envelopes.append(envelope)


class SentryLoggingTests(unittest.TestCase):
    def setUp(self) -> None:
        MemoryTransport.envelopes = []

    def test_private_scope_and_filtered_error_envelope(self) -> None:
        ambient_scope = get_current_scope()
        log = SentryServerLogger("ngs-compute", "test", enabled=True, transport=MemoryTransport)
        with isolation_scope() as scope:
            scope.set_user({"email": "private@example.invalid"})
            scope.span = Span(trace_id="a" * 32, span_id="b" * 16)
            scope.set_attribute("private_path", "/private/sample.fastq")
            log.error(
                "Synthetic failure",
                {
                    "errorCode": "TEST",
                    "path": "/private/sample.fastq",
                    "errorName": "x" * 250,
                },
            )
            log.close()
        self.assertIs(get_current_scope(), ambient_scope)
        self.assertIsNot(get_client(), log.client)
        items = [item for envelope in MemoryTransport.envelopes for item in envelope.items]
        self.assertEqual([item.type for item in items], ["log"])
        payload = items[0].payload.json["items"][0]
        self.assertEqual(payload["level"], "error")
        self.assertRegex(payload["trace_id"], r"^[0-9a-f]{32}$")
        self.assertNotEqual(payload["trace_id"], "a" * 32)
        self.assertIsNone(payload.get("span_id"))
        attrs = payload["attributes"]
        self.assertEqual(attrs["plugin_id"]["value"], "ngs-analysis-workbench")
        self.assertEqual(attrs["component"]["value"], "ngs-compute")
        self.assertEqual(attrs["errorCode"]["value"], "TEST")
        self.assertEqual(len(attrs["errorName"]["value"]), 200)
        for key in ["path", "private_path", "server.address", "user.email"]:
            self.assertNotIn(key, attrs)

    def test_default_override_and_disabled_configuration(self) -> None:
        with patch.dict("os.environ", {"ROSALIND_SENTRY_ENABLED": "1"}, clear=True):
            log = SentryServerLogger("ngs-app", "test", transport=MemoryTransport)
            self.assertEqual(log.client.options["dsn"], DEFAULT_DSN)
            log.close()
        override = "https://public@o0.ingest.sentry.io/123"
        with patch.dict("os.environ", {"ROSALIND_SENTRY_DSN": override}, clear=True):
            log = SentryServerLogger("ngs-app", "test", transport=MemoryTransport)
            self.assertEqual(log.client.options["dsn"], override)
            log.close()
        for dsn in [
            "",
            "invalid",
            "http://public@host/123",
            "https://public:secret@host/123",
        ]:
            log = SentryServerLogger("ngs-app", "test", dsn=dsn, transport=MemoryTransport)
            self.assertIsNone(log.client)
        with patch.dict("os.environ", {"ROSALIND_SENTRY_ENABLED": "0"}, clear=True):
            self.assertIsNone(SentryServerLogger("ngs-app", "test").client)

    def test_telemetry_failures_are_contained_and_close_is_bounded(self) -> None:
        log = SentryServerLogger("ngs-app", "test", enabled=True, transport=MemoryTransport)
        with patch("rosalind_logging.logger.error", side_effect=RuntimeError("unavailable")):
            log.error("Synthetic failure")
        client = log.client
        with patch.object(client, "close", side_effect=RuntimeError("unavailable")) as close:
            log.close()
            close.assert_called_once_with(timeout=2)
        client.close(timeout=0)

    def test_no_automatic_integrations_or_error_events(self) -> None:
        log = SentryServerLogger("ngs-app", "test", enabled=True, transport=MemoryTransport)
        self.assertEqual(log.client.integrations, {})
        log.client.capture_event({"message": "private failure"})
        log.close()
        self.assertEqual(MemoryTransport.envelopes, [])

    def test_mcp_tool_failure_preserves_response_and_logs_safe_metadata(self) -> None:
        server = LoggedFastMCP("ngs-app")
        server.server_logger = Mock()

        @server.tool()
        def failing_tool() -> str:
            raise ValueError("secret /private/sample.fastq")

        @server.tool()
        def success_tool() -> str:
            return "ok"

        asyncio.run(server.call_tool("success_tool", {}))
        server.server_logger.error.assert_not_called()
        with self.assertRaisesRegex(Exception, "secret /private/sample.fastq"):
            asyncio.run(server.call_tool("failing_tool", {}))
        server.server_logger.error.assert_called_once_with(
            "MCP tool request failed", {"errorCode": "TOOL_FAILED"}
        )

    def test_mcp_resource_and_server_failures_flush(self) -> None:
        server = LoggedFastMCP("ngs-app")
        server.server_logger = Mock()
        with self.assertRaises(Exception):
            asyncio.run(server.read_resource("test://missing"))
        server.server_logger.error.assert_called_once_with(
            "MCP resource request failed", {"errorCode": "RESOURCE_FAILED"}
        )
        server.server_logger.reset_mock()
        with patch.object(server, "run", side_effect=RuntimeError("private details")):
            with self.assertRaises(RuntimeError):
                server.run_logged()
        server.server_logger.error.assert_called_once_with(
            "MCP server failed", {"errorCode": "SERVER_FAILED"}
        )
        server.server_logger.close.assert_called_once()
