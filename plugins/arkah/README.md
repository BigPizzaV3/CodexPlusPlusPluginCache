# Arkah assistant integrations

**Visualize and challenge your ideas.** Arkah turns ideas, plans and decisions into boards of readable notes, tables, charts and visual panels. These integrations bring your boards into your assistant: find and read existing boards, review a brief, then build a new board and follow its progress.

Published by Arkah / Hubble LLC. This repository contains the MIT-licensed plugin packages, workflow instructions and branding assets; it does not contain the hosted application's source or credentials. Directory approval and availability are separate from this public repository. No platform endorsement is implied.

Connect a compatible remote MCP client to `https://arkah.io/mcp` using OAuth. Start read-only. Log in to Arkah in the browser and review the client identity and requested permissions. Client-provided names are not verified publisher identities. Creation requires separate permission and consumes normal Arkah credits, including preparation; normal plan limits still apply.

OpenAI's portable package is `openai/arkah` (`plugin.json`, `mcp.json`, `skills/`), with a Codex compatibility overlay. Claude's package is `claude/arkah` (`.claude-plugin/plugin.json`, `.mcp.json`, `skills/`). This root contains both OpenAI (`.agents/plugins/marketplace.json`) and Claude (`.claude-plugin/marketplace.json`) local marketplace catalogs; paths resolve from this root, not from the hidden manifest directory.

## Connect

For ChatGPT and Claude Chat, add a custom remote MCP connection with the URL above. In Codex, choose Streamable HTTP in the custom MCP setup, or run `codex mcp add arkah --url https://arkah.io/mcp` and `codex mcp login arkah --scopes boards:read`. Claude Code can use `claude mcp add --transport http arkah https://arkah.io/mcp`, then `/mcp` to authenticate. Never paste an Arkah browser cookie, API key or password into MCP headers.

To install the Claude Code plugin, use `/plugin marketplace add Arkah-io/arkah-plugins`, then `/plugin install arkah@arkah`. For Codex, add this repository as a plugin marketplace and choose Arkah. Avoid installing a duplicate MCP connection if you already use the manual connection. Regular Claude Chat uses its remote connector, not the Claude Code CLI installation.

Start with: “List my recent Arkah boards. Do not prepare a brief or create anything.” Then ask to read or show a board. Staging connections are separate and do not transfer to this production endpoint.

ChatGPT's registered MCP integration ID and public directory submission are separate platform setup steps; no made-up ID is included. Claude's hosted connector and plugin directory review are also separate. There is no local server binary or desktop-extension bundle. MCP Apps support varies by client; text tools and Arkah links do not depend on it.

Read all currently owned boards, including future boards; search titles/descriptions, not full content. Prepare/revise a brief, approve its exact revision, build once, check progress, or stop a build started by that client. Explicit defaults still pass through preparation. Web research is opt-in. Existing-board editing/deletion/publishing, shared workspaces, Project/file selection, Deep Research and outbound MCP are not exposed.

Generation is durable: closing a chat does not cancel it. Open Arkah or poll progress; the integration does not promise an unsolicited completion message in the assistant chat. Failures and cancellations retain recovery links and never trigger an automatic rebuild.

Connections expire after 30 days from authorization, even when actively used; reconnect to renew access. Ordinary Arkah sign-out does not disconnect assistants. Account security revocation or disabling the account ends access immediately.

Disconnect at **Arkah Settings → Connected apps**. Future calls and private panel delivery are blocked. Already accepted builds continue. Data returned to a host may have been retained by that host and cannot be recalled by revocation. Refer to that host's privacy policy as well as [Arkah privacy](https://arkah.io/privacy).

The hosted workflow has been exercised in Codex, ChatGPT and Claude Chat on web/macOS. Claude Code package installation is validated; its authenticated end-to-end workflow remains separately unverified. Rendering and permission prompts vary by host. If a host cannot render the viewer, use the returned text and Open in Arkah link.

## Support

For connection, permission, viewer or build problems, email [support@arkah.io](mailto:support@arkah.io). Include the assistant name, the action you attempted and the error message. Do not include passwords, access tokens or private board contents in a public issue. You can disconnect an assistant from Arkah Settings → Connected apps.

Connection details: [Arkah integrations](https://arkah.io/integrations). [Terms](https://arkah.io/terms) and [Privacy](https://arkah.io/privacy) govern the hosted service. The package license does not grant trademark rights or access to paid services.

Packaging references: [OpenAI plugins](https://developers.openai.com/plugins/build/plugins), [Claude plugin reference](https://code.claude.com/docs/en/plugins-reference).
