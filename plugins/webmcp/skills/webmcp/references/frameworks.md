# Framework patterns

## Vanilla / any SPA

Centralize registration in a module owned by the route or feature:

```js
export function registerSearchTool(mc, { search, signal }) {
  return mc.registerTool(
    {
      name: "search_docs",
      description: "Search docs by keyword; returns up to five matches.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search phrase" },
        },
        required: ["query"],
      },
      annotations: { readOnlyHint: true },
      async execute({ query }, { signal: execSignal }) {
        return search(query, { signal: execSignal });
      },
    },
    { signal },
  );
}
```

On route leave / teardown: `controller.abort()`.

## React / Next.js (client)

Prefer the strict-core hook package `usewebmcp` when you only need tools:

```bash
npm install usewebmcp @mcp-b/webmcp-polyfill
```

```tsx
// main.tsx — before createRoot
import { initializeWebMCPPolyfill } from "@mcp-b/webmcp-polyfill";
initializeWebMCPPolyfill();
```

```tsx
"use client";

import { useWebMCP } from "usewebmcp";

const INPUT_SCHEMA = {
  type: "object",
  properties: {
    query: { type: "string", description: "Search phrase" },
  },
  required: ["query"],
} as const;

export function DocsSearchTools({ search }: { search: (q: string) => Promise<unknown> }) {
  useWebMCP({
    name: "search_docs",
    description: "Search documentation by keyword; returns matching pages.",
    inputSchema: INPUT_SCHEMA,
    annotations: { readOnlyHint: true },
    execute: async ({ query }) => search(query),
  });

  return null; // or UI that mirrors tool state if useful
}
```

Notes:

- Only register from **client** components
- Mount tools in the layout/page where they are valid; unmount aborts registration
- For MCP-B prompts/resources/providers, use `@mcp-b/react-webmcp` instead of `usewebmcp`

## Next.js App Router

- Put polyfill init in a client entry imported from the root layout, or a tiny
  `WebMCPProvider` client component rendered once
- Do not call `registerTool` in Server Components or Route Handlers — WebMCP is
  a **document** API

## Vue

Use `onMounted` / `onBeforeUnmount` with an `AbortController`, or
`webmcp-proxy/vue` when proxying a remote MCP server.

## Angular

Chrome documents experimental Angular WebMCP integration (Signal Forms → tools).
Prefer the framework’s current docs when the app is Angular-first; otherwise use
imperative `document.modelContext.registerTool` in a service tied to DI lifecycle.

## Existing remote MCP server (Bridge)

If tools already live on an HTTP MCP endpoint, do **not** re-wrap each tool by
hand — `webmcp-proxy` is the Bridge option. See
[proxy-existing-mcp.md](proxy-existing-mcp.md).

## Existing HTML forms (Declarative)

Do not convert real `<form>`s into `registerTool` by default. Annotate them:
[declarative-forms.md](declarative-forms.md).
