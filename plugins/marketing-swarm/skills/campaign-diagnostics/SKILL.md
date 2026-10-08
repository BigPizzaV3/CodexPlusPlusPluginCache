---
name: campaign-diagnostics
description: Use when paid-media performance changed, spend looks abnormal, delivery or pacing is off, or the user wants an account/campaign health diagnosis before choosing tactics.
---

# Campaign Diagnostics

Diagnose before prescribing tactics. Separate arithmetic changes from causal explanations.

## Inputs

Prefer campaign-level or lower-grain data with current and comparison periods. Useful fields include spend, impressions, reach, frequency, CPM, clicks, CTR, CPC, landing-page views, conversions, CVR, CPA, revenue/value, ROAS, budget, delivery status, audience size, attribution window, and creative/ad identifiers.

## Diagnostic sequence

### 1. Validate comparability

Check:

- same metric definitions and attribution settings
- same or comparable date length and day-of-week mix
- reporting lag and conversion latency
- major promotions, stock, price, website, tracking, or offer changes
- campaign structure or learning-phase changes

### 2. Decompose the KPI

For a CPA problem, inspect the chain:

`CPA = CPC / CVR`, while `CPC` is influenced by CPM and CTR.

For ROAS, inspect revenue/value per conversion as well as acquisition cost. A falling ROAS can come from traffic cost, conversion efficiency, basket/value changes, attribution shifts, or a mix of them.

Use Python for deterministic calculations when the host exposes it and the data volume warrants execution.

### 3. Detect risk patterns

Flag only when supported by data:

- overspend or underspend versus expected pacing
- abrupt CPM/CPC movement
- CTR or CVR deterioration
- high frequency paired with creative performance decay
- suspicious click/conversion spikes
- placement or geography concentration changes
- budget fragmentation or learning resets
- tracking gaps or metric discontinuities

Classify severity as `low`, `medium`, `high`, or `critical` based on magnitude, confidence, and business exposure. Do not label fraud from weak signals alone.

### 4. Rank explanations

For each explanation include:

- evidence supporting it
- evidence contradicting it
- confidence
- cheapest discriminating check

Avoid the common failure mode of converting correlation into a single-cause story.

## Output contract

Return:

1. health summary
2. metric decomposition
3. anomalies and severity
4. ranked explanations
5. immediate protections, if any
6. next checks/tests
7. data gaps

If there is a credible spend-loss condition, put the protective action first. A proposed pause, cap, exclusion, or budget change is still a recommendation until an authorized app executes it.
