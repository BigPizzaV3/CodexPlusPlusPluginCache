---
name: evidence-pack-generator
description: Build a DBA-ready performance case file with SQL, plan, waits, recommendation, rollback, and evidence grade.
---

# Evidence Pack Generator

Run:

```bash
node runtime/runTool.js evidence_pack_generator '{"question":"Why is checkout slow?","sql":"SELECT * FROM orders","recommendation":"add covering index"}'
```

Returns executive summary, case file sections, evidence grade, and missing evidence.
