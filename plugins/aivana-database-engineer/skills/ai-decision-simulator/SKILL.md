---
name: ai-decision-simulator
description: Simulate database agent decisions against evidence, policy, and approval constraints.
---

# ai_decision_simulator

Use this skill to simulate how an AI database agent should decide under evidence, policy, and approval constraints.

Governance:
- Simulation only.
- No production apply or autonomous DDL.
- Human approval requirements always override dry-run readiness.

Output contract:
- `usp: "ai_decision_simulator"`
- `proposedAction`, `simulatedDecisions`, `decision`
- `evidence`, `confidence`, `source: "analysis"`
