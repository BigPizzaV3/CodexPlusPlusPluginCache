---
name: enforce-policy
description: "Evaluate request against governance policies and either permit, gate, or block execution."
---

# Enforce Policy

## Use when
- Pre-execution gating is needed for write/read operations.
- User asks why an action is disallowed or delayed.

## Workflow
1. Resolve active policies for environment, user role, and data classification.
2. Evaluate action against allow/deny and approval matrix.
3. Return decision and required controls to proceed.
4. Persist decision in audit trail.

## Governance
- Deny-by-default across critical policy mismatches.
- Escalate critical violations to Compliance Agent workflow.

## Output
- `decision`, `requiredControls`, `exceptions`, `auditReference`
