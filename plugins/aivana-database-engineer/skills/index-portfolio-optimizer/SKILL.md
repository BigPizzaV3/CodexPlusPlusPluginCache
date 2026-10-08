---
name: index-portfolio-optimizer
description: Optimize the whole index portfolio by finding redundant, overlapping, unused, and high-write-cost indexes.
---

# Index Portfolio Optimizer

Run:

```bash
node runtime/runTool.js index_portfolio_optimizer '{"indexes":[{"name":"ix_a","columns":["status"],"reads":100,"writes":50},{"name":"ix_ab","columns":["status","created_at"],"reads":200,"writes":60}]}'
```

Returns redundant indexes, drop candidates, create candidates, and action order.
