---
name: ship24-webhooks
description: Build a correct Ship24 webhook receiver in any language. Use when asked to receive Ship24 tracking updates, build a webhook endpoint, verify webhook secrets, handle tracking or proof of delivery webhooks, or test webhook delivery. Covers authentication, payload structure, retry logic, ordering guarantees, and best practices to avoid data loss and duplicate processing.
license: MIT
---

# Building Ship24 webhook receivers

Ship24 pushes tracking events to your system via webhooks instead of requiring you to poll. Your webhook endpoint must validate the authentication, answer quickly, and process messages idempotently.

Facts in this skill come from [docs.ship24.com/webhooks](https://docs.ship24.com/webhooks/overview) and the Ship24 implementation verified on 2026-09-09. When implementing, consult:

| Need | Resource |
| --- | --- |
| Payload structure and field names | `references/webhook-payloads.md` (generated from the OpenAPI spec) and the example payloads under `assets/` |
| Event statuses and milestones | `ship24-tracking-statuses` skill |
| Error codes | `ship24-troubleshooting` skill |
| Receiver code examples | `references/receiver-checklist.md` (Express, FastAPI, Rails) |
| Testing your receiver | `ship24-webhook-test` skill |

Sibling skills: `ship24-integration` (full integration workflow), `ship24-webhook-test` (test your receiver), `ship24-tracking-statuses` (map status codes to business logic), `ship24-troubleshooting`.

## Configuration

**Webhook URL**: Dashboard only. Log in to [dashboard.ship24.com](https://dashboard.ship24.com), go to Integrations → Webhooks, and set your HTTPS endpoint. Optional: set a separate Proof of Delivery Webhook URL if you have the PoD add-on. The dashboard test button does NOT originate from the documented outgoing IP.

**Webhook secret (authentication)**: Each account has one shared secret sent as `Authorization: Bearer <secret>` in every request.

- It is NOT an HMAC signature; there is no per-message signature or replay protection.
- Compensate by using HTTPS, constant-time comparison of the secret (e.g., `crypto.timingSafeEqual`, `secrets.compare_digest`, `ActiveSupport::SecurityUtils.secure_compare`), whitelisting the outgoing IP `54.161.7.2`, and deduplicating on `metadata.messageId` and `events[].eventId`.

## Payload structure: tracking events

Ship24 sends tracking results under topic `tracking/events`:

```json
{
  "trackings": [{
    "metadata": {"generatedAt": "2025-03-04T17:13:35.000Z", "messageId": "...", "topic": "tracking/events"},
    "tracker": {"trackerId": "...", "trackingNumber": "...", "shipmentReference": "...", "clientTrackerId": "...", "isSubscribed": true, "createdAt": "..."},
    "shipment": {"shipmentId": "...", "statusMilestone": "delivered", "statusCode": "delivery_delivered"},
    "events": [{"eventId": "...", "status": "...", "occurrenceDatetime": "2025-03-04T17:12:57", "order": 9, "statusMilestone": "delivered"}],
    "statistics": {"timestamps": {...}}
  }]
}
```

**Structure:**
- Root key is `trackings` (array); each item has metadata, tracker (webhook-tracker, no `isTracked`/`courierCode`), shipment, events array (always exactly one event per webhook item), statistics.
- Match shipments on `tracker.trackerId` (preferred) or `tracker.clientTrackerId`.
- `metadata.topic` is `tracking/events` or `tracking/pod`.
- Add-on fields (e.g., `shipment.delivery.aiPredictiveDeliveryDate`) are absent, not `null`, when unavailable. Check field presence before reading.

## Payload structure: proof of delivery

Set a separate Proof of Delivery Webhook URL in the dashboard (if you have the PoD add-on). Payloads contain `metadata`, `tracker`, and `data` with fields: `status` (`found` or `unavailable`), `courier` (source code), `content.type` (text/plain, text/html, application/pdf, image/png, image/jpeg), `content.downloadUrl` (valid 7 days, download immediately). PoD payloads are never grouped; `trackings` always has exactly one item.

## Ordering and event deduplication

Webhooks are not ordered. Retries or out-of-order delivery can cause duplicates and older events to arrive late.

**Process:**
1. Deduplicate on `metadata.messageId` and `events[].eventId`.
2. Compare new event's `occurrenceDatetime` (a `logistic-date-time`: full datetime, datetime with offset, UTC datetime, or date only) to your latest stored event.
3. Use the `order` field (integer or null, lower is older) to break ties when `occurrenceDatetime` is equal or date-only.
4. Only apply business logic when the new event is newer than your latest stored event.

## Grouping and delays

By default, one event per webhook. The dashboard setting "Maximum number of updates per webhook message" controls it (default 1 on recent accounts; changing it requires contacting Ship24). A value above 1 introduces a delay of around 15 minutes so that updates can be grouped; `trackings` array length > 1, but each item still has exactly one event.

## Delivery contract

**Response:** Any `2xx` signals success. The docs say the body is ignored; Ship24's implementation treats a JSON body containing `success: false` as a failed delivery and retries it, so never return that. Answer quickly, then process asynchronously.

**Timeout:** Ship24 waits 15 seconds by default (verified in Ship24's implementation, not yet documented). No response = delivery fails.

**Retries:** the docs describe up to 20 retries with an exponential backoff "ranging from a few seconds to a few hours". Ship24's implementation, verified on 2026-09-09, makes up to 20 attempts in total: the first retry about 12 minutes after the failure, later attempts up to 12 hours apart, so deliveries can keep arriving for about six days. After the last attempt the message is not retried; use the resend endpoint to recover.

## Resending webhooks and history

**Resend:** `POST /public/v1/trackers/{trackerId}/webhook-events/resend` (rate limit 1 req/s, supports `?searchBy=clientTrackerId`). Resends ALL messages, so your receiver must be idempotent.

**History:** `GET /public/v1/trackers/{trackerId}/webhook-history/download` (supports `?searchBy=clientTrackerId`). Returns a JSON file with metadata and the log of sent pushes: request body, response, HTTP status, timestamps. Pending webhooks (not yet sent or failed) are excluded.

## Recommended receiver flow

1. Validate the secret (constant-time comparison).
2. Answer `2xx` immediately (persist or enqueue, then return).
3. Process asynchronously: parse JSON, iterate `trackings[]`, match on `tracker.trackerId` or `tracker.clientTrackerId`, skip if `metadata.messageId` or `events[].eventId` already seen, compare `occurrenceDatetime` to latest stored event, apply business logic.

See `references/receiver-checklist.md` for code examples (Express, FastAPI, Rails) and a complete checklist.

## Error codes

`webhook_url_missing`: Webhook URL is required but not configured. Set one in the dashboard.

## Testing without real parcels

Use sample tracking numbers: `SHIP24_SAMPLE_DELIVERED_000`, `SHIP24_SAMPLE_IN_TRANSIT_000`, etc. Change the last three digits to mint new trackers with the same events. See the `ship24-tracking-statuses` skill for the full list.

## Key links

| Resource | URL |
| --- | --- |
| Dashboard, webhook setup | https://dashboard.ship24.com/integrations/webhook/ |
| Webhook documentation | https://docs.ship24.com/webhooks/overview |
| Resend endpoint | [Ship24 API reference](https://docs.ship24.com/tracking-api-reference/#/operations/resend-webhooks) |
| Webhook history download | [Ship24 API reference](https://docs.ship24.com/tracking-api-reference/#/operations/download-webhook-history) |
