# Observability Stack Audit

## Operation

Inspect the named boundary and report supported findings. Do not edit product code. Include concrete evidence, impact, the owning source, one remediation direction and a meaningful validation route. Severity follows actual impact, not a category example.

## Goal and scope

Audit metrics, logs, dashboards, alerts, and correlation as one signal contract with bounded cardinality, cost, tenancy, and operator actionability.

## Domain invariants

- Metric names, type, units, label meanings, reset behavior, scrape ownership, and aggregation match the measured phenomenon; labels are bounded and never carry user-generated identifiers or secrets.
- Recording rules preserve label semantics and reduce expensive repeated queries; alerts target user/system symptoms with explicit duration, severity, ownership, and actionable annotations.
- Grafana dashboards and alerts are provisioned from an authoritative source, bind the intended datasource/tenant, use valid variables, and show units, nulls, rates, and percentiles honestly.
- VictoriaLogs ingestion parses timestamps/streams/fields consistently, bounds stream cardinality and payload size, and applies retention/tenant access at the authoritative boundary.
- Log queries use selective filters and indexed/stream fields where supported; dashboards and alerts cannot trigger unbounded full-retention scans under normal use.
- Correlation identifiers link request/run/message traces without making logs or labels a primary datastore and without exposing credentials, personal data, or full untrusted payloads.
- Signal freshness, loss, duplicate ingestion, out-of-order data, rule evaluation delay, and no-data behavior are visible rather than silently interpreted as health.
- Telemetry volume, query concurrency, retention, dashboard refresh, and alert fan-out have explicit cost/capacity ownership.

## Audit method

1. Trace one user/system outcome through instrumentation, scrape/ingest, storage, recording/query, dashboard, alert, and runbook/owner response.
2. Inspect metric type/unit/labels and estimate cardinality from actual label domains, targets, replicas, and retention rather than a single local sample.
3. Evaluate rule expressions for aggregation, counter reset, histogram buckets, absent/no-data, evaluation window, flap, and multi-tenant labels.
4. Render/provision Grafana resources and verify datasource UID, variables, units, links, permissions, and alert ownership.
5. Inspect VictoriaLogs stream/field extraction, tenant routing, retention, query shape, ingestion failures, and backpressure/cost evidence.

## Priority model

- **P0:** loss of visibility for a critical failure, PII/secret exposure, alert storm, or unbounded ingestion/cardinality cost.
- **P1:** a material metric, log, dashboard, alert, retention, or query-semantics defect.
- **P2:** a lower-risk but concrete signal quality, usability, cost, or maintainability issue.
