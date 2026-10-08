---
name: ycloud-balance
description: Design, implement locally, or evaluate retrieval and interpretation of the YCloud account balance. Use for the single Balance read operation or a balance-to-readiness evidence handoff; exclude plugin readiness checks, billing history, top-ups, and real API operations.
---

# YCloud Balance

Design or implement contract-aware retrieval of the current account balance.
Use synthetic responses and a mock transport only; never call YCloud, read a
credential, expose customer financial data, or claim a live balance was checked.

## Execution boundary

These restrictions govern Skill execution: do not call a YCloud Provider API, access real credentials, or read real business data. The Skill may generate server-side adapter code for an application's runtime, but must not start it or make a live request. Reading public official documentation as contract evidence is allowed and is not a Provider API call or business-data access. A live smoke test is outside the default workflow and requires separate, explicit authorization naming the target/environment, allowed operations, credential boundary, and required result evidence.

Honor an Architect handoff for scope, deliverable, mutation, capability ID,
project seams, and evidence. Without one, default to focused read-only guidance
unless the user explicitly requests local implementation. Local-write
authorization permits a trusted-server adapter, typed response mapping,
mock-only handler/service bindings, fixtures, and no-network tests in the scoped
project. It never authorizes a live balance request or production readiness
decision.

## Scope and handoffs

After this Skill is selected, read the generated [OpenAPI
contract](references/openapi.md) and reviewed [runtime
behavior](references/runtime.md). If retry, error translation, rate limiting, or
production architecture is requested, also read
`references/shared/integration-boundaries.md`. If either generated reference is
missing, stale, or conflicts with the pinned source, report the drift and stop
instead of guessing.

This Skill owns exactly `GET /balance`, operationId `balance-retrieve`. It does
not own transactions, billing history, invoices, spending forecasts, top-ups,
currency conversion, or account mutation. API-key configuration belongs to
`ycloud-api-authentication`; broad planning belongs to
`ycloud-integration-architect`.

Balance may provide one synthetic or observed-at-runtime input to an
application's operational-readiness policy, but this Skill does not define a
minimum sufficient balance and cannot certify plugin, deployment, account, or
production readiness. Route an explicit Developer Kit installation/readiness
check to the readiness/smoke workflow. Keep any application threshold, alert,
reservation, or fail-open/fail-closed rule labeled as project policy.

## Contract-first workflow

1. Confirm the source hash, exact method/path, `operationId`, lack of parameters
   and request body, and response schema in the generated reference. Do not
   infer an SDK method from `balance-retrieve`.
2. Preserve the documented `200 Balance` shape: required numeric `amount` and
   required string `currency`, where currency is an ISO 4217 code. Do not assume
   `amount` is an integer, minor units, non-negative, available credit, or a
   promise that a future operation will succeed. Preserve decimal precision
   according to the target project's established money strategy; if none
   exists, surface that decision instead of silently rounding through binary
   floating-point arithmetic.
3. Keep provider-generated identifiers and future opaque strings
   case-sensitive and unparsed. Preserve unknown response properties and an
   explicit unknown branch for future enum-like values. Do not convert currency
   or combine balances unless a separate, authoritative project contract is in
   scope.
4. At the provider adapter, retain the standard error envelope and
   `YCloud-Request-ID` (or `error.requestId`) for redacted correlation. The
   operation itself declares only `200`; use reviewed cross-cutting runtime
   behavior for generic failures and do not invent balance-specific status
   codes or error meanings. Branch on HTTP status and `error.code`, never
   diagnostic `error.message`.
5. On `429`, honor `Retry-After` before another request and parse beta
   `RateLimit-*` headers defensively. Do not assign an invented balance quota.
   Because retrieval is read-only, a bounded transient retry may be proposed as
   project policy, but no retry count, backoff, cache lifetime, or staleness
   tolerance is a YCloud guarantee unless `runtime.md` says so.
6. Keep the API key on a trusted server and use placeholders only. A local
   handler or readiness consumer must call a fake adapter and visibly
   label its data synthetic; it must not offer a control that reaches YCloud.

## Illustrative raw HTTP

This shape is documentation only; do not execute it:

```http
GET <YCLOUD_API_BASE_URL>/balance
X-API-Key: <YCLOUD_API_KEY>
```

Synthetic response fixture:

```json
{"amount": 190.0765, "currency": "USD"}
```

Do not put a real key, account identifier, response, or customer financial data
in examples, fixtures, logs, or generated artifacts.

## Outcome requirements

Adapt the result to planning, implementation, or evaluation, while making these
items explicit:

1. **Matched contract** — source hash, `GET /balance`, `balance-retrieve`, no
   request body, `200 Balance`, and required `amount`/`currency` fields.
2. **Interpretation** — numeric/precision strategy, ISO 4217 treatment, unknown
   property handling, freshness label, and every project-owned threshold or
   policy clearly separated from YCloud facts.
3. **Integration placement** — trusted-server adapter, placeholder
   Authentication handoff, mock transport seam, and redacted request-ID
   observability.
4. **Response and rate handling** — standard error envelope, no invented
   balance-specific statuses, defensive rate headers, `Retry-After`, and any
   bounded GET retry labeled as project policy.
5. **Tests** — no-parameter/no-body request construction; decimal and currency
   preservation; missing/wrong-typed fields; unknown fields/currency-like
   values; synthetic error/request-ID fixtures; `429` scheduling; timeout and
   bounded-retry policy; readiness handoff without a readiness claim; and proof
   that no network call occurs.
6. **CANNOT** — live balance retrieval, credentials or real financial data,
   mutations/top-ups/history, currency conversion, affordability or readiness
   guarantees, inferred SDK methods, invented quotas/errors, or unlabelled
   caching and threshold policy.
7. **Handoff** — provide Balance evidence with provenance and freshness to the
   Architect or project-owned readiness consumer, which owns the final policy
   decision. Return capability-row status, artifacts, tests/results, and
   unknowns; state when no handoff is needed.

## Safety and source priority

Use the pinned OpenAPI source first, generated references second, and this
workflow third. Keep provider contract, reviewed runtime facts, and project
policy visibly separate. External reads and mutations remain prohibited even
when local implementation is authorized.
