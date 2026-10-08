---
name: ship24-node-sdk
description: Use the official Ship24 npm package in TypeScript or Node.js. Triggers include "Ship24 Node SDK", "ship24 npm package", "use ship24", "ship24.trackers.create", "import ship24", "new Ship24", or asking to replace hand-written fetch or axios calls to Ship24 in Node/TypeScript. Routes deeper Node SDK questions away from generic integration guidance. Covers installation, constructor configuration, all 12 endpoint methods, error handling, per-call vs per-shipment differences, pagination, and when retries are needed.
license: MIT
---

# Ship24 Node SDK

Official SDK for the Ship24 Tracking API. Full TypeScript support, zero runtime dependencies, native `fetch`.

## Install

```bash
npm install ship24
```

The SDK README lists Node 18+, Bun, Deno, Cloudflare Workers and modern browsers as supported runtimes; CI tests Node 20/22/24, Bun and Deno. Never ship a production API key to a browser: keep the SDK on the server. It ships ESM and CommonJS:

```ts
// ESM
import { Ship24 } from 'ship24';
// CommonJS
const { Ship24 } = require('ship24');
```

## Quickstart

```ts
import { Ship24 } from 'ship24';

const apiKey = process.env.SHIP24_API_KEY;
if (!apiKey) throw new Error('SHIP24_API_KEY is not set');

const ship24 = new Ship24({ apiKey });
const tracker = await ship24.trackers.create({ trackingNumber: '1234567890' });
console.log(tracker.trackerId);
```

## Configuration

Pass a `Ship24Config` object to the constructor. Only `apiKey` is required:

```ts
type Ship24Config = {
  apiKey: string; // required; the SDK does not read the environment itself
  baseUrl?: string; // default 'https://api.ship24.com'; the SDK appends /public/v1
  timeoutMs?: number; // see Timeouts
  fetch?: typeof fetch; // custom fetch implementation
  headers?: Record<string, string>; // extra default headers; Authorization is always overwritten
};
```

### Timeouts

Defaults are 10 seconds per request and 60 seconds for the synchronous `ship24.trackers.track` and `ship24.perCall.track` (Ship24 queries couriers synchronously, up to about a minute). In SDK 1.0.0 the constructor's `timeoutMs` is stored but never read by the transport, so set the timeout per call:

```ts
const result = await ship24.trackers.track(
  { trackingNumber: '1234567890' },
  { timeoutMs: 120_000 }
);
```

Per-call options are accepted by every method: `{ timeoutMs?, signal?, headers? }`. Tracker-id methods also accept `{ searchBy: 'trackerId' | 'clientTrackerId' }` to resolve the id as your own client id.

## Methods

See `references/sdk-methods.md` for the full table of 12 methods, their endpoints, signatures and when each is used, and `references/endpoints.md` for the endpoint paths, response codes and rate limits generated from the OpenAPI spec. Highlights:

### Per-shipment (default, recommended)

Create trackers, receive updates via webhooks or polling, manage courier codes.

```ts
await ship24.trackers.create({ trackingNumber, courierCode?, clientTrackerId? });
await ship24.trackers.track({ trackingNumber });  // sync, ~60s
await ship24.trackers.bulkCreate([{ trackingNumber }, ...]);  // up to 100
await ship24.trackers.list({ page?, limit?, sort? });
await ship24.trackers.get(trackerId);
await ship24.trackers.getResults(trackerId);
await ship24.trackers.update(trackerId, { isSubscribed? });
await ship24.trackers.resendWebhooks(trackerId);
await ship24.couriers.list();  // rate limited 1 req/s
```

### Per-call (separate subscription)

Synchronous one-off lookups; no persistent tracker.

```ts
await ship24.perCall.track({ trackingNumber, destinationCountryCode? });
```

Returns `PerCallTracking[]`. Note there is **no `.tracker`** field, unlike `trackers.track`.

## Error handling

All errors extend `Ship24Error`. Catch by class, then optionally branch on `code`:

```ts
import {
  Ship24Error,
  NotFoundError,
  RateLimitError,
  SubscriptionError,
  AuthenticationError,
  ValidationError,
  ConflictError,
  QuotaError,
  ServerError,
  Ship24ConnectionError,
  Ship24TimeoutError,
} from 'ship24';

try {
  const tracker = await ship24.trackers.get('unknown-id');
} catch (err) {
  if (err instanceof NotFoundError) {
    console.error(`Tracker not found: ${err.code}`);
    // Handle 404
  } else if (err instanceof RateLimitError) {
    console.error(`Rate limited; wait ${err.retryAfter}s`, err.rateLimit);
    // err.rateLimit has { limit, remaining, reset }
  } else if (err instanceof SubscriptionError) {
    console.error(err.message); // Actionable: per-call subscription required?
  } else if (err instanceof ValidationError) {
    console.error(`Invalid request: ${err.code}`);
    // Handle 400 validation
  } else if (err instanceof ConflictError) {
    console.error(`Conflict: ${err.code}`); // tracker_conflict or request_conflict
  } else if (err instanceof QuotaError) {
    console.error(`Quota exceeded: ${err.code}`);
  } else if (err instanceof AuthenticationError) {
    console.error(`Auth failed: ${err.code}`); // Missing/invalid key or header
  } else if (err instanceof ServerError) {
    console.error(`Server error (5xx): ${err.httpStatus}`);
  } else if (err instanceof Ship24TimeoutError) {
    console.error(`Timed out after ${err.timeoutMs}ms`);
  } else if (err instanceof Ship24ConnectionError) {
    console.error(`Network error: ${err.message}`);
  } else if (err instanceof Ship24Error) {
    console.error(`Unexpected error: ${err.message}`);
  } else {
    throw err; // Not a Ship24 error
  }
}
```

