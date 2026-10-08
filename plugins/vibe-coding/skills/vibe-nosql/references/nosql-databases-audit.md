# NoSQL Databases Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit a NoSQL data path against the selected engine's real atomicity, partitioning, index, consistency, TTL, change-stream, and connection capabilities.

## Domain invariants

- The selected engine/version and deployment topology are explicit; SQL or another NoSQL engine's transaction/consistency assumptions are not imported implicitly.
- Primary/partition key and document/item boundaries align with access patterns, write contention, size limits, tenant isolation, and atomic update scope.
- Cross-document/item invariants use supported transactions, conditional writes/version checks, or an explicit asynchronous reconciliation model.
- Partition/shard distribution, hot keys, monotonic keys, fan-out, and resharding behavior remain within throughput and storage limits under real skew.
- Every query has an intentional index/access path and bounded result/page behavior; scans, unindexed sorts, and N+1 fan-out are visible and justified.
- Read/write concern or consistency level, retryable writes, causal/read-after-write expectations, and conflict resolution are explicit per operation.
- TTL expiry is treated according to engine semantics (often asynchronous), and change streams/CDC preserve resume token, ordering scope, duplicate handling, retention, and resync behavior.
- Client pools, selection/connect/socket/server-operation timeouts, retry policies, topology discovery, and failover are bounded across deployment replicas.

## Audit method

1. Identify engine/version/topology and map key/document model, access patterns, indexes, consistency settings, TTL, CDC, and connection ownership.
2. Trace create/update/delete/read and concurrent conflict paths, including duplicate requests, partial multi-item work, retry, failover, and stale reads.
3. Analyze partition-key distribution and query/index shape using representative cardinality/skew rather than uniform toy data.
4. Inspect TTL/change-stream lag, resume-token loss, duplicate/out-of-order events, resync, and downstream idempotency.
5. Calculate total pool and in-flight demand and verify timeout/retry layering under node loss or topology change.

## Priority model

- **P0:** data loss, cross-tenant exposure, consistency violation in a critical path, or hot-partition service collapse.
- **P1:** a material partitioning, conditional-write, index, TTL, load, or recovery defect.
- **P2:** a lower-risk but concrete efficiency, observability, or maintainability issue.
