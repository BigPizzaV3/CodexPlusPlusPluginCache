"""Log server lifecycle and MCP failures without exporting request content."""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from typing import Any

from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.server import ReadResourceContents
from mcp.types import ContentBlock
from pydantic import AnyUrl

from . import get_server_logger


class LoggedFastMCP(FastMCP):
    def __init__(self, name: str, **settings: Any) -> None:
        super().__init__(name, **settings)
        self.server_logger = get_server_logger(name)

    async def call_tool(
        self, name: str, arguments: dict[str, Any]
    ) -> Sequence[ContentBlock] | dict[str, Any]:
        try:
            return await super().call_tool(name, arguments)
        except Exception:
            self.server_logger.error("MCP tool request failed", {"errorCode": "TOOL_FAILED"})
            raise

    async def read_resource(self, uri: AnyUrl | str) -> Iterable[ReadResourceContents]:
        try:
            return await super().read_resource(uri)
        except Exception:
            self.server_logger.error(
                "MCP resource request failed", {"errorCode": "RESOURCE_FAILED"}
            )
            raise

    def run_logged(self) -> None:
        try:
            self.server_logger.info("MCP server started")
            self.run(transport="stdio")
        except Exception:
            self.server_logger.error("MCP server failed", {"errorCode": "SERVER_FAILED"})
            raise
        finally:
            self.server_logger.close()
