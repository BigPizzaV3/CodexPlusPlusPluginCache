# Traceability Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/traceability_map.md` as the cross-reference from requirements, product decisions, invariants, docs, code owners, tests, release gates, and implementation workstreams.

## Inspect

Product docs, PRDs, README/design docs, issue text supplied by the user, existing maps, routes/components/API/jobs, schemas, tests, generated artifacts, release/deploy docs, migrations, feature flags, analytics events, and known audit outputs.

## Map content

### Evidence and IDs

- Write or update `docs/traceability_map.md` when possible. If writing is unavailable, print the complete markdown content in chat.
- Use stable IDs and preserve existing IDs: trace row `TRC-*`, requirement `REQ-*`, invariant `INV-*`, code owner `CODE-*`, test anchor `TEST-*`, release gate `REL-*`.
- A trace row must include direct evidence for each link when available; missing links are explicit gaps, not invented references.

### Coverage

Cover requirement → owner → implementation surfaces → API/data/runtime/auth contracts → tests → docs → release/rollout gates. Include acceptance coverage, stale docs, orphan code, orphan tests, missing tests, and decisions that lack owner evidence.

### Entry details

For each trace row, capture source requirement or decision, expected behavior, implementation owners, affected contracts, tests/checks, docs/maps, release gate, residual gaps, and recommended next prompt-skill.

## Markdown structure

Use summary, conventions, traceability matrix, orphaned requirements, orphaned code/tests/docs, acceptance gaps, release gates, unknowns, assumptions.
