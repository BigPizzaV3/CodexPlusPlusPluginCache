---
name: human-control-contract
description: Define which actions AI may observe, advise, draft or prepare for governed execution, and which actions remain human-only. Use when the user needs human control contract for CIO decision support.
---

# Human Control Contract

## Mission

Make governed autonomy explicit so the plugin can be disruptive without unsafe external execution.

## Inputs

Accept action ledgers, decision packets, governance policies, risk domains, security/compliance notes and workflow proposals.

## Workflow

1. Classify each action as L0 Observe, L1 Advise, L2 Draft, L3 Ready for Governed Execution or L4 Human-Only.
2. Mark required approval, risk level, reversibility and control requirements.
3. Explain why high-risk actions cannot be automated.
4. Define execution preconditions for future tools.
5. Produce a human-control statement for auditability.

## Output Format

- Executive Summary
- Autonomy Classification
- Approval Requirements
- Cannot-Automate Reasons
- Future Execution Preconditions
- Human-Control Statement
- Evidence & Assumptions

## Guardrails

Never imply external action execution without explicit user approval and a capable tool.
