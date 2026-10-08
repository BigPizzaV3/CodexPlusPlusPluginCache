---
name: ycloud-unsubscribers
description: Design, implement locally, or evaluate YCloud customer unsubscribe creation, lookup, listing, and deletion. Use for opt-out records and message-eligibility evidence; exclude Contact CRUD, message sending, provider delivery status, and real API operations.
---

# YCloud Unsubscribers

For `unsubscriber-list`, read
[`references/shared/pagination-contract.md`](references/shared/pagination-contract.md)
with the generated OpenAPI/runtime references.

Design or implement contract-aware handling for the five Unsubscriber operations
in the pinned reference. Use synthetic customers and a mock transport only.
Never call YCloud, inspect credentials or customer data, or mutate a real
unsubscribe record.

## Execution boundary

These restrictions govern Skill execution: do not call a YCloud Provider API, access real credentials, or read real business data. The Skill may generate server-side adapter code for an application's runtime, but must not start it or make a live request. Reading public official documentation as contract evidence is allowed and is not a Provider API call or business-data access. A live smoke test is outside the default workflow and requires separate, explicit authorization naming the target/environment, allowed operations, credential boundary, and required result evidence.

Honor an Architect or Contact handoff for scope, deliverable, mutation,
capability IDs, project seams, confirmed customer identity, and expected
evidence. Without one, default to focused read-only guidance unless the user
explicitly requests local implementation. Local-write authorization permits
request/response models, adapters, handlers, mock fixtures, policy-evidence
mappers, and no-network tests in the scoped project. Create and delete remain
mock-only, and even GET operations must use mocks in this workflow.

After this Skill is selected, read the generated [OpenAPI
contract](references/openapi.md) and reviewed [runtime
behavior](references/runtime.md). For retry, idempotency, error translation, or
production architecture, also read
`references/shared/integration-boundaries.md`. If either local reference is
missing, stale, or inconsistent with its recorded source hash or operation
count, report drift and stop rather than reconstructing the contract from
memory.

## Exact operation scope

| Intent | Method and path | operationId |
| --- | --- | --- |
| Create an unsubscribe record | `POST /unsubscribers` | `unsubscriber-create` |
| Delete by composite identity | `DELETE /unsubscribers/{customer}/{channel}` | `unsubscriber-delete-by-customer-and-channel` |
| List unsubscribe records | `GET /unsubscribers` | `unsubscriber-list` |
| List all records for one customer | `GET /unsubscribers/{customer}` | `unsubscriber-list-all-by-customer` |
| Retrieve by composite identity | `GET /unsubscribers/{customer}/{channel}` | `unsubscriber-retrieve-by-customer-and-channel` |

Contact discovery and updates belong to a Contact capability; message request
construction, `filterUnsubscribed`, submission, retrieval, and message status
belong to `ycloud-whatsapp-messages`. Authentication belongs to
`ycloud-api-authentication`; broad multi-domain planning belongs to
`ycloud-integration-architect`. Webhook processing, keyword configuration,
marketing consent design, and non-WhatsApp channel behavior are out of scope.

## Contract-first workflow

1. Match only the five allowlisted operations. Report exact method, path,
   `operationId`, parameters, body, response schema, and documented status.
   Treat operation IDs and `x-*` fields as identifiers or codegen hints, not SDK
   method names or additional behavior.
2. Model `(customer, channel)` as the unique Unsubscriber identity. Do not use
   `regionCode`, `source`, or `createTime` as identity. For the documented
   `type=PHONE_NUMBER`, require `customer` to remain an E.164 string, never a
   number, and URL-encode it as one path segment (including the leading `+`).
   The only currently documented channel is lowercase `whatsapp`; do not
   normalize an unknown future channel into it. Consume a Contact handoff only
   when it supplies a confirmed customer value and its identity provenance;
   never infer an E.164 number from a contact name or unrelated identifier.
3. For create, send required `type`, `customer`, and `channel`; `regionCode` is
   optional. Preserve the documented `PHONE_NUMBER` and `whatsapp` values, but
   decode future `type`, `channel`, and `source` values through an explicit
   unknown branch. Preserve unknown response properties. Do not interpret the
   response `source` prose as an additional create/delete guarantee.
