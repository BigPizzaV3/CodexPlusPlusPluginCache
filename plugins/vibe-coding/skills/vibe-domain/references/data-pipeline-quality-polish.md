# Data Pipeline & Quality Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Data Pipeline & Quality improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Make stage outputs idempotent or atomically committed and use stable batch/event identities.
- Version schemas and transforms; preserve mixed-version compatibility or gate cutover explicitly.
- Fail or quarantine on material quality violations with operator-visible recovery; do not silently coerce bad data.
- Convert production-owning notebook logic into parameterized code with tests, dependency lock, and reproducible inputs.

## Validation

- Run pipeline/schema/data-quality tests plus partial batch, retry/resume, late/duplicate, schema-change, and backfill scenarios.
- Reconcile representative source and sink counts/aggregates and inspect lineage evidence.
- List production data volume, scheduler, warehouse, and external source gates separately.
