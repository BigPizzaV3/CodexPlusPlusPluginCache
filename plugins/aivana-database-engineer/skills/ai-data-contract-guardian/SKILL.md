---
name: ai-data-contract-guardian
description: Check schema drift, required columns, PII declaration, retention, and governance controls against a declared data contract.
---

# AI Data Contract Guardian

Use this skill when validating table contracts before deploys, migrations, or
data product releases.

Run:

```bash
node runtime/runTool.js ai_data_contract_guardian '{"engine":"postgres","database":"analytics","schema":"public","table":"events","contract":{"requiredColumns":["event_id","user_email","created_at"],"piiColumns":["user_email"],"retentionDays":90}}'
```

The output includes contract findings, a contract status, required governance
controls, and evidence from catalog metadata. It is deterministic and does not
call an external AI service.
