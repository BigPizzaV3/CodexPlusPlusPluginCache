# MCP contract boundaries

Use only the sections relevant to the selected server/client and requested operation. Record the installed SDK, supported protocol revisions, transport and enabled extensions before judging conformance. A newer specification does not by itself require a migration.

## Version and transport

- Separate compatibility branches. The `2025-11-25` protocol uses initialization; Streamable HTTP sessions are optional. The `2026-07-28` core uses self-contained requests and per-request capabilities; its Streamable HTTP transport has no protocol session or GET stream endpoint. Do not require legacy initialization/session headers on a newer implementation or remove compatibility needed by an older client.
- Check framing, request IDs, notifications and result envelopes against the implemented revision. On stdio, diagnostics belong on stderr, not the JSON-RPC stdout channel.
- On HTTP, follow the supported JSON/SSE response forms, status codes and origin validation. For `2026-07-28`, compare required routing/version headers with their body fields; a successful HTTP status alone does not prove protocol success.
- Cancellation and reconnect are version/transport-specific. An interrupted response does not prove an external mutation was rolled back. Identify the downstream operation before retrying; protocol request IDs are not business idempotency keys.

## Discovery and execution

Trace one advertised tool from discovery through argument validation, authorization, handler, downstream effect and serialized result. Check pagination and the implemented discovery cache/change mechanism. A tool list is not a substitute for call-time access control.

Validate results against declared schemas, including `structuredContent` when an `outputSchema` is advertised. Distinguish JSON-RPC/protocol errors, authentication failures and tool execution errors; a tool result marked `isError` must not be presented as success. Use the selected revision's result discriminator and schema rules, not examples from a different SDK major version.

Annotations describe behavior; they do not grant authority. Read-only/destructive/idempotency claims must match reachable handler effects. Resource contents and tool outputs remain untrusted data. Optional Tasks, Apps, sampling or elicitation support must be evidenced and negotiated before use; installing an MCP server does not imply these features are supported.

## HTTP authorization

Identify the protected resource, trusted authorization server, token audience and required scopes. Check discovery and challenges against the implemented authorization revision. Validate token issuer/audience/expiry and operation-level permissions; do not forward an inbound access token to an unrelated upstream API. Use the server-side principal to scope data, rather than accepting a tenant/user identifier from model arguments as authority.

Test unavailable credentials, expired/wrong-audience tokens and insufficient scope separately. Keep step-up/retry bounded, and preserve existing user-granted permissions when the protocol calls for a scope union. Do not require HTTP OAuth for stdio or for a deliberately public, non-sensitive tool.

## References

Use version-matched sections of the [MCP specification](https://modelcontextprotocol.io/specification/2026-07-28), [Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http), [tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools) and [authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization). For a legacy implementation, select its recorded revision before applying these rules.
