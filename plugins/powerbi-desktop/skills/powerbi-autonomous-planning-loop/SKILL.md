---
name: powerbi-autonomous-planning-loop
description: Use when building or running a closed-loop autonomous Power BI planning cycle that refreshes actuals, forecast, gap detection, scenarios, actions, tracking, learning, and the next plan without changing PBIX files directly.
---

# Power BI Autonomous Planning Loop

Use this skill when the user wants planning to run as a recurring control cycle rather than a one-time forecast.

## Loop

1. **Observe**: load actuals, open backlog, forecast outputs, model quality, overrides, and action status.
2. **Forecast**: run or reuse `Invoke-PowerBIAIForecast.ps1`.
3. **Detect**: identify gaps to budget, roll, prior year, and committed actions.
4. **Simulate**: create target, base, risk, and rescue scenarios.
5. **Decide**: classify items as trusted, challenge, rescue, de-risk, or advisory.
6. **Act**: create action records with owner hints, probability, impact, and due date.
7. **Learn**: compare outcomes to forecast and update trust, bias, and readiness signals.
8. **Repeat**: preserve a versioned run record for the next cycle.

## Required artifacts

- `planning-run-log.csv`
- `planning-gap-detection.csv`
- `planning-decisions.csv`
- `planning-learning-events.csv`

## Guardrails

- Keep every run immutable and timestamped.
- Never overwrite management numbers; store autonomous recommendations separately.
- Stop autonomous action recommendations when readiness is below threshold.
