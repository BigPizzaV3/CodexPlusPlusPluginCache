# ClickHouse Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit ClickHouse table engines, partition/order keys, ingestion/deduplication, query pruning, replication/mutations, and workload limits as one analytics contract.

## Domain invariants

- Table engine, partition key, ORDER BY/primary key, sampling, TTL, codecs, and schema match dominant filters, data lifecycle, update model, and storage scale.
- Partition cardinality stays bounded and does not substitute for the ORDER BY key; queries can prune parts/granules using the actual predicates.
- Ingestion batch/async-insert, retries, dedup token/window, block identity, Distributed routing, and source offset define an explicit duplicate/loss contract.
- Replacing/Collapsing/Aggregating engines and materialized views encode their eventual merge semantics; users do not assume immediate uniqueness or final state without appropriate query logic.
- Queries bound scanned rows/bytes, joins, aggregation state, sorting, concurrency, timeout, memory, spill, and result size under representative cardinality/skew.
- Replication, quorum expectations, replica lag, Distributed tables, merges, part counts, disk, mutations, and failed inserts are observable and recoverable.
- Schema evolution/backfill/materialized-view changes account for existing parts, mixed writers/readers, mutation cost, and rollback/forward-fix.
- Connection pools, users/roles, quotas, settings profiles, workload scheduling, and read-only/tenant boundaries are deployment-wide and least privilege.

## Audit method

1. Map source batch/offset → insert path → local/distributed table → parts/replicas/views → query/user/settings → export/consumer.
2. Inspect table DDL and representative `EXPLAIN`/query-log/system-table evidence for pruning, rows/bytes, memory, parts, merges, and latency.
3. Trace retry/duplicate windows, partial insert, async insert acknowledgement, replica failure, Distributed queue, and source checkpoint boundaries.
4. Evaluate partition/key choices and materialized-view semantics against real filters, time ranges, tenant skew, late data, and update/delete requirements.
5. Calculate concurrent connections/queries/ingestion, quotas, memory, disk, merge bandwidth, and mutation/backfill pressure.

## Priority model

- **P0:** data loss or duplication in decision-critical pipelines, cluster overload, cross-tenant exposure, or unrecoverable schema/replication failure.
- **P1:** a material ingestion, partitioning, merge, query-load, distributed-table, or retention defect.
- **P2:** a lower-risk but concrete efficiency, observability, or maintainability issue.
