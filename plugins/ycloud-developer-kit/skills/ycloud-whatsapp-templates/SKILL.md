---
name: ycloud-whatsapp-templates
description: Design, implement locally, or evaluate YCloud WhatsApp template create, list, retrieve, edit, delete, and analytics operations. Use for template lifecycle integration; do not use for sending template messages, media uploads, readiness, broad integration planning, or real template/API mutations.
---

# YCloud WhatsApp Templates

Design or implement safe, contract-aware WhatsApp template lifecycle and
analytics work. This skill never mutates a real template.

## Execution boundary

These restrictions govern Skill execution: do not call a YCloud Provider API, access real credentials, or read real business data. The Skill may generate server-side adapter code for an application's runtime, but must not start it or make a live request. Reading public official documentation as contract evidence is allowed and is not a Provider API call or business-data access. A live smoke test is outside the default workflow and requires separate, explicit authorization naming the target/environment, allowed operations, credential boundary, and required result evidence.

Honor Architect handoffs for `scope`, `deliverable`, `mutation`, capability IDs,
project seams, and expected evidence. Without one, default to focused scope and
read-only guidance unless the user explicitly requests local implementation.
Local-write authorization permits request models/builders, adapters, handlers,
component editors, test-console bindings, mocks, and no-network tests in the
scoped project. It does not authorize create, edit, delete, analytics, or any
other real API call. Reuse the project's existing UI/interface stack and do not
generate a dashboard or bind a framework without user/project support.

## Trigger boundary

Use this skill for template creation, listing, retrieval, editing, deletion, or
analytics. A request to send a message that happens to use a template belongs to
`ycloud-whatsapp-messages`, even when the template already exists. A request to
upload media belongs to `ycloud-whatsapp-media`. Broad integration design belongs
to `ycloud-integration-architect`; readiness, repository-maintenance, and issue-tracker prompts do
not trigger this skill.

Read only `references/openapi.md` and `references/runtime.md` after selection.
For create requests, component editors, or template smoke tests, also read
`references/create-examples.json`. If retry, idempotency, queueing, or error
translation is requested, also read `references/shared/integration-boundaries.md`. The generated OpenAPI reference is
the contract index for the seven allowlisted template operations: create, list,
retrieve, edit, delete-by-name, delete-by-name-and-language, and analytics. Use
the exact source-derived path, method, operationId, parameter, schema, response,
and descriptions from the reference; do not guess names or paths from prose.
For template-list work, also read `references/shared/pagination-contract.md`.
Interpret `allOf` as schema composition and `x-*` extensions or generated model
names as codegen hints, not additional lifecycle behavior.
If source hash, operation coverage, or reference content drifts, report the drift
and stop.

## Workflow

1. Establish the user’s intended lifecycle operation and the target server-side
   project context. Ask for missing language, framework, environment, or
   template identity rather than inferring them.
2. Match exactly one of the seven operations in the generated reference. Keep
   lifecycle operations separate from message sending. Preserve source-defined
   path parameters, request/response schemas, enum values, and description-only
   constraints. Use the runtime reference for the shared Management API quota,
   standard error envelope, request ID, pagination behavior, edit replacement
   semantics, extensible status handling, and documented template error codes.
   Do not fill gaps with imagined safe replay, idempotency, approval states,
   delivery semantics, or analytics meanings.
