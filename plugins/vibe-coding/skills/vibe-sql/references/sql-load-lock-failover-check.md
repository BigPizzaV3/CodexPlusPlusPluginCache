# SQL Load Lock & Failover Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Drive pool saturation across representative application replicas and verify bounded acquire wait, timeout, admission, and reserved recovery capacity.
- Run the changed query with representative skew/cardinality and compare plan, rows, buffers/I/O, memory/temp spill, and latency distribution.
- Execute conflicting transactions to prove isolation/constraint behavior, lock order, deadlock/serialization retry, and final invariant.
- Interrupt and resume schema migration/backfill while old/new application versions run; verify compatibility, load control, and rollback/forward fix.
- Simulate connection reset/primary failover or use a test proxy; verify pool recovery, session reset, transaction outcome ambiguity, and replica consistency.
