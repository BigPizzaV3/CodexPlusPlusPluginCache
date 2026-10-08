# Integration boundary policy

Use this reference only after a YCloud integration Skill is selected and the
request asks for production architecture, error translation, retry,
idempotency, or webhook reliability. It is a reviewed project-policy reference,
not a YCloud provider contract.

## Authority labels

Keep every generated claim in one of these layers:

| Layer | Authority | Allowed use |
| --- | --- | --- |
| Confirmed provider contract | The selected `openapi.md` and `runtime.md` | State as YCloud behavior. Preserve exact fields, paths, headers, limits, and unknowns. |
| Recommended platform policy | This file and established project patterns | Propose as an implementation choice. Label defaults and numeric values as configurable. |
| Project profile | Files and configuration explicitly placed in scope | Map the policy to the confirmed runtime, storage, queue, secret manager, and deployment. |

Never promote a platform recommendation or project setting into a YCloud
guarantee. When the provider contract and a recommendation conflict, stop and
report the conflict.

## Error translation boundary

- Preserve the YCloud error envelope and `YCloud-Request-ID` at the provider
  adapter. Do not claim that YCloud returns RFC 9457 Problem Details.
- A project may translate provider failures into `application/problem+json` at
  its own northbound API boundary. Treat `code`, `retryable`,
  `provider_code`, and `provider_request_id` as documented extension members;
  use a stable problem `type`, a URI-reference `instance`, and a stable `title`.
- Keep the real HTTP status authoritative. Do not let the body status contradict
  it. Do not parse human-readable `detail`, the YCloud diagnostic message, or
  stack text for control flow.
- Redact credentials, customer payloads, internal URLs, stack traces, SQL, and
  PII. Correlate logs, metrics, jobs, and user-safe responses with a request ID.
- Derive `retryable` from the local failure classifier. It is guidance for the
  caller, not proof that replay is safe.

See RFC 9457 for the optional project-facing Problem Details format:
<https://www.rfc-editor.org/rfc/rfc9457.html>.

## Replay and retry boundary

- Retry only when both conditions hold: the failure is transient and the operation is replay-safe.
  A timeout or connection loss can have an ambiguous outcome because the
  provider may have accepted the request.
- Honor documented `Retry-After` first. Backoff, full jitter, retry budgets,
  deadlines, maximum attempts, circuit breakers, queues, and DLQs are
  configurable platform policy unless `runtime.md` says otherwise.
- Never blindly replay a send, create, edit, delete, upload, or rotate request.
  The selected YCloud contract does not define a general client
  `Idempotency-Key` or exactly-once guarantee.
- If the project exposes its own `Idempotency-Key`, state that it is the
  project's northbound contract. Back it with a durable command/outbox identity
  and unique constraint before the provider call; do not forward or attribute
  it to YCloud without provider evidence.
- Persist the provider resource/message ID separately from the application's
  idempotency key or `externalId`. Do not treat a queued retry as a substitute
  for resolving an ambiguous provider outcome.

RFC 9110 permits `Retry-After` to contain an HTTP date or delay seconds; the
reviewed YCloud runtime reference currently defines seconds. Parse according to
the selected boundary: <https://www.rfc-editor.org/rfc/rfc9110.html>.

## Rate-limit boundary

- Treat YCloud response headers and the selected operation policy as the
  provider signal. Parse beta `RateLimit-*` headers defensively.
- WAF limits, tenant/API-key/route token buckets, provider concurrency limits,
  and Redis/Lua implementations are project architecture. Never present sample
  thresholds as YCloud defaults.
- An IP-only webhook limit can penalize shared provider egress. Prefer an
  endpoint/account dimension with a reviewed burst policy; use IP restrictions
  only when the provider publishes stable network information.

## Webhook durable-acceptance boundary

For YCloud, take the signature header, canonical string, algorithm, retry
schedule, acknowledgement guidance, endpoint limits, and suspension behavior
from `runtime.md`. Apply this order:

1. Enforce method, content type, header size, and body size using project limits.
2. Capture the exact raw body before JSON reserialization.
3. Parse the documented signature fields; verify HMAC in constant time.
4. Apply the configurable Developer Kit default of 300 seconds in both
   directions: `abs(nowUnixSeconds - timestamp) <= 300`. This is recommended
   receiver policy, not a fixed YCloud tolerance.
5. Resolve the tenant from a trusted endpoint mapping, not an untrusted payload
   claim.
6. Validate the common envelope and compute a payload hash.
7. Insert or resolve a durable inbox record with a unique key scoped at least by
   `(provider, webhook_endpoint_id, event_id)`.
8. Return `2xx` only after durable acceptance, then process asynchronously.

Use this response policy as a recommendation, not a provider response schema:

| Receiver state | Recommended response |
| --- | --- |
| Missing or invalid signature | `401`; do not enqueue |
| Invalid common envelope before durable acceptance | `400` |
| Duplicate event ID with the same hash | `2xx`; do not duplicate work |
| Verified unknown event type | Persist as `UNSUPPORTED_EVENT`, return `2xx` |
| Same scoped event ID with a different hash | Persist/quarantine and alert; return `2xx` only after durable recording |
| Inbox unavailable or durable recording failed | `503` so provider retry remains possible |
| Business processing failed after durable acceptance | Keep the earlier `2xx`; use internal retry/DLQ |

The core rule is: before durable acceptance, provider delivery retry may be
needed; after durable acceptance, rely on internal processing retry.

Do not parse an invalidly signed payload for business classification. Do not use
event type, `whatsappMessage.id`, message status, `wamid`, signature, or payload
hash alone as the inbox identity. Distinct event IDs for the same message remain
distinct accepted observations; consumer projection idempotency is a separate
step and may return `no_change` without relabeling a new event as `duplicate`.

## Webhook security and lifecycle boundary

- For an accepted signature, atomically claim
  `(webhook_endpoint_id, timestamp, signature)` for at least the configured
  300-second timestamp window. This blocks an identical transport replay; event
  retries still require the durable event-ID inbox below.
- The Developer Kit default event-inbox retention is 24 hours. Keep the unique
  key `(provider, webhook_endpoint_id, event_id)` and allow a project to extend
  retention for its recovery window. Neither value is a YCloud retention
  guarantee.
- Verify every explicitly configured candidate secret and combine the results
  without returning on the first candidate. This is a receiver capability for
  bounded cutovers. An old-secret expiry, provider-side dual-secret overlap,
  atomic rotation, and rollback remain `CANNOT` unless provider evidence or an
  approved project contract confirms them.
- SSRF validation belongs to callback URL registration/endpoint management, not
  the receiver. When a project manages callback URLs, validate schemes, ports,
  redirects, DNS resolution, and private/loopback/link-local/metadata addresses,
  including DNS-rebinding considerations.
- Prefer HTTPS as documented by the reviewed guidance; enforce it only when the
  provider or project contract confirms that requirement. Recommend IP
  allowlists or mTLS only when the provider publishes stable support; otherwise
  label them unsupported or project-dependent.
- Minimize raw payload storage. When storage is justified, encrypt it, restrict
  access, set a reviewed retention period, and keep ordinary logs to IDs,
  hashes, states, and redacted diagnostics.

## Required output discipline

When this reference affects a response, separate the result into:

1. **Confirmed provider contract**
2. **Recommended platform policy**
3. **Project decisions required**
4. **CANNOT**

Use placeholders and synthetic data. Never imply that a proposed database,
Redis, queue, KMS, WAF, retry count, TTL, or threshold already exists in the
developer's project.
