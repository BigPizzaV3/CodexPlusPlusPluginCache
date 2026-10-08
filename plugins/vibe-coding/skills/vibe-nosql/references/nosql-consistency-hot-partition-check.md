# NoSQL Consistency & Hot Partition Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Generate representative skew/hot keys and verify throttling, latency, partition distribution, capacity response, and recovery.
- Run conflicting conditional/transactional updates and retries; verify final invariant and conflict/error mapping.
- Interrupt topology/connection paths and verify bounded selection/connect/socket timeouts, retries, pool recovery, and stale-read contract.
- Expire data and interrupt change-stream consumers; verify asynchronous TTL expectations, resume token, duplicates, retention gap, and full resync.
- Exercise each changed query/index with representative cardinality and pagination; reject unbounded scan/fan-out behavior.