4. For `unsubscriber-list`, preserve `page` as 1-based with range 1-100,
   `limit` as 1-100, defaults of 1 and 10, optional `includeTotal`, optional
   `pageAfter`, and exact dotted filters `filter.customer`, `filter.channel`,
   and `filter.regionCode`. Parse the successful response as the merged Page
   envelope with required `offset`, `limit`, `length`, resource `items`, optional
   `total`, and optional `cursor`; `offset` is response metadata. Treat `total`
   as optional and present only when
   requested. Cursor traversal must use the returned opaque `cursor.after`
   unchanged and stop when it is absent. Add project-owned safety guards for an
   empty page, a repeated cursor, and a configured page/item budget. Do not
   synthesize a cursor from offsets, infer completion from `total`, or silently
   switch/mix page and cursor strategies beyond behavior confirmed by the
   contract.
5. Keep `GET /unsubscribers/{customer}` distinct: it returns an array, not an
   `UnsubscriberPage`, and documents `404`. Composite retrieve and delete also
   document `404`; list and create declare only `200`. Use reviewed runtime
   behavior for generic errors and do not invent endpoint-specific statuses.
6. Keep provider contract separate from local policy. Confirmation UX, local
   consent rules, audit retention, eligibility caches, retry budgets, and
   reconciliation are application-owned. A timeout or lost response to create
   or delete has an ambiguous outcome. The contract defines no general
   idempotency key, so never replay either mutation automatically. Honor
   `Retry-After` before later traffic without treating it as replay authority.
7. Use placeholders such as `<YCLOUD_API_KEY>` and `<E164_CUSTOMER>` and fully
   synthetic fixtures. Keep credentials server-side and hand credential work to
   Authentication. Do not read `.env`, secret stores, production logs, live
   Contacts, Unsubscribers, or Messages.

## Eligibility-policy evidence

An exact composite retrieve, a customer-wide list, or a deliberately complete
and defensively traversed filtered list can produce an evidence object for the
Messages capability. Include the queried customer/channel, match or no-match,
operation and source provenance, observation time/freshness, pagination
completeness, and unknown-value warnings. A local cache entry or incomplete
page traversal is not authoritative negative evidence.

This evidence is an input to the application's message-eligibility policy. It
does not submit or suppress a message by itself and is not a YCloud/WhatsApp
final status. Never label it sent, accepted, queued, failed, delivered, read, or
provider-rejected. Messages owns request-time policy (including whether to use
`filterUnsubscribed`) and provider response/webhook interpretation.

## Validation and evidence

For local implementation, add no-network tests for exact routes, required body
fields, E.164 string preservation and path encoding, composite identity,
array-versus-complete-page-envelope response shapes, all list parameters and dotted filters,
optional total, opaque cursor continuation, absent/repeated cursor termination,
empty pages, configured traversal budgets, `404` handling, standard errors and
request IDs, and unknown fields/enum values. Add mutation tests for explicit
authorization, ambiguous outcomes, and proof of no automatic replay. Mocks must
prove that no network client is invoked.

Return these sections, adapted to the requested deliverable:

1. **Matched contract** — source hash, selected operations, exact request and
   response shapes, and description-only constraints.
2. **Construction or implementation** — placeholder design, changed artifacts,
   and project facts still needed.
3. **Contract versus policy** — provider facts separated from local consent,
   eligibility, cache, pagination-budget, retry, and audit choices.
4. **Tests and evidence** — synthetic cases, actual no-network results, and
   pagination completeness.
5. **CANNOT** — live calls, credentials/customer data, unsupported operations,
   guessed SDK methods, automatic mutation replay, unconfirmed idempotency, or
   provider send/delivery/final-status claims.
6. **Handoff** — consume confirmed customer identity evidence from Contact;
   produce provenance-bearing eligibility-policy evidence for
   `ycloud-whatsapp-messages`; return capability status, artifacts, tests,
   unknowns, and outgoing handoffs to Architect. Do not claim a Contact exists
   merely because an Unsubscriber exists, or that an eligible result guarantees
   a message will be accepted or delivered.

## Safety stop

YCloud Provider API calls are prohibited during Skill execution, including
nominally read-only GETs. All mutations are mock-only. Stop before any request
that would use a real API key, customer identifier, Contact, Unsubscriber,
Message, or other live YCloud data.
