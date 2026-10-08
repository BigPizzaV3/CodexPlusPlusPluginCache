---
name: decision-quality-gate
description: Use before finalizing high-impact marketing recommendations or whenever multiple analyses disagree, evidence is weak, causal language may be overstated, or a live campaign change is being considered.
---

# Decision Quality Gate

Review the recommendation, not just the prose.

## Gate checks

### Evidence integrity

- Are stated observations present in the supplied or retrieved data?
- Are calculations reproducible?
- Are time windows and metric definitions compatible?
- Are missing data and reporting lag acknowledged?

### Causal discipline

- Does the recommendation claim causality from correlation?
- Could attribution overlap or confounding reverse the conclusion?
- Is a modeled forecast being presented as observed fact?

### Decision economics

- Does the action align with the business objective rather than a proxy metric?
- Are margin, volume, capacity, and opportunity cost relevant?
- Is the proposed action material enough to matter but bounded enough to learn safely?

### Risk and reversibility

Classify the proposal:

- low-risk / reversible
- moderate-risk / reversible with monitoring
- high-impact / requires stronger evidence or staged rollout
- blocked / evidence or permissions insufficient

### Execution boundary

A plan is not an executed change. If the host provides a compatible write-capable app and the user explicitly authorizes the mutation, restate the exact change set before execution. Otherwise return a ready-to-execute plan only.

## Scorecard

Score each dimension `pass`, `warn`, or `fail`:

- evidence
- measurement
- causal claim
- expected economics
- risk
- reversibility
- authorization

Any `fail` on evidence, authorization, or a material causal claim blocks live execution.

## Output contract

Return gate result, warnings, blocked claims/actions, revised recommendation, and the minimum additional evidence needed to clear the gate.
