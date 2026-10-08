# Strategies: which paths to expose

Do **not** start coding until the user has picked a strategy (or mix) and a
curated path list. Mix is allowed — e.g. **Bridge** the existing MCP server for
breadth, then add 1–2 **Imperative** tools for the money path.

Present options as **Declarative vs Imperative vs Bridge**.

## Declarative — expose existing forms as tools

**Focus:** add missing WebMCP meta on existing `<form>` DOM so the browser
exposes each form as a declarative tool. No new agent UX; humans still see the
same forms.

Use when the site already has real HTML forms (search, contact, filters,
checkout steps that are actual `<form>`s) and you want the fastest native
visual feedback (browser fills fields, `:tool-form-active`).

**Not a fit** when the “form” is a custom widget with no `<form>`, or when a
multi-step tunnel should collapse into one agent call (use **Imperative**).

Implementation: [declarative-forms.md](declarative-forms.md).

## Imperative — craft dedicated paths

**Focus:** unlike **Declarative** tools (via form), `registerTool` is how you
give an AI browsing agent a *real path* — a packaged scenario, not a 1:1 map
of today’s UI.

Requires a planning pass with the user:

1. Which scenarios deserve a tool (outcomes, not clicks)?
2. What is the **input** (schema the agent must supply)?
3. What is the **outcome** on UI and app state (navigate where, what the human
   sees, what is persisted)?

Example: a 4-step checkout tunnel can be one WebMCP tool registered on step 1
that fills everything and redirects straight to the last step (review / pay),
instead of four form tools the agent must chain.

Use when the agent should complete a job that humans currently do as several
screens, or when you need `execute` to call app APIs, update stores, and then
change the route.

Implementation: [tool-design.md](tool-design.md) + [frameworks.md](frameworks.md).

## Bridge — expose an existing MCP server (`webmcp-proxy`)

**Focus:** reuse the work already spent designing and shipping a remote MCP
server — the right functionalities and paths already exist. `webmcp-proxy` is a
fast first patch: it lists remote tools and registers them on
`document.modelContext` so any AI browsing agent can call them via WebMCP.

Trade-offs (say these out loud to the user):

- **Fast to deploy** — install, point at the MCP URL, ship.
- **No in-page visual feedback** — tools execute against the MCP server; the DOM
  does not fill, highlight, or navigate the way Declarative / Imperative tools can.
- **Credentials** — if the MCP server uses the **same OAuth client** as the
  webapp, the proxy can ride the user’s existing browser session / tokens instead
  of inventing a second auth path. Confirm this with the user before wiring
  headers.

Use when they already have Streamable HTTP or SSE MCP in production (or staging)
and want browsing agents to see those tools on the site.

Implementation: [proxy-existing-mcp.md](proxy-existing-mcp.md).

## Mixing strategies

| Mix | Typical reason |
| --- | --- |
| Bridge then Imperative | Proxy for coverage; hand-craft 1–2 high-value paths with UI |
| Declarative then Imperative | Annotate leftover simple forms; collapse tunnels into dedicated tools |
| Bridge + Declarative | MCP tools for product actions; page forms for marketing/contact |
| All three | Only if the user explicitly wants it — keep the first ship small |

Never register overlapping tools for the same job (Bridge `create_order` *and*
an Imperative `create_order` *and* a checkout form tool).
