# Data Model Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Data Model improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Change the canonical model and update all directly affected contracts; do not create adapter-only shadow truth.
- Use expand/migrate/contract for incompatible live changes and make backfills idempotent/resumable.
- Add constraints only after validating/backfilling existing data and define violation handling.
- Synchronize generated types, fixtures, analytics, docs, retention, and operator checks.

## Validation

- Run schema/type/migration/model/API/event/data-quality tests.
- Exercise old/new compatibility, backfill retry/resume, constraint violations, deletion/retention, and rollback/forward-fix.
- Report production data volume/distribution and maintenance-window gates separately.
