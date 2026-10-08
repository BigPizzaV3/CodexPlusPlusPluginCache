---
name: production-rollout-orchestrator
description: Combine production readiness, verification gates, and migration risk into a Go/No-Go rollout decision.
---

# Production Rollout Orchestrator

Run:

```bash
node runtime/runTool.js production_rollout_orchestrator '{"environment":"production","engine":"postgres","database":"analytics","schema":"public","table":"events","proposedSql":"CREATE INDEX ix_events_created_at ON events(created_at)"}'
```

Returns rollout gates, evidence, a Go/No-Go decision, and next actions.
