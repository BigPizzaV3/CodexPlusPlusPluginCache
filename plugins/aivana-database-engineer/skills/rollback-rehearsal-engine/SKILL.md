---
name: rollback-rehearsal-engine
description: Creates rollback rehearsal steps and proof checklist for database changes.
---

# Rollback Rehearsal Engine

Run:

```bash
node runtime/runTool.js rollback_rehearsal_engine '{"change":"CREATE INDEX ix_orders_status ON orders(status)","rollback":"DROP INDEX ix_orders_status","validationQueries":["SELECT count(*) FROM orders"]}'
```

Returns rehearsal status and ordered rollback validation steps.
