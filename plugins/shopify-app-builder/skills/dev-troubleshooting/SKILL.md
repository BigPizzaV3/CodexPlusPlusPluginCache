---
name: dev-troubleshooting
description: "Use when a Shopify dev workflow is failing — `shopify app dev` cryptic errors, Cloudflare tunnel not starting, App Bridge v3→v4 migration 'No AppBridge context provided', GraphQL 200 OK with throttle errors, webhook 401, double-subscribed webhooks, app proxy 404, REST 302 loops, Rust function wasm-validator errors, session token 24h expiry, X-Frame-Options blocking iframe, dev store billing fakeouts, app review SLA blown. Triggers: 'shopify app dev failing', 'tunnel won't start', 'no app bridge context', 'throttle error 200', 'webhook 401', 'wasm validator error', 'session token expired', 'frame ancestors', 'remix template auth broken', 'billing test charge', 'shopify cli error'."
---

# Shopify Dev Troubleshooting — Triage First, Fix Fast

A symptom-driven triage skill for Shopify app developers. When your dev loop hits a wall, start here. Each pain below is sourced from the most-reported Reddit, Shopify Developer Community (community.shopify.dev), Shopify Community (community.shopify.com), and GitHub Shopify/* issues as of 2026-05-15.

Use this skill **first** when:
- `shopify app dev` exits with cryptic errors
- The browser shows "No AppBridge context provided", 401, 302 loops, or 404 on `/auth/login`
- GraphQL "works" but data is missing in production
- Webhooks fire twice, never, or your handler keeps timing out
- A Function deploys fail with `[wasm-validator error]`
- App Review SLA is blown and you don't know what to do
- A dev-store billing test charge silently fails

If the symptom matches a row in the Diagnostic Table, jump straight to that fix. If not, work through the Decision Tree at the bottom.

---

## 1. When to Use This Skill

This is the **entry point** for any "something is broken in my Shopify dev workflow" question. It is not the place to learn how to build new features — that's what the other `shopify-app-builder` skills are for. This skill is the ER, not the gym.

Surface this skill when the user says any of:
- "shopify app dev failing / not working / errors"
- "tunnel won't start", "cloudflared", "max retries reached"
- "App Bridge migration", "v3 to v4", "No AppBridge context provided"
- "graphql throttled", "200 OK error", "currentlyAvailable"
- "webhook 401", "double webhook", "duplicate webhook", "webhook retry"
- "remix auth broken", "/auth/login 404", "nested route login"
- "wasm-validator error", "wasm-opt failed", "Rust function deploy"
- "session token expired", "24 hour", "iframe redirect blocked"
- "X-Frame-Options", "frame-ancestors", "DENY"
- "billing test charge", "Apps without public distribution"
- "app review", "Built for Shopify rejected", "SLA blown"
- "shopify cli error", "cannot read properties of null"

If multiple symptoms match, run them in order of blast radius: production data corruption > auth break > review block > dev-loop friction.

---

## 2. The Diagnostic Table

Find your symptom in column 1. Apply the fix in column 3.

| # | Symptom (verbatim or close) | Likely cause | Exact fix |
|---|---|---|---|
| 1 | `shopify app dev` returns 403 "Cannot find a valid organization associated to this shop" | Stale auth or wrong org logged in | `shopify auth logout && shopify auth login` against the org-owning account; verify with `shopify app config link` |
| 2 | "Cannot read properties of null (reading 'X')" on CLI start | Corrupted `.shopify` cache or stale config | Back up the caches with `node <plugin-root>/scripts/reset-shopify-cache.mjs`, then run `shopify app dev --reset` |
| 3 | "Could not start Cloudflare tunnel: max retries reached" | Leftover `~/.cloudflared/config.yaml` from another project | `mv ~/.cloudflared/config.yaml ~/.cloudflared/config.yaml.bak`, or `shopify app dev --use-localhost` (CLI 3.80+) |
| 4 | Tunnel URL doesn't update in Partner Dashboard | CLI 3.x bug | `shopify app dev --reset --tunnel-url <fresh>` or upgrade CLI to latest |
| 5 | "Issues with valid certificates after the recent update" | Self-signed cert rotation on `--use-localhost` | `shopify app dev --use-localhost --localhost-port 3000` and re-trust the cert in Chrome (chrome://flags allow-insecure-localhost) |
| 6 | Hot reload broken for extensions | Known regression post new-Dev-Platform migration | `shopify app dev --reset`; if still broken, downgrade CLI one minor version |
| 7 | `shopify app dev` doesn't work with Plus dev stores | Known incompatibility, no fix | Create a Partner dev store for daily dev; only test Plus features manually on the Plus store |
| 8 | "No AppBridge context provided" on `<Modal>` or `<Titlebar>` | App Bridge v4 React Provider removed | Use as web components (`<ui-modal>`) **or** call `useAppBridge()` then `shopify.modal.show('id')` |
| 9 | App Bridge v4 fetch sending expired/undefined tokens | Browser caching old token; `X-Shopify-Retry-Invalid-Session-Request` not recovering | Replace custom `fetch` wrapper with App Bridge v4 `authenticatedFetch`; remove manual token storage |
| 10 | GraphQL returns 200 OK but data is missing | Throttling — body contains `errors[].extensions.code === "THROTTLED"` | Parse `extensions.cost.throttleStatus`; sleep `(requestedQueryCost - currentlyAvailable) / restoreRate` seconds; retry |
| 11 | `currentlyAvailable` dropped from 10000 to <100 unexpectedly | Bucket exhausted by previous expensive query | Add cost-budget middleware in front of every GraphQL client; never assume bucket state |
| 12 | Webhook handler returning 200 but Shopify keeps retrying | Took >5s to ACK | Move work to a queue (Inngest/SQS/BullMQ). ACK immediately after HMAC verify |
| 13 | Same `orders/create` webhook fires twice | Subscribed in both `shopify.app.toml` AND `shopifyApp({ webhooks })` | Pick one (toml is canonical in CLI 3.50+). Delete programmatic subs. `shopify app deploy`. Then `webhookSubscriptions(first: 250)` → delete orphans |
| 14 | Webhook signature verification fails | Express `body-parser` mutating raw body | `express.raw({ type: 'application/json' })` on webhook routes; in Remix, use `authenticate.webhook(request)` |
| 15 | Webhook returns 401 immediately | HMAC computed on parsed JSON instead of raw bytes | Compute HMAC on the raw request body buffer, not on `JSON.stringify(body)` |
| 16 | Remix `/auth/login` 404 on App Proxy calls | Wrong authenticate helper | Use `authenticate.public.appProxy(request)`, not `authenticate.admin(request)` |
| 17 | Login form appears on nested routes inside the embedded app | `authenticate.admin(request)` only called in root loader | Call `authenticate.admin(request)` in **every** loader/action, including children |
| 18 | REST API returns 401 then 302 loop after reinstall | Stale `Session` row with old scopes | Delete sessions for that shop; trigger reinstall; or use Token Exchange auth |
| 19 | App Store submission rejected: "Not authenticating with session tokens" | App still on redirect-based OAuth | Switch to Managed Install + Token Exchange; remove all `Redirect.dispatch` OAuth flows |
| 20 | Embedded app session breaks after ~24 hours | Session token expired; iframe can't redirect (X-Frame-Options: DENY) | Use App Bridge v4 `authenticatedFetch` (auto-refresh via Token Exchange); on 401 do `window.top.location.href`, not `window.location.href` |
| 21 | `[wasm-validator error in function 0]` on `shopify app deploy` (Rust) | `wasm-opt` choking on newer Rust features | Pin Rust to 1.84; init `shopify_function_wasm_api::init_panic_handler()` early; run `wasm-snip --snip-rust-panicking-code`; pre-run `wasm-opt -Os` locally |
| 22 | Vitest WASM tests fail; `dist/index.wasm` is base64 text not binary | CLI 3.93.0 regression | Downgrade to CLI 3.92.x or pin to a version after the fix; tracked in community.shopify.dev/t/33061 |
| 23 | Function fails silently on large carts | Hit 5ms / 20kb / determinism ceiling | Reduce input query fields; split into multiple functions; remove any non-deterministic calls |
| 24 | `appSubscriptionCreate` errors "Apps without a public distribution cannot use the Billing API" | Custom or unlisted draft | Set `distribution = "app_store"` in `shopify.app.toml`; create a draft listing (doesn't have to publish); redeploy |
| 25 | Billing test charge not approvable on Plus dev store | Known Plus-dev-store bug | Test billing on a Partner (non-Plus) dev store; document Plus-only flows separately |
| 26 | Polaris CSS missing after upgrade (e.g., `Polaris-TopBar__SearchField`) | Tree-shaker dropped `styles.css` | `import '@shopify/polaris/build/esm/styles.css'` exactly once at app root, in a non-shaken entry |
| 27 | Polaris tooltips broken | Polaris web components version mismatch | Pin to the Polaris version your app was built against; don't mix React Polaris and web-components Polaris |
| 28 | App proxy returns 200 but Shopify shows "Liquid error" | App proxy response not setting `Content-Type: application/liquid` | Set header `Content-Type: application/liquid` and return raw Liquid as string |
| 29 | App Review past 10-day SLA, no reviewer assigned | Known SLA slip in 2026 | Open Partner Support ticket; quote SLA from policy page; resubmit only if reviewer never assigned after 21 days |
| 30 | Rejected for "performance" with no specifics | Reviewer skim-rejection | Reply requesting specific repro steps with timestamps; attach Lighthouse scores from a Plus dev store |

---

## 3. Top 10 Dev Pains — Deep Dive

### 3.1 `shopify app dev` 403 org / tunnel failures

**Symptom (verbatim):** "After upgrading the CLI my `shopify app dev` returns 403 'Cannot find a valid organization associated to this shop' for multiple dev stores." (community.shopify.dev/t/34202)

Plus the cluster: "Could not start Cloudflare tunnel: max retries reached", "Issues with valid certificates after the recent update", "shopify app dev provides cryptic error message and fails" (github.com/Shopify/cli/issues/6522).

**Root cause:** The new Dev Platform migration changed how CLI links shops to organizations. Stale `~/.config/shopify/` state, an old `.shopify` directory in the project, a leftover `~/.cloudflared/config.yaml` from another project, or expired CLI auth all surface the same generic error.

**Exact fix sequence:**

```bash
# 1. Nuke stale local state
node <plugin-root>/scripts/reset-shopify-cache.mjs

# 2. Re-auth against the org that owns the dev store
shopify auth logout
shopify auth login

# 3. Re-link the app to confirm org
shopify app config link

# 4. If tunnel was the issue, side-step Cloudflare
mv ~/.cloudflared/config.yaml ~/.cloudflared/config.yaml.bak 2>/dev/null
shopify app dev --use-localhost

# 5. If certificate complaints persist on --use-localhost
shopify app dev --use-localhost --localhost-port 3000
# Then in Chrome: chrome://flags → enable "Allow invalid certificates for resources loaded from localhost"
```

**Prevention:** Pin CLI version per-project via `package.json`:
```json
"devDependencies": { "@shopify/cli": "3.92.0", "@shopify/app": "3.92.0" }
```
Don't upgrade CLI mid-sprint. Wait until a feature branch's merge window. Sources: github.com/Shopify/cli/issues/6522, community.shopify.dev/t/22830, community.shopify.dev/t/23075.

---

### 3.2 App Bridge v3 → v4 Re-architecture

**Symptom (verbatim):** "Uncaught Error: No AppBridge context provided — happens with `<Modal>` and `<Titlebar>` as React components, works fine when used as HTML tags." (github.com/Shopify/shopify-app-bridge/issues/340)

And: "App Bridge will no longer be offered via npm. There doesn't seem to be any mention of React compatibility... feels like a really big shift away from the React-first implementation." (github.com/Shopify/shopify-app-bridge/issues/219)

**Root cause:** v4 deleted the React Provider, removed most hooks, removed npm distribution. App Bridge is now a CDN-loaded global object. The React package still exists but is a thin shim around web components. `<Modal>` and `<Titlebar>` work as web components (`<ui-modal>`, `<ui-title-bar>`) without any Provider — but the React imports throw without it.

**Exact fix:**

1. Remove the v3 Provider entirely:
```tsx
// REMOVE
import { Provider } from '@shopify/app-bridge-react';
<Provider config={{ apiKey, host }}>...</Provider>

// REMOVE the npm dependency
// "@shopify/app-bridge": "3.x"
```

2. Add the CDN script tag to your root document (Remix `app/root.tsx`, Next.js `app/layout.tsx`):
```tsx
<script
  src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
  data-api-key={process.env.SHOPIFY_API_KEY}
/>
```

3. Replace removed APIs with the `shopify` global:
```tsx
// v3
const app = useAppBridge();
const redirect = Redirect.create(app);
redirect.dispatch(Redirect.Action.REMOTE, url);

// v4
const shopify = useAppBridge();
shopify.toast.show('Saved');
shopify.modal.show('my-modal-id');
open(url, '_top'); // for top-level redirects
```

4. For modals/titlebars in React, use them as web components:
```tsx
<ui-modal id="confirm">
  <p>Are you sure?</p>
  <ui-title-bar title="Confirm">
    <button variant="primary" onClick={() => shopify.modal.hide('confirm')}>OK</button>
  </ui-title-bar>
</ui-modal>
```

5. Replace custom fetch wrappers with `authenticatedFetch`:
```tsx
const res = await shopify.fetch('/api/data'); // auto-refreshes via Token Exchange
```

**Prevention:** When App Bridge announces a major, freeze your version, build a migration branch, run the codemod, deploy to a staging app. Don't take a major mid-release. Source: shopify.dev/docs/api/app-bridge/migration-guide-react.

---

### 3.3 GraphQL Throttling Returns 200 OK (The Silent Prod Corruption Case)

**Symptom (verbatim):** "When your app spends more than it has, Shopify returns a 200 OK with a THROTTLED error in the response body. Yes — a 200, not a 429." (letstalkshop.com/blog/shopify-admin-graphql-rate-limits-2026)

Plus: "GraphQL Admin API rate limits — limits per query is 1000 but I have 10000 cost available, why does my query fail?" (community.shopify.com/t/192109)

**Root cause:** Shopify's GraphQL Admin API uses a bucket-based cost system, not a request-per-second rate. Every query has a cost. When you exceed the bucket you get HTTP 200 with `errors[].extensions.code === "THROTTLED"`. Your monitoring that alerts on 4xx/5xx never fires. Data silently goes missing. Downstream code thinks the API returned an empty result.

**Per-plan budgets:**
| Plan | Max bucket | Restore rate |
|---|---|---|
| Standard | 1000 | 50/sec |
| Advanced | 2000 | 100/sec |
| Plus | 10000 | 500/sec |

`first: 250` on a flat resource is cheap. `first: 250` with nested connections multiplies cost — sometimes 1000+ per query.

**Exact fix:** Wrap every GraphQL call with a cost-aware middleware:

```ts
async function shopifyGql<T>(client, query, variables): Promise<T> {
  const res = await client.request(query, { variables });

  // Check for throttling in the body (NOT status code)
  const throttled = res.errors?.some(e => e.extensions?.code === 'THROTTLED');
  if (throttled) {
    const cost = res.extensions?.cost;
    const wait = cost
      ? Math.ceil((cost.requestedQueryCost - cost.throttleStatus.currentlyAvailable) / cost.throttleStatus.restoreRate)
      : 2;
    await sleep(wait * 1000);
    return shopifyGql(client, query, variables); // retry once
  }

  // Pre-emptive backoff: if we're <2x next query cost, slow down
  const status = res.extensions?.cost?.throttleStatus;
  if (status && status.currentlyAvailable < res.extensions.cost.requestedQueryCost * 2) {
    await sleep(1000);
  }

  return res.data as T;
}
```

For bulk reads (>1000 items), don't paginate — use `bulkOperationRunQuery`:
```graphql
mutation {
  bulkOperationRunQuery(query: """
    { products { edges { node { id title } } } }
  """) { bulkOperation { id status } }
}
```
Then poll `currentBulkOperation` until `status: COMPLETED`, download the JSONL file from `url`.

**Prevention:** Log `extensions.cost` from every response. Alert on `currentlyAvailable < 20% of max`. Never trust HTTP status for Shopify GraphQL. Sources: shopify.engineering/rate-limiting-graphql-apis-calculating-query-complexity, shopify.dev/docs/api/usage/limits.

---

### 3.4 Webhook At-Least-Once + Double-Subscription Footgun

**Symptom (verbatim):** "Orders/Create webhook missing address field, and Shopify sends duplicate events on order/create." (community.shopify.com/t/306917)

And: "Duplicate webhook subscriptions commonly happen with Shopify embedded apps when webhooks are defined in both shopify.app.toml and programmatically via shopifyApp() — each subscription triggers a separate delivery." (hookdeck.com/webhooks/platforms/shopify-embedded-app-webhook-configuration)

**Root cause:** Two compounding problems:
1. **Delivery model:** Shopify is at-least-once, never exactly-once. Network blips trigger retries (8 retries over ~4 hours). Same event arrives 2-9 times.
2. **Configuration drift:** Devs declare webhooks in `shopify.app.toml` AND register them programmatically via `shopifyApp({ webhooks: { ORDERS_CREATE: { ... } } })`. Shopify treats these as separate subscriptions. Two records, two deliveries per real event.

Plus the 5-second ACK trap: handlers that block on DB writes get retried while the first call is still running.

**Exact fix — dedupe sources:**

1. Pick one source. In CLI 3.50+ the toml is canonical:
```toml
# shopify.app.toml
[[webhooks.subscriptions]]
topics = ["orders/create"]
uri = "https://myapp.com/webhooks/orders/create"
```

2. Remove every programmatic `webhookSubscriptions` from your `shopifyApp({...})` config.

3. Run `shopify app deploy` to sync.

4. Audit existing subscriptions and delete orphans:
```graphql
query { webhookSubscriptions(first: 250) { edges { node { id topic endpoint { __typename ... on WebhookHttpEndpoint { callbackUrl } } } } } }
```
For any duplicates: `webhookSubscriptionDelete(id: "...")`.

**Exact fix — survive at-least-once:**

```ts
// Express
app.post('/webhooks/orders/create',
  express.raw({ type: 'application/json' }), // RAW body for HMAC
  async (req, res) => {
    // 1. Verify HMAC on raw body
    const hmac = req.headers['x-shopify-hmac-sha256'];
    const computed = crypto.createHmac('sha256', SECRET).update(req.body).digest('base64');
    if (hmac !== computed) return res.status(401).end();

    // 2. ACK immediately
    res.status(200).end();

    // 3. Idempotency on X-Shopify-Webhook-Id
    const webhookId = req.headers['x-shopify-webhook-id'] as string;
    const seen = await redis.set(`wh:${webhookId}`, '1', 'NX', 'EX', 86400 * 7);
    if (seen !== 'OK') return; // already processed

    // 4. Push to queue
    await queue.add('orders/create', JSON.parse(req.body.toString()));
  }
);
```

**Reconciliation cron:** Webhooks lie. Run a daily delta:
```graphql
query { orders(first: 250, query: "updated_at:>=YYYY-MM-DDTHH:MM:SSZ") { ... } }
```
Compare to your local DB. Backfill anything missing.

**Prevention:** One source of truth (toml). Idempotency key from `X-Shopify-Webhook-Id`. ACK before work. Queue everything. Source: shopify.dev/docs/apps/build/webhooks/best-practices, shopify.dev/docs/apps/build/webhooks/ignore-duplicates.

---

### 3.5 Remix Template Nested-Route Auth Break

**Symptom (verbatim):** "Authentication issues when navigating to nested routes — the login form is displayed even though navigation should work." (github.com/Shopify/shopify-app-template-remix/issues/599)

Plus: "Shopify Remix app in Production environment embedded issue — embedded app roots load but any sub-page selected via the side menu wants re-authentication." (community.shopify.com/t/382024) and "`shopify.authenticate` for Remix App Proxy kicking to an /auth/login 404." (issues/747)

**Root cause:** The default Remix template calls `authenticate.admin(request)` once in `app/routes/app.tsx` loader. Nested routes don't automatically inherit it. When the user navigates client-side via React Router, the child route's loader runs without the auth. The redirect to `/auth/login` happens — but for App Proxy routes there is no `/auth/login`, so you get 404.

**Exact fix:**

1. Call `authenticate.admin(request)` in **every** loader and action, not just the parent:
```tsx
// app/routes/app.products.tsx
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  // ... your loader logic
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  // ... your action logic
};
```

2. For App Proxy routes, use the public helper, not admin:
```tsx
// app/routes/proxy.coupon.tsx (mapped to App Proxy URL)
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { liquid, session } = await authenticate.public.appProxy(request);
  return liquid('<p>Hello {{ shop.name }}</p>');
};
```

3. For checkout extension routes:
```tsx
const { sessionToken } = await authenticate.public.checkout(request);
```

4. For 302 loops after reinstall (scope mismatch):
```sql
DELETE FROM Session WHERE shop = 'my-shop.myshopify.com';
```
Then visit the app — Shopify will re-OAuth with current scopes.

5. For App Store submission rejection on "session tokens": switch to Managed Install + Token Exchange. In `shopify.app.toml`:
```toml
[access_scopes]
scopes = "read_products,write_orders"
use_legacy_install_flow = false

[auth]
redirect_urls = ["https://myapp.com/api/auth/callback"]
```

**Prevention:** Treat every loader/action as untrusted. Auth-call it explicitly. Don't trust inheritance. Source: github.com/Shopify/shopify-app-template-remix issues 432, 599, 747, 797, 993.

---

### 3.6 Rust Function wasm-validator + CLI 3.93.0 base64 Regression

**Symptom (verbatim):** "[wasm-validator error in function 0] — happens during the wasm-opt optimization step after I try to deploy my Rust function." (community.shopify.com/t/223885)

Plus: "CLI 3.93.0 regression: vitest WASM tests fail for Rust function extensions — base64 written to dist/index.wasm instead of raw binary." (community.shopify.dev/t/33061)

**Root cause:** Two separate but co-occurring issues:
1. `wasm-opt` (the optimizer Shopify runs before deploy) doesn't understand all features of newer Rust toolchains. Especially panic infrastructure compiled in by default.
2. CLI 3.93.0 changed the WASM output pipeline; for a brief window the build wrote base64-encoded text to `dist/index.wasm` instead of binary bytes, breaking vitest's WASM tests and breaking deploys.

**Exact fix:**

1. Pin Rust toolchain:
```toml
# rust-toolchain.toml at function root
[toolchain]
channel = "1.84"
targets = ["wasm32-wasip1"]
```

2. Init the Shopify-provided panic handler early in `main`:
```rust
use shopify_function_wasm_api::init_panic_handler;

#[shopify_function]
fn function(input: input::ResponseData) -> Result<output::FunctionResult> {
    init_panic_handler();
    // ... your logic
}
```

3. Strip Rust panic code (cuts WASM by ~30-50%):
```bash
cargo install wasm-snip
cargo build --target wasm32-wasip1 --release
wasm-snip target/wasm32-wasip1/release/your_function.wasm \
  -o target/wasm32-wasip1/release/your_function.wasm \
  --snip-rust-panicking-code
```

4. Run `wasm-opt -Os` yourself before `shopify app deploy` so errors surface locally:
```bash
wasm-opt -Os target/wasm32-wasip1/release/your_function.wasm \
  -o target/wasm32-wasip1/release/your_function.wasm
```

5. For the CLI 3.93.0 regression: downgrade to 3.92.x or upgrade to the post-fix version:
```bash
npm install --save-dev @shopify/cli@3.92.0 @shopify/app@3.92.0
```

6. Verify your `dist/index.wasm` is binary, not text:
```bash
file dist/index.wasm  # should say "WebAssembly (wasm) binary module"
```

**Prevention:** Pin Rust toolchain, pin CLI version, run `wasm-opt` locally, ship a CI step that runs `function-runner` on a fixture before deploy. Sources: community.shopify.com/t/223885, community.shopify.dev/t/33061, docs.rs/shopify_function_wasm_api.

---

### 3.7 Function 5ms / 20kb / Deterministic Ceiling

**Symptom (verbatim):** "Can the instruction and input size limits be raised for large orders?" — answer: no. (github.com/Shopify/function-examples/discussions/329)

Plus the cluster of "my function works in dev but fails silently on stores with 100k SKUs."

**Root cause:** Shopify Functions are hard-capped:
- **5ms** execution time per invocation
- **20kb** output JSON size
- **25** active discount functions per store (combined limit)
- **Deterministic**: no network, no clock, no randomness, no env reads
- Input query has a complexity ceiling — large catalogs explode silently

Devs hit these because they treat Functions like serverless lambdas. They aren't. They're WASM running in a sandbox.

**Exact fix:**

1. Minimize the input query — only request fields you'll branch on:
```graphql
# BAD — pulls everything
query Input { cart { lines { merchandise { ... on ProductVariant { product { ... } } } } } }

# GOOD — only the fields you need
query Input { cart { lines { id quantity merchandise { ... on ProductVariant { id } } } } }
```

2. Profile output size. If approaching 20kb, batch or split:
```rust
// Bad: returning 1000 separate discount applications
// Good: one ProductDiscountApplication with multiple variants
```

3. Determinism checklist:
- No `std::time::Instant::now()` — use timestamps from the input
- No `rand::random()` — seed from a deterministic value (e.g., order ID hash)
- No HTTP calls — pre-load via input query
- No `std::env` — Shopify won't expose env to functions

4. For data your function needs but can't fit in input: stash it in metafields on the store/product, request via input query.

5. Test before you deploy:
```bash
shopify app function run --input fixtures/large-cart.json
```

6. If you genuinely can't fit logic in 5ms/20kb, split into multiple Functions (cart, shipping, payment) — each gets its own budget.

**Prevention:** Build the test fixture for your worst-case cart on day 1. Run it in CI. If it fails the ceiling, you redesign now, not at launch. Source: shopify.dev/docs/api/functions/latest/discount, gadget.dev/blog/understanding-shopify-functions-part-2.

---

### 3.8 Billing API Fakeouts on Dev Stores

**Symptom (verbatim):** "Unable to approve Billing API test charges on Plus Development Stores — this issue appears specific to Plus Dev Stores created from the Dev Dashboard." (community.shopify.dev/t/23258)

Plus: `appSubscriptionCreate` returns "Apps without a public distribution cannot use the Billing API" (community.shopify.com/m-p/1757459) and "negative-duration billing cycle for subscription" (t/25346) and double-charge UI bugs.

**Root cause:** Billing API has several hardcoded preconditions that aren't documented in one place:
- App must have `distribution = "app_store"` set
- A draft listing must exist (doesn't have to be published)
- Plus dev stores have a specific bug approving test charges
- Custom-distribution apps can't use Billing API at all

**Exact fix:**

1. In `shopify.app.toml`:
```toml
[build]
include_config_on_deploy = true

[application]
distribution = "app_store"
```

2. In Partner Dashboard → your app → App listing → create a draft. Don't publish; just save.

3. Redeploy:
```bash
shopify app deploy
```

4. Test on a **Partner dev store**, not a Plus dev store. Create one specifically for billing flows:
```bash
shopify app dev --store=billing-test.myshopify.com
```

5. When creating subscriptions, set `test: true` so charges don't actually capture:
```graphql
mutation {
  appSubscriptionCreate(
    name: "Pro Plan"
    returnUrl: "https://myapp.com/billing/callback"
    test: true
    lineItems: [{
      plan: { appRecurringPricingDetails: { price: { amount: 29.99, currencyCode: USD }, interval: EVERY_30_DAYS } }
    }]
  ) { confirmationUrl userErrors { field message } }
}
```

6. Handle the negative-duration edge case server-side:
```ts
const cycleEnd = new Date(subscription.currentPeriodEnd);
const cycleStart = new Date(subscription.currentPeriodStart);
if (cycleEnd < cycleStart) {
  // Known Shopify bug. Use cycleStart + 30 days instead.
  cycleEnd.setDate(cycleStart.getDate() + 30);
}
```

**Prevention:** Two dev stores: Partner non-Plus (daily dev + billing tests), Plus dev (Plus-specific feature checks only). Never test billing on the Plus one. Source: community.shopify.dev/t/23258, community.shopify.com/m-p/1757459.

---

### 3.9 Session Token 24h Expiry + Iframe Redirect Block

**Symptom (verbatim):** "I have an embedded app where after about 24 hours of having it opened, the session token expires and the app needs to be reopened." (community.shopify.com/c/shopify-apps/managing-embedded-app-user-session-lost/td-p/1038381)

Plus: "You can't perform a redirect from inside an iframe in the Shopify admin, due to X-Frame-Options: DENY restrictions on Shopify admin pages." (shopify.dev docs, quoted in dozens of threads)

**Root cause:** Embedded apps run in an iframe inside Shopify admin. Session tokens (JWTs) expire roughly daily. When they expire:
1. Your `fetch` returns 401
2. You try to redirect to OAuth to re-auth
3. Shopify admin sends `X-Frame-Options: DENY` on its OAuth endpoints
4. Browser blocks the iframe redirect
5. App appears frozen, user has to close and reopen

**Exact fix:**

1. Use App Bridge v4 `authenticatedFetch` — it auto-refreshes via Token Exchange:
```tsx
const shopify = useAppBridge();
const res = await shopify.fetch('/api/data');
// Behind the scenes: if token expired, fetches a new one via Token Exchange, retries
```

2. If you must implement yourself, on a 401, do a **top-level** redirect, not an iframe redirect:
```tsx
// WRONG — blocked by X-Frame-Options
window.location.href = '/auth/login';

// RIGHT — breaks out of iframe
if (window.top) {
  window.top.location.href = '/auth/login';
} else {
  window.location.href = '/auth/login';
}
```

3. Or use App Bridge's `Redirect` action which handles this for you:
```tsx
import { Redirect } from '@shopify/app-bridge/actions';
const app = createApp({...});
Redirect.create(app).dispatch(Redirect.Action.REMOTE, '/auth/login');
```

4. For App Store submission requirement of session-token auth: confirm Token Exchange is wired in your backend:
```ts
// Remix
const { admin, session } = await authenticate.admin(request);
// `session` was obtained via Token Exchange if Managed Install is on
```

5. Verify your CSP allows Shopify framing (Shopify auto-injects but check):
```
Content-Security-Policy: frame-ancestors https://*.myshopify.com https://admin.shopify.com;
```

**Prevention:** Default to App Bridge v4 `authenticatedFetch`. Never hand-roll session token storage in localStorage. Always test the 24h scenario explicitly with `Date.now() + 25h` mocking. Source: shopify.dev/docs/apps/build/authentication-authorization/session-tokens/set-up-session-tokens, community.shopify.dev/t/32004.

---

### 3.10 App Review SLA Blown — What to Do

**Symptom (verbatim):** "I submitted my app for review in January 2026 when Shopify's posted SLA was 8–10 days. I did not get any update until over 30 days after submission (3x the SLA)." (community.shopify.dev/t/32259)

Plus: "Frustration with app review process — reviewers taking 2+ weeks just to get assigned, then long back-and-forth where they don't read emails." (community.shopify.dev/t/31784) and "Application review rejected — but I can't tell why." (community.shopify.dev/t/17950)

**Root cause:** Shopify's app review queue has been backed up since early 2026. Posted SLA is 8-10 days; actual is 21-45 days. Reviewers skim-reject for vague reasons. Replies often go unread for a week.

**Exact action plan:**

1. **Before submission — pre-flight the Top 10 rejection reasons** (shopify.dev/docs/apps/store/common-rejections):
   - GDPR mandatory webhooks present and responding 200: `customers/data_request`, `customers/redact`, `shop/redact`
   - Session token auth (not redirect OAuth) — required since 2024
   - Embedded apps must use App Bridge v4
   - Listing screenshots exactly 1600×900, no Shopify logos, no competitor names
   - Pricing page shows actual prices, not "Contact us"
   - Demo video shows install → core flow → uninstall in <3 minutes
   - Privacy policy URL responds 200 and matches what's in the app
   - Performance: app must score 70+ on Lighthouse Performance for embedded admin
   - All scopes used; remove unused scopes from `shopify.app.toml`
   - Onboarding has clear next-step CTA after install

2. **At submission:** Record a reviewer-facing screencast (3-5 min) that walks the reviewer through install, core feature, uninstall. Caption every step. Reviewers skim — make the value un-missable.

3. **If past 14 days with no reviewer assigned:** Open a Partner Support ticket. Subject: "App review past SLA — request reviewer assignment". Body: app handle, submission date, SLA reference. Don't ask twice; once is enough.

4. **If past 21 days:** Escalate via the Partner Slack (if you're in it) or Partner Success Manager (if you have one). If neither, post on the dev forum at community.shopify.dev — Shopify staff monitor it.

5. **If rejected with vague reason** ("performance issues" with no specifics):
```
Hi [reviewer], thanks for the review. Could you share specific repro steps?
For "performance issues" I'd appreciate:
- The exact admin page where you saw the issue
- Browser + screen size
- Time of day (UTC)
- Network conditions if applicable

I'll fix and resubmit within 48 hours of your response.
```
Don't argue. Don't restate features. Ask for specifics. Wait for response.

6. **If rejected for a real reason:** Fix, document the fix in your resubmission notes, attach a video of the fix in action.

7. **Common silent-killers most devs miss:**
   - GDPR webhooks return 500 (not implemented at all). This is the #1 silent reject reason. Verify with `shopify webhook trigger customers/data_request --address=https://yourapp.com/webhooks/gdpr/customers_data_request`.
   - Privacy policy URL 404s in production
   - Demo video unlisted but URL doesn't work for reviewer
   - Test charge required but billing not set up (see §3.8)

**Prevention:** Submit on a Tuesday morning UTC (highest reviewer activity), submit with a perfect screencast, and have a 48-hour SLA on your end for responding to reviewer feedback. Source: community.shopify.dev/t/32259, community.shopify.dev/t/31784, shopify.dev/docs/apps/store/common-rejections.

---

## 4. Decision Tree

Run this in order. Stop at the first match.

```
START
  │
  ├─ Is the user blocked from any progress (CLI won't start)?
  │   │
  │   ├─ "Cannot find a valid organization" or 403?
  │   │     → §3.1 (auth logout/login + reset state)
  │   │
  │   ├─ "Could not start Cloudflare tunnel" or tunnel URL stale?
  │   │     → §3.1 tunnel section (rename ~/.cloudflared/config.yaml or --use-localhost)
  │   │
  │   ├─ "Cannot read properties of null" or generic CLI crash?
  │   │     → back up caches with reset-shopify-cache.mjs, then run shopify app dev --reset
  │   │
  │   └─ Plus dev store specific?
  │         → §3.1 Plus section (use Partner dev store for dev loop)
  │
  ├─ Is auth broken in the running app?
  │   │
  │   ├─ "No AppBridge context provided"?
  │   │     → §3.2 (v3→v4 migration, remove Provider, use CDN + global)
  │   │
  │   ├─ Token expired after ~24h, app frozen?
  │   │     → §3.9 (authenticatedFetch + top-level redirect)
  │   │
  │   ├─ /auth/login 404 on App Proxy?
  │   │     → §3.5 (use authenticate.public.appProxy)
  │   │
  │   ├─ Login form on nested routes?
  │   │     → §3.5 (call authenticate.admin in every loader)
  │   │
  │   └─ 302 loop after reinstall?
  │         → §3.5 (delete sessions for shop, re-OAuth)
  │
  ├─ Is production data going missing or being duplicated?
  │   │
  │   ├─ GraphQL "succeeds" with 200 but data is absent?
  │   │     → §3.3 (parse extensions.cost, detect THROTTLED in body)
  │   │
  │   ├─ Webhook handler running twice per event?
  │   │     → §3.4 (dedupe sources, idempotency key, queue offload)
  │   │
  │   └─ Webhook returning 401, all rejected?
  │         → Diagnostic row 14-15 (HMAC on raw body)
  │
  ├─ Is a Function failing to deploy or running wrong?
  │   │
  │   ├─ [wasm-validator error] on deploy?
  │   │     → §3.6 (pin Rust 1.84, init panic handler, wasm-snip)
  │   │
  │   ├─ CLI 3.93.0, base64 in dist/index.wasm?
  │   │     → §3.6 (downgrade CLI to 3.92.x)
  │   │
  │   └─ Function fails on large carts but works on small?
  │         → §3.7 (5ms/20kb/deterministic — reduce input query, split functions)
  │
  ├─ Is a Billing test charge failing?
  │   │
  │   ├─ "Apps without a public distribution cannot use the Billing API"?
  │   │     → §3.8 (set distribution=app_store, create draft listing)
  │   │
  │   ├─ Plus dev store specifically?
  │   │     → §3.8 (test on Partner dev store instead)
  │   │
  │   └─ Negative-duration billing cycle?
  │         → §3.8 (clamp client-side: cycleEnd = cycleStart + 30 days)
  │
  ├─ Is App Store review the blocker?
  │     → §3.10 (pre-flight Top-10, ask for specifics, escalate at 21d)
  │
  └─ None of the above — drop to row scan in §2 Diagnostic Table.
```

---

## 5. Quick-Reference Commands

```bash
# Nuke and restart
node <plugin-root>/scripts/reset-shopify-cache.mjs && shopify app dev --reset

# Bypass Cloudflare tunnel
mv ~/.cloudflared/config.yaml ~/.cloudflared/config.yaml.bak
shopify app dev --use-localhost

# Re-auth
shopify auth logout && shopify auth login && shopify app config link

# Pin CLI version
npm install --save-dev @shopify/cli@3.92.0 @shopify/app@3.92.0

# List webhook subscriptions (to find duplicates)
shopify app generate extension  # or via GraphiQL → webhookSubscriptions(first: 250)

# Run a Function locally with a fixture
shopify app function run --input fixtures/cart.json

# Trigger a webhook locally for testing
shopify webhook trigger orders/create --address=http://localhost:3000/webhooks/orders/create

# Build + strip a Rust function before deploy
cargo build --target wasm32-wasip1 --release
wasm-snip target/wasm32-wasip1/release/fn.wasm -o target/wasm32-wasip1/release/fn.wasm --snip-rust-panicking-code
wasm-opt -Os target/wasm32-wasip1/release/fn.wasm -o target/wasm32-wasip1/release/fn.wasm
```

---

## 6. Sources (URLs Cited Inline Above)

CLI / Dev loop:
- github.com/Shopify/cli/issues/6522
- community.shopify.dev/t/shopify-app-dev-returns-403-cannot-find-a-valid-organization-associated-to-this-shop-for-multiple-dev-stores/34202
- community.shopify.dev/t/shopify-cli-reloading-broken-after-migration-to-new-dev-platform/22830
- community.shopify.dev/t/issues-with-valid-certificates-after-the-recent-update/23075
- community.shopify.dev/t/shopify-app-dev-doesnt-work-with-plus-development-stores/23471

Cloudflare tunnel:
- community.shopify.dev/t/cloudflare-tunnel-shows-healthy-but-shopify-app-wont-load/9865
- community.shopify.dev/t/cloudflare-tunnel-error-when-running-shopify-app-dev-persistent-since-1-week/24200
- community.shopify.dev/t/shopify-app-dev-doest-update-cloudflare-tunnel-url-on-dev-partner-dashboard/22315
- shopify.dev/docs/apps/build/cli-for-apps/networking-options

App Bridge:
- github.com/Shopify/shopify-app-bridge/issues/340
- github.com/Shopify/shopify-app-bridge/issues/219
- community.shopify.dev/t/app-bridge-v4-cdn-automatic-fetch-authorization-sends-expired-undefined-tokens-x-shopify-retry-invalid-session-request-doesnt-recover/32004
- shopify.dev/docs/api/app-bridge/migration-guide-react

Remix auth:
- github.com/Shopify/shopify-app-template-remix/issues/599
- github.com/Shopify/shopify-app-template-remix/issues/747
- github.com/Shopify/shopify-app-template-remix/issues/797
- github.com/Shopify/shopify-app-template-remix/issues/993
- community.shopify.com/t/shopify-remix-app-in-production-environment-embedded-issue/382024

GraphQL throttling:
- letstalkshop.com/blog/shopify-admin-graphql-rate-limits-2026
- community.shopify.com/t/graphql-admin-api-rate-limits-limits-per-query-is-1000-but-i-have-10000-cost-available/192109
- shopify.dev/docs/api/usage/limits
- shopify.engineering/rate-limiting-graphql-apis-calculating-query-complexity

Webhooks:
- hookdeck.com/webhooks/platforms/how-to-handle-duplicate-shopify-webhook-events
- hookdeck.com/webhooks/platforms/shopify-embedded-app-webhook-configuration
- shopify.dev/docs/apps/build/webhooks/best-practices
- shopify.dev/docs/apps/build/webhooks/ignore-duplicates
- community.shopify.com/t/orders-create-webhook-missing-address-field-and-shopify-send-duplicate-events-on-order-create/306917

Rust + Functions:
- community.shopify.com/t/cant-deploy-shopify-function-written-in-rust/223885
- community.shopify.dev/t/cli-3-93-0-regression-vitest-wasm-tests-fail-for-rust-function-extensions-base64-written-to-dist-index-wasm-instead-of-raw-binary/33061
- community.shopify.dev/t/shopify-functions-and-rust-1-84/5570
- docs.rs/shopify_function_wasm_api
- github.com/Shopify/function-examples/discussions/329

Billing:
- community.shopify.dev/t/unable-to-approve-billing-api-test-charges-on-plus-development-stores/23258
- community.shopify.com/c/technical-q-a/apps-without-a-public-distribution-cannot-use-the-billing-api/m-p/1757459
- community.shopify.dev/t/possible-bug-negative-duration-billing-cycle-for-subscription/25346

Session tokens / iframe:
- community.shopify.com/c/shopify-apps/managing-embedded-app-user-session-lost/td-p/1038381
- shopify.dev/docs/apps/build/authentication-authorization/session-tokens/set-up-session-tokens

App Review:
- community.shopify.dev/t/warning-shopify-app-store-review-process/32259
- community.shopify.dev/t/frustration-with-app-review-process/31784
- community.shopify.dev/t/application-review-rejected/17950
- shopify.dev/docs/apps/store/common-rejections
