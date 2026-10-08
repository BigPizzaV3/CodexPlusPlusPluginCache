---
name: dry-run-action-critic
description: Critiques proposed dry-run actions for blast radius, rollback gaps, tenant risk, and weak evidence.
---

# Dry-Run Action Critic

## Use when
- A candidate remediation needs adversarial safety review before recommendation.

## Governance
- Destructive or schema-changing actions must be escalated.
- Missing rollback, tenant, or live-plan evidence must be reported.

## Output
- `criticisms`, `decision`, `confidence`, `safeNextAction`
