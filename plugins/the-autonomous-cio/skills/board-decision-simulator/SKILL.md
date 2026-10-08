---
name: board-decision-simulator
description: Simulate board reactions to approve, defer, approve with conditions or escalate options. Use when the user needs board decision simulator for CIO decision support.
---

# Board Decision Simulator

## Mission

Stress-test decision options against explicit executive concerns. Simulated objections
are hypothetical perspectives, not predictions of actual people's votes or beliefs.

## Inputs

Accept decision packets, options, board packs, missing evidence, risk chains and recommendations.

## Workflow

1. Read the [shared decision contract](../autonomous-cio-orchestrator/references/decision-contract.md).
2. Identify the decision, deadline, available options, approval authority, and source-backed constraints.
3. Compare approve, approve with conditions, defer, and stop when applicable. Explain exclusions.
4. Apply the persona criteria below, referencing claim IDs. Mark unsupported reactions as hypotheses.
5. For each option, give the hardest objection, strongest defensible response, missing evidence,
   approval condition, and the condition that would reverse the recommendation.
6. Recommend a draft board motion with an owner, evidence gate, review date, and escalation path.
   Use unknown for dates or owners not supplied. The motion does not constitute approval.

## Persona Criteria

| Persona | Decision criterion | Challenge |
|---|---|---|
| CEO | Strategic necessity, customer harm, execution capacity | What changes if we wait? |
| CFO | Affordable downside, cash timing, measurable benefit | Which costs are evidenced rather than assumed? |
| CISO | Exposure, control evidence, rollback, risk acceptance authority | What prevents an irreversible incident? |
| Audit | Traceable evidence, accountable sign-off, unresolved exceptions | Can we reconstruct why approval was reasonable? |

Use only relevant personas; add others when context warrants it. Do not assign
support percentages or confidence scores without the scoring gate's required model.

## Worked Example (Synthetic)

Inputs: S1 test lead update says integration testing has not started (C1, fact about
reported test status). S2 sponsor predicts Friday go-live (C2, assumption). No cost
of delay, rollback result, or approval owner is supplied (Q1-Q3).

Approve now: CISO challenge is untested failure recovery; a confident response is
not available from C1-C2. Gate: test and rollback evidence plus an authorized owner.
Conditional approval: can authorize preparation only, not a production release;
release remains blocked until gates are met. Defer: reduces immediate exposure,
but CFO needs cost-of-delay evidence before comparing financial impact. Stop:
insufficient strategic evidence to justify permanent cancellation.

Draft motion: defer the release decision pending test and rollback evidence; propose
the test lead as evidence contributor, with accountable approver and review date
to be confirmed. The recommendation changes when the required evidence is supplied.
No probability of board approval or financial loss can be computed from these inputs.

## Output Format

- Executive Summary
- Simulated Options
- Likely Board Reaction
- Main Objection
- Condition for Support
- Recommended Board Motion
- Weakest Point

## Guardrails

Simulation is directional and based only on provided context. Keep the main brief
within 450 words; place a detailed option/persona matrix in an appendix when requested.
