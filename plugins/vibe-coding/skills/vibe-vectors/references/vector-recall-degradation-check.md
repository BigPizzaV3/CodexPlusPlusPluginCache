# Vector Recall & Degradation Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Compare exact/brute-force or trusted baseline results with ANN across representative labelled queries and filter selectivity; report recall and ranking distributions.
- Run concurrent ingestion/query with duplicate upserts, partial batch failure, deletes, and stale source versions; verify convergence.
- Attempt all query variants across tenants and filters; prove authorization cannot be omitted or bypassed.
- Build/rebuild a new index/collection, shadow or dual-read it, cut over by alias/config, and verify rollback plus completeness.
- Degrade replicas/index availability or capacity in a test environment and verify bounded latency, quality floor, backpressure, and fallback/no-result policy.
