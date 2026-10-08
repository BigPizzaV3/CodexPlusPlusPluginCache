# Runtime: native vs polyfill

## Feature detection (always)

```js
export function getModelContext() {
  if (typeof document !== "undefined" && document.modelContext) {
    return document.modelContext;
  }
  if (typeof navigator !== "undefined" && navigator.modelContext) {
    return navigator.modelContext; // deprecated fallback
  }
  return null;
}

export function canRegisterWebMCP() {
  const mc = getModelContext();
  return Boolean(mc && typeof mc.registerTool === "function");
}
```

If `canRegisterWebMCP()` is false, **do not throw** during app boot. Log once and
skip registration so the human UI still works.

## Native WebMCP

- Spec attribute: `document.modelContext` (secure context)
- Chrome: origin trial / early preview; check current Chrome docs for flags
- Prefer native when the user’s agent browser already implements the API

## Polyfill (dev + broader browsers)

When you need `registerTool` without native support:

```bash
npm install @mcp-b/webmcp-polyfill
```

Init **once**, before any tool registration (e.g. top of `main.tsx`):

```ts
import { initializeWebMCPPolyfill } from "@mcp-b/webmcp-polyfill";

initializeWebMCPPolyfill();
```

Alternatives in the MCP-B family: `@mcp-b/global` (broader runtime). Prefer the
smallest package that gives you `document.modelContext.registerTool`.

## What not to do

- Do not rely on `navigator.modelContext` alone in new code
- Do not call removed APIs: `unregisterTool()`, `provideContext()`, `clearContext()`
- Do not load the polyfill from a random CDN in production without pinning

## Permissions / iframes

Cross-origin iframes need the parent to delegate:

```html
<iframe src="https://widget.example" allow="tools"></iframe>
```

Child registration may pass:

```js
await mc.registerTool(tool, {
  signal: controller.signal,
  exposedTo: ["https://parent.example"],
});
```

Only potentially trustworthy (secure) origins are valid in `exposedTo` /
`fromOrigins`.
