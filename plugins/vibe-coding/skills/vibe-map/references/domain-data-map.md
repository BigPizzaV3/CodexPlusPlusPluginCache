# Domain Data Map

## Operation

Create or refresh only the requested repository map. A map is a navigation index, not proof of correctness. Verify entries against current owners and preserve stable IDs. If the user asks for an explanation in chat, do not insist on writing a file.

## Goal

Create or update `docs/domain_data_map.md` as a repository evidence map of domain entities, relationships, states, sensitive fields, persistence owners, generated types, and data lifecycle rules.

## Inspect

Database schemas, migrations, ORM models, NoSQL collections, object keys, search/vector indexes, generated clients/types, serializers, fixtures, factories, seed data, retention/deletion jobs, import/export code, API schemas, analytics tables, and docs.

## Map content

### Evidence and IDs

- Write or update `docs/domain_data_map.md` when possible. If writing is unavailable, print the complete markdown content in chat.
- Use stable IDs and preserve existing IDs: entity `ENT-*`, relationship `REL-*`, state machine `STM-*`, field group `FLD-*`, index/cache `IDX-*`, sensitive data `PII-*`, lifecycle rule `LIFE-*`.
- Anchor each entry to current repository evidence and distinguish source schema from generated clients, projections, docs, fixtures, and inferred behavior.

### Coverage

Cover entities, fields, relationships, ownership and tenant scope, lifecycle statuses, validation, uniqueness, migrations, indexes, caches/materialized views, retention/deletion/export, PII/sensitive data, access boundaries, fixtures, tests, generated artifacts, and analytics derivations.

### Entry details

For each entity, capture owner schema/model, key fields, state transitions, relations, readers/writers, permissions, data lifecycle rules, migrations, tests/fixtures, derived projections, and stale or missing documentation.

## Markdown structure

Use summary, conventions, entity index, relationship graph in text/table form, state machines, sensitive data table, projections/caches/indexes, lifecycle rules, tests/fixtures, unknowns, assumptions.
