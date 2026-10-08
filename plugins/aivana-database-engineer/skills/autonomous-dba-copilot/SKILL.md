---
name: autonomous-dba-copilot
description: Orchestrates a DBA loop from evidence collection through confidence grading, experiment design, ticket prep, and rollback.
---

# Autonomous DBA Copilot

Run:

```bash
node runtime/runTool.js autonomous_dba_copilot '{"question":"Checkout is slow","sql":"SELECT * FROM orders","evidence":{"hasLivePlan":true,"hasWaits":true,"hasRollback":true}}'
```

Returns loop steps, decision package, next action, and evidence grade.
