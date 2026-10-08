---
name: sql-code-review-assistant
description: Reviews SQL like a senior DBA and returns PR-ready comments and decision.
---

# SQL Code Review Assistant

Run:

```bash
node runtime/runTool.js sql_code_review_assistant '{"sql":"SELECT * FROM orders WHERE LOWER(status) = ''paid''","context":"pull_request"}'
```

Returns review comments, severities, and review decision.
