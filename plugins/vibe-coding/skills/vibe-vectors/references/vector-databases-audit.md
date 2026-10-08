# Vector Databases Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit vector retrieval from embedding/version and collection schema through tenant filtering, ingestion, ANN recall/latency, reindex, snapshot, and fallback.

## Domain invariants

- Embedding model/version, preprocessing, dimension, datatype, normalization, distance metric, collection/namespace, and payload schema are versioned as one compatibility contract.
- Tenant/authorization filters are mandatory at the authoritative query boundary and cannot be omitted by a caller or applied only after cross-tenant candidates are exposed.
- Source document/chunk IDs, content/version hash, embedding version, upsert idempotency, tombstone/delete, and reconciliation prevent stale or duplicate vectors.
- Payload/filter indexes support actual filter combinations; filter semantics under ANN are understood and tested for both isolation and recall.
- ANN parameters and index build state are evaluated against a representative labelled set using recall/precision/ranking and latency distributions, not anecdotal queries.
- Capacity includes vector count/dimension, replicas/shards, index build memory/disk, compaction, write rate, query concurrency, and hot tenants.
- Model/schema/index migration uses new collection or compatible staged rebuild, backfill/checkpoint, dual-read/write/shadow evaluation, cutover, and rollback.
- Snapshots/backups and restore include collection config, payload/schema, aliases, and embedding compatibility; degradation has an explicit exact/fallback/no-result policy.

## Audit method

1. Map source/version → chunk/preprocess → embedding model → collection/payload/index → filtered query/rerank → result citation/authorization → delete/reindex.
2. Inspect every writer and query path for shared embedding/schema/tenant contracts and locate stale-data reconciliation.
3. Build or use a representative evaluation set segmented by tenant, filter selectivity, language/domain, rare terms, and hard negatives.
4. Measure recall/ranking and p50/p95/p99 latency across ANN parameters, dataset size, concurrent query/write load, and filtered cases.
5. Trace partial ingestion, duplicate retry, deletion, index-build failure, snapshot/restore, cutover, and fallback behavior.

## Priority model

- **P0:** ACL or tenant leakage, destructive index/data loss, or materially unsafe retrieval in a critical path.
- **P1:** a material embedding, filtering, recall, freshness, indexing, load, or degradation defect.
- **P2:** a lower-risk but concrete evaluation, cost, observability, or maintainability issue.
