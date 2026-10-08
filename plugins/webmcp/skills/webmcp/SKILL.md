---
name: webmcp
description: >-
  Make a website usable by in-browser AI agents with WebMCP. Plan which paths
  to expose, then ship them as declarative form annotations, dedicated
  imperative tools, or a bridge to an existing MCP server. Use when the user
  mentions WebMCP, document.modelContext, navigator.modelContext, registerTool,
  webmcp-proxy, or browser agents.
---

# WebMCP — make a website agent-compatible

WebMCP lets a **page** register tools that in-browser AI agents can call. It is
**not** a remote MCP server and **not** an MCP App / ChatGPT widget.

Canonical surface: `document.modelContext.registerTool(...)`.
Fallback (deprecated): `navigator.modelContext`.
Declarative surface: HTML `<form>` attributes (`toolname`, `tooldescription`).

## When this skill applies

- User asks to make a site / app **WebMCP compatible**
- Mentions `document.modelContext`, `navigator.modelContext`, `registerTool`,
  `webmcp-proxy`, or declarative form tools
- Wants browser agents to use page actions without DOM scraping

**Do not use this skill** for building remote MCP servers, ChatGPT/Claude MCP
Apps, or Skybridge UIs.

## Workflow (follow in order)

Copy and track:

```
WebMCP Progress:
- [ ] 1. Design: inventory + strategy + paths (stop for user agreement)
- [ ] 2. Wire runtime (native / polyfill) if the chosen strategy needs JS
- [ ] 3. Implement the agreed strategy (Declarative / Imperative / Bridge)
- [ ] 4. Dogfood with Chrome DevTools MCP
- [ ] 5. Harden (security, lifecycle, errors)
```

**Do not implement until step 1 is agreed.** Path choice is a product decision.

### 1. Design — UX paths worth exposing

Read [references/strategies.md](references/strategies.md) first.

Talk to the user. Propose; do not assume. Goal: a **short list of paths** and
**which strategy** ships each one.

1. Find the browser entry (HTML shell, `main.tsx`, router root) and stack
   (vanilla / React-Next / Vue / other). If several apps exist, ask which one
   first.
2. Inventory, then **ask**:
   - What jobs should a browsing agent complete on this site?
   - Are there existing HTML `<form>`s that should become tools as-is?
   - Is there already a remote MCP server with the right tools/paths?
   - Which human tunnels (checkout, onboarding, booking) should collapse into
     one agent tool instead of step-by-step forms?
3. Present **Declarative vs Imperative vs Bridge** (mix OK; first ship should
   stay small). Use the user’s domain in the examples.

**Declarative — expose existing forms as tools.** Add missing WebMCP meta on
existing form DOM (`toolname`, `tooldescription`, `toolparamdescription`,
optional `toolautosubmit`) so each form is a declarative tool. Fast, visual
(browser fills the form). See [references/declarative-forms.md](references/declarative-forms.md).

**Imperative — craft dedicated paths.** Unlike Declarative tools (via form),
`registerTool` packages a real agent path. Example: a 4-step checkout tunnel as
**one** tool from step 1 that fills everything and redirects to the last step.
Plan with the user: which scenarios, what **input**, what **UI/state outcome**.
See [references/tool-design.md](references/tool-design.md).

**Bridge — expose an existing MCP server.** Reuse the tools and paths already
designed for a shipped MCP server. `webmcp-proxy` is a fast first patch that
registers those tools on WebMCP for any AI browsing agent. It **lacks visual
feedback** in the browser. It **can leverage existing webapp credentials** if
the MCP server uses the **same OAuth client**. See
[references/proxy-existing-mcp.md](references/proxy-existing-mcp.md).

4. Write back a proposal and wait for a yes / edits:

```
Proposed WebMCP paths:
- [strategy] path — input → UI/state outcome
- …
Out of scope this round: …
```

5. Only then implement. If the user is unsure, recommend: **Bridge** if an MCP
   server already exists; **Declarative** if the site is form-heavy;
   **Imperative** for the one high-value tunnel they care about.

### 2. Wire the runtime

Skip a polyfill for **Declarative only** if you are not registering JS tools.
Imperative and Bridge need `document.modelContext` (native or polyfill).

```js
function getModelContext() {
  return document.modelContext ?? navigator.modelContext ?? null;
}
```

| Situation | What to do |
| --- | --- |
| Target browsers with native WebMCP | Feature-detect; graceful no-op if missing |
| Need tools without native support | `@mcp-b/webmcp-polyfill` (or `@mcp-b/global`) **before** register/proxy |
| Bridge (existing MCP HTTP/SSE) | `webmcp-proxy` — do not reimplement each tool |

