# Appllama public contract

This is a local record of the supplied public-source packet. It is documentation
for evidence handling, not a live MCP connection. Snapshot: 2026-09-15. Public
skills repository commit: `dd5caaec3d5d50ad7fc0324da238119c6b7c3707`.

## Documented surface

- Published HTTP MCP endpoint: `https://mcp.appllama.io/mcp`.
- The `appllama-usage` v1.1.0 tool map names `get_credits`, `search_apps`,
  `get_app`, `list_app_screens`, `search_screens`, `get_screen`, `list_flows`,
  `get_flow_apps`, `list_ui_elements`, `get_element_screens`, `list_my_boards`,
  and `get_board`.
- List results expose `next_cursor`; pagination is sequential and tied to the
  original query. Invalid or expired cursors require a new first page.
- Media URLs expire in about one hour. Screen IDs are durable and can be used to
  request fresh media. Images and videos carry a provenance watermark.
- The public skills are MIT licensed. The Appllama name, llama, and logo remain
  Antmind Ventures trademarks. Pricing and credit limits are service terms, not
  plugin capabilities.

## Unknown until entitled runtime verification

Do not invent exact JSON schemas, field nullability, authentication or token
formats, HTTP status and error bodies, rate-limit headers or quotas, semantic
ranking, board permissions, or media MIME and resolution guarantees. The local
packet does not prove any of those details and does not prove that current tool
names or arguments still match the snapshot.

## Confirmed unauthenticated boundary

The supplied 2026-09-15 probe recorded `GET /mcp` returning HTTP 401 with an
`invalid_token` response and a `WWW-Authenticate: Bearer` challenge stating
that authentication is required. The challenge included a resource-metadata
URL. The public resource metadata returned HTTP 200 and described the resource
as `https://mcp.appllama.io/mcp`, authorization server
`https://mcp.appllama.io/`, the `appllama` scope, and the `header` bearer method.
These observations confirm an unauthenticated boundary and public OAuth
metadata only. They do not prove an authenticated tool call, entitlement, or
any JSON schema. No credentials were used.

## Local release boundary

The released App Design Research skill does not call this endpoint, fetch the
site, call `get_credits`, spend credits, harvest the catalog, bypass a paywall,
or hammer rate limits. It does not require an API key or server. A user may
supply an entitled export, screen metadata, or screenshot as review evidence;
record its provenance and freshness, preserve stable IDs, and extract patterns
instead of copying the screen. Do not include supplied screens, datasets,
watermarks, logos, or private browser output in this plugin bundle.

Keep this documented MCP surface separate from an unknown private backend. Never
claim a live MCP integration, entitlement, directory approval, or runtime result
from this file. The supplied case packet and unauthenticated probe records remain
outside this plugin bundle.

## Source links

- [Appllama public skills README](https://github.com/Appllama/appllama-skills/tree/dd5caaec3d5d50ad7fc0324da238119c6b7c3707)
- [Appllama app design skill](https://github.com/Appllama/appllama-skills/blob/dd5caaec3d5d50ad7fc0324da238119c6b7c3707/skills/appllama-app-design-skill/SKILL.md)
- [Appllama usage skill](https://github.com/Appllama/appllama-skills/blob/dd5caaec3d5d50ad7fc0324da238119c6b7c3707/skills/appllama-usage/SKILL.md)
