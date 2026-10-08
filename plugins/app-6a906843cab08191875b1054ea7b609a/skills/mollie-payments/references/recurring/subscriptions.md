# Subscriptions vs. manual recurring charges

Two different patterns once a valid mandate exists — pick based on whether the
charge is fixed/scheduled or triggered by your own logic.

## On-demand recurring charge (`sequenceType: 'recurring'`)

Use when you decide each time whether/when to charge — pay-per-use, phone orders,
usage-based billing.

```javascript
const payment = await mollie.payments.create({
  customerId: customer.id,
  mandateId: mandate.id,
  sequenceType: 'recurring',
  amount: { currency: 'EUR', value: '25.00' },
  description: 'Usage charge — March',
  webhookUrl: 'https://example.com/webhooks/mollie',
  // no redirectUrl needed — the customer isn't present, no browser redirect happens
});
```

Status updates arrive via webhook exactly like a normal payment.

## Fixed, repeating subscription (Subscriptions API)

Use when the amount and interval are fixed — Mollie generates the payments for you.

```javascript
const subscription = await mollie.customerSubscriptions.create({
  customerId: customer.id,
  mandateId: mandate.id,
  amount: { currency: 'EUR', value: '19.99' },
  interval: '1 month',
  description: 'Premium plan',
  webhookUrl: 'https://example.com/webhooks/mollie',
  times: 12,  // omit for an indefinite subscription
});
```

## Matching subscription-generated payments in your webhook

Mollie creates the payment automatically — your system won't already know its ID
when the webhook arrives. Match on `subscriptionId` instead.

This is a routing fragment to add inside your existing webhook handler (see
`<references/payments/webhooks.md>`), not a standalone handler — a webhook fires
for every payment, subscription-generated or not, and the `else` branch below
must still run your normal one-off payment logic:

```javascript
app.post('/webhooks/mollie', async (req, res) => {
  res.sendStatus(200);
  const payment = await mollie.payments.get(req.body.id);

  if (payment.subscriptionId) {
    // Subscription-generated charge — not a one-off payment
    await handleSubscriptionCharge(payment);
  } else {
    // Regular one-off payment — your existing fulfilment logic goes here
    await handleRegularPayment(payment);
  }
});
```

There is no separate subscription-status webhook — everything arrives as a payment
webhook; use `subscriptionId` to route it.

## Billing-date edge case

If a subscription bills on a day that doesn't exist in a given month (29th–31st for
February, etc.), Mollie charges on that month's last valid day instead. Don't build
your own date-clamping logic for this — it's handled for you.

## Cancelling a subscription

```javascript
await mollie.customerSubscriptions.cancel(subscription.id, { customerId: customer.id });
```

See `<references/recurring/failures-and-sepa.md>` for what happens to the
underlying mandate when a subscription is cancelled due to repeated payment
failures rather than a direct cancel call.

## Common mistakes

| Mistake | Fix |
|---|---|
| Expecting to know the payment ID before the webhook fires | Match on `subscriptionId`, not a pre-generated payment ID |
| Building custom month-length handling for billing dates | Mollie already clamps to the last valid day of the month |
| Using `sequenceType: 'recurring'` for a fixed recurring plan | Use the Subscriptions API instead — don't hand-roll scheduling |
