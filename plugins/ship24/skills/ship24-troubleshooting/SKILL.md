---
name: ship24-troubleshooting
description: Diagnose Ship24 Tracking API problems from the symptom. Use when asked about a Ship24 error, a 400, 401, 403, 422 or 429 response, tracker_not_found, parcel_not_found, tracker_conflict, quota_limit_reached, "no tracking results", "tracker not updating", "webhook not received", "rate limited", or when the Ship24 MCP tools return 401 or seem to be missing. Gives the cause and the fix for every documented HTTP status and error code.
license: MIT
---

# Troubleshooting

Sources: [Error management](https://docs.ship24.com/errors), [Rate limiter](https://docs.ship24.com/rate-limiter),
[Standard data format](https://docs.ship24.com/data-format), [Trackers](https://docs.ship24.com/trackers),
[Integrate with AI](https://docs.ship24.com/integrate-with-ai). Full tables: `references/errors.md`,
`references/rate-limits.md`, `references/statuses.md`, `references/endpoints.md`.

Error bodies are `{ "errors": [{ "code", "message" }], "data": null }`; `message` is optional. `POST /trackers/bulk`
is the exception: its body is `{ status, summary, data, error }` with the code under `error.code`. Branch on
`code`; `message` is for humans and may change.

## Symptom to fix

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `401` | Missing or wrong `Authorization: Bearer apik_...` header, revoked key | Check the header and the key in Dashboard → Integrations → API Keys. |
| `403` | Insufficient permissions or endpoint limitations; on `POST /trackers/bulk` it carries `quota_limit_reached` | Check the subscription and quota in the dashboard. A missing plan for an endpoint answers `422` + `no_active_subscription` instead. |
| `400` + `validation_error` | A field failed validation | Read `message`. Country codes: ISO 3166-1 alpha-2 or alpha-3, uppercase. Tracking number: 5 to 50 chars, `A-Z a-z 0-9 - _ / .`, dummy values rejected. Postcode: 1 to 32 chars, `A-Z a-z 0-9 - _ / .` and space. |
| `400` + `tracker_conflict` | A tracker with similar conflicting parameters already exists: the `clientTrackerId` belongs to an active tracker with a different payload, or (on `POST /trackers/track`) the `courierCode` list overlaps an existing tracker's list without matching it | Provide additional parameters such as `shippingDate` and `destinationCountryCode` to differentiate the tracker, or resend the identical payload to reuse it. |
| `bulk_create_limit_exceeded` | More than 100 items in `POST /trackers/bulk` (bulk envelope, code under `error.code`) | Split into batches of 100. |
| `402` | Parameters valid but the request failed | Read the error `code`; it names the reason. |
| `404` + `tracker_not_found` | Unknown `trackerId`, or `clientTrackerId` used without `searchBy=clientTrackerId` | Check the id and the `searchBy` query parameter. |
| `409` + `request_conflict` | Same payload sent in parallel; one request won | Retry later; idempotent endpoints are safe to retry. |
| `400` + `shipping_date_outdated` | `shippingDate` older than 180 days | Ship24 does not track shipments older than 6 months. |
| `422` + `no_active_subscription` | No subscription covers the endpoint, most often `POST /tracking/search` without a per-call plan | Use the per-shipment endpoints (`POST /trackers/track` for a synchronous lookup) or subscribe. |
| `quota_limit_reached` | Trackers or calls above the plan's quota for the billing period | Wait for the period to reset or upgrade. Note that changed payloads create new trackers and consume quota. |
| `tracker_not_updatable` | The shipment has already been processed; courier and destination can only change while Ship24 has found no trace of it | Create a new tracker with the corrected data. |
| `parcel_not_found` | Shipment created recently and not yet visible at the courier, or too little information | Wait and retry; add `originCountryCode`, `destinationCountryCode`, `destinationPostCode`, `shippingDate` when known. Do not add made-up destination fields to sample numbers. |
| `processing_error` | Error while processing the data; on `POST /trackers/bulk` it means every item failed validation | Read each bulk item's `errors`. Otherwise retry once, then contact Ship24. |
| `webhook_url_missing` | The operation needs a webhook URL and none is configured | Set the URL in Dashboard → Integrations → Webhooks. |
| `429` | Rate limit exceeded | Wait `Retry-After` seconds (also `RateLimit-Reset`). Default limits are per endpoint per second: most endpoints 10, `POST /trackers/bulk` 3, `GET /couriers` and the resend endpoint 1. |
| `207` on bulk | Some items failed | Inspect each item in `data` and the `summary`; `status` is `partial`. |
| `500`, `502`, `503`, `504` | Ship24 side | Retry with exponential backoff. |

## Tracker created, no events

1. Tracking is not instant. Results appear once Ship24 has queried the couriers; wait before the first poll.
2. `isTracked: false` means Ship24 has stopped tracking this shipment; no new events will come.
3. Courier not detected: add `courierCode`, and the courier's `requiredFields` (`destinationPostCode`,
   `destinationCountryCode`; `courierAccount` has no request field). See `ship24-couriers`.
4. A deprecated `courierCode` is silently ignored. Check `isDeprecated` in `GET /couriers`.
5. `shipment.statusMilestone` stays `pending` when no events are available or the shipment cannot be found.

## Webhook not received

1. URL registered in Dashboard → Integrations → Webhooks? There is no API for it.
2. Public HTTPS endpoint reachable from the internet?
3. Does the endpoint answer `2xx` quickly? Ship24's implementation gives up after 15 seconds by default
   (verified in code, not yet documented); return `2xx` first and process afterwards.
4. Use the dashboard "test your integration" button, then `POST /trackers/{trackerId}/webhook-events/resend`
   (1 request per second) to replay a tracker's messages. `GET /trackers/{trackerId}/webhook-history/download`
   shows every push with response codes.
5. Filtering by source IP? The documented outgoing IP is `54.161.7.2`; the dashboard test button does not use it.

## Duplicate or out-of-order webhooks

Deliveries are retried when no `2xx` is received and the resend endpoint replays every message of a tracker,
so duplicates are normal. Deduplicate on `events[].eventId`. Order is not guaranteed: compare
`occurrenceDatetime` (and `order` when the time is missing) with the latest stored event.

## MCP tools

| Symptom | Cause | Fix |
| --- | --- | --- |
| Tools are listed but every call returns `401` | The server lists tools without a key (discovery lane) but needs `Authorization: Bearer` for calls | Set `SHIP24_API_KEY` where the host tool reads it (shell environment, plugin variable or setting), then reconnect. |
| `search_tracking` missing | The key's plan has no per-call subscription | Use `track` (per-shipment). Per-call-only keys see `search_tracking` and `get_couriers`; per-shipment-only keys see everything except `search_tracking`. |
| Tools did not change after upgrading the plan | Plan is detected once per session | Reconnect the MCP client. |
| `track` or `search_tracking` slow | Synchronous courier fetch | Up to one minute is documented and the MCP server aborts after 60 seconds; wait rather than retrying, and allow at least 60 seconds when calling the API directly. |

## Sibling skills

`ship24-webhooks` for the receiver contract, `ship24-couriers` for detection issues, `ship24-tracking-statuses`
for what a status means, `ship24-integration` for the overall flow.
