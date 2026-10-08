---
name: performance-pr-reviewer
description: Reviews schema and migration pull requests for performance, locking, index, and rollback risks before merge.
---

# Performance PR Reviewer

Run:

```bash
node runtime/runTool.js performance_pr_reviewer '{"pullRequest":"PR-42","changes":[{"type":"add_foreign_key","table":"orders","column":"customer_id","hasSupportingIndex":false}]}'
```

Returns merge decision, findings, and required checks.
