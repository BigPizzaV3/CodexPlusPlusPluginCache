---
name: fleet-health-scorecard
description: Ranks database fleet health by latency, error-budget burn, and replication lag.
---

# Fleet Health Scorecard

Run:

```bash
node runtime/runTool.js fleet_health_scorecard '{"databases":[{"name":"prod-a","p95Ms":800,"errorBudgetBurnRate":3,"replicationLagSeconds":10}]}'
```

Returns ranked scorecard and health status.
