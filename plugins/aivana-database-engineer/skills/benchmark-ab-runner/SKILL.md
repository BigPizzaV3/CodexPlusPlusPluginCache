---
name: benchmark-ab-runner
description: Compare baseline and candidate query performance metrics and declare a benchmark winner.
---

# Benchmark A/B Runner

Run:

```bash
node runtime/runTool.js benchmark_ab_runner '{"baseline":{"p95Ms":300,"cpuMs":80},"candidate":{"p95Ms":190,"cpuMs":55}}'
```

Returns deltas, winner, and verdict.
