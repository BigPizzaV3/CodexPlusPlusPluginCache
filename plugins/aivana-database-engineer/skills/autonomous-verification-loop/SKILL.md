---
name: autonomous-verification-loop
description: Create prove-before-apply gates for migrations, indexes, rewrites, SLOs, replay, and rollback evidence.
---

# Autonomous Verification Loop

Use this skill before applying write-like database changes.

Run:

```bash
node runtime/runTool.js autonomous_verification_loop '{"tool":"create_index","engine":"postgres","database":"analytics","schema":"public","table":"events","proposedSql":"CREATE INDEX ix_events_email ON events(user_email)"}'
```

The tool returns gates for policy, explain, replay, SLO, and rollback evidence,
plus a release decision.
