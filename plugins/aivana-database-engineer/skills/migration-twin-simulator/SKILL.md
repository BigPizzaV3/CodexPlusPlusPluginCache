---
name: migration-twin-simulator
description: Builds a SQL Server to PostgreSQL migration twin and rates query-family performance risk.
---

# Migration Twin Simulator

Run:

```bash
node runtime/runTool.js migration_twin_simulator '{"sourceEngine":"sqlserver","targetEngine":"postgres","queries":[{"queryId":"q1","sql":"SELECT TOP 100 * FROM events"}]}'
```

Returns query risks, overall risk, and migration next actions.
