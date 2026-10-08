# Ownership & Invariant Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/owner_invariant_map.md` as the canonical navigation index for business, data, authorization, runtime, and operational invariants and their authoritative owners.

## Inspect

Schemas/models, domain services, policy engines, state machines, validators, API handlers, workers, migrations, feature flags, pricing/entitlement code, generated types, tests, docs, and runtime config.

## Map content

### Evidence and IDs

- Write or update `docs/owner_invariant_map.md` when possible. If writing is unavailable, print the complete markdown content in chat.
- Use stable IDs and preserve existing IDs: invariant `INV-*`, owner `OWN-*`, decision `DEC-*`, state machine `STM-*`, policy `POL-*`, producer/consumer edge `EDGE-*`.
- Anchor every invariant to its current owner with `path:line[-line]` plus symbol when possible.
- A map entry is not proof by itself. Audits and implementation tasks must re-check the owner source when stale or risky.

### Coverage

Cover permissions, tenancy, plans/quotas, lifecycle state transitions, validation rules, pricing/billing activation, idempotency rules, data integrity constraints, external provider contracts, audit logs, rollout/rollback constraints, and duplicated or ambiguous rules.

### Entry details

For each invariant, capture the owner source, human-readable rule, producers, consumers, failure/error semantics, direct tests, docs/spec links, generated artifacts, rollout/rollback notes, and known drift or duplication. Mark owner ambiguity as a first-class risk.

## Markdown structure

Use summary, conventions, invariant index by domain, owner table, producer/consumer edges, duplicated logic, missing tests, stale docs, unknown owners, and assumptions.
