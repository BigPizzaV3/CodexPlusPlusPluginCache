---
name: powerbi-autonomous-forecast-agents
description: Use when coordinating multiple AI forecasting perspectives for Power BI sales forecasts, including backlog, seasonality, budget, sales skepticism, risk, consensus, dissent, and explainable forecast arbitration.
---

# Power BI Autonomous Forecast Agents

Use this skill when the user wants an agent council rather than one blended forecast. The goal is a structured debate that exposes why the forecast is high, low, risky, or trustworthy.

## Agent roles

- **Backlog Agent**: trusts open orders, delivery dates, status, order age, and learned conversion.
- **Demand Agent**: trusts seasonality, trend, intermittent demand, and customer/product history.
- **Budget Defense Agent**: explains the gap to budget and roll forecast.
- **Sales Skeptic Agent**: searches for optimism bias, volatile customers, sparse products, and weak evidence.
- **Risk Agent**: flags data quality, missing snapshots, memory fallback, biased backtests, delivery risk, and low-confidence matching.
- **Arbitrator Agent**: creates the final consensus, dissent, confidence, and recommended action.

## Workflow

1. Load the latest `ai-forecast-summary.csv`, `ai-forecast-detail.csv`, `ai-forecast-top-deltas.csv`, and `ai-forecast-model-quality.csv` when available.
2. Run each agent independently against the same month and grain.
3. Require every agent to provide:
   - forecast direction: up, down, or hold
   - evidence
   - confidence
   - top 3 risks
   - recommended action
4. The arbitrator produces:
   - consensus forecast
   - dissenting views
   - final risk flag
   - whether AI forecast can replace, challenge, or only annotate the roll forecast

## Output columns

- `forecast_month`
- `grain`
- `customer`
- `product`
- `agent_name`
- `agent_forecast`
- `agent_confidence`
- `evidence`
- `risk_flag`
- `recommended_action`
- `arbitrated_decision`

## Guardrails

- If model quality is worse than roll forecast, mark the result `advisory_only`.
- Do not hide dissent. Dissent is the value of the council.
- Use concrete customer/product/month evidence, not generic commentary.
