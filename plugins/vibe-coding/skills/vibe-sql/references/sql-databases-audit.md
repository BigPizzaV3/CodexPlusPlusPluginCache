# SQL Databases Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit SQL access from pool/admission and query plans through transactions, migrations, replicas, failover, and tenant permissions.

## Domain invariants

- Total possible connections across application replicas, pools, migrations, jobs, admin tools, and failover headroom stay within database and proxy budgets.
- Connect/acquire/statement/lock/idle-transaction/request timeouts form an ordered end-to-end budget and release connections on every cancel/error path.
- Queries use representative predicates/cardinality and have a plan/index/data-access shape that scales without hiding write amplification or stale statistics.
- Transaction boundaries and isolation level match the protected invariant; lock order, deadlock/serialization retry, and external calls do not create unsafe or long transactions.
- Schema changes use expand/migrate/contract where mixed application versions or large data require it; backfills are resumable, bounded, observable, and do not hold unbounded locks.
- Primary/replica routing makes read-after-write, lag, failover, transaction, and consistency expectations explicit; reconnect does not reuse stale session state.
- Tenant and privilege enforcement lives in authoritative roles/policies/queries; RLS/policy changes are tested under actual application and migration roles.
- Backup/restore, rollback/forward-fix, generated ORM/client artifacts, and query observability are synchronized with schema/connection changes.

## Audit method

1. Map request/job → pool/acquire → query/transaction/locks → primary/replica → commit → downstream/cache/event and all timeout/cancel boundaries.
2. Calculate connection demand per process/replica and compare it with server/proxy limits, reserved admin capacity, and failover topology.
3. Inspect representative explain/plan evidence, row estimates, scans, sorts, temp spill, index selectivity, and write/update cost for the changed query.
4. Trace concurrent anomaly/deadlock scenarios and identify the exact database constraint, lock, isolation, or optimistic version that owns the invariant.
5. Review migration/backfill under mixed versions, large tables, restart, replica lag, rollback, and tenant/role permissions.

## Priority model

- **P0:** data corruption or loss, cross-tenant exposure, deadlock-driven outage, unsafe failover, or connection-pool collapse.
- **P1:** a material transaction, isolation, lock, index, query-load, replica, or pool defect.
- **P2:** a lower-risk but concrete efficiency, observability, or schema-maintainability issue.
