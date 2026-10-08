---
name: semantic-incident-predictor
description: Classify potential database incident risks from supplied signals using heuristic analysis.
---

# semantic_incident_predictor

Use this skill to predict likely database incident classes from semantic workload and telemetry signals.

Governance:
- Prediction only.
- Use results to choose dry-run diagnostics, not remediation.
- Escalate high-likelihood production risks to evidence collection.

Output contract:
- `usp: "semantic_incident_predictor"`
- `workload`, `predictions`, `decision`, `safeNextAction`
- `confidence`, `source: "analysis"`
