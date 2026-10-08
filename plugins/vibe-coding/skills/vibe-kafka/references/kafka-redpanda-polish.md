# Kafka Redpanda Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Kafka Redpanda improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Keep topic/key/schema/consumer-state changes compatible through staged producers and consumers; use explicit versioning or dual-read/write when required.
- Place offset commits at the real completion boundary and make external side effects idempotent; do not call broker exactly-once a guarantee for arbitrary external systems.
- Bound retries and processing concurrency, pause/resume deliberately, and preserve partition ownership/order where required.
- Use producer transactions only with a complete transactional topology and reader isolation; otherwise state the duplicate/loss contract explicitly.
- Treat partition-count changes, compaction keys, retention, and migration feature differences as data-contract changes with replay implications.

## Validation

- Run serializer/schema compatibility and repository integration tests against the supported broker implementation(s).
- Exercise duplicate delivery, process crash at commit boundaries, consumer rebalance, poison record, partition unavailability, and graceful shutdown.
- Report observed loss/duplicate/order/lag/recovery behavior and any broker-level gates not reproduced locally.
