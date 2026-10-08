# Performance Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Performance improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Change the limiting owner rather than hiding latency with unbounded concurrency, cache, retry, or batching.
- Preserve cancellation, deadlines, fairness, memory bounds, and failure visibility.
- Keep cache keys, invalidation, query semantics, and result ordering explicit when optimization changes data access.
- Remove temporary profiling noise or gate it safely before completion.

## Validation

- Re-run the same measurement shape and report before/after evidence with variance and environment limits.
- Run correctness tests for the optimized path and representative failure/cancellation cases.
- Inspect resource ceilings and downstream call amplification under bounded concurrency.
