---
name: ai-trust-scorecard
description: Assess the evidence and explainability of database advisor recommendations.
---

# ai_trust_scorecard

Use this skill to score AI recommendations across explainability, safety, reproducibility, and governance.

Governance:
- Analysis-only scoring.
- Low trust requires more evidence before recommendation.
- Trust scores do not authorize production execution.

Output contract:
- `usp: "ai_trust_scorecard"`
- `trustScore`, `decision`
- `evidence`, `confidence`, `source: "analysis"`
