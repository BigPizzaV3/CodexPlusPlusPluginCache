# Data Model Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal

Audit persistence models, schema invariants, migrations, query boundaries, and domain data ownership. Keep only reachable issues that can cause data corruption, inconsistent behavior, broken migrations, query bugs, or unsafe future changes.

## Inspect

Database schemas, migrations, ORM models, generated types, repositories/DAOs, service/domain layers, transactions, constraints/indexes, seed data, background jobs, cache/index sync, import/export flows, API schemas, UI assumptions, tests, fixtures, docs, and generated maps when present.

## Issue classes

- Invariants: required business rules enforced only in UI, missing database/domain constraints, inconsistent enum/state-machine handling, nullable fields with unsafe assumptions, and invalid transitions.
- Migrations: non-idempotent or unsafe migration order, data backfill gaps, missing rollback/forward strategy, generated type drift, and schema changes not reflected in code/tests.
- Ownership and boundaries: domain rules split across handlers/components/workers, duplicated query filters, repository/service bypasses, and unclear source of truth for writes.
- Relationships and tenancy: missing foreign keys/cascade policy where repo expects them, orphan records, wrong uniqueness scope, unsafe tenant/workspace/project scoping, and inconsistent soft-delete behavior.
- Query behavior: N+1 hot paths, unstable ordering/pagination, missing indexes for reachable filters, race conditions, transaction gaps, and cache/index invalidation drift.
- Import/export/sync: partial failure handling, duplicate prevention, external ID stability, replay/idempotency, and stale derived artifacts.
- Regression resistance: missing fixtures/tests for constraints, migrations, state transitions, concurrency, tenant isolation, and data repair/backfill.

## Priority model

Reachable data loss/corruption, cross-tenant data mix-up, migration that can break production data, unauthorized mutation through data boundary drift, or invalid state enabling destructive/paid/security impact.

Important invariant or migration gap, query bug on a main path, duplicated data ownership likely to drift, missing critical data-model tests, or performance issue from schema/query mismatch.

Lower-risk schema hygiene issue, stale generated type/docs, minor index/test gap, unclear ownership that does not currently break behavior, or maintainability coupling around data access.
