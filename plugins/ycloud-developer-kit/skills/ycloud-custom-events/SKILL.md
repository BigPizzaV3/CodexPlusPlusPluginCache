---
name: ycloud-custom-events
description: Design, implement locally, or evaluate YCloud custom-event definition/property lifecycle and CONTACT-associated event ingestion. Use for the seven allowlisted Custom Events operations; exclude Contact lifecycle, webhook consumption, analytics, and real API mutations.
---

# YCloud Custom Events

Design or implement contract-aware custom-event schema management and event
ingestion with synthetic data and a mock transport only. Never call YCloud,
read credentials or customer data, mutate a real definition, or send a real
event.

## Execution boundary

These restrictions govern Skill execution: do not call a YCloud Provider API, access real credentials, or read real business data. The Skill may generate server-side adapter code for an application's runtime, but must not start it or make a live request. Reading public official documentation as contract evidence is allowed and is not a Provider API call or business-data access. A live smoke test is outside the default workflow and requires separate, explicit authorization naming the target/environment, allowed operations, credential boundary, and required result evidence.

Honor an Architect handoff for scope, deliverable, mutation, capability IDs,
project seams, Contact artifacts, and expected evidence. Without one, default
to focused read-only guidance unless the user explicitly requests local
implementation. Local-write authorization permits server-side request models,
builders, adapters, handlers, fixtures, and no-network tests in the scoped
project. It never authorizes an external create, update, delete, retrieve, or
send request. Use placeholders and synthetic identifiers throughout.

After this Skill is selected, read the pinned [OpenAPI
contract](references/openapi.md) and reviewed [runtime
boundaries](references/runtime.md). If retry, idempotency, outbox/queue, rate
limiting, or error translation is requested, also read
`references/shared/integration-boundaries.md`. If the source hash, operation
coverage, or contract facts drift, stop and report the mismatch instead of
guessing.

## Exact scope and routing

Definition and property lifecycle is separate from occurrence ingestion:

| Concern | Method and path | operationId |
| --- | --- | --- |
| Create definition | `POST /event/definitions` | `custom_events-create-definition` |
| Retrieve definition | `GET /event/definitions/{name}` | `custom_events-retrieve-definition` |
| Update definition metadata | `PATCH /event/definitions/{name}` | `custom_events-update-definition` |
| Create property definition | `POST /event/definitions/{name}/properties` | `custom_events-create-property-definition` |
| Delete property definition | `DELETE /event/definitions/{name}/properties/{propertyName}` | `custom_events_delete-property-definition` |
| Update property metadata | `PATCH /event/definitions/{name}/properties/{propertyName}` | `custom_events_update-property-definition` |
| Ingest event occurrence | `POST /event/events` | `custom_events-send-event` |

The first six operations manage reusable definitions; they do not ingest an
event. The final operation submits one occurrence; it does not create or alter
its definition. Contact create/retrieve/update/delete and identity resolution
belong to the Contact workflow. Webhook consumption, analytics, readiness, and
broad multi-domain planning are outside this Skill.

## Contract-first workflow

1. Match only the selected operations above to their exact method, path,
   parameters, request schema, responses, and descriptions in `openapi.md`.
   Treat `operationId` as an identifier, not an SDK method. Use raw HTTP shapes
   or an SDK artifact/version already confirmed in the project.
2. For definition creation, preserve required `name`, `label`, and `objectType`;
   the pinned enum contains only `CONTACT`. Preserve the exact source patterns
   and lengths without “correcting” or anchoring them. Definition update changes
   only `label` and/or `description` in the declared request shape.
3. For property creation, preserve required `name`, `label`, and `type`, and the
   declared types `STRING`, `NUMBER`, `TIMESTAMP`, and `URL`. Property update
   changes only `label` and/or `description`; changing a property's name or type
   is not an allowlisted update behavior. Treat delete as high risk: identify
   the exact definition/property pair and stop before any external execution.
