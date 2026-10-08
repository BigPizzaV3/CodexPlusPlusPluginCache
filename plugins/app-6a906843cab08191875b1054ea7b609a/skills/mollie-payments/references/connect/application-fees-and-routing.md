# Application fees and payment routing

Before writing any fee/routing code, read `<references/operations/write-action-safety.md>`
— application fees move money to the platform's own balance and are as hard to
reverse as a payment.

## Application fees

When creating a payment on behalf of a connected client, the platform can specify a
fee that moves to the platform's balance whenever the payment succeeds.

```javascript
const payment = await mollie.payments.create({
  amount: { currency: 'EUR', value: '99.00' },
  description: 'Order #4567',
  redirectUrl: 'https://client-shop.example.com/orders/4567/complete',
  webhookUrl: 'https://platform.example.com/webhooks/mollie',
  applicationFee: {
    amount: { currency: 'EUR', value: '4.95' },
    description: 'Platform commission',
  },
  testmode: true,  // set explicitly when testing — see note below
});
```

- The fee is only collected if the underlying payment succeeds — a failed or
  canceled payment collects no fee.
- This call is made with the **client's** access token (the payment belongs to
  them), not the platform's own credentials — see
  `<references/connect/permissions-and-tokens.md>`.
- Unlike the API-key examples elsewhere in this skill, Connect calls authenticate
  with an access token, which isn't `test_`/`live_` prefixed — mode isn't fixed by
  the credential. Pass `testmode: true` explicitly to run in test mode, or omit it
  entirely for live (it defaults to `false`). Passing `testmode` at all on a plain
  API-key call is rejected by the API — only use it here, with an access token.

## Full vs. partial refunds and routing reversals

If a payment used `applicationFee`, refunding it affects the fee too:

- A **full refund** can optionally reverse the entire routed fee back to the client
  via `reverseRouting: true` on the refund.
- A **partial refund** can reverse a specific portion via `routingReversals` — use
  this when only part of an order (and its proportional fee) is being refunded.

```javascript
const refund = await mollie.paymentRefunds.create({
  paymentId: 'tr_WDqYK6vllg',
  amount: { currency: 'EUR', value: '99.00' },
  reverseRouting: true,  // pull the full application fee back to the client
});
```

Getting this wrong means the platform keeps a commission on an order that was fully
refunded — treat `reverseRouting`/`routingReversals` as a required decision on every
Connect refund, not an optional field to skip.

## Common mistakes

| Mistake | Fix |
|---|---|
| Refunding a Connect payment without deciding on fee reversal | Explicitly set `reverseRouting` or `routingReversals` — don't leave the platform holding a fee on a refunded order |
| Using the platform's own API key to create a client's payment | Use the client's access token — the payment belongs to their account |
| Assuming the fee is collected even if the payment fails | Fees only apply to successful payments |
