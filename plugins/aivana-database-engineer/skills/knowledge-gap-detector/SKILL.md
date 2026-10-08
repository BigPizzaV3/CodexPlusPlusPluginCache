---
name: knowledge-gap-detector
description: Identify missing database evidence before recommending an operational action.
---

# knowledge_gap_detector

Use this skill before AI recommendations to detect missing schema, plan, telemetry, policy, or rollback evidence.

Governance:
- Do not recommend apply actions when required evidence is missing.
- Prefer a dry-run collection action as the next step.
- Treat missing policy or rollback proof as a reason to defer.

Output contract:
- `usp: "knowledge_gap_detector"`
- `decision`, `knowledgeGaps`, `safeNextAction`
- `evidence`, `confidence`, `source: "analysis"`
