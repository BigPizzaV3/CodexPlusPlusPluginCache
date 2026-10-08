---
name: operator-goal-monitor
description: Converts SLO, cost, compliance, and incident goals into ongoing watch criteria and escalation policy.
---

# Operator Goal Monitor

## Use when
- A platform team wants an autonomous operator to watch operating goals over time.

## Governance
- Monitoring can trigger dry-run experiments, not direct remediation.

## Output
- `watchCriteria`, `escalationPolicy`, `decision`, `safeNextAction`
