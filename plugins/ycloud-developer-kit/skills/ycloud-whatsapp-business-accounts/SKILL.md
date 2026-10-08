---
name: ycloud-whatsapp-business-accounts
description: Design, implement locally, or evaluate YCloud WhatsApp Business Account listing, retrieval, and automatic creative optimization operations. Use for WABA inventory or ACO integration; exclude phone-number management, messaging, template lifecycle, broad planning, and real API mutations.
---

# YCloud WhatsApp Business Accounts

Design or implement contract-aware support for the four WABA operations in the
generated reference. Never call YCloud or Meta, read credentials or customer
data, or mutate a real WABA.

## Execution boundary

These restrictions govern Skill execution: do not call a YCloud Provider API, access real credentials, or read real business data. The Skill may generate server-side adapter code for an application's runtime, but must not start it or make a live request. Reading public official documentation as contract evidence is allowed and is not a Provider API call or business-data access. A live smoke test is outside the default workflow and requires separate, explicit authorization naming the target/environment, allowed operations, credential boundary, and required result evidence.

Honor Architect handoffs for `scope`, `deliverable`, `mutation`, capability IDs,
project seams, and expected evidence. Without one, default to focused,
read-only guidance unless the user explicitly requests local implementation.
Local-write authorization permits request models/builders, adapters, handlers,
service bindings, mocks, synthetic fixtures, and no-network tests inside
the scoped project. The ACO PATCH operation is mock-only: local implementation
does not authorize a real enrollment update. Reuse the project's existing
interface stack and preserve concurrent work.

Load [the generated OpenAPI reference](references/openapi.md) and
[the reviewed runtime reference](references/runtime.md) only after this skill is
selected. If retry, idempotency, queueing, or error translation is requested,
also read `references/shared/integration-boundaries.md`. Exact paths, schemas,
responses, and descriptions come from `openapi.md`; cross-cutting pagination,
error, request-ID, rate-limit, and compatibility behavior comes from
`runtime.md`. If either generated reference is missing, stale, or inconsistent
with its recorded source hash and operation count, report drift and stop rather
than reconstructing the contract from memory.
For WABA list work, also read
[`references/shared/pagination-contract.md`](references/shared/pagination-contract.md).

## Exact operation scope

| Intent | Method and path | operationId |
| --- | --- | --- |
| List WABAs | `GET /whatsapp/businessAccounts` | `whatsapp_business_account-list` |
| Retrieve one WABA | `GET /whatsapp/businessAccounts/{id}` | `whatsapp_business_account-retrieve` |
| Retrieve ACO enrollment | `GET /whatsapp/businessAccounts/{wabaId}/automatic-creative-optimizations` | `whatsapp_waba-retrieve-automatic-creative-optimizations` |
| Partially update ACO enrollment | `PATCH /whatsapp/businessAccounts/{wabaId}/automatic-creative-optimizations` | `whatsapp_waba-update-automatic-creative-optimizations` |

Phone-number inventory and configuration belong to
`ycloud-whatsapp-phone-numbers`. Message submission/retrieval belongs to
`ycloud-whatsapp-messages`; template lifecycle and analytics belong to
`ycloud-whatsapp-templates`; authentication-only work belongs to
`ycloud-api-authentication`; broad multi-domain planning belongs to
`ycloud-integration-architect`. Readiness, repository maintenance, and issue
tracking are out of scope.

## Contract-first workflow

1. Match only an allowlisted operation and report its exact method, path,
   operationId, parameters, request/response schemas, and documented responses.
   Treat `operationId` and `x-*` fields as identifiers or codegen hints, not SDK
   method names or business rules. Use a project SDK only when its actual
   artifact, version, and method are confirmed.
2. Keep every WABA ID as an opaque, case-sensitive string. Do not parse prefixes,
   coerce it to a number, infer ownership, or rewrite it. Preserve the source's
   exact path parameter name: `{id}` for retrieve and `{wabaId}` for ACO.
3. For list, use 1-based `page`, `limit` from 1 through 100, and the documented
   defaults. Request `includeTotal=true` only when a count is needed, and apply
   `filter.accountReviewStatus` only as the source-defined string filter. Do not
   invent an enum or infer account eligibility from a review status. Parse the
   response as the merged Page envelope with required `offset`, `limit`,
   `length`, WABA `items`, and optional `total`; do not use response `offset` as
   a request parameter. Preserve
   unknown response properties and enum/status values.
4. For ACO GET, preserve the distinction between the response's extensible map
   and the PATCH request's closed map. GET returns Meta string fields without
   feature-key filtering, status validation, or case normalization; a successful
   response without the expected upstream object yields an empty
   `creativeOptimizationFeatures` object. Do not silently discard unknown keys
   or normalize unknown values.
5. For ACO PATCH, require the non-empty `creativeOptimizationFeatures` object,
   accept only the feature keys and `OPT_IN`/`OPT_OUT` values enumerated by the
   generated schema, and send only intended changes. The operation is a partial
   update: omitted keys are not a request to reset them. The contract says
   YCloud does not persist enrollment locally and does not pre-check Meta MM
   Lite/ACO onboarding; do not add either behavior as a claimed YCloud rule.
6. Keep contract facts separate from project policy. Input validation, approval
   UX, an audit record, an idempotency ledger, retry budgets, and rollback
   controls may be recommended or implemented locally when requested, but must
   be labeled application-owned. A mutating timeout is ambiguous; never replay
   ACO PATCH automatically. Honor documented `Retry-After` before later traffic
   without treating it as proof that replay is safe.
7. Use placeholders such as `<YCLOUD_API_KEY>`, `<WABA_ID>`, and synthetic
   feature values. Keep authentication server-side and hand credential storage
   to `ycloud-api-authentication`; do not inspect `.env`, secret stores, logs, or
   live responses.

## Validation and evidence

For local implementation, add no-network tests for operation routing, exact
parameter names, opaque/string IDs, pagination boundaries/defaults, optional
totals, filter encoding, standard error/request-ID mapping, unknown response
fields and enum values, ACO GET's extensible/empty map behavior, and ACO PATCH's
non-empty closed-key map, enum validation, partial-update construction, and
ambiguous-timeout/no-replay behavior. Mocks must prove that no network client is
invoked.

Return these sections, adapted to the requested deliverable:

1. **Matched contract** — source hash, selected operations, exact request and
   response shapes, and description-only constraints.
2. **Construction or implementation** — placeholder HTTP/project-local design,
   changed artifacts, and project facts still needed.
3. **Contract versus policy** — identify YCloud guarantees separately from local
   validation, approvals, persistence, retries, and rollback choices.
4. **Tests and evidence** — synthetic cases and actual no-network results.
5. **CANNOT** — real API/Meta calls, credentials/customer data, guessed SDK
   methods, unsupported operations, unknown lifecycle behavior, and any missing
   facts. Do not put confirmed pagination, error-envelope, request-ID, or ACO
   behavior in `CANNOT`.
6. **Handoff** — pass the selected opaque WABA ID to
   `ycloud-whatsapp-phone-numbers`; after a phone number is selected, route
   sending/retrieval to `ycloud-whatsapp-messages` and template lifecycle or
   analytics to `ycloud-whatsapp-templates`. Return to Architect with capability
   status, artifacts, tests, unknowns, and outgoing handoffs.

## Safety stop

YCloud Provider API calls are prohibited during Skill execution, including
nominally read-only GETs. All mutations are mock-only. Stop before any request
that would use a real API key, WABA/customer identifier, or live YCloud/Meta
resource.
