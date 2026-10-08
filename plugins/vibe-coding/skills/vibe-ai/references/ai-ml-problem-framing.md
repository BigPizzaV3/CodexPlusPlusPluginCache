# AI ML Problem Framing

## Operation

Analyze and return an actionable brief in the current conversation. Planning does not create a new assistant task or edit product code. Carry the full requested objective into the plan; separate independent work without silently discarding it.

## Goal

Determine whether the requested AI/ML/DS behavior is a well-defined product or decision problem before selecting a model, dataset, retrieval system, or evaluation stack.

## Framing method

1. Define actor, decision/action, unit of observation, prediction/generation time, allowed context, desired outcome, and unacceptable failure.
2. Name the simplest non-ML/manual/rule baseline and why ML or a model is warranted.
3. Define target/label or acceptable output, feedback delay, data availability at decision time, and leakage boundary.
4. Specify offline metrics, slices, uncertainty, thresholds/abstention, latency/cost/privacy/safety constraints, and online product outcome.
5. Choose human-in-the-loop, fallback, monitoring, rollback, and learning/feedback ownership.
6. State feasibility blockers rather than inventing data quality, model capability, or production volume.

- Ground repository facts with exact `path:line[-line]` anchors plus symbol when possible.
- Separate desired business outcome, observable user behavior, statistical objective, operational constraints, and assumptions.
- Reject an ML solution when deterministic logic, search, rules, or product changes satisfy the requirement more safely or cheaply.
- Do not invent data availability, labels, consent, latency, cost, or deployment guarantees.
