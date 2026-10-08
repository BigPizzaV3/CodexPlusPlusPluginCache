# Redis Job Queues Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit Redis-backed cache, Streams, BullMQ, and ARQ lifecycles across keys, atomicity, worker leases, retries, memory, persistence, and recovery.

## Domain invariants

- Key names encode environment/tenant/entity/version intentionally, have an ownership and TTL policy, and use compatible hash-tagging when cluster multi-key atomicity is required.
- Connection pools, command/socket/connect timeouts, retry/backoff, health checks, and blocking commands are bounded per process and deployment replica.
- Atomic state transitions use one Redis command, transaction, or reviewed script; partial multi-key updates cannot silently corrupt queue/cache state.
- maxmemory/eviction and persistence/replication settings match whether data is reconstructible cache, durable-ish queue state, or coordination state.
- Redis Streams consumers acknowledge after processing, inspect pending entries, reclaim only stale ownership, and retain/trim data without losing required replay.
- BullMQ job IDs, lock duration/renewal, stalled handling, attempts/backoff, flows, rate limits, delayed jobs, and cleanup preserve idempotency and parent/child completion semantics.
- ARQ job uniqueness, retry/defer/cron, timeout, health, result retention, and worker shutdown match its delivery semantics rather than assuming Celery/BullMQ behavior.
- Queue retention removes completed/failed payloads only after audit/retry needs; sensitive job data is minimized and not embedded indefinitely.

## Audit method

1. Classify each Redis keyspace as cache, queue, stream, lock/lease, rate limit, dedup record, or durable state and map its TTL/eviction/persistence owner.
2. Trace enqueue → schedule/delay → reserve/claim → heartbeat/lock → side effect → ack/complete/fail → retry/DLQ/cleanup for the actual framework.
3. Inspect crash windows, duplicate job IDs, stale lock/consumer, retry storms, cron overlap, flow dependency failure, and Redis failover/reconnect.
4. Compute connection and in-flight budgets across processes/replicas and compare queue concurrency with downstream capacity and Redis memory/CPU.
5. Check scripts/transactions and cluster key-slot compatibility for every multi-key invariant.

## Priority model

- **P0:** lost jobs, duplicate irreversible effects, stale-worker writes, unbounded queue growth, or cross-tenant data exposure.
- **P1:** a material lease, retry, deduplication, scheduling, backpressure, or recovery defect.
- **P2:** a lower-risk but concrete fairness, observability, or efficiency issue.
