---
name: audit-query
description: "Generate audit-grade records for sensitive SQL operations including approvals, risk outcomes, and execution traces."
---

# Audit Query

## Use when
- User or policy requires immutable evidence trail for governance/compliance.

## Workflow
1. Capture request context, actor, environment, and policy context.
2. Attach parsed query fingerprint and risk decision.
3. Record outcomes, anomalies, and deviations.
4. Produce a signed audit artifact when applicable.

## Governance
- Ensure immutable append-only behavior.
- Redact secrets and raw sensitive literals in logs.

## Output
- `auditEntryId`, `requestFingerprint`, `decisionLog`, `approvalChain`, `trace`
