# Security

## What this plugin does with your API key

The plugin never stores or transmits your Ship24 API key itself. The host tool (Claude Code, Cursor, Codex,
Gemini CLI, ...) reads the `SHIP24_API_KEY` environment variable or its own secret store and sends it as an
`Authorization: Bearer` header to exactly one destination: `https://api.ship24.com/mcp`, Ship24's hosted MCP
server. Nothing in this repository calls the network: skills, the agent and the scripts contain no outbound
requests, and the webhook test receiver only listens on localhost.

Treat the key like a password: it grants access to your account's tracking data and quota. Create a dedicated
key for AI tools in the dashboard so it can be revoked on its own.

## Reporting a vulnerability

Email contact@ship24.com with "Security" in the subject, a description and reproduction steps. Do not open a
public issue for security reports. Vulnerabilities in the Ship24 API or MCP server should be reported the same
way.
