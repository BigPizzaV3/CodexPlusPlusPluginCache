---
name: ycloud-whatsapp-messages
description: Design, implement locally, or evaluate contract-aware WhatsApp message submission and retrieval for direct, queued, or existing-template sends, including conditional request semantics and accepted-versus-final status handling. Use for message send/retrieve intent; exclude template lifecycle, media upload, webhook endpoint management, authentication-only, readiness, and repository maintenance.
---

# YCloud WhatsApp Messages

Design or implement project-local support for the three message operations in the generated reference. Never call YCloud, send a real message, read credentials or customer data, or claim that a submission was delivered.

## Execution boundary

These restrictions govern Skill execution: do not call a YCloud Provider API, access real credentials, or read real business data. The Skill may generate server-side adapter code for an application's runtime, but must not start it or make a live request. Reading public official documentation as contract evidence is allowed and is not a Provider API call or business-data access. A live smoke test is outside the default workflow and requires separate, explicit authorization naming the target/environment, allowed operations, credential boundary, and required result evidence.

Honor Architect handoffs for `scope`, `deliverable`, `mutation`, capability IDs,
project seams, and expected evidence. Without one, default to focused scope and
read-only guidance unless the user explicitly requests local implementation.
Local-write authorization permits request builders, adapters, handlers,
test-console bindings, mocks, and no-network tests inside the scoped project. It
never authorizes a real send or retrieve call. A `test-console` must expose the
selected conditional message shapes and must reuse the project's existing UI or
interface stack; do not create a dashboard or choose a framework on your own.

## Scope and operation routing

Load `references/openapi.md` and `references/runtime.md` only after this Skill is selected. If the request includes retry, idempotency, outbox/queue, circuit breaking, or error translation, also read `references/shared/integration-boundaries.md`. The allowlist is exact:

| Intent | Method and path | operationId |
| --- | --- | --- |
| Direct submission | `POST /whatsapp/messages/sendDirectly` | `whatsapp_message-send-directly` |
| Queued submission | `POST /whatsapp/messages` | `whatsapp_message-send` |
| Retrieve by message ID | `GET /whatsapp/messages/{id}` | `whatsapp_message-retrieve` |

Sending an already-created template message belongs here. Creating, editing, listing, retrieving, deleting, or analysing a template belongs to `ycloud-whatsapp-templates`. Uploading media belongs to `ycloud-whatsapp-media`; receive its confirmed media reference before constructing a media message. API-key-only questions belong to `ycloud-api-authentication`; broad/multi-domain planning belongs to `ycloud-integration-architect`. Readiness, repository-maintenance, and issue-tracker workflows are out of scope.

## Contract-first workflow

For an explicitly requested local sandbox/mock path, also read
`references/shared/sandbox-contract.md`. Use its fixed synthetic key, sender,
recipient, base URL, scenarios and lifecycle controls only in tests. Never expose
`X-YCloud-Mock-*` or `/_mock/*` as provider contract, and never let a mock
`accepted` result satisfy final delivery evidence.

1. Confirm the selected operation’s exact path, method, parameters, request schema, response schema, and descriptions in the generated reference. If the source/reference hash or operation list drifts, stop and report it.
2. For direct versus queued requests, preserve endpoint-specific fields and semantics from the reference. Do not substitute one endpoint for the other or imply that a queue is a delivery guarantee.
   For queued template messages, preserve the reference’s confirmed rule that the referenced template must be `APPROVED`; an `ARCHIVED` template cannot be sent. Do not generalize this into an unconfirmed template lifecycle policy.
3. Treat `WhatsappMessageSendRequest` as a flat codegen shape: it has `type` plus optional payload fields, not an automatic `oneOf`/discriminator. Apply the description’s type-dependent rules and include only fields valid for the selected `type`; do not treat every optional field as simultaneously valid.
   The request requires `from` and `type`; payload members such as `audio`, `contacts`, `document`, `image`, `interactive`, `location`, `reaction`, `sticker`, `template`, `text`, or `video` are required only for their matching type.
   For an existing-template send, never reuse the template create/edit definition: static component `text` and the definition's `buttons` array belong to the Templates workflow. Generate parameter-override components using the canonical lowercase spellings: `header`, `body`, `button`, `limited_time_offer`, `carousel`, or `order_status`. Preserve case-insensitive compatibility for component types, button subtypes, and parameter types; capitalization alone is not a reason to reject the send model. Each button is a separate `button` component with `sub_type`, zero-based `index`, and `parameters`; do not resend static header, body, or footer text. For carousel template sends, use one `carousel` component with `cards`, each containing a zero-based `card_index` and `header`, `body`, or `button` parameter overrides. A send may supply overrides for one card; do not apply the create/edit definition's two-card minimum to this array. Read the generated reference before constructing any component; the exact required parameters depend on the approved template.
