---
name: ycloud-whatsapp-flows
description: Design, implement locally, or evaluate all 9 YCloud WhatsApp Flows operations across draft creation, retrieval, metadata or structure updates, publishing, preview, deprecation, and deletion. Use for Flow lifecycle management; exclude Flow message sending and real API mutations.
---

# YCloud WhatsApp Flows

Design or implement contract-aware WhatsApp Flow lifecycle management against
mocks only. Never call YCloud, mutate a real Flow, open a live preview URL, read
credentials or customer data, or imply that managing a Flow sent a message.

## Execution and authority boundary

These restrictions govern Skill execution: do not call a YCloud Provider API, access real credentials, or read real business data. The Skill may generate server-side adapter code for an application's runtime, but must not start it or make a live request. Reading public official documentation as contract evidence is allowed and is not a Provider API call or business-data access. A live smoke test is outside the default workflow and requires separate, explicit authorization naming the target/environment, allowed operations, credential boundary, and required result evidence.

Honor an Architect handoff for `scope`, `deliverable`, `mutation`, capability
IDs, project seams, and evidence. Without one, default to focused, read-only
guidance unless the user explicitly requests local implementation. Local-write
authorization permits request models/builders, multipart adapters, handlers,
handler/service bindings, mocks, fixtures, and no-network tests inside the scoped
project. Every create, update, publish, deprecate, delete, or preview-link
invalidation remains mock-only; no authorization level in this Skill permits a
real API call.

Keep claims in three authority layers:

1. **Provider contract** — [references/openapi.md](references/openapi.md) and
   [references/runtime.md](references/runtime.md). State these as YCloud behavior.
2. **Developer Kit policy** — `references/shared/integration-boundaries.md` when
   retry, idempotency, queueing, error translation, or webhook reliability is in
   scope. Label its recommendations as local policy.
3. **Project decisions** — only facts confirmed in the user's scoped project.

Do not promote an `operationId`, generated model name, `x-*` extension, example,
platform recommendation, or project convention into provider behavior. If the
generated references are absent, stale, internally inconsistent, or do not list
all 9 operations below, stop and report the drift.

## Exact operation allowlist

Load both generated references after this Skill is selected. Match only these
operations and preserve every source-defined path/query parameter,
request/response schema, content type, status code, and description constraint.
For Flow list response adaptation, also read
[`references/shared/pagination-contract.md`](references/shared/pagination-contract.md).

| Intent | Method and path | operationId |
| --- | --- | --- |
| Create Flow | `POST /whatsapp/flows` | `whatsapp_flow-create` |
| List Flows | `GET /whatsapp/flows` | `whatsapp_flow-list` |
| Retrieve Flow | `GET /whatsapp/flows/{flowId}` | `whatsapp_flow-retrieve` |
| Update structure | `PATCH /whatsapp/flows/{flowId}/assets` | `whatsapp_flow-update-structure` |
| Update metadata | `PATCH /whatsapp/flows/{flowId}/metadata` | `whatsapp_flow-update-metadata` |
| Publish Flow | `POST /whatsapp/flows/{flowId}/publish` | `whatsapp_flow-publish` |
| Generate preview URL | `GET /whatsapp/flows/{flowId}/preview` | `whatsapp_flow-preview` |
| Deprecate Flow | `POST /whatsapp/flows/{flowId}/deprecate` | `whatsapp_flow-deprecate` |
| Delete Flow | `DELETE /whatsapp/flows/{flowId}` | `whatsapp_flow-delete` |

Flow interactive message composition and sending belong to
`ycloud-whatsapp-messages`, even when the Flow already exists. This Skill owns
only management of the Flow resource and its preview URL.

## Contract-first workflow

1. Confirm the selected operation and server-side project seam. Treat `flowId`,
   `cloneFlowId`, WABA IDs, request IDs, and later message IDs as opaque,
   case-sensitive strings; never parse example prefixes or formats. Preserve
   unknown response properties and enum/status values rather than failing
   exhaustive decoding or coercing them into a known lifecycle state.
   `whatsapp_flow-list` returns `{items: [...]}` without the common Page envelope;
   do not invent `page`, `offset`, `total`, `cursor`, or `data` fields.
2. Preserve create semantics: `wabaId`, `name`, and `categories` are required;
   a new Flow defaults to `DRAFT`. `flowJson` and `publish=true` can create it
   directly as `PUBLISHED`; `cloneFlowId` requires permission to the source Flow.
   Do not infer clone ownership, copy completeness, validation, or publish
   success beyond the returned contract.
3. Send structure updates as `multipart/form-data` with the required binary
   `flowJson` file field. Do not silently send JSON text under
   `application/json`. Preserve structured `validationErrors` on create and
   structure-update HTTP `400` responses, including unknown error codes and
   source locations. Metadata updates use JSON and only the source fields
   `name`, `categories`, and `endpointUri`.
