---
name: incident-analysis
description: "Correlate lock, query, and replication signals into causal incident hypotheses with prioritized remediation guidance."
---

# Incident Analysis

## Use when
- User asks why an incident happened or wants a causal chain.
- Response to operational regressions in latency, deadlocks, or replication lag.

## Workflow
1. Pull recent lock, query, and replication signal snapshots.
2. Correlate temporal overlap and severity transitions.
3. Build top incident hypotheses with confidence and remediation order.
4. Return expected validation probes and rollback readiness.

## Governance
- Do not trigger any destructive action.
- Mark confidence clearly before making any operational recommendation.

## Output
- `timeline`, `incidentHypotheses`, `confidence`, `recommendedActions`
