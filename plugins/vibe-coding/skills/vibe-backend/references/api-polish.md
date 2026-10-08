# API Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Improve one coherent API surface end to end: route/handler, validation, domain/service boundary, persistence side effects, errors, docs, tests, and direct consumers. Do not merely rename fields or tidy controllers while the contract remains ambiguous or inconsistent.

## Scope selection

- If the user named an endpoint, integration, client failure, schema, webhook, SDK call, or contract issue, polish that API surface and directly affected consumers.
- If the request is broad, inspect the main API seams and apply the highest-confidence improvement with contract, safety, or developer-experience impact.
- Include related validation, error, idempotency, permission, observability, docs, and tests when they belong to the same contract.
- Avoid unrelated endpoint redesigns, mass API versioning, dependency changes, and database rewrites unless required by the selected contract fix.

## Polish targets

- Request/response schema clarity, required/optional/null semantics, type coercion, defaults, pagination, sorting, filtering, and versioning behavior.
- Validation boundary: reject malformed input close to the API edge while keeping domain invariants in the owner layer.
- Error model: stable status codes, machine-readable error codes, safe messages, retryability, conflict handling, and not-found/forbidden distinction when security allows it.
- Side effects: idempotency keys, duplicate prevention, transaction boundaries, retries, partial failure, webhooks, background jobs, and cache/index invalidation.
- Consumer contract: generated clients, frontend callers, bot/tool callers, docs/examples, fixtures, and integration tests.
- Operational behavior: rate limits, timeouts, logging, tracing, metrics, and safe diagnostics where repo patterns exist.

## Implementation principles

- Preserve public contracts unless the task explicitly authorizes a breaking change.
- Reuse existing routing, schema, service, repository, auth, error, and test patterns.
- Prefer one source of truth for schemas and shared types over duplicated literals.
- Keep UI/client promises aligned with backend behavior.
- Update directly affected tests, generated artifacts, docs, and examples when the repo uses them.

## Validation

Run repository-native checks for the touched API surface. Prefer endpoint/unit/integration tests that exercise success, validation failure, auth/permission failure, conflict/idempotency, and consumer behavior. If external services or credentials block full validation, state exactly what was not exercised.
