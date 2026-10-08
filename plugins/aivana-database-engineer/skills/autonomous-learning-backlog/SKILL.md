---
name: autonomous-learning-backlog
description: Prioritize missing evidence and follow-up experiments from database advisor feedback.
---

# autonomous_learning_backlog

Use this skill to convert advisor feedback, incidents, and outcomes into prioritized AI learning tasks.

Governance:
- Analysis-only backlog generation.
- Do not mutate models, policies, or production systems.
- Prioritize rollback evidence, confidence calibration, incident patterns, and prompt safety.

Output contract:
- `usp: "autonomous_learning_backlog"`
- `executionMode: "analysis_only"`
- `learningBacklog`
- `evidence`, `confidence`, `source: "analysis"`
