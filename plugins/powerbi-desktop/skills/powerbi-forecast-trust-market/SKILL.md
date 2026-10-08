---
name: powerbi-forecast-trust-market
description: Use when designing or evaluating a Power BI forecast trust market, human override tracking, sales and finance confidence scoring, forecast accountability, and self-learning model-vs-human accuracy loops.
---

# Power BI Forecast Trust Market

Use this skill when the user wants the forecast to learn from human judgment, overrides, and organizational accuracy over time.

## Concept

Every forecast can receive confidence signals from AI, Sales, Finance, Supply Chain, and Management. Later actuals determine which source was calibrated and which source was biased.

## Workflow

1. For each forecast version, capture:
   - AI forecast
   - roll forecast
   - budget
   - human override
   - confidence percentage
   - reason code
   - owner or role
   - timestamp
2. After actuals arrive, calculate:
   - absolute error
   - bias
   - directional accuracy
   - calibration error
   - trust score by role, segment, customer, product, and horizon
3. Feed the trust score back into the next forecast cycle:
   - high-trust human input can challenge model output
   - low-trust input remains visible but gets lower weight
   - biased sources trigger review rather than automatic blending

## Suggested tables

- `AI_Forecast_Version`
- `AI_Forecast_Override`
- `AI_Forecast_Actuals`
- `AI_Forecast_TrustScore`

## Required metrics

- WAPE
- bias
- hit rate within tolerance
- override lift versus AI baseline
- override lift versus roll forecast
- confidence calibration

## Guardrails

- Do not turn trust scores into personal blame. Frame them as calibration by source and context.
- Preserve the original AI forecast and human override separately.
- Require reason codes for overrides that materially change the forecast.
