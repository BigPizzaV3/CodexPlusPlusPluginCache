---
name: heytraders-browser
description: Operate supported research and simulation workflows in the HeyTraders web app through its page-defined heytraders_cli WebMCP tool. Use when the user asks to open, navigate, inspect, or manipulate HeyTraders charts; check HeyTraders login; work with indicators, drawings, panes, OHLCV, market research, backtests, portfolios, or simulated paper strategies; or explicitly invokes the HeyTraders Codex plugin.
---

# HeyTraders Browser

Use the Codex in-app Browser and the live page's generic HeyTraders request router. Prefer the page-defined `heytraders_cli` WebMCP tool. When the selected Browser runtime does not advertise WebMCP, use this skill's bundled CLI adapter; both transports call the same `window.__bridge.request` entrypoint. The live webpage owns the command contract; this public skill owns the narrower research, backtesting, and simulated-paper workflow.

## Required workflow

1. Read and follow the bundled Browser control skill before browser work.
2. Reuse the user's existing in-app-browser tab when it is on the canonical `https://hey-traders.com` origin, keeping its current workspace URL. When opening a new product or sign-in tab, use `https://hey-traders.com/?ht_client=codex`. Do not reload or navigate an existing tab just to add the marker. The bundled adapter accepts only this origin.
3. Inspect the tab's advertised capabilities.
   - If `webmcp` is available, fetch its tools and call only the listed `heytraders_cli` tool.
   - If `webmcp` is absent, import `scripts/heytraders-cli.mjs` with its absolute installed path, create one CLI handle with `createHeyTradersCli(tab)`, and reuse `cli.call(command, args)`.
4. Execute a known in-scope command directly when its current live contract is already available in this task. Otherwise use `help list` to discover command families and `help describe <command>` to obtain the selected command's schema. Discovery does not expand the public scope below. Refresh discovery after schema errors or a changed page contract; a new help/describe round trip is not required before every call.
5. Put the selector-only canonical command in `command` and all operands in `args`. Build arguments from the live schema; do not repeat operands positionally or wrap args in `params` or `payload`. A field named `payload` is valid only when that command's schema declares it. Follow deeper domain discovery only when the live result calls for it. Do not preload or reproduce live contracts in prompt text.
6. After SPA navigation, fetch WebMCP tools again if a previous tool handle becomes stale.

## Hard boundaries

- Never call individual `window.__bridge` members, inspect the bridge object ad hoc, or hand-write page-evaluation bridge code. The bundled adapter is the only non-WebMCP transport and calls only the generic request entrypoint.
- Never substitute the OS shell `heytraders-cli`, standalone Playwright, or a second browser session for the selected Codex in-app-browser tab.
- Never read or expose credentials, cookies, tokens, localStorage, or sessionStorage.
- Never type login credentials. Login is always a user handoff.
- The `ht_client=codex` entry marker is a client-declared acquisition hint. It never grants analytics consent, proves identity, or changes command authorization. The application owns consent and account attribution; do not add UTMs or issue extra commands to attribute an already-open tab.
- Do not invent route IDs, docs slugs, indicator IDs, drawing types, pane IDs, container IDs, or chart actions. Discover them from live results.
- The public plugin is limited to navigation, documentation, read-only market and account information, chart operations, backtests, and simulated paper strategies.
- Never use a command to place, modify, cancel, or monitor a real order; operate a strategy in live mode; connect or configure an exchange, venue, or wallet; or manage exchange credentials or permissions. Do not navigate to or operate those transaction flows. If a user requests one, explain that it is unavailable through the public plugin and stop that workflow.
- Treat excluded commands returned by `help list`, `help describe`, or any deeper discovery result as unavailable. Do not retrieve their detailed schemas or call them. A mixed-mode strategy command may be described and used only when its contract requires an explicit mode and the request can be fixed to `paper`; its historical command name does not authorize live mode.
- Treat chart mutations, backtests, and simulated-paper starts or stops as explicit operations. Do not combine unrelated mutations into one call unless the user requested that exact batch.
- Keep market and portfolio analysis descriptive. Separate sourced observations from interpretation, disclose material data gaps, and leave every financial decision to the user.

## User-action handoff

When an in-scope command returns `userActionRequired` or an equivalent user-action-required state, explain the visible handoff and stop automating that action. Resume only after the user confirms completion, then rediscover or re-read the relevant state through the live catalog. Never infer that closing a dialog means the operation succeeded. Do not resume an excluded transaction or connection workflow after a handoff.

## Chart workflow

Use live `help list chart` and `help describe` to discover the current state-query, capability-discovery, and chart-action commands. Read the current state before choosing target identifiers, execute only a described in-scope action, then re-read state and visible UI.

Raw Pine source is intentionally absent when the live capability registry marks it unsupported. Do not bypass that restriction.

## Backtest and paper operations

For backtests and simulated-paper operations, use the current live command contract. Before starting or changing a paper strategy, verify from the described input contract that its mode is explicitly fixed to `paper` or `simulated` and cannot route orders to a real venue. A canonical action whose historical name contains `live` remains out of scope for every non-paper mode. Verify the returned mode again after the operation. If either side is ambiguous, do not call it.

Reuse a request identifier for a retry only when the schema explicitly accepts that identifier and the application documents its retry semantics. Never invent an identifier field or reuse an identifier with different input. After a lost response or unknown outcome, inspect the backtest or simulated-paper state before deciding any further action; do not automatically start it again. Follow the active Browser's rules for every allowed operation. Presentation placement, admission, and idempotency belong to the application Gateways.

## Bundled adapter

Use the adapter only when the tab does not advertise WebMCP:

```js
const { createHeyTradersCli } = await import("<absolute installed skill path>/scripts/heytraders-cli.mjs");
const heytradersCli = await createHeyTradersCli(tab);
await heytradersCli.call("help list");
```

The adapter requires a numeric safe-integer facade version of 7 or newer, with domain-prefixed command selectors and result actions. A `heytraders-bridge-upgrade-required` result means the version is missing, invalid, or too old; do not fall back to legacy flat members. The adapter sends each call once and does not retry or promise to cancel an application operation when the Browser call stops waiting.

## References

- Read [command-reference.md](references/command-reference.md) for CLI wrapper syntax.
- Read [runtime-contract.md](references/runtime-contract.md) when diagnosing readiness, login, or navigation.
