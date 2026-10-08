# Bridge — proxy an existing MCP server into WebMCP

When the site already has a remote MCP server (Streamable HTTP or SSE), reuse
the tools and paths that were designed for that server. Do not reimplement them
in the page.

[`webmcp-proxy`](https://www.npmjs.com/package/webmcp-proxy) connects to the
remote MCP server, lists tools, and registers them on `document.modelContext`
(with `navigator.modelContext` fallback). That is the **fast first patch**:
browsing agents see the MCP tools via WebMCP after a small front-end change.

## Say this to the user before shipping

- **Speed:** install, point at the MCP URL, deploy — no per-tool `execute`.
- **No visual feedback:** calls go to the MCP server. The page does not fill
  forms, highlight controls, or walk a tunnel unless you add **Imperative** later.
- **Credentials:** if the MCP server uses the **same OAuth client** as the
  webapp, the browser session / tokens can authorize `tools/call` without a
  second login. Confirm the client id, token storage (cookie vs memory), and
  whether the MCP origin allows CORS from this site.
- **CORS:** the MCP endpoint must allow the page origin. The proxy runs in the
  browser.

## Package

```bash
npm install webmcp-proxy
```

### Vanilla

```ts
import { createWebMcpProxy } from "webmcp-proxy";

const proxy = await createWebMcpProxy({
  url: "https://mcp.example.com/mcp",
  // headers: { Authorization: "Bearer …" }, // only if not using cookie/session
});

// proxy.tools — descriptors that were registered
// await proxy.disconnect() — cleanup
```

### React

```tsx
import { WebMCPProxy } from "webmcp-proxy/react";

export function App() {
  return (
    <>
      <WebMCPProxy url="https://mcp.example.com/mcp" />
      {/* app */}
    </>
  );
}
```

### Vue

```vue
<script setup>
import { WebMCPProxy } from "webmcp-proxy/vue";
</script>

<template>
  <WebMCPProxy url="https://mcp.example.com/mcp" />
</template>
```

## Auth / same OAuth client

1. Ask how the webapp stores the access token (httpOnly cookie, in-memory,
   localStorage).
2. If MCP and webapp share the OAuth client:
   - Cookie session to the MCP origin: often no `headers` — cookies send if
     CORS + `credentials` allow it. Confirm the package/docs if you must pass
     a fetch wrapper.
   - Bearer in memory: pass `headers` from the same token the SPA already has.
3. If they do **not** share a client, do not invent a silent second OAuth
   flow in this patch — flag it and ask how they want agents to authenticate.
4. Never paste long-lived secrets into front-end source.

## Coexistence

Proxy tools use `registerTool`. Page-local **Imperative** tools can sit beside them
if names do not collide. Unregister via `proxy.disconnect()` / component
unmount (`AbortSignal`).

Chrome 153+: `execute(input, { signal })` is forwarded to remote `tools/call`.

## Requirements

- Remote MCP: Streamable HTTP or SSE
- CORS from the website origin
- WebMCP native or polyfill; if missing, proxy is a no-op (human site still works)

Still dogfood with Chrome DevTools MCP after wiring. Expect **results without
DOM changes**.
