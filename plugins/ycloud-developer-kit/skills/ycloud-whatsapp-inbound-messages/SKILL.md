---
name: ycloud-whatsapp-inbound-messages
description: Design, implement locally, or evaluate the two YCloud WhatsApp inbound-message acknowledgement operations for marking a received message as read or showing a typing indicator. Use after verified inbound-message receipt; exclude webhook receiving, message sending, and real API operations.
---

# YCloud WhatsApp Inbound Messages

Design or implement contract-aware acknowledgement of an already received
WhatsApp message. Keep all examples synthetic and every operation side effect
behind a mock transport; never call YCloud, read credentials or customer data,
or claim that a real read receipt or typing indicator was produced.

## Execution boundary

These restrictions govern Skill execution: do not call a YCloud Provider API, access real credentials, or read real business data. The Skill may generate server-side adapter code for an application's runtime, but must not start it or make a live request. Reading public official documentation as contract evidence is allowed and is not a Provider API call or business-data access. A live smoke test is outside the default workflow and requires separate, explicit authorization naming the target/environment, allowed operations, credential boundary, and required result evidence.

Honor an Architect handoff for scope, deliverable, mutation, capability IDs,
project seams, and evidence. Without one, default to focused read-only guidance
unless the user explicitly requests local implementation. Local-write
authorization permits server-side request builders, adapters, handlers, mock
transport bindings, synthetic fixtures, and no-network tests in the scoped
project. It does not authorize a real API call or a browser/mobile integration
that exposes `X-API-Key`.

## Scope and handoffs

After this Skill is selected, read the generated [OpenAPI
contract](references/openapi.md) and reviewed [runtime
behavior](references/runtime.md). If retry, idempotency, error translation, or
production architecture is requested, also read
`references/shared/integration-boundaries.md`. If either generated reference is
missing, stale, or conflicts with the pinned source, report the drift and stop
instead of guessing.

The allowlist is exact:

| Intent | Method and path | operationId |
| --- | --- | --- |
| Mark received message as read | `POST /whatsapp/inboundMessages/{id}/markAsRead` | `whatsapp_inbound_message-mark-as-read` |
| Mark as read and show typing | `POST /whatsapp/inboundMessages/{id}/typing` | `whatsapp_inbound_message-typing` |

The Webhook Receiver owns signature verification, exact raw-body handling,
durable acceptance, deduplication, and parsing of
`whatsapp.inbound_message.received`. This Skill begins only after that boundary.
Consume `event.whatsappInboundMessage.id` or its `wamid`; never substitute the
webhook envelope's `event.id`. Return acknowledgement results to the receiver's
asynchronous business-processing path without changing its already-issued HTTP
response.

Route message composition or sending to `ycloud-whatsapp-messages`, API-key
configuration to `ycloud-api-authentication`, webhook endpoint/receiver work to
`ycloud-webhook-endpoints`, and broad multi-domain work to
`ycloud-integration-architect`. Readiness and repository-maintenance workflows
are outside this Skill.

## Contract-first workflow

1. Confirm the selected operation's source hash, exact method/path,
   `operationId`, path parameter, response schemas, and descriptions in the
   generated references. Do not infer SDK methods from operation IDs.
2. Treat `{id}` as an opaque, case-sensitive path value. The operation accepts
   the YCloud inbound-message ID or the original WhatsApp `wamid`. Preserve the
   value, encode it as one URL-path segment, support contract-compatible future
   formats, and never parse prefixes or impose a local wamid grammar. Neither
   operation has a request body.
3. Preserve the effects exactly. `markAsRead` also marks earlier messages in
   the conversation as read. `typing` does the same and displays a typing
   indicator until a response is sent or 25 seconds elapse. Repeating `typing`
   refreshes the indicator, and the contract defines no idempotency key.
4. Interpret responses without filling gaps. `markAsRead` documents an empty
   `200` and a `404 ErrorResponse`. `typing` documents `200
   WhatsappInboundMessageTypingResponse` with `success: true`, plus
   `400`, `401`, `403`, `404`, `429`, and `500` `ErrorResponse` bodies. Preserve
   unknown properties and status/code values. Do not invent response bodies,
   endpoint errors, or delivery/read guarantees.
5. At the provider adapter, retain the standard error envelope and
   `YCloud-Request-ID` (or `error.requestId`) for redacted correlation. Branch on
   HTTP status and `error.code`, not diagnostic `error.message`. If the project
   translates errors, do so only at its own northbound boundary and label that
   mapping as project policy.
6. On `429`, honor `Retry-After` before another request and parse beta
   `RateLimit-*` headers defensively. Do not invent an inbound-operation quota.
   A typing repeat is a new visible side effect, not a harmless retry; do not
   automatically replay it after a timeout, connection loss, or ambiguous
   response. The source does not establish idempotency or replay safety for
   `markAsRead` either, so do not blindly replay that POST.
7. Use only a fake or mock HTTP transport for implementation evidence. Tests
   may assert a captured synthetic request and fixture response, but must fail
   closed if configured with a real base URL, credential, or network transport.

## Illustrative raw HTTP

These shapes are documentation only; do not execute them:

```http
POST <YCLOUD_API_BASE_URL>/whatsapp/inboundMessages/<SYNTHETIC_INBOUND_MESSAGE_ID>/markAsRead
X-API-Key: <YCLOUD_API_KEY>
```

```http
POST <YCLOUD_API_BASE_URL>/whatsapp/inboundMessages/<SYNTHETIC_WAMID>/typing
X-API-Key: <YCLOUD_API_KEY>
```

Do not put real IDs, keys, phone numbers, payloads, or customer identifiers in
examples, fixtures, URLs, or logs.

## Outcome requirements

Adapt the result to planning, implementation, or evaluation, while making these
items explicit:

1. **Matched contract** — selected operation IDs, methods/paths, source hash,
   path-ID provenance, response shapes, and documented side effects.
2. **Receiver handoff** — verified/durably accepted event precondition and the
   precise `whatsappInboundMessage.id` or `wamid` field used; keep the event ID
   distinct.
3. **Integration placement** — trusted-server adapter, mock transport seam,
   placeholder authentication handoff, and redacted request-ID observability.
4. **Response and rate handling** — exact documented statuses, standard error
   envelope, unknown-value preservation, `Retry-After`, and ambiguous-outcome
   behavior without blind POST replay.
5. **Tests** — no-body request construction, path-segment encoding, opaque and
   case-sensitive ID preservation, inbound ID versus wamid selection, rejection
   of an event ID substituted for a message ID, empty `200` handling for
   `markAsRead`, `success: true` for `typing`, every documented error fixture,
   request-ID mapping, `429` scheduling, timeout ambiguity, repeated-typing
   semantics, and proof that no network call occurs.
6. **CANNOT** — real read/typing operations, credentials or customer data,
   webhook verification/acknowledgement, message sending, inferred SDK methods,
   invented quotas/errors, general idempotency, blind replay, or claims about
   what a user actually saw.
7. **Handoff** — return capability-row status, changed or proposed artifacts,
   tests/results, unknowns, and outgoing Receiver, Authentication, Messages, or
   Architect handoffs. State when no handoff is needed.

## Safety and source priority

Use the pinned OpenAPI source first, generated references second, and this
workflow third. Keep provider contract, reviewed runtime facts, and project
policy visibly separate. External mutations remain prohibited even when local
implementation is authorized.
