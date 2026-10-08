---
name: production-readiness-check
description: Check whether CodexDB Agent is safe to run in production with live database connections, signing, audit replay, drivers, and complete skill metadata.
---

# Production Readiness Check

Use this skill before enabling CodexDB Agent against production SQL Server or PostgreSQL.

Run:

```bash
node runtime/runTool.js production_readiness_check '{"environment":"production","engine":"postgres"}'
```

The tool returns:

- `ready`: true only when no production blockers remain.
- `blockingIssues`: hard deployment blockers.
- `warnings`: non-blocking operational risks.
- `checks`: individual readiness checks for manifests, skill docs, live mode, drivers, migration signing, and audit replay.

Production should set:

- `CODEXDB_REQUIRE_LIVE_CONNECTION=true`
- `CODEXDB_MIGRATION_SIGNING_KEY`
- engine-specific connection variables such as `CODEXDB_POSTGRES_CONNECTION_STRING` or `CODEXDB_SQLSERVER_SERVER`.
