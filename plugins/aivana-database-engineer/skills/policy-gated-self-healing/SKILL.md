---
name: policy-gated-self-healing
description: Creates safe self-healing runbooks with policy, rollback, and approval gates instead of blind production changes.
---

# Policy Gated Self Healing

Run:

```bash
node runtime/runTool.js policy_gated_self_healing '{"incidentType":"lock_pressure","riskLevel":"high","environment":"production"}'
```

Returns execution mode and gated runbook.
