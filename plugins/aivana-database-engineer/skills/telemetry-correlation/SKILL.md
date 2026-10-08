---
name: telemetry-correlation
description: "Correlate deployment, lock, query-plan, and replication telemetry into incident evidence."
---

# Telemetry Correlation

## Use when
- User asks whether a deployment or runtime signal caused a database incident.
- Incident response needs correlated observability evidence.

## Workflow
1. Collect lock, query-plan, and replication signals.
2. Build causal graph and severity summary.
3. Attach OpenTelemetry-compatible references for follow-up.

## Governance
- Use correlation as evidence for triage, not automatic proof.
- Escalate high-severity results through incident and compliance agents.

## Output
- `deploymentId`, `correlation`, `telemetryRefs`
