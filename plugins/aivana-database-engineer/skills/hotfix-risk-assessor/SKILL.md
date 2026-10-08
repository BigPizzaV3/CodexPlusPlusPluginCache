---
name: hotfix-risk-assessor
description: Rates emergency database hotfix risk and blocks unsafe production changes.
---

# Hotfix Risk Assessor

Run:

```bash
node runtime/runTool.js hotfix_risk_assessor '{"change":"ALTER TABLE orders ADD COLUMN priority int NOT NULL DEFAULT 0","environment":"production","hasRollback":false}'
```

Returns risks and decision.
