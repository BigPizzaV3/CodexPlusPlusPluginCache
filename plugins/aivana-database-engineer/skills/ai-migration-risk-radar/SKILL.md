---
name: ai-migration-risk-radar
description: Score migration blast radius and produce a rollback rehearsal plan before schema changes reach production.
---

# AI Migration Risk Radar

Use this skill before proposing, signing, or applying migrations.

Run:

```bash
node runtime/runTool.js ai_migration_risk_radar '{"engine":"sqlserver","database":"app_prod","schema":"public","migrationSql":"CREATE INDEX ix_orders_status ON orders(status)"}'
```

The tool computes blast radius from catalog metadata, risk classification,
PII sensitivity, table size hints, and policy preflight. It returns a release
recommendation and dry-run rollback rehearsal checklist.
