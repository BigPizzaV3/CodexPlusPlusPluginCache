---
name: scenario-simulation
description: Use for campaign what-if questions, budget or KPI forecasts, sensitivity analysis, and decision ranges where deterministic or probabilistic scenarios are more useful than a single point estimate.
---

# Scenario Simulation

Use simulation to expose decision ranges and sensitivity. Do not decorate weak assumptions with false precision.

## Choose the method

Use the simplest defensible method:

- deterministic scenario table for direct arithmetic changes
- sensitivity analysis when one or more assumptions drive the result
- bootstrap/resampling when representative historical observations are available
- Monte Carlo only when probability distributions or defensible uncertainty ranges can be specified

Use host-native Python when available for non-trivial calculations. Report the executed method and assumptions.

## Define the model

Specify:

- target metric and horizon
- starting state
- controllable inputs
- uncertain inputs
- constraints
- relationship assumptions
- number of simulations, if applicable

Do not silently assume that CPA, ROAS, CVR, or CPM remains constant as spend changes. If a constant-rate scenario is useful as a baseline, label it explicitly.

## Scenario set

Typically compare:

- base case
- conservative case
- expected/planning case
- upside case

For budget decisions, include the current allocation as a control scenario.

## Sensitivity

Identify which assumptions have the largest influence on the decision. If a small change in one uncertain parameter flips the recommendation, the answer should emphasize measurement rather than confidence.

## Output contract

Return:

- model and assumptions
- scenario results or distributions
- sensitivity drivers
- decision boundary
- what the model cannot infer
- next measurement that would reduce uncertainty most

A simulated result is not evidence that the future will occur. Keep observed data and modeled outcomes separate.
