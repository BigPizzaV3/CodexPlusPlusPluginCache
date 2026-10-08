---
name: ship24-webhook-test
description: Test and debug a Ship24 webhook receiver end to end. Use when asked to test your webhook, simulate tracking updates, replay webhook messages, run a local webhook receiver, or validate webhook handling. Provides a runnable HTTP server and walkthrough for creating sample shipments, triggering events, and auditing delivery.
license: MIT
---

# Testing Ship24 webhooks end to end

Verify your receiver handles tracking updates correctly before going to production.

## Quick start

### 1. Start a local receiver

From the installed skill directory (wherever your tool placed `ship24-webhook-test`), or from a clone of https://github.com/ship24/ship24-ai-plugin:

```bash
cd skills/ship24-webhook-test
node scripts/receiver.mjs
```

Output:

```
Ship24 webhook test receiver listening on http://localhost:3000 (POST any path)
secret check: off (set SHIP24_WEBHOOK_SECRET to enable); log: stdout
```

The receiver:
- Accepts `POST` on any path.
- Responds `200 { ok: true }` immediately.
- Logs to stdout (or a file if `LOG_FILE` is set).
- Validates the `Authorization: Bearer <secret>` header if `SHIP24_WEBHOOK_SECRET` is set.
- No external dependencies; uses Node 22 built-in `node:http`.

**Env variables:**

- `PORT`: Listen port (default 3000).
- `SHIP24_WEBHOOK_SECRET`: Optional. When set, rejects requests whose `Authorization` header does not match using a constant-time comparison.
- `LOG_FILE`: Optional. Append NDJSON logs to a file instead of stdout.

### 2. Expose to the internet

Ship24 must reach your receiver. Use any tunnel you already have; examples:

- **ngrok**: `ngrok http 3000`
- **Cloudflare Tunnel**: `cloudflared tunnel --url http://localhost:3000`
- **LocalTunnel**: `npx localtunnel --port 3000`

Note the public HTTPS URL the tunnel prints.

### 3. Configure the dashboard

