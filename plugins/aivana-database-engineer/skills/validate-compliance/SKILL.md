---
name: validate-compliance
description: "Validate planned database operation against GDPR, HIPAA, SOC2, SOX, and ISO27001-aligned checks."
---

# Validate Compliance

## Use when
- Migration, retention, or query policy needs explicit compliance verification.

## Workflow
1. Map action to compliance domains.
2. Check for PII movement, retention conflicts, audit gaps, and access boundary breaches.
3. Generate compliance gap list and mandatory remediation items.
4. Produce approval-ready summary.

## Governance
- Do not auto-approve if any unresolved compliance blocker exists.
- Require explicit acknowledgement of residual risk.

## Output
- `complianceStatus`, `violations`, `requiredFixes`, `approvalChecklist`
