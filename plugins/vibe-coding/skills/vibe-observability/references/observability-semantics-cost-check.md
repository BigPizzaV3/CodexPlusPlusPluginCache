# Observability Semantics & Cost Check

## Operation

Verify the selected invariant through bounded scenarios in an authorized environment. Do not turn verification into unrelated implementation. Return passed, failed or blocked, with actual evidence and any missing required scenario.

## Scenarios

- Generate representative metrics/logs across tenants, status classes, replicas, and error paths; measure series/stream growth and ingestion rejection.
- Run recording/alert rules through normal, reset, missing, stale, burst, and recovery windows.
- Provision dashboards/alerts in a disposable environment and validate datasource, variables, units, permissions, links, and query errors.
- Exercise VictoriaLogs ingestion backpressure, malformed timestamps, tenant mismatch, retention boundary, and bounded query concurrency.
- Compare end-to-end signal latency and correlation from emitted event to operator-visible dashboard/alert.