1. Log in to [dashboard.ship24.com](https://dashboard.ship24.com)
2. Go to Integrations → Webhooks
3. Paste the public URL into the Webhook URL field
4. Copy the Webhook Secret and set it locally:

```bash
export SHIP24_WEBHOOK_SECRET=your_webhook_secret
```

5. (Optional) Test using the dashboard button. This test does not originate from the documented outgoing IP `54.161.7.2`, so it is blocked if you restrict by IP.

### 4. Create a sample tracker

Use one of the bundled MCP tools, the Node SDK, or a direct HTTP call:

**Via MCP (if available):**

```
create_tracker trackingNumber=SHIP24_SAMPLE_DELIVERED_000
```

**Via Node SDK:**

```javascript
import { Ship24 } from 'ship24';

const client = new Ship24({ apiKey: process.env.SHIP24_API_KEY });
const tracker = await client.trackers.create({
  trackingNumber: 'SHIP24_SAMPLE_DELIVERED_000'
});
console.log('Tracker:', tracker.trackerId);
```

**Via curl:**

```bash
curl -X POST https://api.ship24.com/public/v1/trackers \
  -H "Authorization: Bearer $SHIP24_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"trackingNumber": "SHIP24_SAMPLE_DELIVERED_000"}'
```

Sample tracking numbers:

- `SHIP24_SAMPLE_DELIVERED_000` - Delivered
- `SHIP24_SAMPLE_IN_TRANSIT_000` - In transit
- `SHIP24_SAMPLE_EXCEPTION_000` - Exception
- Change the last three digits to mint a fresh tracker with the same event sequence (e.g., `SHIP24_SAMPLE_DELIVERED_123`).

### 5. Watch deliveries

As you create the tracker, Ship24 discovers events and sends webhooks. Check your receiver logs:

```
{"timestamp":"2025-03-04T17:13:02.114Z","method":"POST","path":"/","authorization":"Bearer [masked]","topic":"tracking/events","messageId":"...","trackerId":"...","trackingNumber":"SHIP24_SAMPLE_DELIVERED_000","statusMilestone":"delivered","eventId":"...","statusCode":"delivery_delivered","occurrenceDatetime":"2025-03-04T17:12:57"}
```

### 6. Replay with resend

To replay all webhooks for a tracker (useful if you dropped messages):

**Via MCP:**

```
resend_webhooks trackerId=<trackerId>
```

**Via curl:**

```bash
curl -X POST https://api.ship24.com/public/v1/trackers/<trackerId>/webhook-events/resend \
  -H "Authorization: Bearer $SHIP24_API_KEY"
```

The receiver logs again. It is your responsibility to deduplicate on `metadata.messageId` and `events[].eventId`.

### 7. Audit with webhook history

Download the full delivery history for a tracker:

**Via MCP:**

```
download_webhook_history trackerId=<trackerId>
```

**Via curl:**

```bash
curl -X GET "https://api.ship24.com/public/v1/trackers/<trackerId>/webhook-history/download" \
  -H "Authorization: Bearer $SHIP24_API_KEY" \
  -o webhook-history.json
```

Returns metadata and a log of every sent webhook delivery (pending ones are excluded): request body, response status, response headers, and timestamps.

### 8. Test offline with curl

To test your receiver without creating a real tracker:

```bash
curl -X POST http://localhost:3000 \
  -H "Authorization: Bearer your_webhook_secret" \
  -H "Content-Type: application/json" \
  -d @assets/webhook-tracking-events.example.json
```

The example file is a sample tracking webhook payload. Your receiver should log the event.

## Receiver behavior

The bundled `scripts/receiver.mjs`:

- **Accepts `POST` on any path**: `/`, `/webhooks`, `/tracking`, etc. all work.
- **Responds immediately**: reads the body, answers 200 with `{ ok: true }`, then logs.
- **Validates secret**: If `SHIP24_WEBHOOK_SECRET` is set, rejects requests without a matching `Authorization: Bearer <secret>` header (401). Comparison is constant-time to mitigate timing attacks.
- **Rejects malformed JSON**: non-JSON bodies receive 400 and are still logged; bodies over 1 MB receive 413 and the connection is closed.
- **Logs to stdout or file**: Each webhook logged as a single-line JSON object (NDJSON).
- **Logs fields of interest**: timestamp, method, path, authorization scheme (the secret is masked), topic, messageId, trackerId, clientTrackerId, trackingNumber, statusMilestone, each event's eventId, statusCode and occurrenceDatetime; for proof-of-delivery messages, the PoD status and content type.
- **No external dependencies**: Uses only Node 22 built-in modules.

## Testing checklist

Before going to production:

- [ ] Receiver logs incoming webhooks without errors.
- [ ] Secret validation works: requests without the correct header are rejected.
- [ ] Response is sent before async processing.
- [ ] Sample tracker triggers webhook delivery once Ship24 has fetched its events (not instant).
- [ ] Resend endpoint replays old messages (receiver must dedupe).
- [ ] Webhook history download works and shows delivery attempts and responses.
- [ ] Multiple shipments (with different statuses) all arrive correctly.
- [ ] Receiver handles the IP allowlist (`54.161.7.2`) if you restrict by IP at production.
- [ ] Offline curl test with example JSON parses without errors.

## Next steps

After confirming delivery:

1. Deploy your receiver to production (public HTTPS URL).
2. Update the dashboard webhook URL.
3. Implement deduplication on `metadata.messageId` and `events[].eventId`.
4. Implement ordering: compare `occurrenceDatetime` to the latest stored event.
5. Add async processing: return 200, then apply business logic (update shipment, send notifications, etc.).
6. Set up logging and monitoring for webhook failures.
7. Keep the resend endpoint and the webhook history download in your debugging toolbox.

See the `ship24-webhooks` skill for full implementation details, payload structure, and best practices.

## Key links

| Resource | URL |
| --- | --- |
| Webhook documentation | https://docs.ship24.com/webhooks/overview |
| Resend endpoint | https://docs.ship24.com/tracking-api-reference/#/operations/resend-webhooks |
| Webhook history | https://docs.ship24.com/tracking-api-reference/#/operations/download-webhook-history |
| Sample tracking numbers | Ship24 Tracking Statuses skill |
