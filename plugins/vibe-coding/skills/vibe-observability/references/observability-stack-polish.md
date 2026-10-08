# Observability Stack Polish

## Operation

Implement the requested coherent change at the owning source and update directly affected consumers. An earlier audit is optional when the user and repository already establish the target. Validate the changed behavior, then stop when the requested scope is complete.

## Goal

Implement one selected, evidence-backed Observability Stack improvement at the authoritative owner. Complete the directly affected contract without broad cleanup or redesign.

## Domain rules

- Change instrumentation and consuming rules/dashboards/alerts together when a metric or log contract changes.
- Prefer bounded stable dimensions and pre-aggregation over dropping useful semantics after cardinality has already exploded.
- Make alert states and operator action explicit; add rate limits/grouping/silences without masking persistent symptoms.
- Provision dashboards/alerts declaratively where the repository already owns them and preserve stable UIDs/references.
- Redact at collection boundaries and configure tenant/retention/query limits at the authoritative storage or gateway layer.

## Validation

- Run repository rule tests, metric linting, dashboard/provisioning validation, and representative VictoriaLogs ingest/query fixtures where available.
- Measure series/stream growth and query cost under representative dimensions; report estimates separately from observed production data.
- Trigger and recover a representative alert, including no-data and dependency-loss behavior, and verify owner/runbook annotations.
