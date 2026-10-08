---
name: mollie-payments
description: >
  Activate this skill when a developer is working with Mollie: integrating payments,
  setting up Mollie Connect for a platform/marketplace, building recurring payments or
  subscriptions, issuing refunds or captures, investigating chargebacks or settlements,
  or troubleshooting a Mollie integration. This includes: hosted checkout, custom
  checkout, Mollie Components (card fields), payment links, webhooks and payment
  status handling, Next.js / React / Vue / Node.js / PHP / Python integrations, 3D
  Secure, PCI compliance, payment methods (iDEAL, credit card, SEPA, Klarna, Apple
  Pay, Google Pay, Bancontact), OAuth onboarding, submerchants, application fees,
  customers and mandates, subscriptions, reconciliation, sales invoices and B2B
  invoicing, stuck or pending payments, missing webhooks, and 401/403 errors.
---

# Mollie Payments

Use `<references/product-selection/routing-guide.md>` for the full decision tree if
a request spans more than one dimension below (e.g. "recurring payments for my
marketplace clients"). The steps here cover the common single-dimension case.

## Step 1 — Is this new integration work, or something else?

**Ask this first, before anything else:**

> Are you setting up something new, fixing a problem with an existing integration,
> upgrading/migrating an existing one, or building an AI agent that uses Mollie?

- **Something isn't working** (stuck payment, missing webhook, auth error, wrong
  credentials) → go straight to `<references/troubleshooting/>`. Do not generate new
  integration code before ruling out a known issue.
- **Upgrading an SDK version or migrating from an older API** → this is the
  `mollie-upgrade` skill, not this one.
- **Building an agent that calls Mollie autonomously** (via `@mollie/agent-toolkit`,
  or exposing Mollie as LLM tools) → this is the `mollie-agent-toolkit` skill.
- **Refunding, capturing, or investigating existing payments/chargebacks/settlements**
  → `<references/operations/>`.
- **Invoicing a customer to be paid later** (B2B billing, payment terms, VAT line
  items — not a real-time checkout) → this is Sales Invoices (Revenue Collection),
  a distinct product from the Payments API. Go straight to
  `<references/payments/sales-invoices.md>` — skip Steps 2–6 below, they don't apply.
- **New integration** → continue to Step 2.

---

## Step 2 — Direct merchant or platform?

> Are you building this for your own business (accepting payments directly as a
> merchant), or are you building a platform or marketplace that processes payments
> on behalf of other businesses?

**If they are a platform or marketplace** → this needs Mollie Connect, not a
standard integration. Route to `<references/connect/oauth-and-onboarding.md>` and
work through the Connect reference set — it covers OAuth, onboarding, application
fees, permissions/tokens, and testing/offboarding. Everything in Steps 3–5 below
still applies once Connect is set up (a platform can still need recurring payments
or hosted checkout — just executed via a client's access token).

**If they are a direct merchant** → continue to Step 3.

---

## Step 3 — One-time or recurring?

> Is this a single checkout, or does the customer get charged again later without
> re-entering their payment details (subscription, saved card, usage billing)?

**Recurring** → route to `<references/recurring/customers-and-mandates.md>` — this
is a distinct flow (Customers API → first payment → mandate → subscription or
on-demand charge), not a variant of one-time checkout. Webhook handling still
applies (`<references/payments/webhooks.md>`), but skip Step 4 below.

**One-time** → continue to Step 4.

---

## Step 4 — Understand their checkout preference

> How much control do you want over the payment experience?
>
> **A) Mollie-hosted checkout** — Mollie handles the entire payment page. Simplest to
> integrate; no frontend work required. Customers are redirected to Mollie to
> complete payment.
>
> **B) Build your own checkout** — You embed payment method selection and
> (optionally) card fields directly in your UI. More work, but full control over
> design and branding.
>
> **C) Payment link** — No embedded checkout at all. You share a URL with the
> customer (email, SMS, chat, QR code) instead of redirecting from a live session.
> Use this when there's no checkout page to redirect from — phone/mail orders,
> donations, social selling. (A formal invoice with payment terms/VAT lines is a
> different product — see Step 1's Sales Invoices branch.)
>
> Not sure? Hosted checkout takes ~30 minutes and handles everything for you. A
> custom checkout takes longer but keeps customers on your page throughout. If
> there's no live session to redirect from in the first place, it's a payment link,
> not A or B.

---

## Step 5 — Understand their stack

Before writing any code, ask:

> What language and framework are you using?
> - Backend: Node.js / PHP / Python / other?
> - Frontend: React / Vue / Next.js / vanilla JS / other?
> - Are you in test mode or live?

Use the answers to generate code with the correct SDK and idioms.

---

## Step 6 — Route to the correct reference

| Checkout preference | Card handling | Reference |
|---|---|---|
| Mollie-hosted checkout | Mollie handles card UI | `<references/payments/hosted-checkout.md>` |
| Build your own — embed card fields | Mollie Components (Mollie.js) | `<references/payments/components.md>` |
| Build your own — other methods only | Methods API + Payments API | `<references/payments/build-your-own-checkout.md>` |
| Payment link — no embedded checkout, share a URL | Mollie handles card UI | `<references/payments/payment-links.md>` |

All integrations require webhook handling — always include it: `<references/payments/webhooks.md>`

---

## SDK selection

Always use the official Mollie SDK for the developer's language:

| Language | Package |
|---|---|
| JavaScript / TypeScript / Node.js | `mollie-api-typescript` |
| PHP | `mollie/mollie-api-php` (Composer) |
| Python | `mollie-api-py` |

`@mollie/api-client` (Node) and `mollie-api-python` are the old/community SDKs —
don't use them for new integrations. If a developer already has one installed,
that's a migration case for the `mollie-upgrade` skill, not a new build.

Always use the v2 API. Never construct raw API calls when an SDK is available.

**Never use the Orders API for a new integration** — it's deprecated. Always build
against the Payments API (`payments.create`, etc.), including hold-then-capture
flows (`captureMode: 'manual'`, see `<references/operations/captures.md>`) that the
Orders API used to handle via Shipments. If a developer's existing code already uses
the Orders API, that's a migration case — route to the `mollie-upgrade` skill rather
than extending the old API.

---

## Critical rules — apply to every integration

- **Never** put API keys (`live_xxx` / `test_xxx`) in frontend code. Only the profile ID (`pfl_xxx`) belongs in the browser.
- **Always** verify payment status via webhook before fulfilling an order — never trust the redirect URL alone.
- **Always** respond with HTTP 200 to webhook requests before doing any async work. Mollie retries on any other status.
- **Always** redirect customers to the checkout URL using HTTP GET (303 See Other), never POST.
- The profile ID used in `Mollie()` on the frontend **must** belong to the same account as the API key used on the backend.
- In test mode, pass `testmode: true` to `Mollie()` on the frontend AND use a test API key (`test_xxx`) on the backend. Both must match.
- When a card payment fails, create a **new card token** and a **new payment** — you cannot retry on the same payment.
- Never show a payment result to the customer until the webhook has been received and processed.
- **Additionally**, for any refund, capture, or cancellation: read `<references/operations/write-action-safety.md>` before generating the code — these are harder to reverse than a payment creation.
