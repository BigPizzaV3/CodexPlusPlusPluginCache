# Payment Links

A payment link is a shareable URL, not an embedded checkout. There's no frontend
integration and no `redirectUrl` requirement — you send the customer a link (email,
SMS, chat, invoice, QR code, social post) and they complete payment on a Mollie-hosted
page. Use this instead of a hosted checkout when there's no live "session" to redirect
from — invoicing, phone/mail orders, donations, social selling.

## When to reach for a payment link instead of a payment

| Situation | Use |
|---|---|
| Customer is on your site right now, completing a checkout | `payments.create` — see `<hosted-checkout.md>` |
| You need to collect payment for something with no live session (an invoice, a phone order, a DM) | Payment link |
| Customer should be able to choose their own amount (tips, donations) | Payment link with `amount` omitted |
| The link needs to be reused by many customers (a fixed-price product page, a donation page) | Payment link with `reusable: true` |

## Create a payment link

```javascript
// Node.js — mollie-api-typescript
const paymentLink = await mollie.paymentLinks.create({
  requestBody: {
    description: 'Invoice #4567',
    amount: { currency: 'EUR', value: '99.00' }, // omit to let the customer enter an amount
    redirectUrl: 'https://example.com/thank-you', // optional — shown after payment
    webhookUrl: 'https://example.com/webhooks/mollie',
    reusable: false, // true allows unlimited customers to pay via the same link
    expiresAt: '2026-12-31T23:59:59+00:00', // optional — omit for a link that never expires
    allowedMethods: ['ideal', 'creditcard'], // optional — omit to allow all enabled methods
  },
});

// Share paymentLink._links.paymentLink.href with the customer via email, SMS, chat, etc.
// (_links.self is the API resource URL, not the checkout page — don't send that one)
```

`profileId` is required instead of an implicit profile when authenticating with an
organization-level credential (OAuth access token) rather than a profile-scoped API key.

## The trap: a payment link has no status of its own

Unlike a payment, a payment link doesn't move through `open` → `paid` → `expired`.
**Each payment made against it does.** This has two consequences:

- **Single-use link**: handle status the same way as any other payment — via
  webhook on that resulting payment, not on the link. See `<webhooks.md>`.
- **Reusable link**: there is no single webhook for "the link." Poll
  `paymentLinks.listPayments({ paymentLinkId })` to see all payments made against it, or
  rely on the `webhookUrl` set on the link — Mollie fires it for every payment the
  link produces, so your handler still keys off the individual payment ID, not the
  link ID.

Do not write code that treats a payment link's own GET response as reflecting
whether "the customer paid" — that response only reflects whether the link itself
is enabled/expired, not payment status.

## Mollie Connect: application fees on payment links

If you're a platform creating payment links on a connected merchant's account (OAuth),
you can charge a fee via `applicationFee`:

```javascript
const paymentLink = await mollie.paymentLinks.create({
  requestBody: {
    description: 'Invoice #4567',
    amount: { currency: 'EUR', value: '99.00' },
    applicationFee: {
      amount: { currency: 'EUR', value: '5.00' },
      description: 'Platform fee',
    },
  },
});
```

The fee is deducted from the connected merchant's balance and routed to your own
account balance when a payment on the link succeeds. See `<connect/application-fees-and-routing.md>`
for the full Connect fee model.
