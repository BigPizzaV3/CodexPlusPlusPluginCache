---
name: vibe-mcp
description: "Audit, fix or verify an MCP server or client: protocol-version compatibility, tool schemas/results, transport, discovery and authorization. Use for MCP integration defects; general agent planning and RAG belong to vibe-ai."
---

# MCP servers & clients

Read [the shared workflow](../../references/workflow.md) once, then the recipe matching the user's operation. The target is an existing MCP implementation or an explicitly requested MCP contract, not installation of arbitrary servers.

| Request | Recipe |
|---|---|
| Inspect a server/client contract without edits | [MCP Server Audit](references/mcp-server-audit.md) |
| Fix or implement a named contract | [MCP Server Polish](references/mcp-server-polish.md) |
| Verify protocol, tool results or authorization | [MCP Protocol & Authorization Check](references/mcp-protocol-auth-check.md) |

The recipes share [version and trust boundaries](../../references/mcp-contract.md). Select the repository's supported SDK/protocol version before applying a rule. Do not treat an optional feature or a newer specification as an automatic migration requirement. An audit-and-fix request includes the correction and meaningful verification.

Durable application execution belongs to [Harness](../vibe-harness/SKILL.md); model tool-choice quality belongs to [AI](../vibe-ai/SKILL.md). Keep protocol compliance separate from those concerns.
