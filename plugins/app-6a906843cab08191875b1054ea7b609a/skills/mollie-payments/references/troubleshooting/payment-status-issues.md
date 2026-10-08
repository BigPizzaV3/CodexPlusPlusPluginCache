# Payment stuck, redirect/webhook ordering, duplicate fulfilment

## "Payment is stuck as `open` or `pending`"

1. Fetch the payment fresh from the API — don't trust a cached status.
   ```javascript
   const payment = await mollie.payments.get(paymentId);
   console.log(payment.status, payment.details);
   ```
2. Check which is actually true:
   - **`open`** — customer hasn't completed the method's flow yet (e.g. bank
     transfer awaiting funds, or they abandoned checkout). Not a bug.
   - **`pending`** — the method itself is asynchronous (e.g. some bank transfers,
     SEPA direct debit takes days to clear). Expected, not stuck.
   - Genuinely stuck past the method's normal window → check `payment.details` for
     a reason, and confirm the webhook actually reached your server (see
     `<references/troubleshooting/webhook-issues.md>`).
3. Never manually flip your own order status to "paid" to work around a stuck
   payment — fix the webhook/status-fetch path instead. Manually overriding status
   is how duplicate fulfilment and reconciliation mismatches happen later.

## Redirect arrived, but no webhook yet — is the payment real?

The redirect is **not proof of payment**. Do not fulfil the order from the redirect
alone.

```javascript
// On the redirect landing page — fetch status, don't trust query params
app.get('/orders/:id/complete', async (req, res) => {
  const order = await db.orders.findById(req.params.id);
  const payment = await mollie.payments.get(order.molliePaymentId);

  if (payment.status === 'paid') {
    res.render('order-complete', { order });
  } else {
    // Webhook may not have arrived yet — show a pending state, let the
    // webhook do the actual fulfilment when it lands.
    res.render('order-pending', { order });
  }
});
```

The redirect and the webhook can arrive in either order, or the redirect can arrive
and the webhook can be delayed by minutes. Fulfilment logic belongs in the webhook
handler, not the redirect handler — the redirect page only reads status, it never
writes it.

## Duplicate fulfilment

Mollie retries webhooks until it gets a `200` — your handler **will** be called more
than once for the same payment in normal operation, not just on failure.

```javascript
app.post('/webhooks/mollie', async (req, res) => {
  res.sendStatus(200);  // acknowledge immediately regardless of outcome below

  const payment = await mollie.payments.get(req.body.id);
  if (payment.status !== 'paid') return;

  // Claim the order atomically — two concurrent webhook deliveries can both
  // read fulfilled=false before either writes, so a plain "check then update"
  // isn't enough to stop both from fulfilling. Let the database enforce it:
  // only the caller whose UPDATE actually changes a row proceeds.
  const order = await db.orders.findById(payment.metadata.orderId);
  const { rowCount } = await db.orders.updateWhere(
    { id: order.id, fulfilled: false },
    { fulfilled: true },
  );
  if (rowCount === 0) return;  // already claimed by another webhook delivery

  await fulfillOrder(order);
});
```

If fulfilment isn't idempotent (e.g. it emails a receipt or ships an item), a
retried webhook will do it twice. The guard above must be a single atomic
conditional write (`UPDATE ... WHERE fulfilled = false`, or a transaction with
`SELECT ... FOR UPDATE`) — a separate read followed by a separate write leaves a
window where two concurrent deliveries both pass the check before either writes.