3. Generate raw HTTP or contract-aware typed request examples, or implement
   project-local request construction when authorized, with placeholders
   such as `<YCLOUD_API_KEY>`, `<TEMPLATE_NAME>`, `<LANGUAGE>`, and synthetic
   values. Use an SDK-specific method only when a confirmed SDK artifact/version
   and documentation are present in the user’s project; `operationId` is not an
   SDK method name.
   For the default create smoke test, use the documented
   `utility-order-confirmation` fixture unchanged except for replacing
   `<WABA_ID>` and, when collision avoidance is required, the template name.
   Use the documented `authentication-copy-code` fixture for authentication
   shape tests. `AUTHENTICATION`, `MARKETING`, and `UTILITY` are top-level
   category values, never component types. Do not manufacture a kitchen-sink
   request by adding one instance of every component enum; component
   combinations have cross-field constraints and must come from a selected
   documented example or a user-supplied valid design.
   Keep `wabaId` as part of template identity across list, retrieve, and edit.
   A UI or local route may encode a composite key, but its provider adapter must
   preserve the exact `/whatsapp/templates/{wabaId}/{name}/{language}` path for
   retrieve and edit; `name|language` alone is not a provider identity.
   Keep template definition components separate from message-send parameters:
   Generate template definitions using the canonical uppercase `CAROUSEL`,
   `HEADER`, `BODY`, and `BUTTONS` spellings (including nested `buttons`).
   Preserve case-insensitive parsing of definition component types, formats,
   and button types; capitalization alone does not distinguish a definition
   from a send payload. Route message parameter composition to
   `ycloud-whatsapp-messages`, which generates the lowercase send component model.
   For carousel create/edit fixtures, include 2..10 cards, a media `HEADER`
   and a `BUTTONS` component containing 1..2 buttons per card. Supply media
   examples as a non-empty `example.header_url` string array. The service uses
   its first URL, which must be HTTP(S) with `.jpg`, `.jpeg`, or `.png` for
   `IMAGE` and `.mp4` for `VIDEO`. If a card
   includes `BODY`, its text must be non-blank and at most 160 characters.
   The two-card minimum is a definition constraint, not a minimum count for
   the parameter overrides included in a later send request.
   Apply the same request validator before both sandbox storage and live
   transport so live mode cannot bypass component/category/button validation.
4. Keep API keys server-side and out of browser/mobile code, URLs, logs, source
   control, and snippets. Do not read `.env`, secret stores, logs, customer
   templates, or live analytics.
5. For create/edit/delete, describe the planned change and its validation and
   rollback considerations. An edit is a full content replacement: include all
   components that must survive, and allow it only for `APPROVED`, `REJECTED`,
   or `PAUSED`; never edit `ARCHIVED`. For list, use 1-based `page`, `limit`
   1..100, and `includeTotal` only when a count is required; archived matches
   remain visible. Parse the response as the merged Page envelope with required
   `offset`, `limit`, `length`, template `items`, and optional `total`; `offset`
   is response metadata, not a query parameter. Preserve unfamiliar status values and stop state-dependent
   mutation rather than mapping them to a known state.
6. Build synthetic tests for request/schema validation, full-replacement edits,
   editable/archived/unknown status gates, pagination boundaries and optional
   totals, path/query parameters, response mapping, and the selected lifecycle
   branch. Create tests must assert that category values never appear in
   `components[*].type` and that the selected documented example survives
   request construction without extra components. Retrieve/edit tests must
   assert that the captured provider path includes the WABA ID. Also test that
   live and sandbox handlers reject the same invalid component payload before
   transport. Do not call YCloud or alter a template.
7. Treat create/edit/delete timeouts as ambiguous outcomes and never replay
   automatically. Any project idempotency ledger, outbox, retry budget, or RFC
   9457 response is local architecture, not a YCloud contract.

## High-risk delete handling

Treat both delete operations as high-risk. Stop before execution, state the
target and potential impact, request explicit confirmation in a future approved
workflow, and outline a verification/rollback plan only where the source or
project facts support it. The MVP performs no delete, create, edit, or other
external API action. Never imply that deleting a template withdraws or changes
already-submitted messages.

## Outcome requirements

Adapt the result to planning, implementation, or evaluation. Preserve these
contract and evidence outcomes:

1. **Matched contract** — source hash, selected operation, exact path/method,
   parameters, request/response schemas, and confirmed constraints.
2. **Lifecycle plan** — placeholder raw HTTP or project-local construction and
   the intended create/list/retrieve/edit/delete/analytics behavior.
3. **Safety and integration placement** — server-side boundary, credential
   handling, validation, and (for delete) high-risk confirmation stop.
4. **Tests** — synthetic contract, mapping, and negative tests with no live call.
5. **CANNOT** — unknown metrics or runtime behavior, unsupported operations,
   unconfirmed SDK methods, missing project facts, and actions not performed.
6. **Handoff** — route template message composition/sending to
   `ycloud-whatsapp-messages`; return to Architect with each selected operation's
   row status, changed or proposed artifacts, tests/results, lifecycle/status
   preconditions, unknowns, and outgoing handoffs.

## Non-goals

Do not consume webhook payloads, verify signatures, upload media, send messages,
read credentials, make unrequested local changes, or invoke a remote API. A
template lifecycle result is not a sent or delivered message; keep that
distinction in every example and handoff.
