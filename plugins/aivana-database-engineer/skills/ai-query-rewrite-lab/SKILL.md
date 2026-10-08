---
name: ai-query-rewrite-lab
description: Generate safe query rewrite candidates with deterministic explainability without executing SQL.
---

# AI Query Rewrite Lab

Use this skill to propose safer or cheaper SQL variants before running EXPLAIN
or executing a statement.

Run:

```bash
node runtime/runTool.js ai_query_rewrite_lab '{"engine":"postgres","database":"analytics","schema":"public","table":"events","sql":"SELECT * FROM events WHERE user_email = ''a@example.com''"}'
```

The lab never executes SQL. It returns rewrite candidates, expected impact
ranges, applied rewrite rules, and a safety block that marks the output as
analysis-only.
