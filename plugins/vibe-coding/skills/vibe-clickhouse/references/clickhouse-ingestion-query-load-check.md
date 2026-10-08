# ClickHouse Ingestion & Query Load Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Ingest duplicate/retried/partially failed batches around source checkpoint and dedup windows; verify exact observed duplicate/loss semantics.
- Run representative skewed queries and compare pruning, rows/bytes, memory/spill, p95/p99 latency, and concurrent workload limits.
- Interrupt a replica or Distributed destination in a disposable cluster; verify queueing, lag, recovery, and read consistency.
- Apply staged schema/materialized-view/mutation/backfill on representative parts; verify old/new writers/readers and rollback/forward fix.
- Drive merge/part pressure and verify insertion throttling, disk capacity, alerts, and recovery without unbounded mutations.
