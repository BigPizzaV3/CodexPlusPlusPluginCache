---
name: surfer-connect
description: >-
  Use when Surfer MCP tools are unavailable or the user asks to connect, install, or set up Surfer
  in their AI assistant. Triggers include "connect the Surfer MCP server", "add Surfer to this
  client", "install Surfer MCP", and "how do I sign in to Surfer". It follows the current client
  setup guide, verifies the connection, and returns to the interrupted surfer-* workflow.
license: MIT
---

# Surfer: Connect MCP

Connect Surfer MCP in the current client, verify it, and return to the interrupted workflow.

## MCP setup

Use the [Surfer MCP overview](https://devs.surferseo.com/mcp/overview) and
[quickstart](https://devs.surferseo.com/mcp/quickstart) as the source of truth for requirements.
Detect the current client and read its guide before configuring it; ask which client only when
it cannot be determined. Follow that guide's current endpoint, sign-in, and verification steps.

| Client | Setup guide |
|---|---|
| Claude Code | https://devs.surferseo.com/mcp/connect/claude-code |
| Claude web or desktop | https://devs.surferseo.com/mcp/connect/claude |
| ChatGPT web | https://devs.surferseo.com/mcp/connect/chatgpt-web |
| ChatGPT desktop (Work) | https://devs.surferseo.com/mcp/connect/chatgpt-desktop |
| Codex CLI or IDE | https://devs.surferseo.com/mcp/connect/codex |
| Cursor | https://devs.surferseo.com/mcp/connect/cursor |
| VS Code | https://devs.surferseo.com/mcp/connect/vs-code |
| Other clients | https://devs.surferseo.com/mcp/connect/other |

Use the client's normal connector settings or CLI. Show a manual configuration edit before
applying it. The user completes OAuth in their browser; never request their sign-in credentials.

## Verify and return

Confirm that Surfer tools are available and `workspace__list` succeeds. Registration
alone is not success; if a restart is required, report setup as pending until the tools are usable.

For connection errors, follow [troubleshooting](https://devs.surferseo.com/mcp/troubleshooting);
for access or quota issues, consult [credits and limits](https://devs.surferseo.com/mcp/credits-and-limits).

After verification, resume the interrupted workflow. If the user only
asked to connect, report what is usable and stop.
