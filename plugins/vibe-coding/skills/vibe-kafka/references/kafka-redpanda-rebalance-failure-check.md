# Kafka Redpanda Rebalance & Failure Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Produce duplicate keys and retry after ambiguous acknowledgement; verify ordering and deduplication contract.
- Crash consumers before/after side effect and before/after offset commit; verify duplicate/loss behavior and replayability.
- Trigger a group rebalance during long processing and verify ownership, pause/resume, commit, and shutdown semantics.
- Inject incompatible/poison records and verify bounded retry, quarantine metadata, alerting, and controlled replay.
- Test broker/partition loss or throttling in a disposable cluster and measure lag, backpressure, recovery, and durability settings.
