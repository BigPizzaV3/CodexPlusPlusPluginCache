"""Console entrypoint for the NGS App MCP server."""

from .app import mcp


def main() -> None:
    mcp.run_logged()


if __name__ == "__main__":
    main()
