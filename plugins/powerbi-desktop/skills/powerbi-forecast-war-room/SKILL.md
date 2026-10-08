---
name: powerbi-forecast-war-room
description: Use when building a Power BI forecast war room or control tower for executive revenue review, forecast risk triage, top deltas, action ownership, gap closure status, confidence monitoring, and daily forecast operating rhythm.
---

# Power BI Forecast War Room

Use this skill when the user wants a management control tower around the forecast rather than only CSV outputs.

## Operating rhythm

1. Daily or weekly refresh of forecast outputs.
2. Review month-level gap to budget, roll, and prior year.
3. Open top deltas as action items.
4. Assign owner hints by customer hierarchy, product line, sales group, or region when available.
5. Track status:
   - open
   - validated
   - escalated
   - rescued
   - lost
   - ignored due to low data confidence
6. Review model quality and override trust after actuals land.

## War room views

- executive gap summary
- top risk customers/products
- backlog at risk
- rescue action board
- agent council dissent
- trust score by source
- model quality by horizon
- counterfactual scenarios

## Required outputs

- `forecast_month`
- `issue_type`
- `customer`
- `product`
- `revenue_at_risk`
- `recommended_action`
- `owner_hint`
- `status`
- `due_date`
- `confidence`
- `evidence`

## Guardrails

- Every red item needs an action or an explicit reason to ignore.
- Do not mix unvalidated AI recommendations with committed management numbers.
- Keep action status separate from model forecast values so reporting remains auditable.
