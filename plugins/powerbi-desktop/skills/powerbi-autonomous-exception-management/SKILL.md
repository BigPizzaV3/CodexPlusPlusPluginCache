---
name: powerbi-autonomous-exception-management
description: Use when turning autonomous Power BI planning deviations into managed exceptions, including revenue gaps, risky backlog, unrealistic targets, biased models, sparse segments, owner hints, status, escalation, and closure evidence.
---

# Power BI Autonomous Exception Management

Use this skill when every planning deviation should become a traceable exception rather than a dashboard comment.

## Exception types

- `budget_gap`
- `roll_gap`
- `backlog_at_risk`
- `delivery_risk`
- `model_biased`
- `sparse_segment`
- `target_infeasible`
- `human_override_required`
- `data_quality_blocker`

## Workflow

1. Detect exceptions from forecast, quality, scenario, constraint, and action outputs.
2. Deduplicate by month, customer, product, issue type, and root cause.
3. Assign severity from revenue impact, confidence, urgency, and controllability.
4. Suggest owner hints from customer hierarchy, sales group, product line, or region.
5. Track status and closure evidence.

## Required outputs

- `exception_id`
- `forecast_month`
- `exception_type`
- `customer`
- `product`
- `revenue_impact`
- `severity`
- `owner_hint`
- `status`
- `next_action`
- `evidence`

## Guardrails

- Every severe exception needs an action, owner hint, or explicit reason to defer.
- Do not close exceptions automatically without actuals, owner response, or rule-based evidence.
