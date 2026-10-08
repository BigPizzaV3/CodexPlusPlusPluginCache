# SDK Methods

All 12 methods exposed by the official Ship24 Node SDK.

| Method | Endpoint | Signature | Source file | Use when |
| --- | --- | --- | --- | --- |
| `trackers.create` | `POST /trackers` | `create(body: CreateTrackerRequest, opts?: RequestOptions): Promise<Tracker>` | `src/resources/trackers.ts` | Creating a tracker for a new shipment; idempotent by payload |
| `trackers.track` | `POST /trackers/track` | `track(body: CreateTrackerRequest, opts?: RequestOptions): Promise<Tracking[]>` | `src/resources/trackers.ts` | Getting tracking results synchronously; first call can take up to 60s; idempotent |
| `trackers.bulkCreate` | `POST /trackers/bulk` | `bulkCreate(items: CreateTrackerRequest[], opts?: RequestOptions): Promise<BulkCreateResult>` | `src/resources/trackers.ts` | Creating up to 100 trackers in one request; never throws on the envelope |
| `trackers.list` | `GET /trackers` | `list(params?: ListTrackersParams, opts?: RequestOptions): Promise<Tracker[]>` | `src/resources/trackers.ts` | Fetching a paginated list of trackers; no total count |
| `trackers.get` | `GET /trackers/{id}` | `get(trackerId: string, opts?: TrackerLookupOptions): Promise<Tracker>` | `src/resources/trackers.ts` | Getting a single tracker's metadata; also accepts `searchBy: 'clientTrackerId'` |
| `trackers.update` | `PATCH /trackers/{id}` | `update(trackerId: string, body: UpdateTrackerRequest, opts?: TrackerLookupOptions): Promise<Tracker>` | `src/resources/trackers.ts` | Updating tracker fields (isSubscribed, destination, etc.); cannot change shipment data after tracking begins |
| `trackers.getResults` | `GET /trackers/{id}/results` | `getResults(trackerId: string, opts?: TrackerLookupOptions): Promise<Tracking[]>` | `src/resources/trackers.ts` | Fetching full tracking data for a tracker: status, events, statistics |
| `trackers.getResultsByTrackingNumber` | `GET /trackers/search/{number}/results` | `getResultsByTrackingNumber(tn: string, opts?: RequestOptions): Promise<Tracking[]>` | `src/resources/trackers.ts` | Searching by raw tracking number; returns an array (a tracking number is not unique) |
| `trackers.resendWebhooks` | `POST /trackers/{id}/webhook-events/resend` | `resendWebhooks(trackerId: string, opts?: TrackerLookupOptions): Promise<ResendWebhooksResult>` | `src/resources/trackers.ts` | Replaying all webhook events of a tracker (rate limited 1 req/s per endpoint) |
| `trackers.downloadWebhookHistory` | `GET /trackers/{id}/webhook-history/download` | `downloadWebhookHistory(trackerId: string, opts?: TrackerLookupOptions): Promise<WebhookHistory>` | `src/resources/trackers.ts` | Downloading full webhook push history: metadata and all deliveries with request/response bodies |
| `couriers.list` | `GET /couriers` | `list(opts?: RequestOptions): Promise<Courier[]>` | `src/resources/couriers.ts` | Fetching all supported couriers; rate limited 1 req/s; cache the result |
| `perCall.track` | `POST /tracking/search` | `track(body: PerCallTrackRequest, opts?: RequestOptions): Promise<PerCallTracking[]>` | `src/resources/perCall.ts` | On-demand per-call lookup (per-call plan only); synchronous, ~60s; returns `PerCallTracking` (no `.tracker`) |
