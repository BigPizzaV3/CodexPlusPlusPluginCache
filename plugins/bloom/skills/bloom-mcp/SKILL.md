---
name: bloom-mcp
description: Use when the user asks to inspect, discuss, or change work on a Bloom canvas. Connect to Bloom MCP and read its current authoring guidance before writing.
---

# Bloom MCP

Connect to `https://api.bloom.diy/mcp` with browser OAuth. The Bloom account must have Canvas
access. Never ask the user to paste credentials or authorization codes into chat.

Call `whoami` to verify the connected account. Before the first canvas write in each session, call
`skills({ name: "bloom-mcp" })` and follow the guidance returned by the live server. Use the tool
schemas and permissions exposed by the server; do not assume a bundled tool list is current.

If the server or its `skills` tool is unavailable, stop before writing and point the user to
https://docs.bloom.diy/connect-bloom-mcp.
