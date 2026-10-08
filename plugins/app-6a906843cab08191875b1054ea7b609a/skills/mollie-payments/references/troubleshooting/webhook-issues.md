# Webhook not received / not working

## Checklist, in order

1. **Is the URL actually public?** `webhookUrl` cannot be `localhost` — Mollie must
   be able to reach it from the internet. For local development, tunnel it:
   `ngrok http 3000` (or similar), and use the tunnel URL as `webhookUrl`.
2. **Are you responding within 15 seconds?** Mollie times out the webhook call at 15
   seconds. If your handler does synchronous work (DB writes, emails) before
   responding, that's the likely cause of "webhook not working" even though your
   endpoint is reachable. Respond `200` immediately, then do the work:
   ```javascript
   app.post('/webhooks/mollie', async (req, res) => {
     res.sendStatus(200);          // respond first
     await processWebhook(req.body.id);  // then do the actual work
   });
   ```
3. **Are you returning exactly `200`?** Any other status (including `2xx` variants
   like `201`, or a `3xx` redirect) counts as failure and triggers a retry.
4. **Check retry timing.** If the first call failed, Mollie retries up to 10 times
   with increasing intervals over roughly 26 hours before giving up. If you're
   debugging right after a deploy, a "missing" webhook may actually just be
   mid-retry — check the payment status directly rather than assuming it's lost.
5. **Don't validate the caller by IP address.** Mollie's webhook source IPs can
   change over time — an IP allowlist will eventually and silently start rejecting
   real webhook calls. Verify by fetching the payment from the API using the `id` in
   the request body instead of trusting the request's origin or payload.

## "I set a breakpoint / added logging but it's not triggering at all"

Confirm the payment actually has a `webhookUrl` set — it's optional per-payment. A
payment created without one will never call your endpoint no matter how the handler
is written.

```javascript
const payment = await mollie.payments.get(paymentId);
console.log(payment.webhookUrl);  // undefined means it was never set at creation
```

## Common mistakes

| Symptom | Likely cause |
|---|---|
| Webhook "sometimes" arrives, sometimes doesn't | Handler takes >15s to respond — move work after `res.sendStatus(200)` |
| Webhook worked in dev, not in production | `webhookUrl` still points at a tunnel/localhost URL from local testing |
| Webhook stopped working after infra change | IP-based validation broke after Mollie's source IPs changed — fetch-and-verify instead |
| No webhook call at all, ever | `webhookUrl` was never set on the payment |
