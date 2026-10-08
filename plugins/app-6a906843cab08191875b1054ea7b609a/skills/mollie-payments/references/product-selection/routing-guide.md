# Product selection — full routing guide

The main `SKILL.md` asks the first few questions inline. This file is the complete
decision tree behind it — consult it when the answers don't map cleanly onto the
router's quick table, or when a request touches more than one dimension at once
(e.g. "recurring payments for a marketplace").

## Dimension 1 — Is this new code, a bug, or a migration?

| Signal in the request | Route to |
|---|---|
| "How do I integrate...", "set up...", "add support for..." | Continue to Dimension 2 |
| "This payment/webhook isn't working", "stuck as pending", "getting a 401/403" | `<references/troubleshooting/>` — do not start generating new integration code before ruling out a known issue |
| "Upgrade my SDK", "migrate from Orders API to Payments API", "update to the latest version" | `mollie-upgrade` skill — this is a distinct workflow, not a reference folder |
| "Build an agent that can...", "let an LLM call Mollie", "AI agent with refund/payment tools" | `mollie-agent-toolkit` skill |

## Dimension 2 — Direct merchant or platform?

> Are you building this for your own business, or processing payments on behalf of
> other businesses (a platform/marketplace)?

- **Platform/marketplace** → `<references/connect/>`. Everything below this point
  in the guide still applies, but layered on top of a Connect integration — e.g. a
  platform can still need recurring payments or hosted checkout, just executed via
  a client's access token instead of the platform's own API key.
- **Direct merchant** → continue to Dimension 3.

## Dimension 3 — One-time or recurring?

> Is this a single checkout, or does the customer need to be charged again later
> without re-entering payment details?

- **Recurring / subscription / "charge them again next month"** → `<references/recurring/>`
- **One-time** → continue to Dimension 4.

## Dimension 4 — Hosted checkout, custom checkout, or a payment link?

Already covered in the main router's Step 4 — see `<references/payments/hosted-checkout.md>`
or `<references/payments/components.md>` / `<references/payments/build-your-own-checkout.md>`.

If there's no live checkout session to redirect from at all — the request is about
sharing a link rather than embedding a checkout (phone/mail orders, donations,
a quick invoice-by-link) — that's a **payment link**, not A or B. Route to
`<references/payments/payment-links.md>`. If instead the request is about a formal
invoice document with payment terms and VAT line items, see the Invoicing callout
below — that's a different product (Sales Invoices), not a payment link.

## Dimension 5 — Is this a build task or an account operation?

> Are you writing integration code, or performing an action on existing
> payments/refunds/settlements (e.g. "issue a refund for order #123", "why did this
> chargeback happen", "reconcile last month's payouts")?

- **Account operation on existing data** → `<references/operations/>`. Read
  `<references/operations/write-action-safety.md>` first if the operation writes
  anything (refund, capture) rather than just reading (chargebacks, settlements).
- **Build task** → the relevant folder from Dimensions 2–4 above.

## Online vs. in-person

If the request mentions a physical point-of-sale/terminal rather than a website —
flag this explicitly rather than routing it through the online-checkout references
above. In-person payment flows differ enough (device pairing, terminal-initiated
transactions) that hosted-checkout/Components guidance doesn't transfer directly;
confirm the exact terminal integration path against current Mollie docs before
generating code, since none of the references in this skill cover it yet.

## Invoicing vs. real-time checkout

If the request is about sending a customer a formal invoice — payment terms
("net 30"), VAT line items, a PDF invoice document, B2B billing — this bypasses
Dimensions 1–4 entirely. It's not a checkout flow at all: it's the **Sales
Invoices API** (Revenue Collection), a distinct product from Payments. Route
straight to `<references/payments/sales-invoices.md>`.

Do not confuse this with Mollie's own (unrelated) Invoices API, which bills the
merchant for Mollie's fees — there's nothing to integrate there, see the
disambiguation table at the top of `sales-invoices.md`.