4. Keep lifecycle gates exact: the status schema says `DRAFT` can be modified,
   `PUBLISHED` cannot be modified, and `DEPRECATED` cannot be used; delete says
   only `DRAFT` may be deleted; deprecate applies to a published Flow and states
   that published Flows cannot be modified or deleted. Do not mutate when status
   is absent or unknown.
5. Preserve the source conflict: the publish operation description also says a
   Flow can later be edited and returned to `DRAFT`, while the status and
   deprecate descriptions say a published Flow cannot be modified. These are
   equal-authority pinned OpenAPI statements. Report the contradiction and put
   post-publish editing/return-to-draft behavior in `CANNOT`; do not choose a
   rule, synthesize an endpoint, or weaken a lifecycle gate.
6. Preview generation returns a public, shareable URL. The reference says it
   expires after 30 days by default and `invalidate=true` generates a new link.
   Treat the URL as sensitive project output: do not open, crawl, log, commit,
   or expose a real URL. A GET with `invalidate=true` changes link state, so it
   remains a mock-only mutation despite its HTTP method.
7. Use placeholders and synthetic Flow JSON/data in examples and tests. Use an
   SDK method only when a confirmed SDK artifact and version exist in the
   project; operation IDs are not SDK methods. Keep `X-API-Key` injection on a
   trusted server through the Authentication handoff without reading a real key.
8. Treat mutating timeouts or lost responses as ambiguous outcomes. Never
   blindly replay create, structure/metadata update, publish, deprecate, delete,
   or preview invalidation. Any idempotency ledger, outbox, retry budget,
   reconciliation job, rollback artifact, or version history is project
   architecture unless the generated runtime reference confirms it.

## Lifecycle and message boundary

An HTTP `200`/`success=true` applies only to the selected Flow management
operation. It is not proof that a Flow message was submitted, accepted,
delivered, opened, completed, or reached any other user state. Publication makes
the management operation successful under the returned contract; sending and
tracking an interactive message remains a separate Messages workflow.

When a user wants to send a Flow, hand `ycloud-whatsapp-messages` the opaque Flow
ID, confirmed current status, and only the message-composition fields supported
by its generated contract. Preserve `DEPRECATED` as unusable and do not infer
message eligibility when status is unknown or when the lifecycle conflict above
matters. Messages owns request construction, message acceptance, YCloud message
ID correlation, retrieve/status handling, and accepted-versus-final semantics.

## Mutation safeguards and tests

Publish, deprecate, delete, clone, replacement of Flow JSON, endpoint URI
changes, and preview invalidation can be disruptive or irreversible. Implement
only local mock behavior and no-network tests. For any future external workflow,
stop before the call, identify the exact opaque Flow/WABA IDs and impact, require
explicit operation-specific confirmation, and treat an ambiguous result as
unresolved. Never claim rollback is available unless the provider contract or
project proves it.

Tests should cover every selected route and schema plus relevant negative cases:
required create fields, draft and create-and-publish branches, clone permission
as an external precondition, category/status unknown handling, exact multipart
encoding, validation-error preservation, metadata field mapping, each lifecycle
gate, the post-publish contradiction stop, draft-only delete, preview expiry and
invalidation behavior, public-URL redaction, provider error/request-ID mapping,
ambiguous mutation outcomes, and the Flow-to-Messages boundary.

## Outcome requirements

Return the matched operation IDs and exact method/paths, authority-labeled
contract facts, lifecycle preconditions/conflicts, project-local artifacts or
proposed seams, no-network test evidence, and explicit unknowns. Do not claim an
operation implemented because only a route label, button, sample JSON, or mock
response exists; link each implemented row to its adapter/handler and behavioral
tests.

### CANNOT

List unsupported operations, missing project facts, the unresolved published
Flow editing contradiction, unconfirmed SDK behavior, live preview URLs,
credentials/customer data, real API calls, external mutations, blind replay,
invented rollback, and message delivery/completion claims. Do not put confirmed
draft creation, draft-only deletion, deprecation, preview expiry/invalidation,
or validation-error behavior into `CANNOT`.

### Handoff

Send Flow message composition, submission, retrieval, and status tracking to
`ycloud-whatsapp-messages` with Flow ID, status evidence, and message IDs kept as
separate opaque values. Send authentication storage to
`ycloud-api-authentication` and webhook endpoint/receiver work to
`ycloud-webhook-endpoints`. Return to Architect with capability-row status,
changed or proposed artifacts, tests/results, lifecycle evidence and conflicts,
unknowns, and outgoing handoffs.
