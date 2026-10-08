---
name: advisor-confidence-grader
description: Grade advisory recommendations by evidence strength and identify missing proof before production change.
---

# Advisor Confidence Grader

Run:

```bash
node runtime/runTool.js advisor_confidence_grader '{"evidence":{"hasLivePlan":true,"hasWaits":true,"hasRollback":true}}'
```

Returns evidence grade, score, missing evidence, and required next evidence.
