# Webhook receiver checklist and snippets

Sources: [Webhooks overview](https://docs.ship24.com/webhooks/overview), [Specification](https://docs.ship24.com/webhooks/specification),
[Authentication](https://docs.ship24.com/webhooks/authentication), [Sending behavior](https://docs.ship24.com/webhooks/delivery).
The 15-second timeout is verified in Ship24's implementation (see the plugin's CONTRIBUTING).

## Checklist

- [ ] Webhook URL set in the dashboard (Integrations → Webhooks); a separate URL for Proof of Delivery if the add-on is active.
- [ ] Endpoint accepts `POST`, is public, HTTPS.
- [ ] `Authorization: Bearer <webhook secret>` compared in constant time; wrong or missing secret → `401`.
- [ ] Any `2xx` returned before heavy work; the whole request completes well under 15 seconds.
- [ ] Payload persisted or enqueued, processed by a worker.
- [ ] Deduplication on `metadata.messageId` and `events[].eventId` (retries and the resend endpoint replay messages).
- [ ] Shipment matched on `tracker.trackerId` or `tracker.clientTrackerId`, never on the tracking number alone.
- [ ] Business rules applied only when the event is newer than the latest stored one (`occurrenceDatetime`, then `order` for equal or date-only values).
- [ ] Add-on fields read only when present.
- [ ] PoD `content.downloadUrl` fetched within 7 days.
- [ ] Tested with `SHIP24_SAMPLE_*` trackers and with `POST /trackers/{trackerId}/webhook-events/resend`.

The snippets below show the receiving half only. `app`, `express`, `queue`, `db` and `seen` are placeholders for
the app's Express instance, queue, storage and deduplication store. The official Node SDK has no webhook
verification or parsing helper; it does export the `Tracking` and `WebhookMetadata` payload types.

## Express (Node.js)

```javascript
import crypto from 'node:crypto';

const secret = Buffer.from(process.env.SHIP24_WEBHOOK_SECRET);

function secretMatches(header = '') {
  const [scheme, token = ''] = header.split(' ');
  const candidate = Buffer.from(token);
  return scheme === 'Bearer' && candidate.length === secret.length && crypto.timingSafeEqual(candidate, secret);
}

app.post('/webhooks/ship24', express.json({ limit: '1mb' }), async (req, res) => {
  if (!secretMatches(req.headers.authorization)) return res.sendStatus(401);
  await queue.enqueue('ship24-webhook', req.body);
  res.status(200).json({ ok: true });
});
```

Worker:

```javascript
async function processShip24Webhook(payload) {
  for (const tracking of payload.trackings) {
    const { metadata, tracker, shipment, events = [] } = tracking;
    if (await seen.has(metadata.messageId)) continue;
    const record = await db.shipments.findByTrackerId(tracker.trackerId);
    if (record) {
      if (metadata.topic === 'tracking/pod') {
        await db.shipments.update(record.id, { proofOfDelivery: tracking.data });
      }
      for (const event of events) {
        if (await seen.has(event.eventId)) continue;
        if (isNewer(event, record.lastEvent)) {
          await db.shipments.update(record.id, { status: shipment.statusMilestone, lastEvent: event });
        }
        await seen.add(event.eventId);
      }
    }
    await seen.add(metadata.messageId);
  }
}
```

`isNewer` compares `occurrenceDatetime` values parsed as dates when both carry a time, and falls back to the
`order` field (which may be `null`) when either is a bare date or the datetimes are equal. Proof-of-delivery
messages (`metadata.topic` = `tracking/pod`) carry `data` instead of `events` and `shipment`.

## FastAPI (Python)

```python
import os
import secrets

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Request

app = FastAPI()
SECRET = os.environ["SHIP24_WEBHOOK_SECRET"]


@app.post("/webhooks/ship24")
async def ship24_webhook(request: Request, tasks: BackgroundTasks, authorization: str = Header("")):
    scheme, _, token = authorization.partition(" ")
    if scheme != "Bearer" or not secrets.compare_digest(token, SECRET):
        raise HTTPException(status_code=401)
    payload = await request.json()
    tasks.add_task(process_ship24_webhook, payload)
    return {"ok": True}
```

`process_ship24_webhook` follows the same steps as the Node worker: skip seen `messageId`, match on
`tracker["trackerId"]`, skip seen `eventId`, compare `occurrenceDatetime` and `order`, then update.

## Rails (Ruby)

```ruby
# config/routes.rb: post "webhooks/ship24", to: "ship24_webhooks#create"
class Ship24WebhooksController < ActionController::API
  def create
    return head :unauthorized unless secret_matches?(request.authorization)

    Ship24WebhookJob.perform_later(JSON.parse(request.raw_post))
    render json: { ok: true }
  end

  private

  def secret_matches?(header)
    scheme, token = header.to_s.split(" ", 2)
    scheme == "Bearer" && ActiveSupport::SecurityUtils.secure_compare(token.to_s, ENV.fetch("SHIP24_WEBHOOK_SECRET"))
  end
end
```

`Ship24WebhookJob#perform(payload)` iterates `payload["trackings"]` with the same deduplication and ordering
rules.

## Production notes

- Keep deduplication entries for at least a week; a retry can arrive about six days after the first attempt
  and the resend endpoint replays a tracker's full history.
- Log the raw payload before processing; the webhook history download
  (`GET /trackers/{trackerId}/webhook-history/download`) shows Ship24's view of every push for comparison.
- If the endpoint filters by source IP, allow `54.161.7.2` (the documented outgoing IP) and remember that the
  dashboard test button does not use it.
