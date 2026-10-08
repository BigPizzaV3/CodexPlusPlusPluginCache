---
name: powerbi-self-healing-forecast-governance
description: Use when Power BI forecast governance should automatically demote biased models, choose safer baselines, trigger data-quality blockers, adjust trust status, and protect planning from low-quality autonomous recommendations.
---

# Power BI Self-Healing Forecast Governance

Use this skill when the planning engine must know when not to trust itself.

## Trust states

- `trusted`: model can drive planning.
- `challenge`: model can challenge roll or budget but needs review.
- `advisory_only`: model is informative but should not replace baseline.
- `blocked`: data or quality issue prevents autonomous recommendation.
- `needs_snapshot_data`: historical as-of state is missing.
- `biased`: backtest bias exceeds tolerance.

## Workflow

1. Read quality metrics by horizon and segment.
2. Compare AI WAPE and bias against roll forecast and accepted tolerances.
3. Assign trust state by horizon, segment, customer, and product where possible.
4. Route planning:
   - trusted: use AI as primary input
   - challenge: show AI and baseline side by side
   - advisory_only: annotate only
   - blocked: require data fix or human review
5. Emit governance events so later runs can learn from demotions.

## Required outputs

- `forecast_month`
- `horizon_months`
- `segment`
- `ai_wape`
- `baseline_wape`
- `bias`
- `trust_state`
- `governance_action`
- `reason`

## Guardrails

- Do not improve apparent accuracy by hiding hard segments.
- Prefer a safer baseline when AI is worse than roll forecast.
