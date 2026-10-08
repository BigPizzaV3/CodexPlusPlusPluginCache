---
name: powerbi-planning-readiness-score
description: Use when scoring whether a Power BI model and forecast pipeline are ready for autonomous planning, including data quality, backlog snapshots, order-to-invoice matching, model accuracy, bias, granularity, constraints, overrides, and action tracking.
---

# Power BI Planning Readiness Score

Use this skill before allowing autonomous planning to drive decisions.

## Score dimensions

- data completeness
- order-to-invoice matching
- backlog snapshot availability
- forecast backtest quality
- bias control
- grain coverage
- constraint coverage
- human override tracking
- action tracking
- planning memory

## Workflow

1. Inspect available model fields, forecast CSVs, quality outputs, and memory/action files.
2. Score each dimension from 0 to 100.
3. Assign overall readiness:
   - `manual_only`: 0-39
   - `assisted`: 40-59
   - `controlled_autonomy`: 60-79
   - `autonomous_ready`: 80-100
4. List blockers and the next highest-leverage improvement.

## Required outputs

- `dimension`
- `score`
- `status`
- `evidence`
- `blocker`
- `recommended_next_step`

## Guardrails

- Do not mark autonomous-ready without historical backtests and snapshot coverage.
- Penalize missing constraints even when the revenue forecast looks accurate.
