---
name: ai-anomaly-triage
description: Correlate query stats, telemetry, policy decisions, and replay memory into deterministic incident hypotheses and next-best actions.
---

# AI Anomaly Triage

Use this skill when an operator asks why database behavior changed, whether a
deployment caused a regression, or what to investigate first during an incident.

Run:

```bash
node runtime/runTool.js ai_anomaly_triage '{"engine":"postgres","database":"analytics","deploymentId":"deploy-42","incidentWindowMinutes":45}'
```

The tool is offline and deterministic. It combines workload stats,
telemetry-correlation output, policy-memory signals, and recent replay context.
It returns an anomaly score, root-cause hypotheses, next-best actions, and
explainability fields listing the exact signal families used.