4. Before ingestion, require an already-defined `eventName` and validate event
   property names and values against the confirmed definition. The source says
   NUMBER accepts numeric values with up to one decimal, TIMESTAMP accepts epoch
   milliseconds, and URL accepts strings beginning with `http://` or `https://`.
   Do not infer coercion, undeclared-property handling, schema evolution, or
   server-side validation behavior beyond the pinned descriptions.
5. Consume a Contact handoff artifact rather than looking up or changing a
   contact. Accept either a confirmed opaque contact ID for `objectId` or a
   confirmed contact phone number for `contactPhoneNumber`, together with its
   provenance. Choose one association form as project policy; the OpenAPI says
   the phone number is an alternative but does not define precedence when both
   fields are present. If the handoff is missing or supplies both without an
   explicit project decision, stop instead of resolving identity here.
6. Keep `occurTime` as RFC 3339 when supplied. The source says the current time
   is used when omitted, but does not define whose clock, timezone normalization,
   or replay semantics. Preserve omission intentionally and test supplied and
   omitted branches with a fake clock where project code needs deterministic
   behavior.
7. Treat a documented HTTP `200` as synchronous acceptance/success for the
   selected endpoint only. For event ingestion, the source declares no response
   body, event ID, processing state, callback, query operation, ordering rule,
   or downstream-completion guarantee. Never label an accepted occurrence as
   processed, delivered, or completed.
8. All seven external operations are mock-only in this workflow. Treat a timeout
   or lost response from create, update, delete, or send as an ambiguous outcome.
   Never replay automatically. Any idempotency key, outbox identity, deduplication
   ledger, retry budget, or reconciliation process is project-owned architecture
   unless a separate authoritative contract confirms it.

## Illustrative ingestion shape

This is documentation only; do not execute it:

```http
POST <YCLOUD_API_BASE_URL>/event/events
X-API-Key: <YCLOUD_API_KEY>
Content-Type: application/json

{"eventName":"<DEFINED_EVENT_NAME>","objectId":"<CONFIRMED_CONTACT_ID>","occurTime":"<RFC3339_TIME>","properties":{"<DEFINED_PROPERTY>":"<SYNTHETIC_VALUE>"}}
```

Use `contactPhoneNumber` instead of `objectId` only when that is the confirmed
Contact handoff artifact. Do not put a real key, contact, phone number, event, or
customer property in examples, fixtures, logs, or generated artifacts.

## Outcome requirements

Adapt the result to planning, implementation, or evaluation and make these
items explicit:

1. **Matched contract** — source hash, selected operation IDs, exact methods and
   paths, parameters, request/response schemas, and description-only rules.
2. **Lifecycle versus ingestion** — definition/property changes and occurrence
   submission remain distinct in architecture, handlers, permissions, and tests.
3. **Contact handoff** — record whether the input is a confirmed opaque contact
   ID or confirmed contact phone number, its provenance, and any project-owned
   choice when both could exist; perform no Contact lookup or mutation.
4. **Acceptance boundary** — distinguish endpoint `200` from unconfirmed
   downstream processing or completion and preserve unknown future fields.
5. **Safety** — trusted-server placement, placeholder authentication, mock-only
   transport, high-risk delete stop, timeout ambiguity, and no automatic replay.
6. **Tests** — exact routing and schemas; name/type constraints; CONTACT-only
   definition handling; update field allowlists; property-value validation;
   Contact artifact branches; supplied/omitted occurrence time; empty-body `200`;
   `404` lifecycle fixtures; ambiguous timeout/no replay; and proof of no network.
7. **CANNOT** — real API calls or credentials, Contact resolution/mutation,
   undocumented property coercion/precedence, safe replay or exactly-once claims,
   downstream status/completion, analytics, callbacks, guessed SDK methods, and
   unlisted errors or operations.
8. **Handoff** — send contact creation, retrieval, normalization, or identity
   choice to Contact; consume only its confirmed artifact. Return to Architect
   with capability-row status, artifacts, tests/results, accepted-versus-final
   evidence, unknowns, and outgoing handoffs.

## Safety and source priority

Use the pinned OpenAPI source first, these derived references second, and this
workflow third. Keep source facts, observed runtime evidence, and project policy
visibly separate. No local implementation authorization permits a network call
or external side effect.
