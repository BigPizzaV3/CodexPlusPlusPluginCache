# Redis Queue Load & Recovery Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Duplicate the same job/operation and crash around side effect/completion; prove stable idempotency and terminal state.
- Expire a BullMQ lock or Stream ownership during long work and verify stall/reclaim does not permit stale double completion.
- Exercise BullMQ flow child failure/rate limit and ARQ retry/defer/cron overlap using deterministic time where possible.
- Restart workers and interrupt Redis connectivity; verify bounded reconnect, no connection storm, pending recovery, and graceful shutdown.
- Drive representative backlog and payload size; measure memory/eviction, command latency, queue age, cleanup, and downstream backpressure.
