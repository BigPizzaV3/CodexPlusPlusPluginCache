---
name: subscriptions-and-payments
description: Use when the user wants to see or manage what they pay Hostinger for — listing subscriptions and their renewal state, enabling or disabling auto-renewal, renewing a subscription, browsing the product catalog with prices, listing payment methods and setting a default, or placing an order for a Hostinger product. Every write here costs the user money or affects whether their services stay online.
---

# Subscriptions and payments

Binary: **`hostinger-billing-mcp`** — every tool named `billing_*`.

Run the `hostinger` router first. Its safety gates apply here more than
anywhere else in the product: **this is the only skill that can charge the
user's card.** Read the billable gate below before any write.

## The reading half is safe — start there

- `billing_getSubscriptionListV1` — every subscription on the account, with
  status and renewal state. This is the answer to "what am I paying for?" and
  "when does X expire?".
- `billing_getCatalogItemListV1` — orderable products and prices. **Prices are
  in cents**, as integers with no decimal point: `1099` is €10.99. Convert
  before showing a price to the user, and never quote the raw integer.
- `billing_getPaymentMethodListV1` — methods available for new orders. Show the
  last digits and type; never echo full card data even if a field contains it.

Answer read-only questions from these three and stop. Do not offer a purchase the
user did not ask for.

## The billable gate

`billing_createPurchaseOrderV1` and `billing_renewSubscriptionV1` **place real
orders against a real payment method.** `billing_createPurchaseOrderV1` is the
broadest tool in the whole Hostinger catalog — it can order any product — which
makes it the one most likely to do expensive damage from a vague request.

Before either of them:

1. `billing_getCatalogItemListV1` for the exact item and its price. Never order
   an item the user named loosely — "the cheapest plan", "whatever works" — get
   a specific catalog item first and read the name back.
2. State **item, term and total in currency**, converted from cents, plus which
   payment method will be charged from `billing_getPaymentMethodListV1`.
3. **First confirmation** naming all of that, and saying that hosting and domain
   purchases are generally non-refundable.
4. **Second confirmation in a separate turn**, after the user answers the first.
   Never batch several items into one approval, and never carry an approval
   forward to a different item, term or quantity.

Never place an order to unblock your own work. If a task stalls because a plan
or a domain is missing, say so, quote what it would cost, and stop. "Get my site
online" is not authorisation to buy anything.

## Auto-renewal — small calls, large consequences

- `billing_enableAutoRenewalV1` — future charges will happen without asking.
  Say that plainly and name the subscription and its renewal amount.
- `billing_disableAutoRenewalV1` — **the service will expire at the end of the
  current term.** For hosting that means the website goes offline; for a domain
  it means the registration lapses and the name can be taken by someone else,
  which is not reversible after the redemption window. Name the subscription and
  the date it would lapse, and confirm.

Both are one confirmation, but the confirmation has to state the consequence, not
just the toggle.

## Payment methods

- `billing_setDefaultPaymentMethodV1` — changes what future orders and renewals
  charge. One confirmation naming the method.
- `billing_deletePaymentMethodV1` — **check for dependencies first.** Removing
  the method that active auto-renewals depend on means those renewals fail
  silently and services lapse. Read `billing_getSubscriptionListV1` and
  `billing_getPaymentMethodListV1`, say which subscriptions would be left without
  a working method, and take two confirmations if any would.

Never help the user *add* a payment method through these tools — there is no tool
for it, and card details must never pass through the conversation. Point them at
hPanel.

## Handling money data

Prices are integer cents. Subscription and order responses may carry billing
identifiers and partial payment details. Show the user only what they asked for,
never write any of it into a project file or a commit, and never include it in a
summary that could be pasted elsewhere.

## Full tool list

Reads: `billing_getSubscriptionListV1`, `billing_getCatalogItemListV1`,
`billing_getPaymentMethodListV1`

Billable: `billing_createPurchaseOrderV1`, `billing_renewSubscriptionV1`

Renewal state: `billing_enableAutoRenewalV1`, `billing_disableAutoRenewalV1`

Payment methods: `billing_setDefaultPaymentMethodV1`,
`billing_deletePaymentMethodV1`
