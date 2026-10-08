---
name: app-performance
description: "Use when optimizing Shopify embedded app performance — LCP, INP, CLS, TTI, cold-start, App Bridge init, Polaris bundle slimming, large GraphQL costs, Remix defer/streaming/prefetch, image lazy-loading, server cache + CDN, Prisma connection pooling, webhook handler latency, and meeting Built for Shopify performance gates. Triggers: 'app slow', 'embedded app performance', 'LCP shopify app', 'INP shopify', 'app bundle too big', 'polaris bundle slim', 'remix defer', 'prefetch intent', 'shopify app lighthouse', 'shopify performance budget', 'built for shopify performance', 'image lazy load shopify', 'graphql query cost', 'n+1 prisma'."
---

# Shopify Embedded App Performance

Fix slow Shopify embedded apps before Built for Shopify rejects them, merchants uninstall, and Shopify demotes you in App Store search. The Web Vitals are the gate. Everything below is how you walk through it.

---

## 1. When to use this skill

Trigger this skill when:

- `shopify app dev` runs but the embedded iframe takes 4+ seconds to render
- BFS review comes back "fails performance" with no specifics
- Lighthouse on your admin route scores below 70
- Web Vitals API reports LCP > 2.5s, INP > 200ms, or CLS > 0.1 over 28 days
- Your bundle is > 500KB gzipped and you don't know why
- GraphQL queries are returning `THROTTLED` (as 200 OK, not 429)
- Prisma queries take 800ms+ in production but 40ms locally
- Webhook handlers are taking > 2 seconds and triggering Shopify retries
- A merchant DMs you "your app is the slowest thing in my admin"
- You're about to submit for Built for Shopify and want to pass on the first try

Don't use this skill for storefront / theme performance — that's a different problem (theme app extensions, web pixels, checkout extensions). This skill is about the admin embedded surface and the server behind it.

---

## 2. Built for Shopify performance thresholds (current)

These are the exact numbers. Memorize them.

### Core Web Vitals (admin, measured via App Bridge Web Vitals API)

| Metric | Threshold | Measurement window | Min sample size |
|--------|-----------|--------------------|-----------------|
| **LCP** (Largest Contentful Paint) | ≤ 2.5s (p75) | 28 days | 100 calls |
| **INP** (Interaction to Next Paint) | ≤ 200ms (p75) | 28 days | 100 calls |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 (p75) | 28 days | 100 calls |
| **TTI** (Time to Interactive) | Aim ≤ 3.8s | Internal target | — |

p75 means 75% of measured launches must be at or under the threshold. One slow merchant doesn't sink you — the long tail does.

### Server / API performance

| Metric | Threshold |
|--------|-----------|
| **API p95 latency** | < 500ms |
| **API failure rate** | < 0.1% |
| **Min requests** (28 days) | 1000 (for checkout-adjacent apps) |
| **Webhook ACK** | < 5s before Shopify retries (target < 2s) |

### Storefront-side requirements (if you ship Theme App Extensions)

- Your app must not reduce the storefront Lighthouse performance score by more than **10 points**
- Per-surface storefront JS budget: **< 50KB gzipped** is the rule of thumb most pass on

### Iframe gotcha

Apps rendered in the Shopify admin run inside iframes. Lighthouse run against your raw URL is misleading — it doesn't model the App Bridge bootstrap, the parent admin chrome, or the cross-origin handshake. The only metric that matters for BFS is what the **Web Vitals API inside App Bridge** reports. Wire that up first or you're flying blind.

---

## 3. Where embedded app slowdowns come from

In order of how often they're the culprit:

### 3.1 Server cold start (40% of slow first-loads)

Your Remix server is on a serverless / scale-to-zero runtime (Fly Machines stopped, Vercel Lambda cold, Render free tier). First request from a merchant pays a 2-5 second cold-boot tax. Every metric is now blown.

### 3.2 App Bridge initialization

The App Bridge CDN script must load and the parent admin must complete the postMessage handshake before your iframe is "interactive." If you load App Bridge late (after your bundle), INP measurements include the gap.

### 3.3 Polaris bundle bloat

`import { Card } from '@shopify/polaris'` from Next.js or a tree-shake-confused bundler pulls in 800KB+ of unused components. Webpack/esbuild/Vite all have known cases where Polaris's barrel exports defeat tree-shaking.

### 3.4 Large or unbatched GraphQL fetches

