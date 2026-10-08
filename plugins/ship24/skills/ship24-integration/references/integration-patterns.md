# Integration patterns

Hand-written companion to the generated references. Sources: [Common scenarios](https://docs.ship24.com/common-scenarios),
[Trackers](https://docs.ship24.com/trackers), [Webhooks](https://docs.ship24.com/webhooks/overview).

## Webhooks or polling

| Criterion | Webhooks | Polling | Synchronous `POST /trackers/track` |
| --- | --- | --- | --- |
| Latency | Pushed as soon as Ship24 discovers events | Bounded by the polling interval | Immediate, first call up to 1 min |
| Cost to the app | One public HTTPS endpoint, idempotent processing | One `GET` per tracker per interval, rate limited at 10 req/s | One call per lookup |
| Public URL needed | Yes | No | No |
| Fits | Any volume, especially thousands of trackers | Small volumes, prototypes, environments without inbound traffic | Interactive lookups, scripts, one-off checks |
| Stop condition | Ship24 stops pushing when tracking ends | Stop when `isTracked` is `false` | Not applicable |

Mixing is fine: create trackers and receive webhooks, and call `GET /trackers/{trackerId}/results` on demand
when a user opens a page.

## Matching Ship24 data to internal records

1. Preferred: store the `trackerId` returned by `POST /trackers` next to the order or shipment row. Webhook
   payloads carry it at `trackings[].tracker.trackerId`.
2. Alternative: send the internal id as `clientTrackerId` at creation. Ship24 enforces uniqueness across
   subscribed trackers, echoes it in every response and webhook, and accepts `?searchBy=clientTrackerId` on
   the `/trackers/{trackerId}` endpoints (get, update, results, resend, webhook history). Unsubscribing a tracker (`PATCH` with `isSubscribed: false`) frees the value.
3. Do not match on the tracking number alone. Two shipments with different couriers can share one, and
   `GET /trackers/search/{trackingNumber}/results` returns an array for that reason.

## Idempotent creation

Verified in Ship24's implementation (see the plugin's CONTRIBUTING). `POST /trackers` and `POST /trackers/track`
look up the account's trackers with the same `clientTrackerId` when one is sent, otherwise with the same
`trackingNumber`, and return an existing one when all of these match:

- `shippingDate` (compared at day precision)
- `originCountryCode`, `destinationCountryCode`, `destinationPostCode`
- `shipmentReference`, `courierName`, `trackingUrl`
- `settings.restrictTrackingToCourierCode`
- the `courierCode` list

Consequences:

- Retrying a failed request with the same body is safe and does not consume quota.
- Changing any of those fields creates a second tracker, which consumes quota.
- Reusing a `clientTrackerId` that belongs to an active tracker with a different payload returns
  `tracker_conflict`; so does, on `POST /trackers/track`, a `courierCode` list that overlaps an existing tracker's
  list without matching it. Differentiate with `shippingDate` or `destinationCountryCode`.

A sound creation routine therefore: look up the internal record first, and if it already has a `trackerId`,
skip the call; otherwise call `POST /trackers`, then persist `trackerId` in the same transaction as the record
update.

## Handling the API key

- Read from `SHIP24_API_KEY`; fail fast at startup when it is missing.
- Server side only. Browser or mobile clients must call the app's backend, never `api.ship24.com`.
- Up to 20 active keys per account: use one key per environment or service so a leak can be rotated in
  isolation from the dashboard.

## Processing webhooks asynchronously

Answer `2xx` first, then process. A typical shape:

1. Verify the `Authorization: Bearer <webhook secret>` header against the secret shown in the dashboard.
2. Persist the raw payload (or enqueue it) and return `200`.
3. A worker iterates `trackings[]`, matches on `tracker.trackerId` or `tracker.clientTrackerId`, skips events
   whose `eventId` was already seen, and applies business rules by comparing `occurrenceDatetime` with the
   latest stored event rather than assuming arrival order.

Details, payload fields and a runnable receiver live in the `ship24-webhooks` and `ship24-webhook-test`
skills.

## Testing without real parcels

- Sample tracking numbers `SHIP24_SAMPLE_<MILESTONE>_000` return a fixed event set for each milestone. Change
  the last three digits to mint a fresh tracker with the same results.
- Ship24 also publishes a list of real sample tracking numbers at
  https://files.ship24.com/docs/s24-tracking-numbers-sample.txt. Do not add made-up destination fields to those;
  results depend on the shipment's real destination and date.
- Test calls use the account's plan and quota; the docs point to the free plan for the integration and testing
  phase.
