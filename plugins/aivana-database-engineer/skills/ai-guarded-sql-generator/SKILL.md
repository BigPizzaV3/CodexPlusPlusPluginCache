---
name: ai-guarded-sql-generator
description: Generates bounded read SQL with tenant, policy, audit, and performance guardrails.
---

# AI Guarded SQL Generator

Run:

```bash
node runtime/runTool.js ai_guarded_sql_generator '{"intent":"list recent paid orders","table":"orders","filters":{"status":"paid"},"limit":100,"tenantId":"tenant-a"}'
```

Returns generated SQL, guardrails, and risk classification.
