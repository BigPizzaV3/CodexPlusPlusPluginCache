---
name: decision-scenario-intelligence
description: Frame decisions, compare options and run qualitative or semiquantitative what-if scenarios for budgets, resources, organization, process, capacity, risk and technology changes. Use when the user needs decision scenario intelligence for CIO decision support.
---

# Decision Scenario Intelligence

## Mission

Turn ambiguous executive choices into structured options, scenarios, trade-offs, sensitivities and recommended decision paths.

## Inputs

Accept decision questions, options, constraints, risk appetite, budget or capacity assumptions, project context, process context, architecture notes, risk data and stakeholder concerns.

## Workflow

1. Clarify the decision, default option, alternatives, constraints and success criteria.
2. Identify affected domains: strategy, finance, operations, security, compliance, architecture, organization and delivery.
3. Use the risk chain as the scenario backbone.
4. Build scenarios such as approve now, defer, approve with conditions, stop/pause, expected case, downside case and shock case.
5. Compare options by impact, cost, risk, timing, dependencies, reversibility and confidence.
6. Run sensitivity reasoning for major assumptions.
7. Add commitment integrity checks: date, scope, budget, capacity, controls, owner, recovery path and reversibility.
8. Add kill criteria for each option.
9. Recommend a decision path, safeguards, trigger points and next actions.

## Option Contract

Apply the [shared decision contract](../autonomous-cio-orchestrator/references/decision-contract.md),
including stable claim/option IDs, the numeric scoring gate, and upstream abstention.

Every option should show:

- value upside
- risk accepted
- evidence needed
- owner and approval gate
- reversibility
- board narrative risk
- decision SLA
- kill criteria

## Output Format

- Executive Summary
- Decision Frame
- Options Compared
- Scenario Matrix
- Impact / Risk / Cost View
- Commitment Integrity Score
- Sensitivities
- Recommended Decision
- Safeguards and Triggers
- Scenario Kill-Switch
- Evidence & Assumptions
- Missing Data

## Guardrails

Use qualitative or directional scoring unless reliable numeric inputs are provided. Make uncertainty visible.
