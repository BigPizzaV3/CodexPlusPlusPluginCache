---
name: ycloud-webhook-endpoints
description: Design, implement locally, or evaluate YCloud webhook endpoint management and secure receivers from the official signature, retry, acknowledgement, and delivery contract. Use for endpoint CRUD/rotate-secret integration or event receiving; do not use for message sending, readiness, broad integration planning, or real endpoint/API mutations.
---

# YCloud Webhook Endpoints

For endpoint-list work, read
[`references/shared/pagination-contract.md`](references/shared/pagination-contract.md)
with the generated OpenAPI/runtime references.

Design or implement endpoint-management integrations from the pinned OpenAPI
contract and receiver integrations from the reviewed official runtime contract.
Keep those two modes distinct in the result.

## Execution boundary

These restrictions govern Skill execution: do not call a YCloud Provider API, access real credentials, or read real business data. The Skill may generate server-side adapter code for an application's runtime, but must not start it or make a live request. Reading public official documentation as contract evidence is allowed and is not a Provider API call or business-data access. A live smoke test is outside the default workflow and requires separate, explicit authorization naming the target/environment, allowed operations, credential boundary, and required result evidence.

Honor Architect handoffs for `scope`, `deliverable`, `mutation`, capability IDs,
project seams, and expected evidence. Without one, default to focused scope and
read-only guidance unless the user explicitly requests local implementation.
Local-write authorization permits endpoint request builders, adapters, receiver
handlers, inbox/state models, test-console bindings, synthetic fixtures, and
no-network tests inside the scoped project. It never authorizes endpoint create,
update, delete, secret rotation, callback delivery, or any real API call. Reuse
the project's existing UI/interface stack; do not create a dashboard or choose a
framework on your own.

## Trigger boundary

Use this skill for creating, listing, retrieving, updating, deleting, or rotating
the secret of a YCloud webhook endpoint, and for receiver acknowledgement,
signature verification, retry/deduplication handling, or event-delivery design.
Endpoint CRUD comes from `references/openapi.md`; receiver behavior comes from
`references/runtime.md`. Event-type-specific payload fields beyond the documented
common envelope require a selected event reference or remain `CANNOT`. Route message operations to `ycloud-whatsapp-messages`, media upload
to `ycloud-whatsapp-media`, template lifecycle to `ycloud-whatsapp-templates`,
and broad integration design to `ycloud-integration-architect`. Readiness and
Repository-maintenance and issue-tracker prompts do not trigger this skill.

After selection, read `references/openapi.md` and `references/runtime.md`. In
receiver mode, also read `references/shared/webhook-contract.md`,
`references/shared/webhook-event-types.txt`, and
`references/shared/webhook-signature-vectors.tsv`. For
`whatsapp.message.updated`, also execute
`references/shared/webhook-message-lifecycle-fixtures.json`. For receiver reliability,
error translation, replay, secret rotation, or callback-URL security, also read
`references/shared/integration-boundaries.md`. The OpenAPI reference mechanically lists the
six allowlisted endpoint-management operations: create, list, retrieve, update,
delete, and rotate-secret. Use the exact source-derived paths, methods,
operationIds, parameters, request/response schemas, and descriptions. Never
invent endpoint paths, event payload fields, retry behavior beyond the published
schedule, delivery semantics, or rotation choreography. The runtime reference
does confirm `YCloud-Signature`, HMAC-SHA256 over `<timestamp>.<raw-body>`, a
fast `2xx`, and seven retry intervals; do not put those facts in `CANNOT`. If
the reference is missing or its source hash/coverage drifts, report the drift
and stop.
Interpret `allOf` as schema composition and `x-*` extensions or generated model
names as codegen hints, not endpoint runtime behavior.

For explicitly requested sandbox/mock/no-real-side-effect receiver testing,
also read `references/shared/sandbox-contract.md`. Its local event producer and
`/_mock/*` transitions are synthetic test controls, not endpoint-management
operations or YCloud delivery guarantees.

## Workflow

1. Identify the intended endpoint operation and inspect only explicitly scoped,
   non-secret project files for runtime and deployment facts. Ask for missing
   facts; do not assume a framework, SDK, endpoint URL, environment, or secret
   store.
2. Match one of the six operations in the generated reference. Preserve exact
   path parameters, request/response schemas, and description-only constraints.
   Treat `operationId` as a contract identifier, never as an SDK method name.
3. Generate a raw HTTP or contract-aware typed example, or implement local
   request/receiver seams when authorized, with placeholders such as
   `<YCLOUD_API_KEY>`, `<ENDPOINT_ID>`, `<CALLBACK_URL>`, and synthetic values.
   Give SDK-specific code only when the user provides a confirmed artifact,
   version, and documentation. Do not make a live request or change a project.
4. Keep API keys and endpoint secrets server-side and out of browsers, mobile
   clients, URLs, logs, source control, and generated snippets. Never read,
   print, validate, or rotate a real credential.
