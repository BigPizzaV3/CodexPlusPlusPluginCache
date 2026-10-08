---
name: powerbi-causal-counterfactual-forecasting
description: Use when adding causal and counterfactual thinking to Power BI sales forecasts, including working days, holidays, delivery constraints, price changes, product lifecycle, stockouts, campaigns, customer behavior, and best/base/worst case simulations.
---

# Power BI Causal Counterfactual Forecasting

Use this skill when the user asks why a forecast changes, what causes a revenue gap, or what would happen under alternative assumptions.

## Feature families

- calendar: working days, holidays, month length, fiscal periods
- order flow: order age, requested delivery, planned delivery, status, backlog value
- customer behavior: recency, frequency, average order value, churn or reactivation signals
- product lifecycle: new product, mature product, discontinued product, replacement product
- operations: supply constraints, delivery delay, stockout indicators
- commercial: price change, discounting, campaign, sales initiative, budget/roll assumptions

## Workflow

1. Separate correlation from actionable cause. Do not claim causality without a plausible mechanism and supporting time sequence.
2. Build counterfactuals:
   - if backlog conversion improves
   - if delivery slips
   - if customer demand follows prior year
   - if budget pressure is ignored
   - if low-confidence segments are excluded
3. Quantify sensitivity:
   - revenue impact
   - probability
   - confidence
   - affected customer/product/month
4. Explain the causal story in one sentence per material driver.

## Required outputs

- `forecast_month`
- `driver`
- `driver_type`
- `base_value`
- `counterfactual_value`
- `revenue_impact`
- `confidence`
- `evidence`
- `actionability`

## Guardrails

- Mark drivers as `hypothesis` when the data only supports association.
- Avoid overfitting small customer/product segments.
- Use backtests to prove that adding a driver improves WAPE or bias before making it a default weight.
