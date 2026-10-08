---
name: analytics-measurement
description: Use when the user needs KPI design, tracking plans, events, UTMs, attribution, dashboards, campaign measurement, experiment readbacks, anomaly analysis, CAC/LTV/ROAS logic, or a way to connect marketing activity to business outcomes.
---

# Analytics and Measurement

## Use it for

- Measurement planning
- Tracking-plan design
- Attribution interpretation
- KPI trees and dashboards
- Performance readbacks and anomaly diagnosis

## Operating rules

- Use context already present in the conversation before asking for more input.
- Separate known facts, reasonable assumptions, and unknowns. Do not present assumptions as evidence.
- When the answer depends on current platform rules, market conditions, pricing, benchmarks, or competitors, verify them with current sources when tools are available.
- Prefer concrete decisions, examples, and next actions over generic marketing advice.
- Do not invent campaign performance, customer quotes, research findings, testimonials, rankings, or competitor claims.
- Keep the requested market, language, funnel stage, audience awareness, budget, and channel constraints visible throughout the work.
- Track for decisions, not because data can be collected.
- Define the business question before the metric.
- Keep platform, analytics, CRM, and finance measures distinct when they answer different questions.
- Do not reconcile conflicting numbers by averaging them.

## Workflow

1. Define the decision, business outcome, funnel model, time window, and source of truth.
2. Build a KPI tree from business outcome to leading indicators and diagnostics.
3. Specify events, properties, UTM rules, identities, and conversion definitions when tracking is in scope.
4. Identify attribution limits, missing data, and known biases.
5. Create readback format with baseline, candidate, segment, caveats, and verdict.
6. Set review cadence and anomaly thresholds appropriate to data volume.

## Output contract

- KPI tree
- Tracking or measurement plan
- Attribution caveats
- Dashboard/readback specification
- Decision rules

## Quality gate

- Every metric has a decision owner or use
- Definitions are unambiguous
- Data-source conflicts are surfaced
- Vanity metrics are not treated as business outcomes

## North Star and input metrics

When the user asks for a North Star Metric, choose one customer-value outcome that can act as a leading indicator of durable business value. Do not use a bundle of metrics and do not confuse the North Star with an OKR or a revenue target. Add a small set of input metrics that teams can influence and explain the causal hypothesis connecting each input to the North Star. Validate the choice against the business model, user value, controllability, measurability, and leading-indicator quality.

## Handoff

If the task is part of a larger marketing request, return the completed deliverable plus the evidence or decisions the next PrePilot skill needs. Do not repeat upstream analysis unless it changes the result.
