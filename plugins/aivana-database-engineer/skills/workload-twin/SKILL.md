---
name: workload-twin
description: Simulate workload scenarios such as traffic growth, added indexes, dropped indexes, and PII-sensitive workload risk.
---

# Workload Twin

Use this skill to estimate how workload behavior changes under a proposed
traffic or indexing scenario.

Run:

```bash
node runtime/runTool.js workload_twin '{"engine":"postgres","database":"analytics","schema":"public","table":"events","scenario":{"trafficGrowthPct":30,"addIndex":["user_email"],"dropIndex":[]}}'
```

The tool returns baseline and projected p95, scenario findings, and a recommended
experiment.
