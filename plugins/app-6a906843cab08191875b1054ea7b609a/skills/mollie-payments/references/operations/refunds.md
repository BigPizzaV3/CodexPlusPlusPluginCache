# Refunds

Before writing any refund code, read `<references/operations/write-action-safety.md>`.

## Create a refund

```javascript
// Node.js — mollie-api-typescript
const refund = await mollie.refunds.create({
  paymentId: 'tr_WDqYK6vllg',
  refundRequest: {
    amount: { currency: 'EUR', value: '15.00' },  // set to the original payment amount for a full refund
    description: 'Order #4567 — item returned',   // shown to the customer, max 255 chars
  },
});
```

- `amount` is the only required field. It may be **lower** than the original payment
  amount — partial refunds are supported. Multiple partial refunds against the same
  payment are allowed as long as their total doesn't exceed the original amount.
- Requires `refunds.write` scope (API key, advanced access token, or OAuth token).
- A `409` response means a duplicate refund was detected on the same payment in short
  succession — do not retry blindly; fetch existing refunds for the payment first.
- A `422` means the request was invalid (e.g. missing `amount`, or amount exceeds
  what's refundable); a `404` means the payment doesn't exist.

## Refund status lifecycle

`queued` → `pending` → `processing` → `refunded` (or `failed` / `canceled`)

Refund completion is asynchronous — poll or listen for it the same way you handle
payment status: fetch the refund by ID, don't assume `refunded` immediately after
creation.

```javascript
const refund = await mollie.refunds.get({ paymentId: 'tr_WDqYK6vllg', refundId: 're_4qqhO89gsT' });
```

## Marketplace-only fields

`reverseRouting` (boolean) and `routingReversals` (array) pull back funds that were
previously routed to connected accounts under Mollie Connect. Only relevant if the
original payment used routing — see `<references/connect/>`. Omit these entirely for
standard direct-merchant refunds.

## Common mistakes

| Mistake | Fix |
|---|---|
| Retrying a refund call after a timeout without checking | Fetch refunds on the payment first — a `409` means it may already exist |
| Refunding a payment still in `open`/`pending` status | Only `paid` (and `authorized`, for methods that support it) payments are refundable |
| Assuming `refunded` status immediately after `create()` | Refunds are async — fetch the refund to confirm final status |
| Exposing unrestricted refund creation to end users | Gate refund-issuing endpoints behind staff/admin auth, not customer-facing routes |
