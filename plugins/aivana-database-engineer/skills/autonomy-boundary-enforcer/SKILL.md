---
name: autonomy-boundary-enforcer
description: Enforces closed-loop dry-run boundaries and blocks autonomous production apply.
---

# Autonomy Boundary Enforcer

## Use when
- A proposed autonomous action must be checked against execution boundaries.

## Governance
- Production apply and real DDL execution require human approval.
- Only dry-run actions are autonomously allowed.

## Output
- `boundary`, `requiredApprovals`, `decision`, `safeNextAction`
