---
name: powerbi-revenue-digital-twin
description: Use when designing or running a Power BI revenue digital twin for sales forecasting, target-gap simulation, backlog-to-invoice scenarios, what-if revenue paths, budget attainment, and forecast-to-cash decision support from an open Power BI Desktop model or exported forecast CSVs.
---

# Power BI Revenue Digital Twin

Use this skill when the user wants to move beyond a static sales forecast into scenario simulation: "How do we still hit budget?", "What if delivery slips?", "Which backlog must convert?", or "Which customers/products close the revenue gap?"

## Workflow

1. Start read-only. Use the open Desktop model through `Invoke-PowerBIAIForecast.ps1` or existing forecast CSVs. Do not write to PBIX/PBIP unless explicitly requested.
2. Establish the current target gap by month: AI forecast, roll forecast, budget, actual-to-date, open backlog, expected backlog revenue.
3. Build scenario levers:
   - backlog acceleration or delay
   - conversion probability changes
   - customer/product demand uplift or erosion
   - working-day and holiday impact
   - budget or roll target constraint
   - supply or delivery risk
4. Produce at least three scenarios:
   - base case from the current AI forecast
   - target case showing what must change to hit budget or roll
   - risk case showing likely downside if weak backlog or volatile segments slip
5. Rank the smallest set of customer/product/month changes that explain or close the gap.

## Required outputs

- `forecast_month`
- `target_metric` such as Budget or Roll
- `current_ai_forecast`
- `target_gap`
- `required_backlog_conversion`
- `required_residual_demand`
- `top_gap_drivers`
- `scenario_name`
- `scenario_forecast`
- `scenario_probability`
- `explanation`

## Quality gates

- Mark a scenario `not_actionable` when it depends on segments already flagged `advisory_only`, `biased`, or `sparse` without human validation.
- Separate controllable levers from non-controllable statistical demand.
- Never present a single scenario as truth; show assumptions and sensitivity.
