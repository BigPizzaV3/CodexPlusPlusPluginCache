# Product Analytics Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Product Analytics improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Fix semantic ownership before adjusting dashboards; use stable event IDs or dedupe keys where delivery repeats.
- Emit at the authoritative state transition and keep client events for interaction semantics only.
- Version incompatible event/metric changes and migrate downstream models/dashboards explicitly.
- Synchronize consent/privacy, schemas, transforms, tests, dashboards, docs, and data-quality alerts.

## Validation

- Run event schema/unit/integration/data-quality/metric tests and inspect representative raw-to-dashboard rows.
- Exercise duplicate, late, missing identity, timezone/window, consent, and backfill cases.
- List warehouse freshness, production volume, and business sign-off gates separately.