Loader fires three GraphQL queries serially because you `await`'d them. Each is 200-400ms. You've blocked LCP by 800ms before render starts.

### 3.5 Prisma N+1

Loop over products, `prisma.metafield.findMany({ where: { productId }})` inside. 100 products × 30ms = 3 seconds. Server p95 dies.

### 3.6 Blocking webhook handlers

Webhook handler does HMAC verify, writes to DB, calls 2 third-party APIs, returns 200 after 7 seconds. Shopify already retried. Now you process the duplicate. Now you're throttled.

### 3.7 Unbounded images

`<img src={huge.png}>` with no `width`/`height`, no lazy loading, no Shopify Image CDN transform. CLS jumps the moment images load.

### 3.8 No HTTP caching

Every navigation refetches the same shop settings, the same plan info, the same merchant profile. Cache-Control header is missing, so the browser never reuses anything.

---

## 4. Server cold-start fix

### 4.1 Runtime choice

| Runtime | Cold start | When to pick |
|---------|------------|--------------|
| **Node on always-on VM** (Fly Machines `min_machines_running = 1`, Render Standard, Railway) | 0ms | Default. Cheapest path to consistent p95. |
| **Bun on always-on VM** | 0ms | Pick if you measured 30%+ faster on your specific Prisma/GraphQL workload. Not a magic bullet. |
| **Edge runtime** (Vercel Edge, Cloudflare Workers) | < 50ms | Pick only if you can live without Node-API libs (Prisma needs Hyperdrive/D1 driver). Great for read-heavy. |
| **Serverless cold-scale** (Vercel Lambda, AWS Lambda) | 1-5s | Avoid for embedded apps unless you have warm-ping infra. |

### 4.2 Warm pings

If you must run on scale-to-zero, hit your own healthcheck every 4 minutes. Cheap:

```ts
// pages/api/health.ts or app/routes/health.tsx
export const loader = () => new Response("ok", { status: 200 });
```

Then a cron (Vercel Cron, GitHub Actions schedule, UptimeRobot free tier) curls it every 4 minutes during expected business hours.

### 4.3 Platform specifics

- **Fly.io:** `min_machines_running = 1`, `auto_stop_machines = false` in `fly.toml`. The $4/mo for the tiniest always-on machine is cheaper than every losing 28-day BFS window.
- **Vercel:** prefer Pro and set `regions: ['iad1']` (or wherever Shopify's main traffic lands). Use Fluid Compute, set `maxDuration` low. Enable Edge Caching on loaders that return cacheable data.
- **Render:** Standard plan or higher. The Free tier sleeps. Don't ship to merchants on Free.
- **Heroku / Railway:** keep at least 1 worker dyno running; eco/hobby dynos sleep.
- **Shopify Oxygen (storefront):** not for embedded admin apps. Don't confuse the two.

---

## 5. Remix optimizations

### 5.1 `defer` and `Await` for non-critical data

Stop blocking the response on slow data. Stream it.

```tsx
// Bad — loader awaits every query, response blocks until all resolve
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  const shop = await admin.graphql(SHOP_QUERY).then(r => r.json());
  const orders = await admin.graphql(ORDERS_QUERY).then(r => r.json()); // slow
  const products = await admin.graphql(PRODUCTS_QUERY).then(r => r.json());
  return json({ shop, orders, products });
}

// Good — only await what's needed for first paint, defer the rest
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  const shop = await admin.graphql(SHOP_QUERY).then(r => r.json()); // fast, needed for header
  const orders = admin.graphql(ORDERS_QUERY).then(r => r.json());   // slow, not blocking
  const products = admin.graphql(PRODUCTS_QUERY).then(r => r.json());
  return defer({ shop, orders, products });
}
```

In the component:

```tsx
<Suspense fallback={<Skeleton />}>
  <Await resolve={data.orders}>
    {(orders) => <OrdersTable orders={orders} />}
  </Await>
</Suspense>
```

LCP fires on the header that the first `await` produced. The orders table streams in after.

### 5.2 `prefetch="intent"` on every internal Link

```tsx
import { Link } from "@remix-run/react";

<Link to="/app/orders" prefetch="intent">Orders</Link>
```

When the merchant hovers (~500ms before they actually click), Remix fetches the route's JS, CSS, and loader data. By the time the click lands, the next page is already in cache. INP measurements drop because the click doesn't trigger a network round-trip.

Don't use `prefetch="render"` for everything — it floods the network on every page load. Use it only for the one obvious next step (e.g., a wizard's next button).

