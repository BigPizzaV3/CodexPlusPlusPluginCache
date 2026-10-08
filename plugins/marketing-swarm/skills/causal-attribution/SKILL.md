---
name: causal-attribution
description: Use for attribution disputes, incrementality questions, causal claims, holdout or lift-test review, counterfactual analysis, and cases where platform-reported credit may not represent true business impact.
---

# Causal Attribution and Incrementality

Ask the causal question before choosing an attribution method.

## Start with the estimand

Define what the user is trying to know, for example:

- incremental conversions caused by a campaign
- incremental revenue from additional spend
- channel contribution versus organic/base demand
- effect of a creative or audience treatment
- likely result if a campaign were paused or budget changed

## Build a causal map

List exposure/treatment, outcome, important pre-treatment variables, plausible confounders, mediators, and colliders. Keep the map practical. The goal is to stop inappropriate adjustment and unsupported causal stories.

Common confounders can include seasonality, promotions, brand demand, geography, audience intent, inventory, price changes, CRM activity, and concurrent media.

## Evidence hierarchy

Prefer, where feasible:

1. randomized holdout / geo / audience experiment
2. credible quasi-experimental design
3. calibrated observational model with explicit assumptions
4. platform attribution or path models for descriptive credit

Do not treat multi-touch attribution as incrementality by default.

## Incrementality review

When test/control data is supplied, check:

- randomization or assignment mechanism
- contamination and spillover
- sample ratio issues
- pre-period balance
- outcome definition
- conversion lag
- statistical uncertainty
- business significance, not only p-values

Use Python for calculations when execution is available and the test requires it.

## Counterfactual questions

For what-if analysis, state the assumptions needed to estimate the unobserved alternative. If those assumptions are not credible, return a range or an experiment design instead of a false answer.

## Output contract

Return:

- causal question
- measurement design or current evidence type
- major confounders/bias risks
- what can be claimed
- what cannot be claimed
- incrementality estimate/range when supported
- recommended next experiment or validation

Use language such as `associated with`, `consistent with`, and `caused by` deliberately. They are not interchangeable.
