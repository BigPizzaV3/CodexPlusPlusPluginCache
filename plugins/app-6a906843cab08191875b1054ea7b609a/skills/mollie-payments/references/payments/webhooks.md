# Webhooks

Mollie sends a POST request to your `webhookUrl` when a payment status changes.
**Never** show a payment result to the customer before receiving and processing the webhook.

## Webhook flow

1. Mollie POSTs `id=tr_xxx` to your webhook URL
2. Your server fetches the payment status from the API
3. Update your database / trigger fulfilment
4. Respond with HTTP 200

## Handler example

```javascript
// Express.js
app.post('/webhooks/mollie', async (req, res) => {
  // Always respond 200 immediately — any other status triggers retries
  res.sendStatus(200);

  const paymentId = req.body.id;
  if (!paymentId) return;

  const payment = await mollieClient.payments.get(paymentId);

  switch (payment.status) {
    case 'paid':
      await fulfillOrder(payment.metadata.orderId);
      break;
    case 'expired':
    case 'failed':
    case 'canceled':
      await cancelOrder(payment.metadata.orderId);
      break;
    // 'open', 'pending', 'authorized' — no action needed
  }
});
```

## Rules

- Respond `200 OK` before doing any async work — Mollie retries on any other status
- Fetch the payment from the API to get the real status; never trust the POST body alone
- Webhook URL must be publicly accessible (no localhost in production)
- For local development, use a tunnel: `ngrok http 3000` or `lt --port 3000`
- Use the `metadata` field when creating payments to pass your internal order ID through
