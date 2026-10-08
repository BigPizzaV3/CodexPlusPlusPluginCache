# Idempotency & Concurrency Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Idempotency & Concurrency improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Enforce uniqueness/versioning at the authoritative boundary and return the prior result or stable terminal status for duplicates.
- Use fencing/version checks for leased work and reject stale completion.
- Keep critical sections small and avoid lock-based coordination when a store-level atomic operation fits existing architecture.
- Synchronize retries, acknowledgements, status, cleanup, metrics, and tests with the concurrency contract.

## Validation

- Run deterministic concurrent/duplicate/crash/timeout/stale-worker tests and repository race detectors where available.
- Verify side-effect count, final state/version, lock/lease cleanup, and duplicate response.
- List distributed timing or multi-node gates not exercised.
