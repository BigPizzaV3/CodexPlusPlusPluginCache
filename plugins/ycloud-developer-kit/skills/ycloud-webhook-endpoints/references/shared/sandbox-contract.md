# Local YCloud Sandbox Facade contract

## Authority and scope

This is Developer Kit **mock infrastructure**, not YCloud provider behavior, an official Sandbox, a credential issuer, or a production SLA. Load this reference only when the user asks for sandbox/mock/no-real-side-effect testing, local reference-project validation, or an explicit YCloud base-URL replacement.

The source distribution provides `ycloud-sandbox-server/` with contract version `v1`. Its `sandbox-full-first-wave-v1` evidence profile covers exactly 17 provider-shaped operations plus two crosscutting capabilities, for 19 explicit rows:

- `crosscutting:api-authentication` with fixed synthetic `X-API-Key`;
- `whatsapp_message-send-directly` at `POST /whatsapp/messages/sendDirectly`;
- `whatsapp_message-send` at `POST /whatsapp/messages`;
- `whatsapp_message-retrieve` at `GET /whatsapp/messages/{id}`;
- `whatsapp_media-upload` at `POST /whatsapp/media/{phoneNumber}/upload`;
- all seven first-wave WhatsApp Templates operations: create, list, retrieve by name/language, edit, both delete shapes and Analytics;
- all six Webhook Endpoint operations: create, list, retrieve, update, delete and rotate Secret;
- `crosscutting:webhook-receiver`, including raw-body HMAC-SHA256 verification and mock event production using `YCloud-Signature`.

The executable coverage matrix is `ycloud-sandbox-server/contracts/v1/coverage-matrix.json`. Media IDs, current template lifecycle state, message final-state evidence and Endpoint identity/Secret are linked through explicit producer-consumer fixtures. Template creation remains `PENDING`; it is not usable for sending until separate lifecycle evidence marks that fixture `APPROVED`. Endpoint configuration accepts only the exact checked-in event catalog, while the Receiver still preserves unknown incoming event types for forward compatibility.

This profile does not increase OpenAPI operation coverage and must not be counted as provider implementation. Operations outside the 17-row first wave remain unsupported unless a later versioned sandbox contract explicitly adds them.

## Use boundary

- Require explicit project injection of `YCLOUD_BASE_URL=http://127.0.0.1:18081` or an equivalent HTTP transport/base-URL option. Fail closed when no local URL is configured.
- Never rewrite DNS, `/etc/hosts`, TLS certificates, system proxies, or the production YCloud host.
- Use only `ycloud_synthetic_test_key_v1`, synthetic identifiers, synthetic messages and the checked-in fixtures. Never inspect or pass through a real key or customer data.
- The Facade has no provider fallback. Public/DNS/metadata/link-local/credential-bearing targets, redirects, and environment proxies are rejected. Container/private-literal traffic is explicit opt-in.
- Optional `--meta-mock-base-url` composes the YCloud northbound Facade with the repository's Meta Mock southbound layer over loopback/private-literal networking. Applications depend only on the YCloud-compatible northbound contract.

## Provider-compatible and mock-only surfaces

Provider-shaped request/response facts still come from the selected domain `openapi.md` and `runtime.md`: `X-API-Key`, exact message paths and schemas, `YCloud-Request-ID`, standard error envelope, documented rate-limit headers, opaque IDs, accepted-versus-final status and `YCloud-Signature`.

The following are mock-only and must never be attributed to YCloud:

- `/_mock/*` control routes;
- `X-YCloud-Mock-*` headers;
- scenario names and synthetic control tokens;
- deterministic timestamps/IDs, in-memory retention and transition triggers;
- fixture classification values such as `duplicate`, `conflict`, or `unsupported`.

Mock classification headers are oracle diagnostics only. A generated receiver
must ignore `X-YCloud-Mock-Event-Classification` for acceptance and business
processing, verify the signature first, and compute its own scoped event-ID/hash
classification.

## Lifecycle and failure evidence

- Queued send returns `accepted`; it never returns a fabricated final `delivered` result.
- Final `sent`, `delivered`, `read`, or `failed` evidence appears only after an explicit mock-only transition and is then observable through retrieve and/or a signed event.
- Timeout, connection loss, 5xx or response loss remains an ambiguous mutation outcome with automatic retry disabled. `Retry-After` does not grant replay safety.
- Unknown status/error/event values preserve the original value and fail closed.
- Duplicate same-hash events are observable without duplicate business effect; same event ID with a different hash is a conflict fixture; out-of-order and unknown dotted events remain visible.
- Different event IDs for the same message remain distinct `new` events even
  when the status is equal; message projection `no_change` is not event
  `duplicate`. Invalid signatures never enter the business inbox.

## Evidence

The source distribution's `ycloud-sandbox-server/contracts/v1/provenance.json` binds the fixtures to Plugin `0.7.8`, OpenAPI SHA-256 `8592bd4cc37186655a480dd86ce6bac6731543727327a2871d9103a0b8ed9e81`, failure contract v1, Webhook contract and vectors. Python repository tests plus Node/Java fixture consumers are the executable evidence. A passing mock test is not evidence that a real API call, message delivery, endpoint change, or production deployment occurred.
