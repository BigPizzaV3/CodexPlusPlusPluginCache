---
name: workload-impact-analyzer
description: Rank workload queries by latency, call volume, and CPU impact to identify optimization hotspots.
---

# Workload Impact Analyzer

Run:

```bash
node runtime/runTool.js workload_impact_analyzer '{"queries":[{"queryId":"q1","p95Ms":900,"calls":20,"cpuMs":70}]}'
```

Returns top impact queries and hotspots.
