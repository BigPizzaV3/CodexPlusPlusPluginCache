---
name: ship24-integration
description: Integrate the Ship24 Tracking API into a codebase end to end. Use when asked to "add Ship24", "integrate Ship24", "integrate package, parcel or shipment tracking", create trackers, choose between webhooks and polling, or call the per-call tracking endpoint, in any language or framework. Detects the project's stack, confirms the Ship24 plan type and update mechanism, then guides implementation and verification against the OpenAPI spec. For webhook receivers, courier codes, statuses, errors or the Node SDK, the sibling ship24-* skills go deeper.
license: MIT
---

# Ship24 Tracking API integration

Opinionated wizard: detect the project, clarify the plan, guide the implementation, verify the result.

Facts in this skill come from [docs.ship24.com](https://docs.ship24.com) and the OpenAPI 3.1 spec at
[docs.ship24.com/assets/openapi/ship24-tracking-api.yaml](https://docs.ship24.com/assets/openapi/ship24-tracking-api.yaml).
The bundled `references/endpoints.md` and `schemas.md` are generated from that spec, `errors.md` and
`rate-limits.md` from the docs pages. When a detail matters (a field name, a status
code, a limit), read the reference file rather than guessing:

| Need | Read |
| --- | --- |
| Every endpoint, parameters, responses, rate limit | `references/endpoints.md` |
| Field tables for tracker, tracking, shipment, event, request bodies | `references/schemas.md` |
| HTTP statuses and error codes | `references/errors.md` |
| Rate limits and rate-limit headers | `references/rate-limits.md` |
| Webhook vs polling trade-offs, matching records, idempotent creation | `references/integration-patterns.md` |

Sibling skills: `ship24-webhooks` (build the receiver), `ship24-couriers` (courier codes and required fields),
`ship24-tracking-statuses` (map statuses to business logic), `ship24-troubleshooting` (errors), `ship24-node-sdk`
(the official `ship24` npm package).

## Phase 1: Detect

Scan before asking. Use the host tool's search if there is no shell.

```bash
grep -ri "ship24" . --include=*.{js,ts,py,rb,php,go,java,cs,env,json,yaml,yml} 2>/dev/null | head -20
grep -ri "SHIP24" .env .env.local .env.example 2>/dev/null
grep -rE "express|fastify|nest|fastapi|django|flask|rails|laravel|symfony|gin|spring|aspnet" \
  package.json requirements.txt pyproject.toml Gemfile composer.json go.mod pom.xml *.csproj 2>/dev/null | head
grep -rn "webhook" . --include=*.{js,ts,py,rb,php,go,java,cs} 2>/dev/null | head
grep -rE "bull|bullmq|celery|sidekiq|rabbitmq|sqs|pubsub|kafka" \
  package.json requirements.txt pyproject.toml Gemfile composer.json go.mod 2>/dev/null | head -5
```

Note: existing Ship24 usage (trackers created? webhook route present?), language and framework, HTTP client in
use, queue or async infrastructure, an existing public webhook route that can be extended.

If the project is Node.js or TypeScript, prefer the official SDK (`npm install ship24`) over hand-written HTTP
calls and switch to the `ship24-node-sdk` skill for the implementation details.

## Phase 2: Clarify

Ask only what detection could not determine, one question at a time.

1. **Account and key.** Does the user have a Ship24 account and API key? A free plan exists for integration and
   testing: [dashboard.ship24.com/onboarding](https://dashboard.ship24.com/onboarding). Keys live under
   Integrations → API Keys (up to 20 active keys per account).
2. **Plan type.** Per-shipment (the standard product: trackers, webhooks, polling) or per-call (a separate
   subscription, one synchronous endpoint, no trackers)? If unsure: per-shipment is the default choice; Ship24
   documents it as offering more features, faster fetching and lower overall cost.
3. **Update mechanism** (per-shipment only). Webhooks (Ship24 pushes updates, recommended) or polling (the app
   calls the API)? Webhooks need a public HTTPS endpoint. At thousands of trackers, polling stops being
   practical.
4. **Constraints.** New project or existing app? Serverless? No public URL? Multi-tenant?

Do not write code until plan type, key handling (env var) and update mechanism are settled.

## Phase 3: Guide

### Authentication and base URL (all plans)

- Base URL: `https://api.ship24.com/public/v1`
- Header on every request: `Authorization: Bearer <api key>` (keys look like `apik_...`).
- Read the key from the `SHIP24_API_KEY` environment variable. Never hardcode it, commit it, or ship it to a
  browser or mobile client: the key grants full access to the account's tracking data and quota.

```bash
# .env (never committed)
SHIP24_API_KEY=apik_your_key_here
```

### Route by plan

| Plan | Endpoints | Docs |
| --- | --- | --- |
| Per-shipment | `POST /trackers`, `POST /trackers/bulk`, `POST /trackers/track`, `GET /trackers/{trackerId}/results`, webhooks | [Trackers](https://docs.ship24.com/trackers), [Webhooks](https://docs.ship24.com/webhooks/overview) |
| Per-call | `POST /tracking/search` only | [Per-call API](https://docs.ship24.com/per-call-api) |

### Per-shipment plan

**Webhook flow (recommended)**

1. Build a `POST` endpoint that answers `2xx` quickly and processes asynchronously (see `ship24-webhooks`).
2. Register its URL in the dashboard: Integrations → Webhooks. There is no API for this.
3. Create a tracker per shipment with `POST /trackers` (or up to 100 at once with `POST /trackers/bulk`).
   Store the returned `trackerId`.
4. Ship24 pushes every new event to the endpoint. A webhook `events[]` array contains only the events
   discovered since the last push; API responses contain the full history.

**Polling flow**

1. `POST /trackers`, store `trackerId`.
2. Do not poll immediately: results are not available the instant a tracker is created.
3. `GET /trackers/{trackerId}/results` on an interval the app chooses. Ship24 does not mandate a cadence.
   Longer intervals for slower shipments.
4. Stop when the tracker's `isTracked` is `false`: Ship24 has stopped tracking that shipment.

**Synchronous one-shot flow**

`POST /trackers/track` creates the tracker and returns results in the same call. The first call can take up to
one minute because Ship24 queries couriers synchronously; some couriers do not support it and return results on
later calls. Calling it again with the same payload returns the same tracker with fresh results.

**Idempotency** (verified in Ship24's implementation, see the plugin's CONTRIBUTING). `POST /trackers` and
`POST /trackers/track` look up the account's trackers with the same `clientTrackerId` when one is sent, otherwise
with the same `trackingNumber`, and reuse a candidate without consuming quota when `shippingDate` (day
precision), `originCountryCode`, `destinationCountryCode`, `destinationPostCode`, `shipmentReference`,
`courierName`, `trackingUrl`, `settings.restrictTrackingToCourierCode` and the `courierCode` list all match.
Otherwise a new tracker is created. `tracker_conflict` comes back when the `clientTrackerId` belongs to an active
tracker with a different payload, and on `POST /trackers/track` when the `courierCode` list overlaps an existing
tracker's list without matching it; differentiate with `shippingDate` or `destinationCountryCode`, or resend the
same payload.

**Identify shipments.** Tracking numbers are not unique across couriers or time. Store Ship24's `trackerId`.
Alternatively set `clientTrackerId` to the app's own unique id: Ship24 validates its uniqueness across
subscribed trackers and most endpoints accept `?searchBy=clientTrackerId`. `shipmentReference` is free text,
not validated for uniqueness, and returned in responses and webhooks.

**Tracker creation fields** (full table in `references/schemas.md`, `tracker-create-request`):

| Field | Notes |
| --- | --- |
| `trackingNumber` | Required. 5 to 50 chars, `A-Z a-z 0-9 - _ / .`; returned uppercased, compare case-insensitively. Dummy values such as `123456789` are rejected. |
| `courierCode` | Optional string or array (max 3 per request). Improves detection; see `ship24-couriers`. |
| `clientTrackerId` | Optional, max 100 chars, unique across subscribed trackers. |
| `shipmentReference` | Optional, max 100 chars, not unique. |
| `originCountryCode`, `destinationCountryCode` | ISO 3166-1 alpha-2 or alpha-3 accepted; alpha-2 returned. Some couriers require the destination. |
| `destinationPostCode` | 1 to 32 chars. Some couriers require it. |
| `shippingDate` | ISO 8601. Rejected with `shipping_date_outdated` when older than 180 days. |
| `recipient.email`, `recipient.name` | Used for email notifications; `name` also feeds courier-restricted tracking data. Max 254 and 100 chars. |
| `settings.restrictTrackingToCourierCode` | Track only with the given courier codes. |

**Bulk creation.** `POST /trackers/bulk` accepts 1 to 100 items and answers `201` (the docs also list `200`),
`207` (partial) or an error. Its body is `{ status, summary, data, error }` with `status` in
`success | partial | error`, unlike the `{ data }` envelope of the other tracker endpoints. Rate limit 3 requests
per second.

### Per-call plan

`POST /tracking/search` with the tracking number (plus optional courier and destination hints) fetches results
synchronously from couriers. Response time can reach one minute. No tracker is created, nothing to store, no
webhooks. Requires an active per-call subscription; without one the API answers `no_active_subscription`.

### Data handling rules that bite

- Add-on fields (for example `shipment.delivery.aiPredictiveDeliveryDate`) are **absent**, not `null`, when
  the account lacks the option or Ship24 has no value. Check presence before reading.
- Event `occurrenceDatetime` is a `logistic-date-time`: local time, local time with offset, UTC, or date only.
  Keep it as a string; use the event `order` field to sort events that lack a time.
- `datetime`, `utcOffset`, `hasNoTime` (events) and `signedBy` (delivery) are deprecated. Do not build on them.
- Rate limits are per endpoint per second (most are 10 req/s, bulk 3, couriers and resend 1). Honor
  `Retry-After` on `429`. Details in `references/rate-limits.md`.
- Error bodies are `{ "errors": [{ "code", "message" }], "data": null }` (`message` optional), except the bulk
  endpoint's `{ status, summary, data, error }`. Branch on `code`, not on the message text. Codes in
  `references/errors.md`.

## Phase 4: Verify

- [ ] API key read from `SHIP24_API_KEY`; not in source, not in client-side code.
- [ ] `trackerId` (or a validated `clientTrackerId`) persisted for every created tracker.
- [ ] Webhook endpoint answers `2xx` before processing and matches payloads on `trackerId` or `clientTrackerId`.
- [ ] Duplicate deliveries handled: deduplicate on `events[].eventId`.
- [ ] Polling does not start immediately, uses an interval the team chose deliberately, and stops on
      `isTracked: false`.
- [ ] `401`, `403`, `422`, `429` (with `Retry-After`) and `5xx` handled; error `code` logged.
- [ ] Add-on fields read only when present.
- [ ] Tested end to end with a Ship24 sample tracking number such as `SHIP24_SAMPLE_DELIVERED_000`
      (see `ship24-tracking-statuses` for the full list).

## Key links

| Resource | URL |
| --- | --- |
| Dashboard, API keys, webhook URL | https://dashboard.ship24.com |
| Documentation | https://docs.ship24.com |
| API reference | https://docs.ship24.com/tracking-api-reference/ |
| OpenAPI 3.1 spec | https://docs.ship24.com/assets/openapi/ship24-tracking-api.yaml |
| Node SDK | https://github.com/ship24/ship24-node |
| Pricing | https://www.ship24.com/pricing |