4. The source requires exactly one of `to` or `recipient`; when both are provided, `to` takes precedence and `recipient` is ignored. Preserve this rule as an implementation invariant: when `to` exists, resolve and validate `to` before touching `recipient`; do not read, normalize, parse, or validate the ignored `recipient`, and do not fall back to it when `to` is invalid. A valid `to` plus an empty, malformed, or wrong-typed `recipient` must produce the same request as `to` alone, with `recipient` omitted. Keep endpoint-specific constraints too: `filterBlocked` and `filterUnsubscribed` apply only to queued `POST /whatsapp/messages`, while `ttlSeconds` and `useDirectSend` follow the direct-send descriptions. If the reference does not settle an edge case, put it in `CANNOT` rather than inventing precedence.
5. Explain the state boundary: request submission/enqueue and an HTTP `accepted` response are not the same as final asynchronous state or `delivered`. Use `runtime.md` for synchronous versus asynchronous errors, documented message quotas, `Retry-After`, and duplicate/out-of-order status events. Do not invent delivery guarantees or unlisted callback behavior.
6. On `429`, schedule later traffic after the documented `Retry-After` delay; the Errors page also recommends exponential backoff for `TOO_MANY_REQUESTS`. Treat any additional jitter policy as a project decision, not a YCloud contract. Retry only when the failure is transient and replay is safe; treat timeouts and lost responses as ambiguous outcomes. Never blindly replay a send POST: the public docs do not define a general idempotency key or exactly-once send guarantee. A project-owned `Idempotency-Key`, command/outbox identity, retry budget, or DLQ must be labeled as local architecture and must not be forwarded or attributed to YCloud without evidence. Do not infer Java/TypeScript/Python/Go/PHP SDK method names from operation IDs; use raw HTTP or confirmed project SDK artifacts only.
7. Apply the documented WhatsApp service-window rule: free-form messages require the 24-hour customer-service window; outside it, use an approved template. Track final state through retrieve-by-ID or `whatsapp.message.updated`, keep `externalId` as an application correlation value, and retain the YCloud message ID separately. Preserve unknown response properties/status values rather than failing exhaustive decoding.

## Illustrative raw HTTP

Examples are synthetic and explanatory only. Use the exact schema fields from the generated reference for the selected message `type`; the ellipsis is a reminder not to send an unreviewed payload.

```http
POST <YCLOUD_API_BASE_URL>/whatsapp/messages/sendDirectly
X-API-Key: <YCLOUD_API_KEY>
Content-Type: application/json

{"type":"<CONFIRMED_TYPE>","to":"<SYNTHETIC_RECIPIENT>","<TYPE_SPECIFIC_FIELD>":"<SYNTHETIC_VALUE>"}
```

```http
GET <YCLOUD_API_BASE_URL>/whatsapp/messages/<SYNTHETIC_MESSAGE_ID>
X-API-Key: <YCLOUD_API_KEY>
```

Do not execute these snippets. Do not put real keys, phone numbers, message bodies, or customer identifiers in examples or logs.

## Outcome requirements

Adapt the result to planning, implementation, or evaluation. Preserve the
following contract and evidence outcomes:

### Operation and Contract

Name exactly one or more allowlisted operation IDs, method/path, request/response schemas, and relevant description-only constraints. State whether the request is direct, queued, or retrieve.

### Request Construction

Show a placeholder-based raw HTTP or project-local typed example. Apply `type`-dependent flattened-field rules, `to`/`recipient` semantics, endpoint-specific fields, and the Authentication handoff without guessing.

### Response Semantics

Separate synchronous/direct submission, queued submission, HTTP accepted, and final asynchronous state. Direct failures may carry `error.whatsappApiError`; queued failures can arrive through `whatsapp.message.updated`. Status events may be duplicated or out of order; never equate accepted with delivered or assume a monotonic state sequence.
The generated reference confirms `200` accepted responses for both send operations and `200`/`404` responses for retrieve; preserve the `WhatsappMessage`/`ErrorResponse` schemas without inventing additional codes.

### Integration and Tests

Place the request in the confirmed server module and cover schema validation, each selected type branch, direct/queued routing, 24-hour-window/template routing, provider-envelope/request-ID mapping, `429` scheduling without blind replay, timeout ambiguity, transient-and-replay-safe classification, project idempotency versus YCloud contract, duplicate/out-of-order/unknown status events, `externalId` versus YCloud-ID correlation, synthetic retrieve IDs, accepted-versus-final state handling, and no-network tests.

For every selected send operation, `to`/`recipient` tests are mandatory. Cover: neither field rejects; valid `recipient` alone succeeds; valid `to` alone succeeds; both valid select `to` and omit `recipient`; valid `to` plus empty, malformed, or wrong-typed `recipient` still succeeds exactly as `to` alone; invalid `to` plus valid `recipient` rejects instead of falling back. Do not report implementation or tests complete without these executable assertions.

### CANNOT

List unsupported operations and unknowns: real API/message calls, actual customer data or credentials, template lifecycle, media upload, blind POST replay, delivery claims, guessed SDK methods/artifacts, general idempotency/exactly-once behavior, unlisted operation errors, or final-state guarantees. Do not put documented quotas, `429`, `Retry-After`, the standard error envelope, or asynchronous error routing into `CANNOT`. External mutations remain gated independently from local writes and are never executed by this workflow.

### Handoff

Send template create/edit/list/retrieve/delete/analytics to Templates. Send media upload to Media and consume only its confirmed media reference before a message request. Send authentication storage to Authentication. Return to Architect with capability-row status, changed or proposed artifacts, tests/results, accepted-versus-final evidence, unknowns, and outgoing Media/Template/Webhook handoffs. If the user asks for delivery/event consumption, require a reliable source or mark `CANNOT`.

## Safety and source priority

Use the exact OpenAPI path/schema first, generated reference second, and this workflow third. Keep `operationId` and codegen extensions as identifiers/hints, not SDK methods or business rules. Use placeholders (`<YCLOUD_API_KEY>`, `<YCLOUD_API_BASE_URL>`) and synthetic identifiers only. Shell and local project writes are permitted only when needed for an explicitly requested local implementation; network API, credential, customer-data, and external side effects remain prohibited.
