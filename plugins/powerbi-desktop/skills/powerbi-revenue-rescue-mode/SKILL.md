---
name: powerbi-revenue-rescue-mode
description: Use when turning Power BI sales forecast gaps into operational rescue actions, including backlog acceleration, customer activation, product substitution, delivery escalation, gap closure ranking, and forecast-to-action recommendations.
---

# Power BI Revenue Rescue Mode

Use this skill when the user asks how to close a forecast gap, secure the month, rescue revenue, or convert forecast findings into actions.

## Workflow

1. Identify the gap by month:
   - budget gap
   - roll gap
   - prior-year gap
   - AI forecast confidence
2. Split the gap into action classes:
   - **accelerate**: open backlog likely billable if delivery or admin blockers are solved
   - **validate**: material customer/product deltas where human sales input is needed
   - **recover**: segments below seasonal or roll expectation with enough history
   - **substitute**: alternative products or customers can offset risk
   - **de-risk**: low-confidence, biased, or sparse segments should not carry the plan
3. Rank actions by expected impact, probability, owner, and deadline.
4. Produce a rescue board that can be imported into Power BI or used as a sales operations action list.

## Action scoring

Use a simple score unless a better calibrated model exists:

`impact_score = expected_revenue * confidence_weight * urgency_weight`

Confidence weights:

- high: 1.00
- medium: 0.70
- low: 0.35

Urgency weights:

- current month: 1.25
- next month: 1.00
- month +2: 0.80

## Required outputs

- `forecast_month`
- `action_type`
- `customer`
- `product`
- `expected_revenue_impact`
- `probability`
- `deadline`
- `owner_hint`
- `reason`
- `next_action`
- `risk_flag`

## Guardrails

- Never recommend actions on segments with no evidence unless marked as `exploratory`.
- Distinguish revenue that can be pulled forward from revenue that requires new demand.
- Flag actions that may improve revenue but harm margin, cash, or delivery reliability.
