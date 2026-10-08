# Kafka Redpanda Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit a Kafka or Redpanda stream from topic/key/schema and producer durability through consumer offsets, retries, rebalance, and replay.

## Domain invariants

- Ordering claims are scoped to one partition and a stable key/partitioner; partition count and key distribution meet throughput and hot-key constraints.
- Producer acknowledgements, idempotence, retries, in-flight ordering, delivery timeout, batching, compression, and transaction settings match the required loss/duplicate/latency trade-off.
- A consume-process-produce flow that claims atomicity coordinates output records and consumed offsets in one transaction and uses compatible isolation on readers.
- Offsets are committed only at the selected processing boundary; duplicate delivery is safe through idempotency, state-store semantics, or an explicit at-most-once decision.
- Consumer assignment, poll/processing time, heartbeat/session settings, cooperative/static membership, pause/resume, and shutdown prevent rebalance loops and abandoned work.
- Schema IDs/contracts and compatibility policy cover producers, consumers, replay, defaults, nullability, key evolution, and unknown fields.
- Retry/DLQ/quarantine preserves original topic/partition/offset/key/schema/error/attempt context and has bounded retention plus a controlled replay path.
- Topic durability, replication, min in-sync replicas, retention/compaction, quotas, ACLs, and Kafka/Redpanda feature compatibility are environment-owned and observable.

## Audit method

1. Map producer → serializer/schema → topic/config/key/partition → consumer group → offset/state/side effect → retry/DLQ/replay.
2. Trace crash windows before send, after broker ack, before/after side effect, before/after offset commit, during transaction, and during rebalance/shutdown.
3. Inspect effective client and broker/topic settings together; reject guarantees inferred from one client flag in isolation.
4. Evaluate key distribution, partition capacity, lag, poll duration, batching, retry amplification, and downstream backpressure using representative traffic evidence.
5. Verify schema compatibility and operational migration behavior against both Kafka and Redpanda when portability is claimed.

## Priority model

- **P0:** record loss, duplicate irreversible effect, tenant/data leak, broken ordering invariant, or cluster-wide availability failure.
- **P1:** a material partitioning, schema, offset, rebalance, replay, or backpressure defect.
- **P2:** a lower-risk but concrete lag, observability, operability, or efficiency issue.