### 5.3 Route prefetching strategy

- `prefetch="intent"` — default for nav links and CTAs (98% of links)
- `prefetch="render"` — single "obvious next step" per page
- `prefetch="viewport"` — links far down a long list, prefetch when scrolled into view
- `prefetch="none"` — anything that points to a route the user will rarely click, or stale-sensitive data

### 5.4 Resource routes for data the client polls

If a chart polls every 30 seconds, don't re-render the whole route. Use a resource route (`/app/api/chart-data`) that returns JSON, fetch it from the client. Resource routes skip the React component tree and just run the loader.

### 5.5 Move heavy work to `clientLoader`

For non-PII data that doesn't need server context (e.g., a chart fed by a public API), use `clientLoader` so the work happens in the browser and the server loader returns instantly.

### 5.6 Cache loader responses

Set `Cache-Control` headers on loaders that return stable data:

```tsx
export function headers() {
  return {
    "Cache-Control": "private, max-age=60, stale-while-revalidate=600",
  };
}
```

`private` because session-token-authed responses shouldn't be cached on shared CDNs. `stale-while-revalidate` lets the browser serve stale content while it refreshes in the background — near-zero perceived latency on the second navigation.

---

## 6. Polaris bundle slimming

Polaris is the biggest single bundle contributor in most embedded apps. Without care, it ships 800KB+ of gzipped JS.

### 6.1 Use deep imports when your bundler fails to tree-shake

```ts
// Bad — barrel import. Many bundlers pull the whole package.
import { Card, Button, Text } from "@shopify/polaris";

// Good — direct import. Forces tree-shake friendliness.
import Card from "@shopify/polaris/build/esm/components/Card";
import Button from "@shopify/polaris/build/esm/components/Button";
import Text from "@shopify/polaris/build/esm/components/Text";
```

Yes, it's ugly. It saves 200-400KB on Next.js 14/15 + React 18 where tree-shaking is known to fail. Check `npm run build` bundle stats before and after — if your bundler tree-shakes fine, keep the readable imports.

### 6.2 Lazy-load heavy components

Heavy components: `IndexTable`, `DataTable`, `ResourceList` with many rows, `Filters`, anything chart-related, `Modal` (sometimes), the entire Polaris Icons set.

```tsx
import { lazy, Suspense } from "react";
const HeavyTable = lazy(() => import("./HeavyTable"));

<Suspense fallback={<Skeleton />}>
  <HeavyTable rows={rows} />
</Suspense>
```

### 6.3 Tree-shake icons

`@shopify/polaris-icons` is huge if imported as a barrel.

```ts
// Bad — pulls every icon
import * as Icons from "@shopify/polaris-icons";

// Good
import { CheckIcon, AlertIcon } from "@shopify/polaris-icons";
```

Or one level deeper if your bundler still misbehaves:

```ts
import CheckIcon from "@shopify/polaris-icons/dist/svg/CheckIcon";
```

### 6.4 CSS — exactly once at app root

Polaris CSS must be loaded exactly once, at the root. If you tree-shake aggressively, your bundler may drop the CSS-only side-effect.

```ts
// In root.tsx or _app.tsx
import "@shopify/polaris/build/esm/styles.css";
```

Add `@shopify/polaris/build/esm/styles.css` to `sideEffects` in `package.json` if your bundler is over-eager.

### 6.5 Frame and AppProvider — render once, never inside loops

`<AppProvider>` and `<Frame>` are expensive on mount. Mount them in the root layout, never re-create them per route.

### 6.6 Consider App Bridge web components

App Bridge v4 ships native web components (`<ui-modal>`, `<ui-title-bar>`, `<ui-nav-menu>`) that don't require React. For embedded apps, using these instead of their React wrappers shaves ~50KB and removes one re-render layer. The trade-off is they're imperatively controlled, not declaratively.

### 6.7 Audit bundle size

Run before every release:

```bash
# Vite
npx vite-bundle-visualizer

# Webpack
npx webpack-bundle-analyzer dist/stats.json

# Or generic
npx source-map-explorer dist/**/*.js
```

Find the top 5 contributors. Polaris should be < 200KB gzipped, your app code < 100KB gzipped, total initial route < 350KB gzipped.

