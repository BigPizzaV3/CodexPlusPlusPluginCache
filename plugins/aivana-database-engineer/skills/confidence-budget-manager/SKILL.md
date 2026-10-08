---
name: confidence-budget-manager
description: Scores whether enough evidence exists to recommend, defer, or escalate an autonomous operator decision.
---

# Confidence Budget Manager

## Use when
- The operator must decide whether it has enough evidence to proceed with dry-run recommendation.

## Governance
- Below-threshold evidence must return `needs_more_evidence`.
- Thresholds do not permit production apply.

## Output
- `confidenceBudget`, `decision`, `missingEvidence`, `safeNextAction`