5. In receiver mode, preserve the raw body bytes, require the exact lowercase
   `t=<unix-seconds>,s=<64-hex>` shape, and compute HMAC-SHA256 over ASCII
   timestamp, one period byte, and the unchanged body bytes. Add no trailing delimiter.
   Compare digest bytes in constant time against every
   explicitly configured candidate secret, and apply the configurable
   Developer Kit 300-second bidirectional tolerance before JSON processing.
   Resolve tenant identity from a trusted endpoint mapping, not an untrusted
   payload.
   Treat `X-Webhook-Endpoint-ID` as correlation metadata that must match the
   trusted route/configuration mapping. Never let that caller-controlled header
   select a tenant, secret, or inbox partition by itself.
   Do not parse or classify the event before successful verification. An invalid
   signature is rejected transport evidence, not a duplicate/conflict event.
   Persist a scoped inbox identity such as
   `(provider, webhook_endpoint_id, event_id)` and payload hash. Return `2xx`
   quickly (within 6 seconds is recommended) only after durable acceptance,
   then enqueue work. Label the 300-second tolerance, transport replay claim,
   and 24-hour event-inbox retention as recommended policy, not YCloud
   guarantees.
   Preserve `X-Webhook-Endpoint-ID` for routing/correlation without logging
   secrets.
6. In endpoint-design mode, require a publicly reachable URL, reject private or
   internal IPs, prefer HTTPS, and account for the documented limit of 20
   endpoints per account. List operations use 1-based page-number pagination
   with `page` and `limit` 1..100 and optional `includeTotal`. Parse the response
   as the merged Page envelope: required `offset`, `limit`, `length`, endpoint
   `items`, and optional `total`; do not send `offset` as a query parameter or
   unwrap a nonexistent `data` field.
7. Apply the recommended durable-acceptance response boundary: invalid
   signature returns `401` without enqueue; invalid common envelope before
   persistence returns `400`; a same-hash duplicate or durably recorded unknown
   event returns `2xx`; an inbox persistence failure returns `503`; business
   failure after the earlier `2xx` uses internal retry/DLQ. For a scoped event-ID
   collision with a different hash, quarantine and alert, and acknowledge only
   after the conflict is durably recorded. Label this matrix as platform policy,
   not a YCloud response schema.
   Never deduplicate by event type, `whatsappMessage.id`, status, `wamid`, or
   payload hash alone. Keep `inboxClassification` separate from message
   `projectionOutcome`: different event IDs for one message are new events even
   when a projection is unchanged or out of order. Ignore the Sandbox
   classification header and compute classification from verified bytes.
8. Explain response handling only from the references. Separate endpoint
   registration state from payload receipt and message delivery. If the user
   wants to send a message after endpoint setup, hand off to
   `ycloud-whatsapp-messages`.
9. Use the shared TSV vectors when generating or testing Java, Node, Go, or PHP
   verification code. The wrong-secret, stale/future timestamp, tampered body,
   JSON-reserialized body, trailing-delimiter, and malformed-header rows must
   fail. Do not create replacement vector values inside the response.
10. Provide synthetic tests for request validation, public-URL checks, endpoint
   count/pagination boundaries, endpoint identity mapping,
   raw-body signature verification, invalid/missing/stale signatures, same-event
   duplicate/conflict, distinct status events for one message, repeated status
   with a distinct event ID, out-of-order observations, unfamiliar event types,
   fast acknowledgement, duplicate/conflict events causing no projection side
   effects, invalid signatures creating no business-inbox row, trusted-route/header
   endpoint mismatch rejection, temporary URL suspension/automatic resume observability, response handling,
   and the chosen handoff. Do not call YCloud or deliver callbacks.

## High-risk delete and secret rotation

Treat delete and rotate-secret as high-risk external side effects. Stop before
execution, identify the target and impact, request explicit confirmation in a
future approved workflow, and state rollback or cutover considerations only when
confirmed by the contract or project facts. Receiver code may support an
explicit candidate-secret list, but do not claim that a provider dual-secret
window, old-secret validity period, atomic rotation, or recovery path exists.
The Skill never deletes endpoints, rotates secrets, or performs any other API
mutation.

SSRF controls belong to endpoint registration, not the receiver. For a project
that accepts callback URLs, propose scheme/port/redirect/DNS validation and
reject private, loopback, link-local, and metadata addresses, including DNS
rebinding checks. Treat IP allowlists and mTLS as project-dependent unless the
provider publishes stable support. Minimize raw payload retention; if required,
encrypt it, restrict access, and use a reviewed retention period.

## Outcome requirements

Adapt the result to planning, implementation, or evaluation. Preserve these
contract and evidence outcomes:

1. **Matched contract** — source hash, selected operation, exact path/method,
   parameters, request/response schemas, and confirmed constraints.
2. **Endpoint management plan** — placeholder raw HTTP or project-local
   construction and the selected create/list/retrieve/update/delete/rotate branch.
3. **Safety and boundary** — server-side credential placement, high-risk stop,
   and explicit separation of endpoint management from receiver processing.
4. **Tests** — synthetic contract and negative tests with no live endpoint/API.
5. **CANNOT** — event-type fields not covered by a selected payload reference,
   provider-fixed timestamp tolerance, provider retention, rotation
   overlap/rollback,
   unconfirmed SDK methods, missing project facts, unsupported operations, and
   actions not run. Do not list the confirmed HMAC/retry/acknowledgement rules.
6. **Handoff** — route message sending to `ycloud-whatsapp-messages`; return to
   Architect with selected operation and `crosscutting:webhook-receiver` row
   statuses, changed or proposed artifacts, tests/results, endpoint-to-receiver
   boundary, unknowns, and outgoing handoffs. Select an event-specific payload
   reference before mapping domain fields.

## Non-goals

This Skill does not send messages, upload media, manage templates, read real
credentials, call YCloud, deliver a callback, or mutate production configuration.
Receiver and endpoint client code may be implemented locally only when requested,
must use synthetic/no-network tests, and must state that no external operation
was performed.
