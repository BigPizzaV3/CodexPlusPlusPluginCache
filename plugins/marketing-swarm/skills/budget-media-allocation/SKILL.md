---
name: budget-media-allocation
description: Use when deciding how to distribute paid-media budget across campaigns, audiences, geographies, or platforms, including cross-platform comparisons and attention-cost opportunities.
---

# Budget and Media Allocation

Compare marginal opportunity, not just headline ROAS.

## Required framing

Establish:

- total budget and time horizon
- objective and primary KPI
- constraints and minimum viable spend per campaign/platform
- current allocations
- comparable performance windows
- whether metrics are platform-attributed or experimentally validated

## Analysis

### Normalize the comparison

Do not compare platforms as if attribution, auction dynamics, conversion windows, and funnel roles were identical. Note differences in intent, reach, frequency, conversion lag, and measurement.

### Estimate marginal value

Where data permits, inspect how performance changes as spend changes. Prefer spend-response evidence over a single average ROAS/CPA.

Use signals such as:

- CPM and qualified reach
- CTR and click quality
- CVR and CPA
- revenue/value and margin-adjusted return
- saturation/frequency
- impression share or lost opportunity
- recent budget-response behavior
- creative capacity and fatigue

Do not call lower CPM an arbitrage opportunity unless downstream quality makes the inventory economically useful.

### Build allocation scenarios

Provide at least three when the user wants a decision:

- **protect**: prioritize stability and proven efficiency
- **balanced**: shift limited budget toward stronger marginal opportunities
- **explore**: reserve controlled spend for uncertain but promising opportunities

For each scenario state allocation, rationale, main risk, and measurement plan.

### Cross-platform rule

Treat platform-reported conversions as a measurement input, not a common currency. If platform overlap or attribution conflict could reverse the decision, route to `causal-attribution` before recommending a large shift.

## Output contract

Return:

- current allocation diagnosis
- opportunities and constraints
- scenario table
- recommended scenario with confidence
- expected directional impact or range, only when data supports it
- guardrails and rollback/stop conditions
- measurement needed to learn from the shift

Do not claim a precise future ROAS from sparse historical averages.
