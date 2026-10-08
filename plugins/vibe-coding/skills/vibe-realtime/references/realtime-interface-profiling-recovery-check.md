# Realtime Interface Profiling & Recovery Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Profile a representative interaction and sustained event stream; attribute network, query-cache, reconciliation, and React commit costs separately.
- Run concurrent optimistic mutations with one delayed/failing and out-of-order responses/events; verify operation-scoped rollback and final server truth.
- Drop and resume WebSocket/SSE with duplicate/out-of-order events and a sequence gap; verify backoff, continuity proof, targeted invalidation/full resync, and bounded buffers.
- Toggle focus/online state and persisted cache across logout/login/tenant switch; verify no refetch storm or cross-user stale data.
- Saturate update frequency/list size and verify commit budget, virtualization/structural sharing, memory stability, input responsiveness, and recovery.