---

## 7. GraphQL strategy

### 7.1 Batch what can be batched

Two related queries that don't depend on each other? One GraphQL document:

```graphql
query DashboardData {
  shop { name myshopifyDomain }
  products(first: 10) { edges { node { id title } } }
}
```

One round-trip instead of two. One throttle bucket charge.

### 7.2 Paginate small for embedded views

`first: 250` is cheap on simple queries (id, title) and expensive on nested ones (products → variants → metafields). For embedded admin views, fetch `first: 25` and paginate. Render fast, fetch the next page on `prefetch="intent"`.

### 7.3 Defer non-critical fields with `@defer`

Shopify supports the GraphQL `@defer` directive on some fields. Use it for heavy nested data:

```graphql
query {
  product(id: $id) {
    id
    title
    ... @defer { metafields(first: 50) { edges { node { id value } } } }
  }
}
```

Server streams the cheap fields first, then the deferred. Pairs nicely with Remix's `defer`.

### 7.4 Bulk operations for > 250 records

For exports, audits, "all products at once" workloads, never paginate. Use `bulkOperationRunQuery`:

```graphql
mutation {
  bulkOperationRunQuery(query: """{ products { edges { node { id title } } } }""") {
    bulkOperation { id status }
    userErrors { field message }
  }
}
```

Then poll `currentBulkOperation` until `status == COMPLETED`, download the JSONL. One bucket charge, async, runs in Shopify's infra.

### 7.5 Detect throttling (the 200-OK kind)

Throttled GraphQL responses arrive as HTTP 200 with `errors[*].extensions.code == "THROTTLED"`. Check every response:

```ts
const response = await admin.graphql(QUERY);
const body = await response.json();

if (body.errors?.some(e => e.extensions?.code === "THROTTLED")) {
  const cost = body.extensions.cost.throttleStatus;
  const waitMs = ((cost.requestedQueryCost - cost.currentlyAvailable) / cost.restoreRate) * 1000;
  await new Promise(r => setTimeout(r, waitMs));
  return retry();
}
```

Log `extensions.cost.actualQueryCost` and `currentlyAvailable` on every response. If you're consistently above 50% bucket usage, you have an N+1 GraphQL problem.

### 7.6 Query cost budget

| Plan | Bucket size | Restore rate |
|------|-------------|--------------|
| Standard | Read `maximumAvailable` | 100 points/sec |
| Advanced | Read `maximumAvailable` | 200 points/sec |
| Plus | Read `maximumAvailable` | 1,000 points/sec |
| Enterprise | Read `maximumAvailable` | 2,000 points/sec |

Your typical query should cost < 100 points. If a single query crosses 500, refactor before shipping.

---

## 8. Image strategy

### 8.1 Use the Shopify Image CDN with size transforms

Never link to the original image URL. Always request a sized variant:

```liquid
{{ product.featured_image | image_url: width: 600 }}
```

In a Remix app, GraphQL returns `image.url(transform: { maxWidth: 600 })`:

```graphql
image {
  url(transform: { maxWidth: 600, preferredContentType: WEBP })
  altText
  width
  height
}
```

### 8.2 Always set explicit `width` and `height`

CLS happens when the browser doesn't reserve space for an image and content shifts when it loads. Always:

```tsx
<img src={url} width={600} height={400} alt={altText} loading="lazy" />
```

Or via `aspect-ratio` CSS if dimensions are dynamic.

### 8.3 Lazy-load below-the-fold images

```tsx
<img loading="lazy" decoding="async" ... />
```

Native lazy-load is supported in every modern browser. Above-the-fold images stay `loading="eager"` so they count toward LCP.

### 8.4 Use modern formats

`preferredContentType: WEBP` (or `AVIF` where available) in the Shopify GraphQL image transform. 30-50% smaller than JPEG, no quality difference.

### 8.5 Preload the LCP image

If the merchant lands on a product page and the hero image is the LCP element, preload it:

```tsx
export const links = () => [
  { rel: "preload", as: "image", href: heroImageUrl },
];
```

LCP drops by 200-600ms depending on connection.

---

## 9. Caching

### 9.1 Server cache (HTTP)

On loader responses that are safe to cache:

```ts
export function headers() {
  return {
    "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
    "Vary": "Cookie",
  };
}
```

