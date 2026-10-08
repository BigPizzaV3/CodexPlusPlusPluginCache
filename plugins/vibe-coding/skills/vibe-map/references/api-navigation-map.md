# API Navigation Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/api_map.md` as a current map of the repository’s API surface so later audits can navigate quickly and cite exact owners.

## Inspect

Routes, controllers/handlers/resolvers, schemas/DTOs, serializers, middleware, auth guards, rate limiters, webhooks, jobs that expose/consume API contracts, OpenAPI/GraphQL/RPC files, generated clients, tests, migrations/models, docs, and deployment/runtime config that affects public behavior.

## Map content

### Evidence and IDs

- Write or update `docs/api_map.md` when the environment allows it. If writing is unavailable, print the complete markdown content in chat.
- Use stable IDs and preserve existing IDs when refreshing: endpoint `A-*`, group `G-*`, schema `S-*`, middleware/policy `M-*`, webhook `W-*`.
- Anchor every entry to current repository evidence with `path:line[-line]` plus symbol when possible.
- Distinguish source-of-truth implementation from generated docs, generated clients, stale docs, and inferred behavior.
- Capture unknowns only when they affect future audit or implementation.

### Coverage

Cover auth/authorization model, endpoint groups, schemas, middleware/policies, role/action matrix when discoverable, versioning/deprecation, webhooks, async status flows, generated artifacts, and consumer-facing tests.

### Entry details

For each endpoint, capture method/path, owner symbol, auth/roles/tenant scope, request/response schemas, status/error behavior, validation, side effects, pagination/filtering/sorting, idempotency/webhook behavior if relevant, tests, and notes/unknowns. For each schema or middleware/policy, capture owner symbol, consumers, invariants, tests, and known drift.

## Markdown structure

Use a readable markdown hierarchy with summary first, then conventions, endpoint groups by feature/resource, schemas, middleware/policies, matrices, generated artifacts, unknowns, and assumptions. Omit sections that do not exist in the repo. Do not invent surfaces, states, commands, endpoints, or contracts.
