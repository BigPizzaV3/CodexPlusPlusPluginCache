# PixVerse Web Handoff

All PixVerse pages opened as part of plugin work are Agent-owned Codex in-app Browser handoffs. This
includes OAuth authorization, subscription/recharge, workspace management, and Canvas. The managed
wrapper must not open Chrome, Edge, an extension browser, or the system default browser implicitly.

## Browser Contract

Use the host's top-level Computer Use browser control when it is exposed. In current Codex desktop this
is `mcp__cua_repl.js`, whose JavaScript runtime exposes `cua`. Follow the documentation returned by its
first call and select only browser id/type `iab`. PixVerse handoffs already provide the complete target
URL, so use the known-URL IAB entrypoint instead of probing global browser state first.

```js
let pixverseIabTab = await cua.createBrowserTab("iab", targetUrl, { visible: true })
```

Do not decide that browser control is unavailable by searching `ALL_TOOLS`, a nested-tools list, the
Skill list, or by counting names that contain `browser`: top-level MCP tools are not necessarily present
in those inventories. If the CUA tool is in the active tool surface, invoke it directly. Only treat the
tool as unavailable when it is actually absent from that surface or a direct invocation fails under the
bounded recovery below. If a host exposes only the legacy in-app Browser API, follow its returned
documentation and select exactly `agent.browsers.get("iab")`; do not mix legacy and CUA calls.

Do not use URL auto-selection, `getForUrl`, `getDefault`, Chrome, Edge, an extension browser, Python
`webbrowser`, or `open` for a plugin web handoff.

Treat the acquired IAB binding, the documentation already read for that binding, and the claimed exact
target tab as task-local state. Within the same turn, never reacquire the binding or reread the same
capability documentation. In later turns, reuse a valid binding only when it is already known to point
at the exact target URL; a tab from an unrelated earlier browser action is not an exact-target binding.
Reread instructions only when the host requires a new Skill activation or the binding is no longer
valid. Retention marks remain turn-scoped and must still be renewed.

The CLI handoff is declarative: returning a URL or `browser_handoff` object does not open, select, or
show a browser by itself. The Agent must execute and verify the handoff in the same turn. Creating a
new Codex task also does not perform a previous handoff automatically.

## Execute And Verify

For the exact returned target URL on current CUA:

1. If this task already has a valid `Tab` binding known to point at the exact target URL, reuse it. Do
   not reinitialize CUA or enumerate global state merely to rediscover that binding.
2. Otherwise, on the first CUA call after initialization or reset, execute exactly one known-URL entry
   call: `let pixverseIabTab = await cua.createBrowserTab("iab", targetUrl, { visible: true })`. The
   explicit `visible: true` is the initial Canvas presentation action. Do not call `cua.getState()`,
   `cua.listBrowsers()`, `cua.getBrowser()`, or `cua.listTabs()` as a pre-open availability probe.
3. Keep the returned `Tab` binding as task-local state. Use `tab.markHandoff()` when browser automation
   must continue in a later turn; otherwise use `tab.markDeliverable()`. Re-mark it in every later turn
   that still needs retention because marks are turn-scoped.
4. Verify the bound tab's current accessibility state, then use
   `cua.listTabs({ browser: "iab" })` to verify the exact URL. A fresh `cua.getState()` is only a
   post-open fallback when the active host does not support that targeted listing; it is never the
   startup gate. Use visibility state only when the current host API actually exposes it; never invent
   or call obsolete `visibility.get/set` methods.

An unbound tab retained from another task cannot be safely reused without an inventory scan. Prefer one
reliable visible handoff for the current task over delaying it behind that scan; once created, retain and
reuse the task-local binding so later Canvas turns do not create duplicates.

For a legacy Browser-only host, perform the equivalent exact-URL reuse/create, visible presentation,
retention, and URL verification with the API documented by that host.

A screenshot is optional evidence. Screenshot failure does not mean the handoff failed when browser
visibility and the target tab URL have already been verified. If the target redirects to `/login`,
show that same IAB tab, ask the user to sign in there, and verify the target URL again afterward.

The in-app Browser has its own profile. Never transfer CLI credentials, tokens, cookies, or local
browser state into the page.

If the known-URL `createBrowserTab` entry call fails with a service startup or runtime-initialization
error before returning a `Tab`, call `mcp__cua_repl.js_reset` once and retry that same known-URL call
once. Do not loop, and do not retry page, permission, login, navigation, or ambiguous post-create
failures as though they were startup failures. If the retry also fails, report the actual startup error,
provide the returned direct URL, and stop browser automation. If no supported in-app control tool is
exposed, provide the direct URL immediately. Do not silently switch browser surfaces. A system browser
is allowed only after an explicit user request, using the wrapper-local `--open-system` opt-in.

## OAuth Login

Plugin/CLI upgrades and same-version package replacements reuse existing authorization; they are not
a reason to start OAuth. Continue using the same Codex IAB profile, without clearing browser data or
copying cookies/tokens into versioned plugin directories. Normal session expiry still requires login.

Start login as one long-lived call:

```bash
"${PVX}" pixverse auth login --json
```

The wrapper forces JSON mode even if `--json` is omitted. In this mode the PixVerse CLI never invokes
its system-browser opener. It emits `Authorize at: <url> (code: <code>)` to stderr as soon as the device
authorization session exists, then keeps polling for completion.

As soon as that line appears:

1. open the complete authorization URL in `iab`
2. tell the user authorization is ready in the Codex Browser
3. keep the original login process alive; do not start a second login
4. after the user authorizes and the process succeeds, run `"${PVX}" doctor`

CLI OAuth and the IAB web session are separate identities: the page authorizes the waiting CLI device
flow, while the CLI stores the resulting token locally. Never ask the user to paste that token.

Use `"${PVX}" pixverse auth login --open-system` only when the user explicitly requests a system
browser. The wrapper removes JSON mode for that opt-in so the upstream CLI can perform its native open.

## Static PixVerse Pages

These wrapper commands no longer invoke the upstream CLI browser opener:

```bash
"${PVX}" pixverse subscribe
"${PVX}" pixverse workspace manage
```

They return `pixverse.web_browser_handoff.v1` with `url`, an exact `browser_handoff`, authentication
guidance, and a direct-link fallback. Open `browser_handoff.url` in `iab`. `subscribe` resolves to the
current environment's `/subscribe`; `workspace manage` resolves to `/team`.

Do not run either command without the user's intent to view or manage that page. Add `--open-system`
only for an explicit system-browser request.

## Canvas

Canvas adds project binding, early visibility, mutation, and refresh rules. Read
`../skills-internal/pixverse-agent-canvas/SKILL.md`; its `canvas handoff` payload uses the same exact IAB
selection and direct-link fallback.

Apply the Canvas skill's **Preserve The User's Viewing State** rule to automatic preview and QA.
Initial handoff shows the ordinary panel; it is not permission to enlarge media. Later automatic
checks preserve the user's size and focus rather than reopening panels or expanding previews.
Enlargement requires an explicit user request; failed inspection stops with unchecked items, not a
fullscreen/maximize retry. Preserve previews the user has already enlarged as well.
Canvas handoffs also expose this in `preview_policy`; obey its initial-handoff-only visibility and
non-interrupting refresh scope. These are declarative Agent constraints, not a host/browser UI lock.