`ValidationError` is an alias of `InvalidRequestError`, the name that appears in `err.name`. All `Ship24APIError` subclasses carry `httpStatus`, `code`, `errors[]`, `requestId` (from the `x-request-id` header), and `body` (raw response). Log the `requestId` when contacting support.

## Per-call vs per-shipment

Ship24 sells two products. The SDK keeps them explicit:

| Aspect | Per-shipment | Per-call |
| --- | --- | --- |
| Namespace | `ship24.trackers.*` | `ship24.perCall.*` |
| Usage counted | Shipments (trackers) | API calls |
| Tracker persists | Yes | No |
| Return type | `Tracking` (has `.tracker`) | `PerCallTracking` (no `.tracker`) |
| Subscription | Standard per-shipment plan | Separate "Per-call" subscription |

Calling `ship24.perCall.track` without an active per-call subscription throws `SubscriptionError` (HTTP 422) with a message pointing to the dashboard.

## Bulk creation

`trackers.bulkCreate` accepts 1 to 100 items and **never throws on the envelope**: HTTP 201/207/400/403 all resolve to a `BulkCreateResult`. Inspect the result's `status` and per-item `errors`:

```ts
const result = await ship24.trackers.bulkCreate([
  { trackingNumber: 'A' },
  { trackingNumber: 'B' },
]);

if (result.status === 'success') {
  console.log('All created');
} else if (result.status === 'partial') {
  // Some failed; iterate result.data to find which
  for (const item of result.data ?? []) {
    if (item.itemStatus === 'error') {
      console.error(item.inputData.trackingNumber, item.errors);
    }
  }
}
```

The SDK documents that HTTP 201, 207, 400 and 403 resolve to a `BulkCreateResult`; other failures throw the usual error classes.

## Honesty: what the SDK does not do

**No automatic retries or backoff.** The SDK raises on rate limit (429). You must handle it:

```ts
import { RateLimitError } from 'ship24';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function retryOnRateLimit<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof RateLimitError && attempts > 1) {
      await sleep((err.retryAfter ?? 1) * 1000);
      return retryOnRateLimit(fn, attempts - 1);
    }
    throw err;
  }
}
```

**No pagination helper.** `trackers.list` returns a flat array with no total count. Pagination is manual:

```ts
import type { Tracker } from 'ship24';

const allTrackers: Tracker[] = [];
let page = 1;
while (true) {
  const batch = await ship24.trackers.list({ page, limit: 100 });
  if (batch.length === 0) break;
  allTrackers.push(...batch);
  if (batch.length < 100) break;
  page++;
}
```

**No webhook helper.** Webhook verification and parsing are your responsibility. See the `ship24-webhooks` skill or `docs.ship24.com/webhooks/overview`. You must verify the `Authorization: Bearer <webhook-secret>` header yourself using constant-time comparison.

**Statuses are typed as `string`, not literal unions.** Compare against the documented snake_case values such as `"delivered"` or `"delivery_delivered"` (see `ship24-tracking-statuses`); the compiler will not catch a typo.

## Exported types

From `src/index.ts` and `src/types/*.ts`:

```ts
import type {
  // Domain
  Tracker, Shipment, ShipmentDelivery, ShipmentRecipient, TrackingEvent, Statistics,
  Courier, CourierRequiredField, WebhookMetadata, Tracking, PerCallTracking,
  LogisticDateTime, IsoDateTime,
  // Requests
  CreateTrackerRequest, UpdateTrackerRequest, ListTrackersParams, PerCallTrackRequest,
  TrackerRecipientInput, TrackerSettingsInput,
  // Responses
  ApiErrorItem, BulkCreateItem, BulkCreateResult, ResendWebhooksResult, WebhookHistoryEntry, WebhookHistory,
  // Config and errors
  Ship24Config, RequestOptions, TrackerLookupOptions, RateLimitInfo, Ship24APIErrorInit,
} from "ship24";
```

Value exports: `Ship24`, `TrackersResource`, `CouriersResource`, `PerCallResource`, `VERSION` and the error classes,
including `Ship24APIError` and `InvalidRequestError`.

The API object `Event` is exported as `TrackingEvent` to avoid shadowing the DOM global. `LogisticDateTime` stays a
plain string on purpose: coercing it to `Date` would lose the "no time" and offset information.

## Schema drift and weekly checks

The `ship24-node` repository runs a weekly workflow that re-downloads the official OpenAPI spec from `docs.ship24.com/assets/openapi/ship24-tracking-api.yaml` and opens a PR when the vendored copy changed. Reconciling the hand-written types with the new spec is a manual step in that PR's checklist, so a spec change is noticed weekly but the types are not diffed automatically.

## See also

For full integration patterns (when to use webhooks vs polling, idempotent creation, handling add-on fields), see the `ship24-integration` skill. For webhooks specifically, see `ship24-webhooks`.
