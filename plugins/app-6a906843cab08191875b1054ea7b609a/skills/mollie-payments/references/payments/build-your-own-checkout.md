# Build Your Own Checkout

A custom checkout embeds payment method selection (and optionally card fields and issuer
selection) directly in your UI. Customers never leave your page for method selection.

## What you control vs what Mollie still handles

| Step | Hosted checkout | Custom checkout |
|---|---|---|
| Payment method selection | Mollie | **You** (Methods API) |
| Issuer selection (iDEAL, KBC) | Mollie | **You** (Methods API `issuers` include) |
| Card form | Mollie | **You** (Mollie Components) or Mollie |
| 3D Secure / bank auth redirect | Mollie | Mollie (unavoidable) |
| Bank transfer details display | Mollie | **You** (returned in API response) |

## Step 1 — Fetch active payment methods

```javascript
// mollie-api-typescript
const methods = await mollie.methods.list({
  amount: { value: '99.00', currency: 'EUR' },
  // include issuers for methods that need them (ideal, kbc, giftcard)
  include: 'issuers',
});

// Render methods.data in your UI as selectable options
```

Filtering by `amount` and `currency` ensures only methods valid for that transaction are shown.

## Step 2 — Create a payment with the selected method

```javascript
const payment = await mollie.payments.create({
  paymentRequest: {
    method: 'ideal',           // the method the customer selected
    issuer: 'ideal_INGBNL2A', // for iDEAL / KBC / gift cards — from the issuers list
    amount: { currency: 'EUR', value: '99.00' },
    description: 'Order #1234',
    redirectUrl: 'https://example.com/orders/1234/complete',
    webhookUrl: 'https://example.com/webhooks/mollie',
    metadata: { orderId: '1234' },
  },
});

// Redirect the customer to complete authentication (bank, 3DS, etc.)
res.redirect(303, payment._links.checkout.href);
```

## Integration depth by payment method

### Credit cards — embed the card form (Mollie Components)
Skip the redirect for card data entry by embedding Mollie.js.
→ See `<references/payments/components.md>`

### iDEAL — embed issuer selection
Fetch issuers via the Methods API and render a bank picker in your UI.
Pass the selected `issuer` field to Create Payment.
Customer is still redirected to their bank for authentication.

### KBC/CBC and gift cards — embed issuer selection
Same pattern as iDEAL — fetch issuers, render in UI, pass `issuer` to Create Payment.

### Bank transfer (SEPA) — display transfer details yourself
Bank transfer details are returned directly in the Create Payment response.
No redirect needed — display the IBAN and reference number in your UI.

```javascript
const payment = await mollie.payments.create({
  paymentRequest: {
    method: 'banktransfer',
    amount: { currency: 'EUR', value: '99.00' },
    description: 'Order #1234',
    redirectUrl: 'https://example.com/orders/1234/complete',
    webhookUrl: 'https://example.com/webhooks/mollie',
  },
});

// Display to customer — no redirect required
const { bankAccount, transferReference } = payment.details;
```

### Always redirect (no deeper integration possible)
Bancontact, EPS, in3, Klarna, PayPal, paysafecard, Przelewy24 always redirect to an
external page. Pass `method` at payment creation and redirect to `_links.checkout`.

## Webhook handling is always required
Regardless of integration depth, payment completion signals arrive server-side via webhook.
→ See `<references/payments/webhooks.md>`
