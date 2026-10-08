---
name: slo-impact-guard
description: Translates SQL latency regressions into SLO status, error-budget burn, impacted traffic, and executive summary.
---

# SLO Impact Guard

Run:

```bash
node runtime/runTool.js slo_impact_guard '{"sloTargetMs":300,"observedP95Ms":750,"requestsPerMinute":12000,"criticalPath":"checkout"}'
```

Returns SLO breach status, burn rate, impacted requests, and actions.