- `private` — never cache on shared CDN; merchant data isn't safe to share
- `max-age=60` — browser cache for 60s
- `stale-while-revalidate=300` — serve stale for 5 minutes while refreshing in background
- `Vary: Cookie` — different merchants get different cached responses

For truly public data (your app's marketing page outside the embedded surface), use `public, max-age=3600, s-maxage=86400` and let the CDN cache it for a day.

### 9.2 CDN edge

If your platform supports edge caching (Vercel, Cloudflare), tag responses and purge on writes. Vercel `unstable_cache`, Cloudflare Cache API, or just `s-maxage` on responses that are tenant-scoped.

### 9.3 Browser localStorage for non-PII

The merchant's "preferred view" toggle, the "last sort order" they chose, UI state — `localStorage`. Never put PII, never put session tokens, never put shop credentials.

### 9.4 In-memory cache on the server

For data that's expensive to fetch and changes rarely (shop settings, app plan info, currency code), cache in process memory with a 60s TTL:

```ts
const cache = new Map<string, { value: any; expires: number }>();

export async function getShop(shop: string) {
  const cached = cache.get(shop);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = await fetchShop(shop);
  cache.set(shop, { value, expires: Date.now() + 60_000 });
  return value;
}
```

If you have multiple server instances, this only helps per-instance. For shared cache, use Redis (Upstash, Vercel KV).

---

## 10. Database — Prisma

### 10.1 Connection pooling

Without pooling, every serverless function invocation opens a new Postgres connection. Your database runs out of connections fast.

Options:

- **Cloudflare Hyperdrive** — global Postgres connection pooler with TLS. Connect Prisma to the Hyperdrive endpoint, get pooled connections with edge latency.
- **PgBouncer** (managed) — Supabase, Neon, Railway all run PgBouncer in front of Postgres. Use the pooled connection string (`...pgbouncer=true&connection_limit=1`).
- **Prisma Accelerate** — Prisma's managed pooler + edge cache. Easiest if you don't want to think about it.

In `schema.prisma`:

```prisma
datasource db {
  provider          = "postgresql"
  url               = env("DATABASE_URL")          // pooled connection
  directUrl         = env("DIRECT_DATABASE_URL")   // unpooled, for migrations
}
```

### 10.2 Fix N+1 with `include` or batched queries

```ts
// Bad — N+1
const products = await prisma.product.findMany();
for (const p of products) {
  p.metafields = await prisma.metafield.findMany({ where: { productId: p.id } });
}

// Good — one query, joined
const products = await prisma.product.findMany({
  include: { metafields: true },
});
```

Or for many-to-many with filters, use `findMany` with `where: { id: { in: ids } }` once, then group in JS.

### 10.3 Index your foreign keys and lookup columns

Every `where: { shop: "..." }` lookup needs an index on `shop`. Without it, your Postgres scans the whole table:

```prisma
model Session {
  id     String @id
  shop   String
  data   String

  @@index([shop])
}
```

### 10.4 Use `select` to fetch only what you need

```ts
// Bad — loads every column including blobs
const session = await prisma.session.findUnique({ where: { id }});

// Good
const session = await prisma.session.findUnique({
  where: { id },
  select: { id: true, shop: true, accessToken: true },
});
```

### 10.5 Database location

Put the DB in the same region as the server. Cross-region Postgres adds 60-200ms per query. Two queries serially = LCP burnt.

---

## 11. Webhook handlers

### 11.1 Return 200 in < 2 seconds, always

Shopify retries webhooks after 5 seconds. If you do real work synchronously, you'll be retried, processed twice, throttled.

Pattern:

```ts
export async function action({ request }) {
  const { topic, shop, payload } = await authenticate.webhook(request);

  // Push to queue. Return immediately.
  await queue.enqueue({ topic, shop, payload, webhookId: request.headers.get("X-Shopify-Webhook-Id") });

  return new Response(null, { status: 200 });
}
```

### 11.2 Queue choices

- **Inngest** — easiest. Type-safe, retries, observability built in. Free tier covers most apps.
- **Trigger.dev** — similar, with longer-running jobs and a workflow visualizer.
- **BullMQ + Redis** — self-hosted, max control. Use if you already have Redis.
- **AWS SQS / Cloudflare Queues** — if you live in that ecosystem.
- **DB-backed queue** (`pg-boss`, `graphile-worker`) — fewest moving pieces if you already have Postgres.

The pattern is the same regardless: webhook handler does HMAC verify, persists the job, returns 200. A worker picks up the job.

### 11.3 Idempotency

Webhooks are at-least-once. Your handler will be called twice on the same event sometimes.

```ts
const webhookId = request.headers.get("X-Shopify-Webhook-Id");
const existing = await prisma.processedWebhook.findUnique({ where: { id: webhookId }});
if (existing) return new Response(null, { status: 200 });

await prisma.processedWebhook.create({ data: { id: webhookId, processedAt: new Date() }});
// process the work
```

### 11.4 HMAC verify on the raw body, not the parsed JSON

If you `await request.json()` before HMAC, Express/Remix may have mutated the body and your HMAC will fail. Use `authenticate.webhook(request)` from the Shopify Remix package — it does this correctly.

---

## 12. Measuring

### 12.1 Web Vitals API (the one BFS cares about)

Wire up the App Bridge Web Vitals API and send to your monitoring service:

```ts
import { shopify } from "@shopify/app-bridge-react";

shopify.webVitals.onReport((metric) => {
  // metric.name: 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB'
  // metric.value: number
  // metric.attribution: detailed breakdown
  sendToMonitoring(metric);
});
```

Without this wired up, BFS shows nothing and you can't improve what you don't measure.

### 12.2 Server monitoring

- **Sentry** — errors + performance traces. Free tier is generous.
- **Datadog** — pricier, deeper. APM, RUM, logs in one place.
- **Axiom** — log-first, cheap, great for serverless.
- **OpenTelemetry + your own backend** — for the curious.

Track p50, p95, p99 latency on every loader and action. Alert when p95 crosses 400ms (well before the BFS gate of 500ms).

### 12.3 Bundle size in CI

Add a bundle-size check that fails CI:

```json
"scripts": {
  "size": "size-limit"
},
"size-limit": [
  { "path": "build/client/**/*.js", "limit": "350 KB" }
]
```

### 12.4 BFS audit tooling

Shopify's Partners dashboard shows your Web Vitals data after the 100-call minimum is hit. Check it weekly. If you see a regression, bisect against your deploys.

---

## 13. 25 performance rules (cheat sheet)

1. App Bridge CDN script in `<head>` before your bundle, always.
2. Polaris CSS imported exactly once at the root.
3. Deep-import Polaris components if your bundler tree-shakes badly.
4. Lazy-load any component over 50KB.
5. Lazy-load icons; deep-import from `@shopify/polaris-icons`.
6. Render `<AppProvider>` and `<Frame>` exactly once.
7. Loader awaits only what's needed for first paint; everything else is `defer`'d.
8. `prefetch="intent"` on every internal `<Link>`.
9. Cache-Control headers on every loader response (private, max-age, SWR).
10. Server runs on always-on infra (or warm pings) — no scale-to-zero for the embedded surface.
11. Server is in the same region as your DB.
12. DB connections pooled (Hyperdrive, PgBouncer, or Accelerate).
13. Every Prisma `where` column is indexed.
14. Prisma `select` only what you need; no SELECT *.
15. No N+1 — use `include` or batched `findMany`.
16. GraphQL queries batched where possible; `first: 25` for embedded views.
17. GraphQL responses checked for `extensions.code == "THROTTLED"` on every call.
18. Bulk operations for > 250 records, never paginate.
19. Images via Shopify Image CDN with `maxWidth` and `WEBP`.
20. Every `<img>` has explicit `width`, `height`, `loading="lazy"` (except LCP).
21. LCP image preloaded via `<link rel="preload">`.
22. Webhook handlers return 200 in < 2 seconds; heavy work in queue.
23. Webhook handlers idempotent via `X-Shopify-Webhook-Id`.
24. Web Vitals API wired to monitoring; check weekly.
25. Bundle size budget enforced in CI; current threshold 350KB gzipped initial route.

---

## 14. Decision tree

```
Embedded app is slow. Where do I start?
│
├── Is the FIRST load slow (cold)?
│   ├── Yes → Server cold start
│   │        Switch to always-on infra OR add warm pings
│   │        Verify with curl timing on cold vs warm: curl -w "%{time_total}\n" -o /dev/null -s URL
│   │
│   └── No → Continue
│
├── Is EVERY load slow?
│   ├── Yes → Likely bundle size or loader latency
│   │
│   │   Check bundle:
│   │   ├── Run vite-bundle-visualizer or webpack-bundle-analyzer
│   │   ├── If Polaris > 250KB gzipped → deep-import, lazy-load heavy components
│   │   ├── If icons > 100KB → deep-import per icon
│   │   └── If your app code > 200KB → split routes, lazy-load
│   │
│   │   Check loader:
│   │   ├── Log loader duration per route
│   │   ├── If > 400ms → look for serial awaits, switch to defer + Promise.all
│   │   ├── If > 1s → GraphQL or DB problem (sections below)
│   │   └── If GraphQL — check actualQueryCost in extensions.cost
│   │
│   └── No → Continue
│
├── Is NAVIGATION slow (clicking around)?
│   ├── Yes → Missing prefetch
│   │        Add prefetch="intent" to all internal Links
│   │        Add Cache-Control headers to stable loader responses
│   │
│   └── No → Continue
│
├── Is the APP unresponsive during interaction (high INP)?
│   ├── Yes → Main thread blocked
│   │        ├── Heavy synchronous work in event handlers — break into chunks or move to worker
│   │        ├── Re-rendering large lists on every keystroke — virtualize (react-virtual, IndexTable virtualization)
│   │        └── Large state updates — useDeferredValue or useTransition
│   │
│   └── No → Continue
│
├── Is the UI JUMPY (high CLS)?
│   ├── Yes → Layout shifts
│   │        ├── Images missing width/height
│   │        ├── Skeletons not matching final dimensions
│   │        ├── Fonts loading and re-flowing (use font-display: optional or swap with size-adjust)
│   │        └── Late-loading ads/embeds pushing content
│   │
│   └── No → Continue
│
├── Are SERVER metrics (p95) too high?
│   ├── DB queries slow?
│   │   ├── Check Prisma logs (DEBUG=prisma:query)
│   │   ├── Add indexes on every WHERE column
│   │   ├── Fix N+1 with include
│   │   └── Move DB to same region as server
│   │
│   ├── GraphQL slow?
│   │   ├── Check actualQueryCost — if > 100, prune fields
│   │   ├── Batch where possible
│   │   └── Switch to bulk operations for > 250 records
│   │
│   └── Cold start?
│       └── See top of tree
│
└── Are WEBHOOKS getting retried?
    └── Handler taking > 2 seconds
         ├── HMAC verify + 200 OK first
         ├── Push work to queue
         └── Idempotent on X-Shopify-Webhook-Id
```

---

## 15. Pre-submit performance checklist

Run through this before BFS submission:

- [ ] App Bridge Web Vitals API wired, sending to monitoring
- [ ] 100+ launches recorded over 28 days (let it run before submitting if new)
- [ ] LCP p75 ≤ 2.5s in Web Vitals dashboard
- [ ] INP p75 ≤ 200ms
- [ ] CLS p75 ≤ 0.1
- [ ] Server p95 latency ≤ 400ms (cushion below BFS 500ms)
- [ ] Server failure rate ≤ 0.05% (cushion below BFS 0.1%)
- [ ] Bundle size for initial route ≤ 350KB gzipped
- [ ] Polaris CSS imported exactly once at root
- [ ] No `<img>` without explicit `width` and `height`
- [ ] Images served from Shopify Image CDN with WEBP
- [ ] All internal `<Link>` use `prefetch="intent"`
- [ ] Loaders use `defer` for non-critical data
- [ ] Cache-Control headers on stable loader responses
- [ ] Server runs on always-on infra
- [ ] DB connection pooling enabled
- [ ] All Prisma WHERE columns indexed
- [ ] No N+1 in any loader (verified with Prisma query logs)
- [ ] GraphQL throttle detection in every request wrapper
- [ ] Webhook handlers return 200 in < 2s, queue heavy work
- [ ] Webhook handlers idempotent via `X-Shopify-Webhook-Id`
- [ ] Storefront extensions (if any) ≤ 50KB gzipped per surface
- [ ] Storefront Lighthouse delta ≤ 5 points

If all checked, submit. If any unchecked, fix first — BFS rejection on perf burns a 28-day re-measurement window you don't want to repeat.

---

## Closing principle

Performance in a Shopify embedded app is the sum of three latencies the merchant feels: **server**, **bundle**, **render**. Optimize all three. Most apps fix one and ignore the other two, then wonder why BFS still rejects them. Wire up Web Vitals first so you can see the truth — then the fixes above are a checklist, not a guess.