Secure context (HTTPS or localhost) is required.
Details: [references/runtime.md](references/runtime.md).

### 3. Implement the agreed strategy

#### Declarative

Patch templates/components: attributes only, plus optional `respondWith` if the
agent should get a structured result. Do not rewrite forms into JS tools unless
the user switched to Imperative.

#### Imperative

Default = **imperative API**. Snippets:
[references/frameworks.md](references/frameworks.md).

```js
const mc = document.modelContext ?? navigator.modelContext;
if (!mc?.registerTool) {
  // Browser has no WebMCP — leave human UI working; skip registration.
} else {
  const controller = new AbortController();

  await mc.registerTool(
    {
      name: "search_docs",
      title: "Search docs",
      description:
        "Search published documentation by keyword and return up to five matches.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Topic or phrase to search for.",
          },
        },
        required: ["query"],
      },
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: false,
      },
      async execute({ query }, { signal }) {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { signal },
        );
        if (!res.ok) {
          throw new Error(`Search failed (${res.status}). Retry with a shorter query.`);
        }
        const hits = await res.json();
        return { matches: hits.slice(0, 5) };
      },
    },
    { signal: controller.signal },
  );
}
```

Hard requirements for imperative tools:

1. Feature-detect before `registerTool`
2. Pass `{ signal }` on registration for cleanup
3. Honor `execute`’s `{ signal }` for fetch / long work
4. Set `annotations.readOnlyHint` accurately
5. Set `untrustedContentHint: true` when return data comes from users / third parties
6. Never embed agent instructions in `description` or return payloads
7. Names: ASCII `[a-zA-Z0-9_.-]`, length 1–128; one tool = one agreed path

#### Bridge

Install `webmcp-proxy`, point it at the MCP URL, confirm CORS and OAuth. Do not
hand-wrap each remote tool.
See [references/proxy-existing-mcp.md](references/proxy-existing-mcp.md).

### 4. Dogfood (mandatory)

Do **not** call the work done until tools are exercised as an agent would.

With **Chrome DevTools MCP** (Chrome Dev 145+ / Canary preferred):

1. Open the page (`navigate_page` / existing tab)
2. `list_webmcp_tools` — confirm names match the agreed proposal
3. `execute_webmcp_tool` with `toolName` + JSON `input` string for each tool
4. Declarative: confirm fields fill and UI highlight. Bridge: confirm MCP
   result (no DOM fill expected). Imperative: confirm UI/state outcome from
   the proposal.
5. Fix and re-run

If DevTools MCP isn’t available, use page console:

```js
const tools = await document.modelContext.getTools();
console.table(tools.map(t => ({ name: t.name, description: t.description })));
```

Checklist: [references/verify.md](references/verify.md).

### 5. Harden

- Destructive tools: confirm in UI or require explicit params
- Auth: tools inherit the user’s cookies/session — scope to what the signed-in
  user may do (Bridge: same OAuth client as the webapp when applicable)
- Cross-origin iframes: parent needs `allow="tools"`; child tools use
  `exposedTo: ['https://parent.origin']` when sharing
- Avoid returning secrets, raw PII dumps, or HTML that could prompt-inject

More: [references/security.md](references/security.md).

## Decision tree

```
Need WebMCP on this site?
│
├─ Ping-pong paths with the user first (never skip)
│
├─ Existing HTML forms that should stay forms?
│    → Declarative: toolname / tooldescription
│
├─ Packaged agent scenario (tunnels, store updates, redirects)?
│    → Imperative: registerTool
│
└─ Existing remote MCP tools to reuse on the page?
     → Bridge: webmcp-proxy
```

## Sources of truth

- Spec: https://webmachinelearning.github.io/webmcp/
- Chrome imperative API: https://developer.chrome.com/docs/ai/webmcp/imperative-api
- Chrome declarative API: https://developer.chrome.com/docs/ai/webmcp/declarative-api
- Chrome best practices: https://developer.chrome.com/docs/ai/webmcp/best-practices
- webmcp-proxy: https://www.npmjs.com/package/webmcp-proxy

## Anti-patterns

- Implementing before the user agrees on strategy and paths
- Building a **server** MCP transport when the user asked for **page** tools
- Reimplementing an existing MCP server in page JS instead of `webmcp-proxy`
- Registering overlapping tools for the same job across Declarative / Imperative / Bridge
- Using `navigator.modelContext` alone with no `document.modelContext` prefer
- Calling `unregisterTool()` (removed) instead of aborting the registration signal
- Returning DOM nodes / functions / circular structures from `execute`
- Skipping DevTools dogfood because “it compiles”
