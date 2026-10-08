---
name: built-for-shopify-standards
description: "Prepare a Shopify app for Built for Shopify status. Covers current quality criteria, performance, accessibility, Shopify admin integration, compliance webhooks, observability, support, application readiness, and ongoing eligibility."
---

# Built for Shopify Standards

The official quality bar for Shopify App Store apps. Qualifying apps receive the Built for Shopify highlight and badge, additional App Store promotion, eligibility for promotion on other merchant surfaces, and priority review for future app submissions. BFS does not create a separate revenue-share tier.

This skill is the full requirement matrix as of May 2026, with rejection patterns, a 50-item self-check, and a decision tree to tell you whether you're ready to apply.

---

## 1. When to use this skill

Trigger this skill when:

- You're planning to submit an app for the Built for Shopify (BFS) designation
- You got a "fails to meet Built for Shopify standards" rejection and want to fix it
- You're scoping a v1 app and want to build to BFS from the start (cheaper than retrofitting)
- A merchant or partner mentioned your app "isn't Built for Shopify yet"
- You're doing a 90-day audit before reapplying after a previous BFS failure
- You're deciding whether the promotional benefits justify the implementation and ongoing-compliance work
- You want to know exactly what "integration depth" means in BFS-speak (it's specific)
- You're comparing your app against a competitor that has the badge and want to close the gap
- You're hitting LCP, INP, CLS, or API p95 problems and want to know the actual gate numbers
- You're wiring up GDPR webhooks and want to confirm BFS still requires all three

Don't use this skill for:

- General App Store submission (different bar — that's `app-validation`)
- Performance debugging itself (that's `app-performance` — this skill references those thresholds but doesn't reteach them)
- Polaris implementation details (that's a separate UI/design skill)
- Listing copy or screenshots (that's `app-listing-optimization`)
- Pricing strategy (that's `app-pricing-strategy`)

This skill is the audit framework. The fix-it skills live elsewhere.

---

## 2. What Built for Shopify actually is

### 2.1 It's a designation, not a category

A common misunderstanding: founders think "Built for Shopify" is a category they apply to and join. It isn't. Every BFS app stays in its primary category (Marketing, Fulfillment, etc.) and additionally earns a **badge** that displays on the App Store listing and in search results.

The badge says, in effect: "Shopify has tested this app against a defined quality bar and it currently passes." It's not a permanent stamp — Shopify re-evaluates apps continuously and apps **lose BFS status** if they fall below thresholds (e.g., LCP regresses, support response time slips, a customer complaint storm hits, you start failing accessibility checks).

### 2.2 Why merchants notice the badge

Shopify documents these benefits:

- A Built for Shopify highlight on the app listing
- A badge on App Store cards, including search results and category pages
- A merchant-facing search filter for Built for Shopify apps
- Additional promotion in the Shopify App Store and eligibility for promotion on other key merchant surfaces
- Priority review for future app submissions from BFS developers

Treat any claim about conversion lift, install velocity, ranking weight, or guaranteed featuring as an experiment to measure for your app, not as an official BFS guarantee.

### 2.3 The revenue share angle (verify the exact terms before relying on it)

Shopify's revenue share for App Store developers has shifted multiple times. As of the most recent published policy update:

- **First $1M USD in lifetime gross app revenue earned from January 1, 2025**: 0% revenue share (you keep 100%)
- **Above $1M lifetime**: 15% revenue share (you keep 85%)

Critical clarifications:

- Earnings before Jan 1, 2025 don't count toward the $1M threshold.
- Revenue is aggregated across apps and associated developer accounts. Associated accounts must be declared; don't split related accounts to avoid the threshold.
- All billing is also subject to a 2.9% processing fee, applicable sales tax, and possible regional fees.
- Very large developers have separate eligibility rules, so verify Shopify's current policy for your organization.
- This 0%/15% structure applies whether or not you have BFS — BFS does **not** currently grant a special revenue share tier on top of this (an older "Built for Shopify gets 15%/20% while non-BFS gets nothing" model existed in some historical content; that's outdated)

**Action**: Before submitting financial projections or making a strategic decision based on revenue share, re-read `https://shopify.dev/docs/apps/launch/distribution/revenue-share` and the latest changelog entry. Shopify has changed this policy three times in the last four years.

### 2.4 What BFS does NOT do

Useful to know so you don't oversell internally:

- It does **not** guarantee installs (the badge helps; it doesn't replace marketing)
- It does **not** exempt you from App Store guideline violations (you can still get pulled for trademark issues, security failures, etc.)
- It does **not** give you direct contact with Shopify reviewers (you still go through standard channels)
- It does **not** make your app eligible for the Shopify Plus Certified App Program (that's a separate, much higher bar)
- It is **not** the same as the Shopify Plus Technology Partner badge

---

## 3. Full requirement matrix (May 2026)

Three pillars: **Performance**, **Design**, **Integration**. Plus operational gates: support, observability, compliance. All must be met simultaneously and continuously.

### 3.1 Performance pillar

| Requirement | Threshold | Measurement | Window |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) — admin embedded | ≤ 2.5s at p75 | Web Vitals API via App Bridge | 28 days, min 100 launches |
| **INP** (Interaction to Next Paint) — admin embedded | ≤ 200ms at p75 | Web Vitals API via App Bridge | 28 days, min 100 launches |
| **CLS** (Cumulative Layout Shift) — admin embedded | ≤ 0.1 at p75 | Web Vitals API via App Bridge | 28 days, min 100 launches |
| **API p95 latency** (your server endpoints) | < 500ms | Shopify Partner dashboard / your APM | 28 days |
| **API failure rate** | < 0.1% | Shopify Partner dashboard / your APM | 28 days, min 1000 requests |
| **Storefront Lighthouse delta** (if you ship theme app extensions) | ≤ 10 points reduction | Lighthouse run with/without your extension | Spot check |
| **Storefront JS budget per surface** (theme app extensions) | ≤ 50KB gzipped (rule of thumb) | Your bundle audit | Per release |
| **Webhook ACK latency** | < 5s (target < 2s) | Your monitoring + Shopify retry logs | Continuous |

See `../app-performance/SKILL.md` for the fix-it playbook for every metric above. This skill enforces the gate while the companion skill provides the remediation workflow.

### 3.2 Design pillar

| Requirement | Standard |
|---|---|
| **Polaris adherence** | Use Polaris components for all admin UI; deviations must match Polaris visual language |
| **App Bridge version** | Latest App Bridge (currently 4.x, loaded via CDN script in `<head>`, before your bundle) |
| **Embedded experience** | App renders embedded in Shopify admin by default; primary workflows complete inside the admin |
| **Mobile responsive** | All admin views functional on Shopify mobile admin app (iOS + Android) |
| **Polaris CSS loaded exactly once** | At the root, no duplicate imports, no per-route loading |
| **Accessibility** | WCAG 2.1 Level AA (matches Polaris's own target) |
| **Dark mode** | Polaris components handle automatically; custom UI must support it |
| **Internationalization** | Use Polaris's i18n system; locale awareness for all merchant-facing text |
| **Visual consistency** | Spacing, typography, color tokens come from Polaris; no ad-hoc CSS for these |
| **Loading states** | Skeletons match final dimensions to prevent CLS |
| **Empty states** | Provided for every list, table, and dashboard view |
| **Error states** | Human-readable error messages, never raw error codes or stack traces |

### 3.3 Integration pillar

This is the BFS-specific one most apps fail. "Integration depth" means: **your app feels like a native part of Shopify, not a third-party iframe**. The reviewer is checking that you've used at least one — and often several — of these surfaces:

| Integration surface | What it does | When BFS reviewers expect it |
|---|---|---|
| **Admin Action extensions** | Buttons in the admin's resource pages (Orders, Products, Customers) that invoke your app | If your app operates on Orders/Products/Customers, expected |
| **Admin Block extensions** | Inline blocks that render your app's UI inside the admin's native resource pages | Strong differentiator; expected for "deep" integrations |
| **Admin Link extensions** | Navigation links that appear in the admin sidebar pointing to your embedded app | Baseline; almost every BFS app has these |
| **ResourcePicker API** | Native Shopify picker for products, collections, variants — instead of you building your own | Required if your app needs merchants to select these |
| **Bulk action support** | Selecting many resources at once and invoking your app on the batch | Expected for any app that operates on lists of resources |
| **Theme App Extensions (App Blocks)** | Storefront UI that merchants add to themes via the theme editor | Required if your app touches the storefront |
| **Shopify Functions** | Server-side logic that runs in Shopify's infra (discounts, delivery customization, payment customization) | Required if your app modifies checkout/discount/delivery logic |
| **Web Pixels** | Customer behavior tracking that respects the consent layer | Required for any storefront analytics/tracking app |
| **Checkout UI Extensions** | UI in checkout (Plus/Shopify Payments only) | Required for checkout-modifying apps |
| **Metafields + Metaobjects** | First-class storage of your app's data on Shopify's side | Strongly preferred over a private DB for merchant-visible data |
| **Flow connectors / triggers / actions** | Integration with Shopify Flow | Expected if your app has events worth automating |

**Rule of thumb**: A BFS app uses at least 3 of these. An app that ships only the embedded admin and reads/writes via GraphQL with no other surfaces will frequently get "lacks integration depth" feedback.

### 3.4 Compliance pillar

| Requirement | Detail |
|---|---|
| **Mandatory privacy webhooks** | All three handlers implemented and returning 200: `customers/data_request`, `customers/redact`, `shop/redact` |
| **Privacy webhook HMAC verification** | Every webhook handler verifies the `X-Shopify-Hmac-Sha256` header before processing |
| **Privacy policy** | Public URL, no login required, mentions GDPR + CCPA + data retention period |
| **Terms of Service** | Public URL, includes app limitations and refund policy |
| **OAuth scopes minimal** | Request only scopes you actually use; reviewers compare requested vs. observed |
| **OAuth flow standard** | Use Shopify's official OAuth flow — no custom session schemes |
| **Session tokens (not third-party cookies)** | For embedded apps; third-party cookies in 2026 are blocked by every modern browser anyway |
| **HTTPS everywhere** | Valid SSL on every endpoint, including webhook handlers and the support email's domain |
| **Sensitive data encryption** | Access tokens, API keys, customer PII encrypted at rest |
| **Data residency** | Honor merchant region preferences if you store EU customer data |
| **Uninstall hygiene** | App deletes all merchant data on `shop/redact` and removes any theme code it injected |

### 3.5 Support pillar

| Requirement | Standard |
|---|---|
| **Support email** | Functional, monitored, on your own domain (not gmail.com) |
| **Public help center / docs** | Searchable, covers setup + top 10 questions |
| **Response time SLA** | Public commitment; BFS reviewers expect **≤ 24 business hours** as the floor |
| **Live chat or messaging channel** | Not strictly required but strongly preferred for higher-tier BFS visibility |
| **Status page** | Public uptime + incident history (StatusPage.io free tier or similar) |
| **In-app help** | Contextual help links from inside your app to the relevant doc |
| **Onboarding** | Merchant reaches first value in < 2 minutes from install |

### 3.6 Observability pillar

| Requirement | Why |
|---|---|
| **Web Vitals API wired up** | BFS literally cannot measure your app without this. App Bridge ships an API; you call `shopify.webVitals.onReport(...)` and forward to your monitoring |
| **Error tracking** | Sentry, Datadog, Axiom, etc. Track every server error and unhandled client exception |
| **APM** | Per-route latency p50/p95/p99 for every loader and action |
| **Webhook delivery monitoring** | Track ACK time and failure rate; alert when retries spike |
| **GraphQL throttle monitoring** | Alert when `extensions.cost.actualQueryCost` consistently exceeds 50% of bucket |
| **Audit log retention** | At minimum 30 days of structured logs for support debugging |

---

## 4. Performance gates — exact numbers

These are the BFS gates as of May 2026. They are p75 (75th percentile of merchant launches) over a rolling 28-day window. You need a minimum sample size before BFS can measure you at all, so a brand-new app needs to run for ~30 days with real merchants before it's even eligible.

### 4.1 Core Web Vitals (admin embedded)

| Metric | Pass | Window | Min sample |
|---|---|---|---|
| LCP | ≤ 2.5s p75 | 28 days | 100 launches |
| INP | ≤ 200ms p75 | 28 days | 100 launches |
| CLS | ≤ 0.1 p75 | 28 days | 100 launches |

**Important**: Google has been increasing the weight of real-user (CrUX) data over lab data in its own ranking. Shopify follows suit — Lighthouse scores on your raw URL are advisory, not the gate. The gate is what App Bridge's Web Vitals API reports from actual merchant sessions. If you haven't wired that up, you can't be measured, you can't pass, you can't get BFS.

### 4.2 Server / API

| Metric | Pass | Window |
|---|---|---|
| API p95 latency | < 500ms | 28 days |
| API failure rate | < 0.1% | 28 days, min 1000 requests |

Build a cushion: target p95 ≤ 400ms and failure rate ≤ 0.05% so a single bad week doesn't sink you.

### 4.3 Storefront impact (theme app extensions only)

| Metric | Pass |
|---|---|
| Lighthouse performance delta | ≤ 10 points reduction with your extension installed |
| Per-surface JS budget | ≤ 50KB gzipped (rule of thumb) |

Measure delta by running Lighthouse on a clean test theme, then installing your extension to the same theme and re-running. The difference must be < 10 points.

### 4.4 Webhook latency

| Metric | Pass |
|---|---|
| Webhook handler ACK | < 5s (Shopify retries at 5s) |
| Target | < 2s with heavy work queued |

The way to pass: HMAC verify, persist the job to a queue, return 200. A worker handles the actual processing.

---

## 5. Accessibility gates — WCAG 2.1 AA

Polaris components already meet WCAG 2.1 AA by default. So if you use Polaris everywhere and don't add custom UI, you get this for free. The places apps trip up:

### 5.1 Where apps lose accessibility points

| Failure | Fix |
|---|---|
| **Custom forms not using Polaris `<TextField>`, `<Select>`, etc.** | Replace with Polaris components |
| **Missing `<label>` association on form inputs** | Polaris does this automatically; custom inputs need `htmlFor` + matching `id` |
| **Color contrast below 4.5:1 for text** (or 3:1 for large text) | Use Polaris color tokens; never set custom hex colors for text |
| **Focus not visible on keyboard tab** | Don't override Polaris focus rings; if you must, ensure visible outline at 2px+ |
| **Modals trap focus poorly** | Use Polaris `<Modal>`, not a hand-rolled overlay; it manages focus correctly |
| **Images missing `alt`** | Every `<img>` has `alt` (empty string for decorative is fine) |
| **Icon-only buttons missing `accessibilityLabel`** | Polaris `<Button>` requires this; set it on every icon-only button |
| **Dynamic content not announced** | Use `<Toast>` or `<Banner>` from Polaris; they handle ARIA live regions |
| **Tables without proper `<th>` scope** | Use Polaris `<IndexTable>` or `<DataTable>` |
| **Custom dropdowns without keyboard nav** | Use Polaris `<Popover>` or `<Combobox>` |
| **Form errors not associated with fields** | Polaris `<TextField error="...">` handles this; custom forms need `aria-describedby` |
| **Skip links missing on long pages** | Add a "Skip to main content" link as the first focusable element |
| **Heading order broken** (`<h1>` → `<h3>` skipping `<h2>`) | Audit with axe DevTools |

### 5.2 Required keyboard interactions

Every interactive element must be reachable and operable by keyboard alone:

- Tab — moves to next focusable element
- Shift+Tab — previous
- Enter — activates buttons and links
- Space — activates buttons (not links), toggles checkboxes
- Arrow keys — navigate within composite widgets (menus, tabs, listboxes)
- Escape — closes modals, popovers, dropdowns

Test this manually: unplug your mouse and try to do every primary workflow. If you can't, you don't pass.

### 5.3 Screen reader testing

Test with at least one screen reader before submission:

- **VoiceOver** (macOS, free, built-in) — Cmd+F5 to enable
- **NVDA** (Windows, free) — most-used in real-world WCAG audits
- **JAWS** (Windows, paid) — enterprise reality

Walk through onboarding + primary workflows. Every screen should be understandable from audio alone.

### 5.4 Automated audit tools

Run all three on every release:

- **axe DevTools** (browser extension) — catches ~40% of issues
- **Lighthouse** accessibility section
- **WAVE** (browser extension) — visual annotations of issues

These tools combined catch maybe 50-60% of WCAG violations. The other 40% require manual testing.

---

## 6. UX / Polaris compliance

### 6.1 The Polaris rule

If Polaris has a component for it, use Polaris's component. Don't build your own button, your own modal, your own form field. Reviewers explicitly look for this. Custom components that visually match Polaris are not enough — they're trying to verify that you've adopted Polaris's accessibility, dark mode, i18n, and responsive behavior.

### 6.2 App Bridge 4.x requirement

All BFS apps must use the **latest version of App Bridge**. As of May 2026, that's App Bridge 4.x.

Migration from earlier versions:

- **App Bridge 1.x / 2.x** — fully deprecated; rewrite required
- **App Bridge 3.x** — supported but not BFS-eligible; upgrade
- **App Bridge 4.x** — the current target; loaded via CDN script

How to load App Bridge 4.x correctly:

```html
<head>
  <!-- This MUST come before your bundle -->
  <meta name="shopify-api-key" content="YOUR_API_KEY" />
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
  <!-- Then your app bundle -->
  <script type="module" src="/build/entry.js"></script>
</head>
```

The script tag is non-negotiable. Bundling App Bridge into your app bundle (via npm) instead of loading it from Shopify's CDN will fail BFS — Shopify needs to control which version runs so they can ship security patches without your redeploy.

### 6.3 Mobile responsive

Shopify's mobile admin app (iOS + Android) renders your embedded app in a webview. Your UI must work at:

- 375px wide (iPhone SE / small Android) — minimum
- 768px wide (iPad portrait)
- 1024px+ wide (desktop)

Polaris components handle this automatically. Custom layouts must use CSS Grid / Flexbox responsively.

### 6.4 Embedded by default

Your app must open inside the Shopify admin's iframe. Opening into a new browser tab, or requiring the merchant to leave the admin to use your app, is a BFS fail.

Exceptions:

- Non-Shopify-related external integrations (e.g., connecting your Stripe account for billing) can open in a new tab
- Long-running file downloads can navigate the parent

---

## 7. Integration depth — what counts

This section deserves its own treatment because "lacks integration depth" is the single most common qualitative rejection.

### 7.1 What reviewers are checking

The reviewer asks: **"Does this app feel like a native part of Shopify, or like a third-party tool with a Shopify OAuth wrapper?"**

Signals of "native":

- Merchant can do most of their work without leaving the admin
- The app shows up in contextual locations (Order detail, Product detail, etc.)
- The app uses Shopify's native UI primitives (ResourcePicker, IndexTable, AppBridge actions) instead of building parallel versions
- The app extends Shopify's surfaces (Functions, Theme App Extensions, Flow) where relevant

Signals of "wrapper":

- Merchant has to leave the admin or open external tabs frequently
- The app builds its own product picker instead of using ResourcePicker
- The app dumps merchants into a generic dashboard with no contextual entry points from Orders/Products/Customers
- The app reads/writes via GraphQL but ships no extensions

### 7.2 Integration surfaces ranked by impact

From most to least impactful for "integration depth" feedback:

1. **Admin Block extensions** — render your UI inside a native resource page. Strongest signal of native integration.
2. **Admin Action extensions** — buttons in the admin that invoke your app. Strong signal.
3. **Theme App Extensions (App Blocks)** — merchant adds your storefront UI via the theme editor. Required for storefront-touching apps.
4. **Shopify Functions** — server-side logic in Shopify infra. Strong signal for checkout/discount/delivery apps.
5. **ResourcePicker API** — using Shopify's native picker instead of your own. Cheap to implement, big signal.
6. **Bulk action handling** — invoking your app on a multi-select of resources. Cheap to implement.
7. **Metafields / Metaobjects** — store data on the Shopify side rather than only in your DB. Makes data visible in admin contexts.
8. **Flow connectors** — exposing triggers and actions to Shopify Flow.
9. **Web Pixels** — for any tracking/analytics apps.
10. **Admin Link extensions** — sidebar nav entries. Baseline; everyone has these.

**Target**: Implement at least 3 of these. Apps with 1-2 frequently get "lacks integration depth." Apps with 5+ rarely do.

### 7.3 GraphQL Admin API expectations

Use the latest stable API version. Shopify versions are supported for a limited window. When this release was audited, the current stable version was `2026-07`; verify the version schedule before each release.

BFS apps must use a non-deprecated version. Don't ship pinned to `2024-04` and expect to pass.

### 7.4 REST Admin API is legacy

Shopify classified the REST Admin API as legacy on October 1, 2024, and new public apps have been required to use GraphQL exclusively since April 1, 2025. Shopify has not announced a blanket end-of-2026 shutdown for every REST resource. Existing integrations should track their API versions and migrate resource by resource.

---

## 8. GDPR webhooks — non-negotiable

All three must be implemented, working, HMAC-verified, and responsive within 30 seconds (Shopify's compliance webhook timeout is more lenient than regular webhooks but still finite).

### 8.1 The three handlers

#### `customers/data_request`

Sent when a merchant or customer requests all customer data your app holds for a specific customer.

Payload includes:

```json
{
  "shop_id": 123,
  "shop_domain": "example.myshopify.com",
  "orders_requested": [123, 456],
  "customer": { "id": 789, "email": "customer@example.com", "phone": "+1..." },
  "data_request": { "id": 999 }
}
```

Your handler: collect all data you store about this customer, return it in a format you can deliver to the merchant (email a JSON file, generate a download link, etc.). The webhook itself just needs to return 200; the data delivery happens out-of-band.

#### `customers/redact`

Sent 10 days after a customer's deletion request (Shopify's mandatory waiting period).

Payload:

```json
{
  "shop_id": 123,
  "shop_domain": "example.myshopify.com",
  "customer": { "id": 789, "email": "customer@example.com", "phone": "+1..." },
  "orders_to_redact": [123, 456]
}
```

Your handler: delete or anonymize all data you hold for this customer. Cascade through related records. Log the deletion for compliance audit.

#### `shop/redact`

Sent 48 hours after a merchant uninstalls your app.

Payload:

```json
{
  "shop_id": 123,
  "shop_domain": "example.myshopify.com"
}
```

Your handler: delete all data you hold for this shop. This is your `DROP TABLE WHERE shop = X` moment. After 48 hours of uninstall, you have no legitimate reason to retain merchant data.

### 8.2 Implementation requirements

- HMAC verify on the raw body, not parsed JSON
- Return 200 within 30 seconds (push to queue if work is heavy)
- Idempotent on `X-Shopify-Webhook-Id`
- Logged for audit purposes
- Tested with Shopify's webhook testing tool before submission

### 8.3 Common compliance webhook fails

- Returning 200 but doing nothing (Shopify spot-checks; will fail you)
- HMAC verification skipped or wrong
- Handler timeout (work too heavy, no queue)
- Webhook URL on HTTP not HTTPS
- Privacy policy doesn't mention the data retention timeline

---

## 9. Observability requirements

BFS reviewers don't just check that your app passes today — they check that you can observe and respond when it doesn't. The expectation:

### 9.1 Web Vitals API wired

```ts
import { shopify } from "@shopify/app-bridge-react";

shopify.webVitals.onReport((metric) => {
  fetch("/api/web-vitals", {
    method: "POST",
    body: JSON.stringify(metric),
  });
});
```

Without this, your app appears in BFS dashboards with "no data" — you'll be told to wire it up before further review.

### 9.2 Error tracking

- Server errors → Sentry / Datadog / equivalent
- Client errors → same
- Alert thresholds defined (e.g., >0.1% error rate)
- On-call rotation if you have a team

### 9.3 APM

- Per-route p50/p95/p99 latency
- Alert when p95 crosses 80% of the BFS gate (e.g., 400ms when the gate is 500ms)

### 9.4 Audit logs

- Structured logs (JSON, not plain text)
- 30+ day retention
- Search by shop, merchant, webhook ID, request ID

### 9.5 Status page

- Public uptime over last 90 days
- Incident history
- Subscribe-for-updates link

---

## 10. Support requirements

### 10.1 Response time SLA

BFS reviewers expect you to publicly commit to **≤ 24 business hours** as the floor. Most successful BFS apps publish 12 business hours; the best publish 4 business hours.

Where to display:

- App Store listing description
- Your help center home page
- In-app help link

### 10.2 Help center

- Public, no login required
- Searchable
- Covers setup + top 10 FAQ
- Includes a contact form or email link prominently
- Updated within 24h when features ship

Hosted options: Intercom, HelpScout, Zendesk Guide, Crisp, GitBook, or even a well-structured Notion page (with custom domain).

### 10.3 In-app help

Contextual help links from inside the embedded app to the relevant docs. Example: a "Help with this page" link in every primary view that deep-links to the matching help article.

### 10.4 Live channel (preferred, not required)

Live chat or messaging shifts perception of support quality substantially. BFS reviewers note it. If you can't staff live chat, async via Crisp / Intercom / Drift with a clear "we respond within X" badge is fine.

---

## 11. Revenue share specifics (verify before relying)

Re-stating the current state for clarity. **Verify against Shopify's revenue share docs before doing financial modeling — this policy has changed multiple times.**

### 11.1 Current structure (post-Jan 2025 update)

| Lifetime revenue | Revenue share | You keep |
|---|---|---|
| First $1M USD (lifetime gross app revenue earned since Jan 1, 2025) | 0% | 100% |
| Above $1M lifetime | 15% | 85% |

### 11.2 What changed

- Prior policy: $1M was an **annual** exemption that reset each calendar year. A successful app could collect $1M every year and pay 0% on all of it.
- Updated policy: the first $1M in qualifying lifetime gross app revenue earned since Jan 1, 2025 is subject to 0% revenue share; revenue above the threshold is subject to 15%.
- This applies to **all** App Store apps — BFS or not. BFS does not currently grant an additional revenue share break on top of this.
- A separate 2.9% processing fee, taxes, and possible regional fees still apply.
- Developers above Shopify's stated annual app-earnings or company-revenue thresholds don't qualify for the $1M exemption.

### 11.3 Partner-level aggregation

Revenue from multiple apps and all associated developer accounts is aggregated. Shopify requires developers to disclose associated accounts, while payouts remain separate at the Partner account level.

### 11.4 Strategic implications

- Evaluate BFS using its documented highlight, badge, search-filter, promotional, and priority-review benefits
- The lifetime $1M means high-MRR apps hit 15% faster than they used to; factor that into pricing
- Never create or omit associated accounts to evade revenue aggregation; follow the Partner Program Agreement

---

## 12. Application / audit process

### 12.1 Eligibility

You can't apply until Shopify's automated checks confirm you meet baseline. The Partner Dashboard shows which prerequisites you've passed and which you haven't. Apply only when everything green-lights.

Prerequisites that get auto-checked:

- Listing meets App Store guidelines
- App Bridge 4.x detected on your embedded URL
- GDPR webhooks present and returning 200 in test calls
- API version current (non-deprecated)
- Web Vitals data flowing
- 100+ launches over 28 days
- API p95 within threshold

### 12.2 The application

When eligible, the Partner Dashboard surfaces a "Apply for Built for Shopify" button. The application asks:

- Confirm support SLA (with public-facing URL)
- Confirm privacy policy URL
- Confirm uninstall hygiene (data deletion within 48h of `shop/redact`)
- Demonstrate integration surfaces used
- Demo video of primary workflows (recommended)
- Test store credentials (for the human reviewer to validate)

### 12.3 Review timeline

Typical: **2-4 weeks** for a human reviewer to walk through your app, test workflows, run accessibility checks, validate integration depth, and either approve or send feedback.

### 12.4 Feedback cycle

If you don't pass, you get specific feedback. Common feedback categories:

- "Performance below threshold on X" — re-measure after fixing, re-apply
- "Lacks integration depth" — add 1-2 more integration surfaces
- "Accessibility issue: keyboard navigation broken in modal Z" — fix and re-apply
- "Support SLA not publicly visible" — publish and re-apply
- "Polaris compliance: custom UI in section X" — refactor

You can re-apply once you've addressed feedback. There's no penalty for multiple cycles, but each cycle re-starts the 2-4 week review.

### 12.5 Continuous evaluation

Once you have BFS, you don't keep it forever. Shopify re-evaluates continuously:

- Performance regression for 2+ weeks → warning
- Performance regression sustained → BFS revoked, you can re-earn it after fixing
- Support complaints accumulating → review
- Major guideline violation → BFS revoked

---

## 13. Top 15 BFS rejection reasons

Ranked by how often they appear in real rejection feedback. Fix all of these proactively before applying.

| # | Rejection reason | Fix |
|---|---|---|
| 1 | **Web Vitals API not wired** | Implement `shopify.webVitals.onReport()` and send to monitoring; wait 28 days for data |
| 2 | **App Bridge not 4.x or loaded incorrectly** | Load from CDN in `<head>` before bundle; remove npm-bundled App Bridge |
| 3 | **Performance below threshold** (LCP, INP, CLS, or API p95) | See app-performance skill; address cold starts, bundle size, GraphQL serial awaits, N+1 |
| 4 | **GDPR webhooks missing or non-functional** | All three implemented, HMAC-verified, return 200 within 30s |
| 5 | **Lacks integration depth** (admin-only iframe, no extensions) | Add Admin Block + Action + ResourcePicker, minimum 3 surfaces total |
| 6 | **OAuth scopes excessive** | Audit; remove every scope you don't use in the last 30 days of logs |
| 7 | **Accessibility failures** (custom UI breaks keyboard nav or screen readers) | Replace custom UI with Polaris components; audit with axe DevTools |
| 8 | **Theme injection without cleanup** | Use Theme App Extensions (App Blocks); they're auto-removed on uninstall |
| 9 | **Support SLA not publicly committed** | Publish 24-hour SLA on listing + help center + in-app |
| 10 | **Privacy policy hidden or missing GDPR mention** | Public URL, explicit GDPR + CCPA + retention period |
| 11 | **Storefront performance impact > 10 Lighthouse points** | Audit theme app extension; trim JS, lazy-load, async-load |
| 12 | **API version deprecated** | Bump to the latest supported stable version; remove pinned unsupported versions |
| 13 | **Onboarding > 2 minutes to first value** | Cut steps; pre-fill defaults; show immediate value (sample data, preview) |
| 14 | **Embedded app opens in new tab** | Render inside admin iframe by default; only external for things like Stripe Connect |
| 15 | **Help docs missing or stale** | Build help center; cover top 10 FAQ; link in-app contextually |

---

## 14. Pre-audit self-check (50 items)

Run this before clicking the Apply button. Every item must be checked. If any are unchecked, fix first.

### Performance (15)

- [ ] App Bridge Web Vitals API wired and sending to monitoring
- [ ] 100+ launches recorded over 28-day window
- [ ] LCP p75 ≤ 2.5s in Web Vitals dashboard
- [ ] INP p75 ≤ 200ms in Web Vitals dashboard
- [ ] CLS p75 ≤ 0.1 in Web Vitals dashboard
- [ ] API p95 latency ≤ 400ms (cushion below 500ms gate)
- [ ] API failure rate ≤ 0.05% (cushion below 0.1% gate)
- [ ] Initial route bundle ≤ 350KB gzipped
- [ ] All internal `<Link>` use `prefetch="intent"`
- [ ] Loaders use `defer` for non-critical data
- [ ] Cache-Control headers on stable loader responses
- [ ] Server runs on always-on infrastructure (no scale-to-zero)
- [ ] DB connection pooling enabled (Hyperdrive, PgBouncer, or Accelerate)
- [ ] No N+1 in any loader (verified via Prisma query logs)
- [ ] Storefront extensions ≤ 50KB gzipped per surface and ≤ 10 Lighthouse point delta

### Design / Polaris (10)

- [ ] App Bridge 4.x loaded from CDN in `<head>` before bundle
- [ ] Polaris CSS imported exactly once at root
- [ ] All admin UI uses Polaris components, not custom equivalents
- [ ] `<AppProvider>` and `<Frame>` mounted once at root
- [ ] Dark mode works (or doesn't break) across all views
- [ ] Internationalization wired (Polaris i18n provider)
- [ ] Mobile responsive at 375px, 768px, 1024px+
- [ ] Skeletons match final dimensions (no CLS on data load)
- [ ] Empty states present on every list / table / dashboard
- [ ] Error states present and human-readable on every async operation

### Accessibility (8)

- [ ] All form inputs use Polaris components (label association handled)
- [ ] Color contrast ≥ 4.5:1 for text (Polaris tokens guarantee this)
- [ ] Keyboard navigation works for all primary workflows (test mouse-unplugged)
- [ ] Focus visible on every interactive element
- [ ] Icon-only buttons have `accessibilityLabel`
- [ ] Screen reader test passed (VoiceOver or NVDA) on onboarding + primary workflow
- [ ] axe DevTools shows zero violations on every route
- [ ] Heading order valid (no skipped levels)

### Integration depth (7)

- [ ] At least 3 integration surfaces used (Admin Action, Admin Block, Theme App Extension, Functions, ResourcePicker, etc.)
- [ ] ResourcePicker used for any product/collection/variant selection (not custom picker)
- [ ] Bulk actions supported if app operates on lists of resources
- [ ] Theme App Extensions used if app touches storefront (no Liquid injection)
- [ ] Shopify Functions used if app modifies discounts/delivery/payments
- [ ] Metafields/Metaobjects used for merchant-visible data
- [ ] Current supported stable API version — no deprecated versions

### Compliance (5)

- [ ] All three GDPR webhooks implemented: `customers/data_request`, `customers/redact`, `shop/redact`
- [ ] All webhook handlers HMAC-verified on raw body
- [ ] Privacy policy public, mentions GDPR + CCPA + retention period
- [ ] Terms of Service public, includes app limitations
- [ ] OAuth scopes minimal — every requested scope is used

### Support + observability (5)

- [ ] Support email on own domain, functional, monitored
- [ ] Public help center with top 10 FAQ + search
- [ ] Response SLA publicly committed (≤ 24 business hours)
- [ ] Sentry / Datadog / equivalent tracking all errors
- [ ] Status page public (uptime + incident history)

If 50/50 checked, you're ready to apply. If any unchecked, fix first — re-applying is cheap, but the 28-day measurement window is expensive.

---

## 15. Decision tree — am I ready to apply

```
Should I apply for Built for Shopify?
│
├── Has the app been live with real merchants for 30+ days?
│   ├── No → Wait. You need 28 days of Web Vitals + API data.
│   │        Even if every fix is in place, Shopify can't measure you yet.
│   └── Yes → Continue
│
├── Is App Bridge Web Vitals API wired and reporting data?
│   ├── No → Wire it up first. Without data, you're invisible to BFS.
│   │        Then wait 28 days for data to accumulate.
│   └── Yes → Continue
│
├── Are all three Web Vitals (LCP, INP, CLS) within threshold in the Partner Dashboard?
│   ├── No → Run app-performance skill. Fix what's failing.
│   │        Re-measure after 14-28 days of the fix being live.
│   └── Yes → Continue
│
├── Is API p95 ≤ 400ms and failure rate ≤ 0.05% over the last 28 days?
│   ├── No → Fix server perf or stability. See app-performance skill.
│   │        Re-measure after fixes.
│   └── Yes → Continue
│
├── Are all three GDPR webhooks implemented, HMAC-verified, returning 200?
│   ├── No → Implement them. Non-negotiable.
│   └── Yes → Continue
│
├── Are at least 3 integration surfaces used (Admin Action, Block, Functions, etc.)?
│   ├── No → Add more. "Lacks integration depth" is the #5 rejection reason.
│   │        Pick the 1-2 cheapest surfaces for your app type and ship them.
│   └── Yes → Continue
│
├── Does the app pass automated accessibility audits (axe DevTools) on every route?
│   ├── No → Fix violations. Most are 5-minute Polaris component swaps.
│   └── Yes → Continue
│
├── Have you done a manual keyboard-only walk-through of onboarding + primary workflow?
│   ├── No → Do it. Today. It will reveal issues automated tools miss.
│   └── Yes → Continue
│
├── Is your support SLA (≤ 24 business hours) publicly committed in 2+ places?
│   ├── No → Publish on listing, help center, in-app help.
│   └── Yes → Continue
│
├── Have you tested uninstall hygiene — does shop/redact actually delete all data within 48h?
│   ├── No → Test it. Install, populate data, uninstall, wait 48h, verify deletion.
│   └── Yes → Continue
│
├── Is the API version current and supported?
│   ├── No → Upgrade. Old versions are an auto-reject.
│   └── Yes → Continue
│
├── Have you walked through the 50-item self-check and checked every box?
│   ├── No → Walk through it. Don't apply with unchecked items.
│   └── Yes → Apply.
│
└── APPLY
    └── Expect 2-4 weeks. If approved, badge appears immediately.
        If rejected, you'll get specific feedback. Fix, re-apply.
        Each cycle is 2-4 weeks. Don't argue with feedback.
```

---

## 16. After approval — maintenance

Getting BFS isn't a one-time event. Keep it by:

- **Watching Web Vitals weekly** in the Partner Dashboard. Two-week regressions trigger warnings.
- **Watching API p95 daily** in your APM. Alert when it crosses 400ms.
- **Auditing bundle size in CI**. Don't let a regression ship.
- **Monitoring support response time**. If it slips past 24h, hire or automate.
- **Re-running accessibility audits** on every release. Polaris updates can introduce regressions in your custom layers.
- **Reviewing API version annually**. Bump to the current version before yours deprecates.
- **Re-validating GDPR webhooks quarterly**. Send a test request, verify response.

BFS is a flywheel — apps that maintain it get more visibility, more installs, better reviews, which compounds. Apps that lose it usually do so quietly (a perf regression, a slow support quarter) and never notice until ranking drops 60%.

---

## Closing principle

Built for Shopify isn't a marketing badge. It's a contract: you commit to a quality bar, Shopify points merchants at you in exchange. The hard part isn't passing the audit once — it's continuing to pass it while you ship features, grow merchants, and the gates inch tighter each year.

Build the foundation right (Polaris everywhere, App Bridge 4.x, performance budget in CI, GDPR webhooks day one, observability before launch) and BFS is a 30-day formality. Try to retrofit it later and you'll spend three months refactoring around tech debt that should never have shipped.

The earliest your app can be ready for BFS is **day 1 of design**. The latest it can be ready is **never**, because the bar moves.

Pick day 1.

Sources:
- [Built for Shopify requirements (Shopify)](https://shopify.dev/docs/apps/launch/built-for-shopify/requirements)
- [About Built for Shopify (Shopify)](https://shopify.dev/docs/apps/launch/built-for-shopify)
- [Revenue share for Shopify App Store developers (Shopify)](https://shopify.dev/docs/apps/launch/distribution/revenue-share)
- [Update to Shopify's app developer revenue share (Shopify changelog)](https://shopify.dev/changelog/update-to-shopifys-app-developer-revenue-share)
- [Latest version of App Bridge required for Built for Shopify (Shopify changelog)](https://shopify.dev/changelog/latest-version-of-app-bridge-required-for-built-for-shopify)
- [Polaris Accessibility (Shopify)](https://polaris-react.shopify.com/foundations/accessibility)
- [Privacy law compliance (Shopify)](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)
- [Common app rejections (Shopify)](https://shopify.dev/docs/apps/store/common-rejections)
- [App Bridge documentation (Shopify)](https://shopify.dev/docs/api/app-bridge-library)
