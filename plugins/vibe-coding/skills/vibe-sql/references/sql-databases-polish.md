# SQL Databases Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed SQL Databases improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Fix ownership at database constraint/transaction/query boundary before adding application-side coordination.
- Keep transactions short, avoid network calls inside them, and implement bounded retry only for classified transient serialization/deadlock failures.
- Use online/staged migration patterns supported by the target database and make backfills resumable with progress/checkpoint and load control.
- Set pool and timeout values from deployment-wide budgets and expose acquire wait, usage, errors, query latency, locks, and lag.
- Preserve read/write routing and tenant enforcement during failover and mixed-version rollout; regenerate clients only from authoritative schema changes.

## Validation

- Run repository SQL/migration tests against the supported database version, not only mocks or an incompatible in-memory engine.
- Exercise concurrent invariant conflicts, pool saturation, cancellation, lock timeout/deadlock, migration restart, replica lag/read-after-write, and reconnect/failover where feasible.
- Capture plans and bounded load measurements with representative data shape; state production-volume/topology assumptions explicitly.
